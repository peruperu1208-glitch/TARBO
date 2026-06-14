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
  ├── ipcMain.handle で8本のハンドラーを登録
  └── BrowserWindow に preload.js を注入

Renderer (Vite + React)
  └── window.electronAPI.*  ← contextBridge 経由で IPC 呼び出し
```

開発時はメインが `http://localhost:5173` をロード。本番は `dist/index.html` をロード（`vite.config.js` の `base: './'` が必須）。
`app.whenReady()` の先頭で `Menu.setApplicationMenu(null)` を呼び出してメニューバーを非表示にしている。

### DB

- **エンジン**: sql.js（node-gyp 不要の WebAssembly 版 SQLite）
- **保存先**: `app.getPath('userData')/turbo.db`（バイナリをそのまま `fs.writeFileSync`）
- 書き込みのたびに `saveDb()` でファイルへ永続化
- スキーマは `initDatabase()` 内で `CREATE TABLE IF NOT EXISTS` で自動生成
- カラム追加は `ALTER TABLE ... ADD COLUMN` + `try/catch` でマイグレーション

#### tasks テーブル主要カラム

`id, project_id, title, description, status, priority, start_date, end_date, progress, comment`

- `status`: `'todo'` | `'in_progress'` | `'done'`（進捗率から自動設定: 0%=todo, 1-99%=in_progress, 100%=done）
- `priority`: `'low'` | `'medium'` | `'high'`

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

`get-tasks` / `create-task` / `update-task` は `tasks LEFT JOIN projects` した結果を返すため、レスポンスに `project_name` と `project_color` が含まれる。

### フロントエンド状態管理

`App.jsx` がすべての状態を保持し、子コンポーネントへ props で渡す（Zustand 等は未使用）。

- `selectedProjectId`: null = 全タスク表示、数値 = プロジェクトフィルター
- `view`: `'gantt'`（デフォルト）| `'list'`
- `theme`: `'light'` | `'dark'` — `data-theme` 属性に反映、`localStorage` の `turbo-theme` キーで永続化
- `completedProjectIds`: `useMemo` で算出した Set — 全タスクが `done` のプロジェクト ID 集合。Sidebar へ渡す
- `handleStatusChange`: status を `'done'` に変更する際は `progress: 100` も同時に設定
- `TaskModal` は `<main style={{ position: 'relative' }}>` の直下に `absolute inset-0` で配置（ヘッダーにかぶらない）

---

## UI スタイル規約

### ニューモーフィズムクラス（`src/index.css`）

CSS 変数 `--nm-bg / --nm-dark / --nm-light / --nm-text / --nm-muted / --nm-accent` をベースにした独自クラスを使う。インライン `box-shadow` の直書きは最小限にする。

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

- ライト: `--nm-bg: #e8edf2`、アクセント: `#4338ca`
- ダーク: `--nm-bg: #2a2d3e`、アクセント: `#6366f1`
- `[data-theme="dark"]` セレクタで上書き

### アイコン色規約

| 状態 | 色 |
|---|---|
| 完了（done）チェック | `#10b981`（緑） |
| 期限超過アラート | `#f59e0b`（アンバー） |
| 削除・危険操作 | `#ef4444`（赤） |

---

## 主要コンポーネントの設計メモ

### GanttChart.jsx

- 倍率（50/75/100/125/150%）で `CELL_W`・`ROW_H`・フォントサイズを一括スケール
- タスク名列幅は `labelBaseW` state（ベース幅）+ `scale` で `lw` を算出。`projects` が変わると canvas でプロジェクト名を計測し自動調整（オーバーヘッド 126px 加算、`LABEL_W` を下限）。ヘッダー右端ドラッグハンドルで手動リサイズも可能
- ドラッグ処理（タスクバー移動・リサイズ・列幅変更）は単一の `useEffect([], [])` で管理。クロージャー内で可変値を参照するため `cw`・`scale`・`viewStart`・`viewEnd` 等は必ず Ref で同期する
- `groupByProject=true`（全タスク表示時）は `projectGroups` useMemo でプロジェクト別ブロックに分割
  - ブロック背景: `${project.color}18`（約10%不透明度）
  - **折りたたみ**: `collapsedProjects`（Set）で管理。折りたたみ時はヘッダー行のみ表示し、グリッド側にプロジェクト全タスクの min(start_date)〜max(end_date) のサマリーバーを描画（`getProjectDateRange()` で算出）
  - **全完了チェック**: `allDone` をブロック内で算出し、ラベル列右端に緑チェックを表示
- タスク行ラベル列の右端アイコン（タイトル span に `flex-1 min-w-0` を付与して右寄せ）:
  - `status === 'done'` → 緑チェック（`#10b981`）、タイトルに取り消し線・ミュート色
  - `end_date < todayStr && status !== 'done'` → アンバー丸!アイコン（`#f59e0b`）、タイトルもアンバー色
  - ドラッグ中はアイコン非表示

### Sidebar.jsx

- 幅 260px
- **ロゴ**: ロケット SVG（機体・ポートホール・フィン・炎で構成、stroke スタイル）+ "TARBO"（font-weight 800）+ "TASK MANAGER"（サブテキスト）。コンテナは `nm-raised-sm` 40×40 radius 12px
- `sidebarMode` state: `'normal' | 'edit' | 'delete'`
- 「プロジェクト」ラベル行に `+`（追加）・鉛筆（編集モード）・ゴミ箱（削除モード）ボタンを左から順に配置（各 28×28px）
- モードが active の間はヒントテキストを表示。プロジェクト行クリック時の動作がモードに応じて変わる
- 削除は 2 回クリック確認（`confirmDeleteId` state）
- `completedProjectIds` prop（App.jsx から渡される Set）— 全タスク完了プロジェクトには緑チェックを右端に表示

### TaskModal.jsx

- **左側**からスライドインするドロワー形式（幅 400px）、バックドロップは右側の残り領域
- `absolute inset-0` で `<main>` を基準コンテナとしてスコープ（ヘッダーにかぶらない）
- `progress` 変更時に `progressToStatus()` で `status` を自動更新
- フォームフィールド: タイトル・説明・プロジェクト・優先度・開始日/終了日・進捗スライダー・コメント
- タイトルヘッダーのアイコンにはニューモーフィズムを適用しない

### TaskList.jsx

- かんばんボード形式（未着手 / 進行中 / 完了）
- 各カラムが独立スクロール: 親に `height: '100%', minHeight: 0`、カード領域に `flex: 1, minHeight: 0`
- **インライン編集**: `expandedId` state でクリックしたカードを展開。`card-expand` アニメーション（`scaleY(0)→(1)`、`transform-origin: top center`）+ アクセントアウトライン
- **ドラッグ&ドロップ**: HTML5 DnD API。完了カラムへドロップ時は `progress: 100` を自動設定
- コンパクトカードの右端アイコン（タイトル行、優先度バッジの右）:
  - `status === 'done'` → 緑チェック、タイトルに取り消し線
  - `isOverdue`（`end_date < todayStr && status !== 'done'`）→ アンバー丸!アイコン、タイトルもアンバー色

### Header.jsx

- 3カラム構成: 左＝プロジェクト名（`flex-1`）、中央＝ガント/リスト切り替えトグル、右＝スペーサー（`flex-1`）
