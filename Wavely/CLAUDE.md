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

**重要**: `electron/main.js` を変更した場合は Electron プロセスの再起動が必要（Vite HMR では反映されない）。

---

## アーキテクチャ

### プロセス構成

```
Electron Main (electron/main.js)
  ├── sql.js (WebAssembly SQLite) でDB操作
  ├── ipcMain.handle でハンドラーを登録
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

#### テーブル主要カラム

**projects**: `id, name, description, color, sort_order, archived`
- `archived INTEGER DEFAULT 0`: アーカイブ済みフラグ。`get-projects` は `archived=0` のみ返す

**tasks**: `id, project_id, parent_id, title, description, status, priority, start_date, end_date, progress, comment, sort_order`
- `status`: `'todo'` | `'in_progress'` | `'done'`（進捗率から自動設定: 0%=todo, 1-99%=in_progress, 100%=done）
- `priority`: `'low'` | `'medium'` | `'high'`
- `parent_id`: NULL = メインタスク、数値 = サブタスク（自己参照 FK）
- `sort_order`: ドラッグ&ドロップによる並び替え順

### IPC フロー

`preload.js` が `window.electronAPI` として以下を公開：

| メソッド | ハンドラー |
|---|---|
| `getProjects()` | `get-projects`（archived=0 のみ） |
| `getArchivedProjects()` | `get-archived-projects`（archived=1 のみ） |
| `createProject(data)` | `create-project`（sort_order を MAX+1 で末尾追加） |
| `updateProject(data)` | `update-project` |
| `deleteProject(id)` | `delete-project` |
| `archiveProject(id)` | `archive-project`（archived=1 に更新） |
| `unarchiveProject(id)` | `unarchive-project`（archived=0 に更新） |
| `getTasks(projectId\|null, includeArchived)` | `get-tasks`（includeArchived=false 時はアーカイブ済みプロジェクトのタスクを除外） |
| `createTask(data)` | `create-task` |
| `updateTask(data)` | `update-task` |
| `deleteTask(id)` | `delete-task` |
| `reorderProjects(ids[])` | `reorder-projects` |
| `reorderTasks(ids[])` | `reorder-tasks` |
| `getDbPath()` | `get-db-path` |
| `chooseDbFolder()` | `choose-db-folder`（ダイアログ → DB を新パスへ移動 → `config.json` 保存） |

`get-tasks` / `create-task` / `update-task` は `tasks LEFT JOIN projects` した結果を返すため、レスポンスに `project_name` と `project_color` が含まれる。

### フロントエンド状態管理

`App.jsx` がすべての状態を保持し、子コンポーネントへ props で渡す（Zustand 等は未使用）。

| state | 説明 |
|---|---|
| `selectedProjectId` | null = 全タスク表示、数値 = プロジェクトフィルター |
| `view` | `'gantt'`（デフォルト）\| `'list'` |
| `theme` | `'light'` \| `'dark'`。`localStorage['turbo-theme']` で永続化 |
| `projects` | アクティブ（非アーカイブ）プロジェクト一覧 |
| `archivedProjects` | アーカイブ済みプロジェクト一覧 |
| `showArchived` | アーカイブ表示トグル。true 時はサイドバーとガント/リストがアーカイブのみ表示 |
| `projectSearch` | サイドバープロジェクト絞り込み文字列（常時有効） |

**派生値（useMemo）**:
- `displayProjects`: `showArchived && !selectedProjectId` なら `archivedProjects`、そうでなければ `projects`。さらに `projectSearch` でフィルタリング
- `rootTasks`: `tasks.filter(t => !t.parent_id)`
- `displayRootTasks`: `selectedProjectId` あり → `rootTasks`そのまま。`showArchived` または `projectSearch` が有効なら `displayProjects` の id セットで絞り込み
- `completedProjectIds`: 全タスクが `done` のプロジェクト ID の Set

**データ取得**:
- `loadTasks` の依存: `[selectedProjectId, showArchived]`
- `showArchived && !selectedProjectId` の場合 `includeArchived=true` でアーカイブ済みタスクも取得

**サブタスク連動**:
- サブタスクの日付変更 → 親タスクの日付を自動調整（`handleUpdateTask` / `handleSubtaskCreate`）
- 全サブタスクが done → 親タスクも `done` / `progress: 100` に自動更新

`TaskModal` は `<main style={{ position: 'relative' }}>` の直下に `absolute inset-0` で配置（ヘッダーにかぶらない）。

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

| クラス | 用途 |
|---|---|
| `nm-raised` / `nm-raised-sm` / `nm-raised-xs` | 浮き上がりカード・ボタン |
| `nm-pressed` / `nm-pressed-sm` / `nm-pressed-xs` | 凹み領域・バッジ・トグルコンテナ |
| `nm-btn` | 標準ボタン |
| `nm-btn-primary` | 主要アクションボタン（文字色 `--nm-accent`） |
| `nm-btn-danger` | 削除ボタン（赤グラデーション背景） |
| `nm-input` / `nm-select` | フォーム要素 |

### 角丸・テーマ・フォント

- **`border-radius: 8px` に統一**。例外: プログレスバー・ピル → `999px`、円形ドット → `50%`
- ライト: `--nm-bg: #e0e5ec`、アクセント: `#4338ca` / ダーク: `--nm-bg: #2a2d3e`、アクセント: `#6366f1`
- UI 全体: `'Noto Sans JP'` / ロゴ: `'Bebas Neue'`（letterSpacing 0.15em）

### アイコン色規約

| 状態 | 色 |
|---|---|
| 完了（done）チェック | `#10b981`（緑） |
| 期限超過アラート | `#f59e0b`（アンバー） |
| 削除・危険操作 | `#ef4444`（赤） |
| アーカイブ操作 | `#f59e0b`（アンバー） |

---

## 主要コンポーネントの設計メモ

### GanttChart.jsx

- 基本定数: `CELL_W=32`, `ROW_H=40`, `LABEL_W=180`（100% 倍率時の基準サイズ）
- 倍率（50/75/100/125/150%）と表示日数（30/60/90日）は `localStorage` から初期値を読み、`CustomEvent('turbo-gantt-settings')` でリアルタイム更新
- **左方向パン**: `extraLeft` state でグリッドを左方向に拡張（`displayStart = addDays(viewStart, -extraLeft)`）。`viewStart` をシフトする方式ではなく、グリッド幅を増やす方式で無限スクロールを実現
- **パンジャンプ防止**: `skipNextDelta` フラグ（React 再レンダリング後の stale `prevX` を読み飛ばす）+ `useLayoutEffect([displayStart])` でスクロール補正
- **パンロック防止**: mousemove で `e.buttons === 0` をチェック。`onMouseDown` で `e.button !== 0` を除外
- ドラッグ処理（バー移動・リサイズ・列幅変更）は単一の `useEffect([], [])` で管理。クロージャー内で可変値を参照するため `cw`・`scale`・`viewStart`・`viewEnd` 等は必ず Ref で同期する
- **ステータスフィルター**: `statusFilter`（`Set<string>`）で複数選択可能。空 Set = 全表示
- `groupByProject=true`（全タスク表示時）: プロジェクトブロックの wrapper に `overflow: hidden` を付けると `position: sticky` が壊れるため不可
- **折りたたみ**: `collapsedProjects`（プロジェクト単位）/ `collapsedTaskIds`（サブタスク単位）の Set で管理
- **スティッキー列**: `position: sticky; left: 0; z-index: 15`。プロジェクトブロックは `backgroundColor + backgroundImage` でプロジェクト色ティントを再現
- **当日列**: 縦線なし。当日セルの背景を `rgba(14,165,233,0.25)` で塗る

### Sidebar.jsx

- 幅 260px。**固定ヘッダー**（`flex-shrink-0`）+ **スクロール対象リスト**（`flex-1 overflow-y-auto`）の2分割構造
- 固定ヘッダー内: ラベル・操作ボタン行・絞り込み検索ボックス・モードヒント
- **操作モード** (`sidebarMode`): `'normal' | 'edit' | 'archive'`
  - edit: クリックで `onEditProject` 呼び出し
  - archive: 2回クリックで `onArchiveProject`（`confirmArchiveId` state）
- **アーカイブ表示トグル** (`showArchived`): App.jsx で管理し prop で受け取る
  - OFF: 通常プロジェクト一覧 + ALL・+・鉛筆・アーカイブボタン
  - ON: アーカイブ済みプロジェクト一覧 + 復元・完全削除ボタン（`archivedMode: 'normal'|'restore'|'delete'`）
- **ALL ボタン**: 全タスク表示（`selectedProjectId=null`）への切り替え。Bebas Neue フォント
- **絞り込み検索**: `projectSearch` prop（App.jsx 管理）。プロジェクト選択中も有効。×ボタンは `position: absolute` で配置
- プロジェクト行はドラッグ&ドロップで並び替え可能（normal モード時のみ）
- フッター: アーカイブ表示ボタン（左）+ テーマ切り替えボタン（右）
- `showArchived` 切り替え時に `useEffect` でモード・検索・確認状態をリセット

### TaskModal.jsx

- **左側**からスライドインするドロワー形式（幅 400px）
- `absolute inset-0` で `<main>` を基準コンテナとしてスコープ
- **オートフォーカス**: 新規作成 → タイトル入力欄、編集 → コメント入力欄（`useRef` + `useEffect([], [])`）
- `progress` 変更時に `progressToStatus()` で `status` を自動更新
- 削除は 2 回クリック確認（`confirmDelete` state）

### ProjectModal.jsx

- センター配置のモーダル（幅 360px）
- **オートフォーカス**: プロジェクト名入力欄に `autoFocus`（新規・編集共通）

### TaskList.jsx

- かんばんボード形式（未着手 / 進行中 / 完了）
- 各カラムが独立スクロール: 親に `height: '100%', minHeight: 0`、カード領域に `flex: 1, minHeight: 0`
- **ドラッグ&ドロップ**: HTML5 DnD API。完了カラムへドロップ時は `progress: 100` を自動設定
- 表示対象はメインタスクのみ（`rootTasks`）。サブタスクはカード内部にインライン表示

### Header.jsx

- 3カラム構成: 左＝プロジェクト名 + タスク数バッジ（`flex-1`）、中央＝ガント/リスト切り替えトグル、右＝設定ボタン（`flex-1 justify-end`）

### SettingsModal.jsx

- **右側**からスライドインするドロワー形式（幅 360px、`drawer-enter-right` クラス）。`fixed inset-0 z-50`
- ガント設定変更時は `localStorage` に保存 + `CustomEvent('turbo-gantt-settings')` を発火してリアルタイム反映

### SplashScreen.jsx

- `fixed inset-0 z-[200]` で全画面に重なる動画スプラッシュ
- `public/splash.mp4` を再生。再生終了 or エラー or 30秒タイムアウトでフェードアウト → `onDone()` 呼び出し
