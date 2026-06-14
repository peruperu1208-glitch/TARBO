---
description: Wavely アプリの開発支援。コンポーネント追加・修正時の設計指針とコーディング規約を提供する。
---

# Wavely 開発スキル

このプロジェクトは **Electron + Vite + React + sql.js + Tailwind CSS** で構築された個人業務管理デスクトップアプリです。
以下の規約・パターンに従って実装してください。

---

## 技術スタック

| レイヤー | 技術 |
|---|---|
| デスクトップ | Electron |
| フロントエンド | React (Vite) |
| DB | sql.js (WebAssembly版 SQLite) |
| スタイル | Tailwind CSS + カスタムニューモーフィズム CSS |
| 日付処理 | date-fns v3 |
| IPC | contextBridge / ipcMain.handle / ipcRenderer.invoke |

---

## ニューモーフィズム CSS クラス

すべての UI 要素はカスタムクラスでスタイリングする。`--nm-bg: #e0e5ec`（ライト）/ `#2a2d3e`（ダーク）がベース。

| クラス | 用途 |
|---|---|
| `nm-raised` | カード・パネルなど浮き上がり（大） |
| `nm-raised-sm` | 中程度の浮き上がり |
| `nm-raised-xs` | 小さい浮き上がり・アクティブボタン |
| `nm-pressed` | 凹み領域（大）・トグルコンテナ |
| `nm-pressed-sm` | 凹み領域（中） |
| `nm-pressed-xs` | バッジ・小さい凹み |
| `nm-btn` | 通常ボタン |
| `nm-btn-primary` | 主要アクションボタン（青紫） |
| `nm-btn-danger` | 削除ボタン（赤） |
| `nm-input` | テキスト入力 |
| `nm-select` | セレクトボックス |
| `nm-nav-active` | サイドバーのアクティブナビ項目 |

### 角丸の統一ルール
- **すべての角丸は `border-radius: 8px`** で統一（CSS クラス・インラインスタイル共通）
- 進捗バー・ピルなど意図的に丸くする要素は `border-radius: 999px`
- 円形ドットは `border-radius: 50%`
- **ネスト時のルール**: コンテナの `border-radius` − パディング = 内側要素の `border-radius`
  - 例：`nm-pressed`（8px）に `p-1`（4px）→ 内側ボタンは `borderRadius: 4`

### ダーク/ライトモード
- `document.documentElement` の `data-theme` 属性で切り替え（`"dark"` / `"light"`）
- テーマ設定は `localStorage` の `wavely-theme` キーで永続化
- CSS変数はすべて `var(--nm-*)` 経由で参照するため、追加コンポーネントも自動対応

---

## データモデル

```
projects: id, name, description, color
tasks:    id, project_id, title, description, status, priority,
          start_date, end_date, progress, created_at
          + (JOIN) project_name, project_color
```

- `status`: `'todo'` | `'in_progress'` | `'done'`
- `priority`: `'low'` | `'medium'` | `'high'`
- `progress`: 0〜100（整数）
- 日付: `'yyyy-MM-dd'` 形式の文字列

---

## IPC API（`window.electronAPI`）

```js
getProjects()
createProject(data)
updateProject(data)
deleteProject(id)

getTasks(projectId)          // null で全タスク
createTask(data)
updateTask(data)
deleteTask(id)
```

---

## コンポーネント構成

```
src/
  App.jsx                          # ルート。theme/view/modal 状態管理
  components/
    Header.jsx                     # ガント/リスト切り替え・新規タスクボタン
    Sidebar.jsx                    # プロジェクト一覧・ダークモード切替
    gantt/
      GanttChart.jsx               # ガントチャート本体（倍率・ドラッグ対応）
    tasks/
      TaskList.jsx                 # かんばんボード（未着手|進行中|完了）
      TaskModal.jsx                # タスク作成・編集ドロワー
    projects/
      ProjectModal.jsx             # プロジェクト作成・編集モーダル
```

---

## 実装パターン

### レイアウト（高さ管理）
```jsx
// 親から子へ高さを渡す際は必ず minHeight: 0 を指定
<div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
  <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>...</div>
</div>
```

### stale closure 回避（GanttChart）
ドラッグ処理など `useEffect` 内で最新の state/props が必要な場合は Ref で同期する。
```jsx
const cwRef = useRef(cw)
useEffect(() => { cwRef.current = cw }, [cw])
// useEffect([], []) の中では cwRef.current を参照
```

### タスク新規作成のデフォルト日付
```js
const today = new Date()
const weekLater = new Date(today)
weekLater.setDate(today.getDate() + 7)
start_date: toDateStr(today)
end_date:   toDateStr(weekLater)
```

### ガントチャート 倍率スケール
```js
const ZOOM_LEVELS = [50, 75, 100, 125, 150]
const scale = zoom / 100
const cw  = Math.round(CELL_W  * scale)   // セル幅
const rh  = Math.round(ROW_H   * scale)   // 行高さ
const lw  = Math.max(110, Math.round(LABEL_W * scale))  // ラベル幅
const fSm = Math.max(10, Math.round(14 * scale))        // フォントサイズ
```

### プロジェクト別グループ（全タスク表示時）
`groupByProject={!selectedProjectId}` を GanttChart と TaskList に渡す。
GanttChart 内の `projectGroups` useMemo がプロジェクト単位に分割して表示する。

---

## コーディング規約

- 日本語で回答・コメントを書く
- コメントは WHY が自明でない場合のみ記述
- `border-radius` の数値は 8 に統一（例外: 999px, 50%）
- ニューモーフィズムの影は CSS クラスを使い、インラインの `box-shadow` は最小限に
- 新しいモーダル/ドロワーは `TaskModal.jsx` のパターン（右端からスライドイン）を踏襲
- 新しいページ/ビューは `App.jsx` の `view` state で分岐して追加