# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 役割・目標

業務支援エンジニア向けの個人タスク管理 + ガントチャートデスクトップアプリ「TARBO」の開発。
**日本語で回答すること。**

---

## コマンド

```bash
npm run dev    # Vite（ポート5173）と Electron を同時起動（開発）
npm run build  # Vite で dist/ にビルド
npm run dist   # ビルド → electron-builder で release/ にインストーラー生成（Windows: NSIS）
```

テストフレームワークは未導入。

---

## アーキテクチャ

### プロセス構成

```
Electron Main (electron/main.js)
  ├── sql.js (WebAssembly SQLite) でDB操作
  ├── ipcMain.handle で12本のハンドラーを登録
  └── BrowserWindow に preload.js を注入

Renderer (Vite + React)
  └── window.electronAPI.*  ← contextBridge 経由で IPC 呼び出し
```

開発時はメインが `http://localhost:5173` をロード。本番は `dist/index.html` をロード（`vite.config.js` の `base: './'` が必須）。
`app.whenReady()` の先頭で `Menu.setApplicationMenu(null)` を呼び出してメニューバーを非表示にしている。

### DB

- **エンジン**: sql.js（node-gyp 不要の WebAssembly 版 SQLite）
- **保存先**: `app.getPath('userData')/turbo.db`（バイナリをそのまま `fs.writeFileSync`）
- カスタム保存先は `config.json`（同じ userData）の `dbPath` キーで永続化。起動時に存在確認して切り替え
- 書き込みのたびに `saveDb()` でファイルへ永続化
- スキーマは `initDatabase()` 内で `CREATE TABLE IF NOT EXISTS` で自動生成
- カラム追加は `ALTER TABLE ... ADD COLUMN` + `try/catch` でマイグレーション

#### tasks テーブル主要カラム

`id, project_id, parent_id, title, description, status, priority, start_date, end_date, progress, comment, sort_order`

- `status`: `'todo'` | `'in_progress'` | `'done'`（進捗率から自動設定: 0%=todo, 1-99%=in_progress, 100%=done）
- `priority`: `'low'` | `'medium'` | `'high'`
- `parent_id`: NULL = メインタスク、数値 = サブタスク（自己参照 FK）
- `sort_order`: ドラッグ&ドロップによる並び替え順（`projects` テーブルにも同カラムあり）
- `App.jsx` が `rootTasks = tasks.filter(t => !t.parent_id)` をビューに渡す。`allTasks` も別途渡す
- サブタスクの開始日・終了日変更時、`handleUpdateTask` / `handleSubtaskCreate` で親タスクの日付を自動調整
- 全サブタスクが done になった時点で親タスクも `done` / `progress: 100` に自動更新

### IPC フロー

`preload.js` が `window.electronAPI` として以下を公開：

| メソッド | ハンドラー |
|---|---|
| `getProjects()` | `get-projects` |
| `createProject(data)` | `create-project` |
| `updateProject(data)` | `update-project` |
| `deleteProject(id)` | `delete-project` |
| `getTasks(projectId\|null)` | `get-tasks`（null で全件） |
| `createTask(data)` | `create-task` |
| `updateTask(data)` | `update-task` |
| `deleteTask(id)` | `delete-task` |
| `reorderProjects(ids[])` | `reorder-projects`（id 配列の順序で `sort_order` を更新） |
| `reorderTasks(ids[])` | `reorder-tasks`（id 配列の順序で `sort_order` を更新） |
| `getDbPath()` | `get-db-path` |
| `chooseDbFolder()` | `choose-db-folder`（ダイアログ → DB を新パスへ移動 → `config.json` 保存） |

`get-tasks` / `create-task` / `update-task` は `tasks LEFT JOIN projects` した結果を返すため、レスポンスに `project_name` と `project_color` が含まれる。

### フロントエンド状態管理

`App.jsx` がすべての状態を保持し、子コンポーネントへ props で渡す（Zustand 等は未使用）。

- `selectedProjectId`: null = 全タスク表示、数値 = プロジェクトフィルター
- `view`: `'gantt'`（デフォルト）| `'list'`
- `theme`: `'light'` | `'dark'` — `data-theme` 属性に反映、`localStorage` の `turbo-theme` キーで永続化
- `projectSearch`: 全タスク表示時のサイドバープロジェクト絞り込み文字列
- `completedProjectIds`: `useMemo` で算出した Set — 全タスクが `done` のプロジェクト ID 集合。Sidebar へ渡す
- `displayRootTasks`: `projectSearch` が有効な場合にフィルター済みプロジェクトのタスクのみ含む（GanttChart に渡す）。`selectedProjectId` が非 null または検索なしの場合は `rootTasks` と同値
- `handleStatusChange`: status を `'done'` に変更する際は `progress: 100` も同時に設定
- `TaskModal` は `<main style={{ position: 'relative' }}>` の直下に `absolute inset-0` で配置（ヘッダーにかぶらない）

### localStorage キー

| キー | 用途 | デフォルト |
|---|---|---|
| `turbo-theme` | ライト/ダークテーマ | `'light'` |
| `turbo-zoom` | ガントチャート表示倍率（50/75/100/125/150） | `100` |
| `turbo-days` | ガントチャート表示日数（30/60/90） | `60` |

ガントの設定変更は `SettingsModal` が `CustomEvent('turbo-gantt-settings', { detail: { zoom, daysToShow } })` を発火し、`GanttChart` 内の `useEffect` が `window.addEventListener` で受け取る。

---

## UI スタイル規約

### ニューモーフィズムクラス（`src/index.css`）

CSS 変数 `--nm-bg / --nm-dark / --nm-light / --nm-text / --nm-muted / --nm-accent / --nm-line` をベースにした独自クラスを使う。インライン `box-shadow` の直書きは最小限にする。

- `--nm-line`: グリッド罫線色（ライト: `rgba(100,116,139,0.28)`、ダーク: `rgba(163,177,198,0.22)`）

| クラス | 用途 |
|---|---|
| `nm-raised` / `nm-raised-sm` / `nm-raised-xs` | 浮き上がりカード・ボタン |
| `nm-pressed` / `nm-pressed-sm` / `nm-pressed-xs` | 凹み領域・バッジ・トグルコンテナ |
| `nm-btn` | 標準ボタン（`--nm-bg` ベース、浮き上がりシャドウ） |
| `nm-btn-primary` | 主要アクションボタン（`nm-btn` と同形状、文字色 `--nm-accent`） |
| `nm-btn-danger` | 削除ボタン（赤グラデーション背景） |
| `nm-input` / `nm-select` | フォーム要素 |

### 角丸

- **`border-radius: 8px` に統一**（CSS クラス・インライン共通）
- 例外: プログレスバー・ピル形状 → `999px`、円形ドット → `50%`

### テーマ

- ライト: `--nm-bg: #e0e5ec`、アクセント: `#4338ca`
- ダーク: `--nm-bg: #2a2d3e`、アクセント: `#6366f1`
- `[data-theme="dark"]` セレクタで上書き

### フォント

- UI 全体: `'Noto Sans JP'`（Google Fonts）
- TARBO ロゴ: `'Bebas Neue'`（Google Fonts）、`letterSpacing: '0.15em'`
- `src/index.css` 冒頭の `@import url(...)` で両フォントを読み込み

### アイコン色規約

| 状態 | 色 |
|---|---|
| 完了（done）チェック | `#10b981`（緑） |
| 期限超過アラート | `#f59e0b`（アンバー） |
| 削除・危険操作 | `#ef4444`（赤） |

---

## 主要コンポーネントの設計メモ

### GanttChart.jsx

- 倍率（50/75/100/125/150%）と表示日数（30/60/90日）は `localStorage` から初期値を読み、`CustomEvent('turbo-gantt-settings')` でリアルタイム更新
- 倍率で `CELL_W`・`ROW_H`・フォントサイズを一括スケール
- タスク名列幅は `labelBaseW` state（ベース幅）+ `scale` で `lw` を算出。`projects` が変わると canvas でプロジェクト名を計測し自動調整（オーバーヘッド 126px 加算、`LABEL_W` を下限）。ヘッダー右端ドラッグハンドルで手動リサイズも可能
- ドラッグ処理（タスクバー移動・リサイズ・列幅変更）は単一の `useEffect([], [])` で管理。クロージャー内で可変値を参照するため `cw`・`scale`・`viewStart`・`viewEnd` 等は必ず Ref で同期する
- `groupByProject=true`（全タスク表示時）は `projectGroups` useMemo でプロジェクト別ブロックに分割
  - ブロック背景: `${project.color}18`（約10%不透明度）
  - プロジェクトブロックの wrapper に `overflow: hidden` を付けると `position: sticky` が壊れるため削除済み
  - **折りたたみ（プロジェクト）**: `collapsedProjects`（Set）で管理。折りたたみ時はヘッダー行のみ表示し、グリッド側にサマリーバーを描画（`getProjectDateRange()` で算出）
  - **折りたたみ（タスク）**: `collapsedTaskIds`（Set）でサブタスク行の表示制御
  - **全折りたたみ/全展開**: `renderDateHeader` の「タスク名」ヘッダーセル内の ▼/▶ ボタンが `isAllCollapsed` 状態で切り替わる
  - **全完了チェック**: `allDone` をブロック内で算出し、ラベル列右端に緑チェックを表示
- **スティッキー列**: タスク名列は `position: sticky; left: 0; z-index: 15; background: var(--nm-bg)` で横スクロール時も固定。プロジェクトブロックのラベルは `backgroundColor + backgroundImage` の重ね合わせでプロジェクト色の透明ティントを再現
- **当日列**: 縦線なし。当日セルの背景を `rgba(14,165,233,0.25)`（スカイブルー）で塗る
- **バー透明度**: 完了バーは `opacity: 0.75`、それ以外は `opacity: 0.85` で統一
- タスク行ラベル列の右端アイコン（タイトル span に `flex-1 min-w-0` を付与して右寄せ）:
  - `status === 'done'` → 緑チェック（`#10b981`）、タイトルに取り消し線・ミュート色
  - `end_date < todayStr && status !== 'done'` → アンバー丸!アイコン（`#f59e0b`）、タイトルもアンバー色
  - ドラッグ中はアイコン非表示

### Sidebar.jsx

- 幅 260px
- **ロゴ**: "TARBO" テキスト（Bebas Neue、30px、letterSpacing 0.15em、テキストシャドウでニューモーフィズム風）
- `sidebarMode` state: `'normal' | 'edit' | 'delete'`
- 「プロジェクト」ラベル行に `+`（追加）・鉛筆（編集モード）・ゴミ箱（削除モード）ボタンを左から順に配置（各 28×28px）
- モードが active の間はヒントテキストを表示。プロジェクト行クリック時の動作がモードに応じて変わる
- 削除は 2 回クリック確認（`confirmDeleteId` state）
- プロジェクト行はドラッグ&ドロップで並び替え可能（normal モード時のみ）。ドロップ上下でインジケーターバーを表示
- `completedProjectIds` prop（App.jsx から渡される Set）— 全タスク完了プロジェクトには緑チェックを右端に表示
- フッターにテーマ切り替えボタン（38×38px）

### TaskModal.jsx

- **左側**からスライドインするドロワー形式（幅 400px）、バックドロップは右側の残り領域
- `absolute inset-0` で `<main>` を基準コンテナとしてスコープ（ヘッダーにかぶらない）
- `progress` 変更時に `progressToStatus()` で `status` を自動更新
- フォームフィールド: タイトル・説明・プロジェクト・親タスク（既存タスクがある場合のみ）・優先度・開始日/終了日・進捗スライダー・コメント
- タイトルヘッダーのアイコンにはニューモーフィズムを適用しない
- 削除は 2 回クリック確認（`confirmDelete` state）

### TaskList.jsx

- かんばんボード形式（未着手 / 進行中 / 完了）
- 各カラムが独立スクロール: 親に `height: '100%', minHeight: 0`、カード領域に `flex: 1, minHeight: 0`
- **インライン編集**: `expandedId` state でクリックしたカードを展開。`card-expand` アニメーション（`scaleY(0)→(1)`、`transform-origin: top center`）+ アクセントアウトライン
- **ドラッグ&ドロップ**: HTML5 DnD API。完了カラムへドロップ時は `progress: 100` を自動設定
- **表示対象はメインタスクのみ**（`rootTasks`）。サブタスクはカード内部にインライン表示
- **KanbanCard** は `subtasks` 配列（`allTasks.filter(t => t.parent_id === task.id)`）を受け取り、カード下部にサブタスクリストを描画
  - タイトル行: 完了/期限超過アイコン（左）→ タスク名（`flex-1`）→ プロジェクト名ラベル（右）
  - フッター: 「サブタスク X/X」バッジ（`nm-pressed-xs`）または「サブタスクなし」テキスト（font-size 11）
  - サブタスクリスト: `└` インデント、クリックで `onEdit(sub)` を呼び出す
- タスクモーダルタイトル: メインタスク編集 = `'メインタスクを編集'`、サブタスク = `'サブタスクを編集'`（`task.parent_id` で分岐）

### Header.jsx

- 3カラム構成: 左＝プロジェクト名 + タスク数バッジ（`flex-1`）、中央＝ガント/リスト切り替えトグル、右＝設定ボタン（歯車、`flex-1 justify-end`）
- 設定ボタンが `onOpenSettings` を呼び出して `SettingsModal` を開く

### SettingsModal.jsx

- **右側**からスライドインするドロワー形式（幅 360px、`drawer-enter-right` クラス）。`fixed inset-0 z-50` で全画面オーバーレイ
- 設定項目: 表示テーマ / デフォルト表示倍率（ガント）/ デフォルト表示日数（ガント）/ データベース保存先
- ガント設定変更時は `localStorage` に保存 + `CustomEvent('turbo-gantt-settings')` を発火してリアルタイム反映
- DB フォルダ変更は `window.electronAPI.chooseDbFolder()` を呼び出し。変更後は現在 DB を新パスへ移動（IPC 側で実行）

### SplashScreen.jsx

- `fixed inset-0 z-[200]` で全画面に重なる動画スプラッシュ
- `public/splash.mp4` を `<video autoPlay muted playsInline>` で再生。再生終了時 or エラー時にフェードアウト開始
- 30 秒のフォールバックタイマーあり（動画が読み込めない環境向け）
- フェードアウトは `splash-fadeout` CSS アニメーション。`animationEnd` イベントで `onDone()` を呼び出して `App.jsx` の `showSplash` を false にする
