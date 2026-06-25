import { useState, useEffect, useRef } from 'react'

function toDateStr(date) {
  return date.toISOString().slice(0, 10)
}

export default function TaskModal({ task, tasks = [], projects, defaultProjectId, defaultStatus = 'todo', onSave, onDelete, onClose }) {
  const today = new Date()
  const weekLater = new Date(today)
  weekLater.setDate(today.getDate() + 7)

  const [form, setForm] = useState({
    title: '',
    description: '',
    project_id: defaultProjectId || projects[0]?.id || null,
    parent_id: null,
    status: defaultStatus,
    priority: 'medium',
    start_date: toDateStr(today),
    end_date: toDateStr(weekLater),
    progress: 0,
    comment: '',
  })
  const [confirmDelete, setConfirmDelete] = useState(false)
  const titleRef = useRef(null)
  const commentRef = useRef(null)

  useEffect(() => {
    if (task) {
      commentRef.current?.focus()
    } else {
      titleRef.current?.focus()
    }
  }, [])

  useEffect(() => {
    if (task) {
      setForm({
        ...task,
        parent_id: task.parent_id || null,
        start_date: task.start_date || '',
        end_date: task.end_date || '',
        progress: task.progress || 0,
        comment: task.comment || '',
      })
    }
  }, [task])

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }))
  const setVal = (key) => (val) => setForm(f => ({ ...f, [key]: val }))

  const progressToStatus = (p) => p === 0 ? 'todo' : p === 100 ? 'done' : 'in_progress'

  const handleProgressChange = (p) => {
    setForm(f => ({ ...f, progress: p, status: progressToStatus(p) }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    onSave({
      ...form,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      progress: Number(form.progress),
    })
  }

  const PRIORITY_OPTIONS = [
    { value: 'low',    label: '低', color: '#10b981' },
    { value: 'medium', label: '中', color: '#f59e0b' },
    { value: 'high',   label: '高', color: '#ef4444' },
  ]

  const STATUS_OPTIONS = [
    { value: 'todo',        label: '未着手' },
    { value: 'in_progress', label: '進行中' },
    { value: 'done',        label: '完了'   },
  ]

  return (
    <div className="absolute inset-0 z-50 flex">
      {/* ドロワーパネル（左側） */}
      <div
        className="nm-drawer-panel drawer-enter flex flex-col h-full"
        style={{ width: 400, flexShrink: 0 }}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center"
              style={{ width: 32, height: 32 }}
            >
              <svg className="w-4 h-4" style={{ color: 'var(--nm-accent)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {task
                  ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                }
              </svg>
            </div>
            <h2 className="text-base font-bold" style={{ color: 'var(--nm-text)' }}>
              {task ? (task.parent_id ? 'サブタスクを編集' : 'メインタスクを編集') : '新規タスク'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="nm-btn flex items-center justify-center"
            style={{ width: 32, height: 32, borderRadius: 8 }}
          >
            <svg className="w-4 h-4" style={{ color: 'var(--nm-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 区切り線 */}
        <div style={{ height: 1, background: 'rgba(163,177,198,0.3)', margin: '0 24px' }} />

        {/* フォーム本体（スクロール領域） */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* タイトル */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--nm-muted)' }}>
              タイトル *
            </label>
            <input
              ref={titleRef}
              type="text"
              value={form.title}
              onChange={set('title')}
              required
              placeholder="タスク名を入力"
              className="nm-input px-4 py-2.5 text-sm"
            />
          </div>

          {/* 説明 */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--nm-muted)' }}>
              説明
            </label>
            <textarea
              value={form.description}
              onChange={set('description')}
              rows={3}
              placeholder="詳細を入力（任意）"
              className="nm-input px-4 py-2.5 text-sm resize-none"
            />
          </div>

          {/* プロジェクト */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--nm-muted)' }}>
              プロジェクト
            </label>
            <select
              value={form.project_id || ''}
              onChange={(e) => setVal('project_id')(Number(e.target.value))}
              className="nm-select px-4 py-2.5 text-sm"
            >
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* 親タスク */}
          {tasks.length > 0 && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--nm-muted)' }}>
                親タスク
              </label>
              <select
                value={form.parent_id || ''}
                onChange={(e) => setForm(f => ({ ...f, parent_id: e.target.value ? Number(e.target.value) : null }))}
                className="nm-select px-4 py-2.5 text-sm"
              >
                <option value="">なし（メインタスク）</option>
                {tasks
                  .filter(t => t.id !== task?.id)
                  .map(t => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))
                }
              </select>
            </div>
          )}

          {/* 優先度 */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--nm-muted)' }}>
              優先度
            </label>
            <div className="flex gap-2">
              {PRIORITY_OPTIONS.map(({ value, label, color }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setVal('priority')(value)}
                  className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${form.priority === value ? 'nm-pressed-sm' : 'nm-raised-xs'}`}
                  style={{ color: form.priority === value ? color : 'var(--nm-muted)' }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 開始日 / 終了日 */}
          <div className="grid grid-cols-2 gap-3">
            {[['start_date', '開始日'], ['end_date', '終了日']].map(([key, lbl]) => (
              <div key={key}>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--nm-muted)' }}>
                  {lbl}
                </label>
                <input
                  type="date"
                  value={form[key]}
                  onChange={set(key)}
                  className="nm-input px-3 py-2.5 text-sm"
                />
              </div>
            ))}
          </div>

          {/* 進捗 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--nm-muted)' }}>
                進捗
              </label>
              <span className="text-sm font-bold" style={{ color: 'var(--nm-accent)' }}>{form.progress}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={form.progress}
              onChange={(e) => handleProgressChange(Number(e.target.value))}
              style={{ '--progress': `${form.progress}%` }}
            />
          </div>

          {/* コメント */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--nm-muted)' }}>
              コメント
            </label>
            <textarea
              ref={commentRef}
              value={form.comment}
              onChange={set('comment')}
              rows={4}
              placeholder="メモや備考を入力（任意）"
              className="nm-input px-4 py-2.5 text-sm resize-none"
            />
          </div>

        </form>

        {/* フッター */}
        <div style={{ height: 1, background: 'rgba(163,177,198,0.3)', margin: '0 24px' }} />
        <div className="flex items-center justify-between px-6 py-4">
          {/* 削除ボタン */}
          <div style={{ minWidth: 120 }}>
            {task && (
              confirmDelete ? (
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => onDelete(task.id)} className="nm-btn-danger px-4 py-2 text-sm">
                    削除確認
                  </button>
                  <button type="button" onClick={() => setConfirmDelete(false)} className="nm-btn px-4 py-2 text-sm" style={{ color: 'var(--nm-muted)' }}>
                    戻る
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="nm-btn flex items-center gap-1.5 px-4 py-2 text-sm"
                  style={{ color: '#ef4444' }}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  削除
                </button>
              )
            )}
          </div>

          {/* 保存ボタン群 */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="nm-btn px-4 py-2 text-sm"
              style={{ color: 'var(--nm-muted)' }}
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="nm-btn-primary px-4 py-2 text-sm"
            >
              {task ? '更新' : '作成'}
            </button>
          </div>
        </div>
      </div>

      {/* バックドロップ */}
      <div
        className="drawer-backdrop flex-1"
        style={{ background: 'rgba(163, 177, 198, 0.35)', backdropFilter: 'blur(3px)' }}
        onClick={onClose}
      />
    </div>
  )
}
