import { useState, useEffect } from 'react'

const COLUMNS = [
  { key: 'todo',        label: '未着手', color: '#9ca3af' },
  { key: 'in_progress', label: '進行中', color: '#6366f1' },
  { key: 'done',        label: '完了',   color: '#10b981' },
]

const STATUS_COLOR    = { todo: '#9ca3af', in_progress: '#6366f1', done: '#10b981' }
const PRIORITY_COLOR  = { low: '#10b981', medium: '#f59e0b', high: '#ef4444' }
const PRIORITY_LABEL  = { low: '低', medium: '中', high: '高' }
const NEXT_STATUS     = { todo: 'in_progress', in_progress: 'done', done: 'todo' }
const PRIORITY_OPTIONS = [
  { value: 'low',    label: '低', color: '#10b981' },
  { value: 'medium', label: '中', color: '#f59e0b' },
  { value: 'high',   label: '高', color: '#ef4444' },
]

const progressToStatus = (p) => p === 0 ? 'todo' : p === 100 ? 'done' : 'in_progress'

function KanbanCard({ task, projects, subtasks, isExpanded, onExpand, onCollapse, onSave, onDelete, onStatusChange, onEdit, onSubtaskCreate, onDragStart, onDragEnd, isDragging }) {
  const subtaskCount = subtasks.length
  const doneSubtaskCount = subtasks.filter(s => s.status === 'done').length
  const [form, setForm] = useState({})
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [addingSubtask, setAddingSubtask] = useState(false)
  const [subtaskTitle, setSubtaskTitle] = useState('')
  const [subtaskDates, setSubtaskDates] = useState({ start: '', end: '' })

  useEffect(() => {
    if (isExpanded) {
      setForm({
        ...task,
        start_date: task.start_date || '',
        end_date: task.end_date || '',
        progress: task.progress || 0,
        comment: task.comment || '',
      })
      setConfirmDelete(false)
    }
  }, [isExpanded, task])

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }))
  const setVal = (key) => (val) => setForm(f => ({ ...f, [key]: val }))

  const handleProgressChange = (p) => {
    setForm(f => ({ ...f, progress: p, status: progressToStatus(p) }))
  }

  const handleSave = () => {
    if (!form.title?.trim()) return
    onSave({
      ...form,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      progress: Number(form.progress),
    })
    onCollapse()
  }

  const todayStr = new Date().toISOString().slice(0, 10)
  const isOverdue = task.end_date && task.status !== 'done' && task.end_date < todayStr

  if (!isExpanded) {
    return (
      <div
        className="nm-raised-sm cursor-pointer"
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        style={{
          transition: 'transform 0.12s ease, box-shadow 0.12s ease, opacity 0.12s ease',
          opacity: isDragging ? 0.4 : 1,
        }}
        onMouseEnter={e => { if (!isDragging) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '7px 7px 14px var(--nm-dark), -7px -7px 14px var(--nm-light)' } }}
        onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
      >
      <div className="p-3.5" onClick={onExpand}>
        {/* 完了/期限アイコン + タイトル + プロジェクト名 */}
        <div className="flex items-start gap-2 mb-2">
          {task.status === 'done' && (
            <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="#10b981" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
          {isOverdue && (
            <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="#f59e0b" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          <p
            className={`text-sm font-medium leading-snug flex-1 min-w-0 ${task.status === 'done' ? 'line-through' : ''}`}
            style={{ color: task.status === 'done' ? 'var(--nm-muted)' : isOverdue ? '#f59e0b' : 'var(--nm-text)' }}
          >
            {task.title}
          </p>
          {task.project_name && (
            <span className="flex items-center gap-1 flex-shrink-0" style={{ fontSize: 12, color: 'var(--nm-muted)' }}>
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: task.project_color }} />
              {task.project_name}
            </span>
          )}
        </div>

        {/* 説明 */}
        {task.description && (
          <p className="text-xs mb-2.5" style={{ color: 'var(--nm-muted)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {task.description}
          </p>
        )}

        {/* 進捗バー */}
        {task.progress > 0 && (
          <div className="mb-2.5">
            <div style={{ height: 4, borderRadius: 999, background: 'var(--nm-bg)', boxShadow: 'inset 1px 1px 3px var(--nm-dark), inset -1px -1px 3px var(--nm-light)' }}>
              <div
                style={{
                  height: '100%',
                  width: `${task.progress}%`,
                  borderRadius: 999,
                  background: `linear-gradient(90deg, ${STATUS_COLOR[task.status]}, ${STATUS_COLOR[task.status]}bb)`,
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
            <p className="text-right mt-0.5" style={{ fontSize: 10, color: 'var(--nm-muted)' }}>{task.progress}%</p>
          </div>
        )}

        {/* フッター */}
        <div className="flex items-center gap-2">
          {subtaskCount > 0 ? (
            <span
              className="nm-pressed-xs flex-shrink-0"
              style={{ fontSize: 11, color: doneSubtaskCount === subtaskCount ? '#10b981' : 'var(--nm-muted)', padding: '2px 6px' }}
            >
              サブタスク {doneSubtaskCount}/{subtaskCount}
            </span>
          ) : (
            <span style={{ fontSize: 11, color: 'var(--nm-muted)', opacity: 0.6 }}>サブタスクなし</span>
          )}
          <div className="flex items-center gap-1.5 ml-auto">
            {task.end_date && (
              <span style={{ fontSize: 11, color: 'var(--nm-muted)' }}>
                〜{task.end_date.slice(5).replace('-', '/')}
              </span>
            )}
            {onEdit && (
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(task) }}
                className="nm-btn flex items-center justify-center flex-shrink-0"
                style={{ width: 22, height: 22, padding: 0 }}
                title="詳細を開く"
              >
                <svg className="w-3 h-3" style={{ color: 'var(--nm-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            )}
            {onSubtaskCreate && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  const t = new Date()
                  const todayStr = t.toISOString().slice(0, 10)
                  const threeStr = new Date(t.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
                  setSubtaskDates({ start: todayStr, end: threeStr })
                  setAddingSubtask(true)
                  setSubtaskTitle('')
                }}
                className="nm-btn flex items-center justify-center flex-shrink-0"
                style={{ width: 22, height: 22, padding: 0 }}
                title="サブタスクを追加"
              >
                <svg className="w-3 h-3" style={{ color: 'var(--nm-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onStatusChange(task, NEXT_STATUS[task.status]) }}
              className="nm-btn flex items-center justify-center flex-shrink-0"
              style={{ width: 22, height: 22, borderRadius: '50%', padding: 0 }}
              title="次のステータスへ"
            >
              <svg className="w-3 h-3" style={{ color: STATUS_COLOR[NEXT_STATUS[task.status]] }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      {subtasks.length > 0 && (
        <div style={{ borderTop: '1px solid rgba(163,177,198,0.2)', paddingTop: 6, paddingBottom: 8, paddingLeft: 24, paddingRight: 14 }}>
          {subtasks.map(sub => {
            const subOverdue = sub.end_date && sub.status !== 'done' && sub.end_date < new Date().toISOString().slice(0, 10)
            return (
              <div key={sub.id} className="flex items-center gap-1.5" style={{ padding: '4px 0' }} onClick={e => { e.stopPropagation(); onEdit && onEdit(sub) }}>
                <span style={{ color: 'var(--nm-muted)', fontSize: 11, flexShrink: 0 }}>└</span>
                <span
                  className="flex-1 truncate"
                  style={{
                    fontSize: 12,
                    cursor: 'pointer',
                    color: sub.status === 'done' ? 'var(--nm-muted)' : subOverdue ? '#f59e0b' : 'var(--nm-text)',
                    textDecoration: sub.status === 'done' ? 'line-through' : 'none',
                  }}
                >
                  {sub.title}
                </span>
                {sub.end_date && sub.status !== 'done' && (
                  <span style={{ fontSize: 11, color: subOverdue ? '#f59e0b' : 'var(--nm-muted)', flexShrink: 0 }}>
                    {sub.end_date.slice(5).replace('-', '/')}
                  </span>
                )}
                <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: STATUS_COLOR[sub.status], flexShrink: 0 }} />
              </div>
            )
          })}
        </div>
      )}
      {addingSubtask && (
        <div className="px-3 pb-3" onClick={e => e.stopPropagation()}>
          <div className="flex gap-1.5 items-center mb-1.5">
            <span style={{ fontSize: 10, color: 'var(--nm-muted)', flexShrink: 0 }}>└</span>
            <input
              autoFocus
              value={subtaskTitle}
              onChange={e => setSubtaskTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && subtaskTitle.trim()) {
                  onSubtaskCreate(task.id, subtaskTitle.trim(), subtaskDates.start || null, subtaskDates.end || null)
                  setSubtaskTitle(''); setSubtaskDates({ start: '', end: '' }); setAddingSubtask(false)
                }
                if (e.key === 'Escape') { setAddingSubtask(false); setSubtaskTitle(''); setSubtaskDates({ start: '', end: '' }) }
              }}
              placeholder="サブタスク名を入力..."
              className="nm-input px-2 py-1 flex-1"
              style={{ borderRadius: 6, fontSize: 13 }}
            />
          </div>
          <div className="flex items-center gap-1" style={{ paddingLeft: 14 }}>
            <input
              type="date"
              value={subtaskDates.start}
              onChange={e => setSubtaskDates(d => ({ ...d, start: e.target.value }))}
              className="nm-input px-1 py-1 flex-1"
              style={{ borderRadius: 6, fontSize: 13 }}
            />
            <span className="flex-shrink-0" style={{ fontSize: 12, color: 'var(--nm-muted)' }}>〜</span>
            <input
              type="date"
              value={subtaskDates.end}
              onChange={e => setSubtaskDates(d => ({ ...d, end: e.target.value }))}
              onKeyDown={e => {
                if (e.key === 'Enter' && subtaskTitle.trim()) {
                  onSubtaskCreate(task.id, subtaskTitle.trim(), subtaskDates.start || null, subtaskDates.end || null)
                  setSubtaskTitle(''); setSubtaskDates({ start: '', end: '' }); setAddingSubtask(false)
                }
                if (e.key === 'Escape') { setAddingSubtask(false); setSubtaskTitle(''); setSubtaskDates({ start: '', end: '' }) }
              }}
              className="nm-input px-1 py-1 flex-1"
              style={{ borderRadius: 6, fontSize: 13 }}
            />
          </div>
        </div>
      )}
    </div>
    )
  }

  // 展開：インライン編集フォーム
  return (
    <div className="nm-raised-sm p-4 card-expand" style={{ display: 'flex', flexDirection: 'column', gap: 12, outline: '2px solid var(--nm-accent)', outlineOffset: '1px' }}>
      {/* タイトル */}
      <input
        type="text"
        value={form.title || ''}
        onChange={set('title')}
        placeholder="タスク名"
        className="nm-input px-3 py-2 text-sm"
      />

      {/* 説明 */}
      <textarea
        value={form.description || ''}
        onChange={set('description')}
        rows={2}
        placeholder="説明（任意）"
        className="nm-input px-3 py-2 text-xs resize-none"
      />

      {/* プロジェクト */}
      {projects && projects.length > 0 && (
        <select
          value={form.project_id || ''}
          onChange={(e) => setVal('project_id')(Number(e.target.value))}
          className="nm-select px-3 py-2 text-xs"
        >
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      )}

      {/* 優先度 */}
      <div className="flex gap-1.5">
        {PRIORITY_OPTIONS.map(({ value, label, color }) => (
          <button
            key={value}
            type="button"
            onClick={() => setVal('priority')(value)}
            className={`flex-1 py-1.5 text-xs font-semibold transition-all ${form.priority === value ? 'nm-pressed-sm' : 'nm-raised-xs'}`}
            style={{ borderRadius: 8, color: form.priority === value ? color : 'var(--nm-muted)' }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 開始日 / 終了日 */}
      <div className="grid grid-cols-2 gap-2">
        {[['start_date', '開始日'], ['end_date', '終了日']].map(([key, lbl]) => (
          <div key={key}>
            <label className="block text-xs mb-1" style={{ color: 'var(--nm-muted)' }}>{lbl}</label>
            <input
              type="date"
              value={form[key] || ''}
              onChange={set(key)}
              className="nm-input px-2 py-1.5 text-xs"
            />
          </div>
        ))}
      </div>

      {/* 進捗 */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs" style={{ color: 'var(--nm-muted)' }}>進捗</span>
          <span className="text-xs font-bold" style={{ color: 'var(--nm-accent)' }}>{form.progress}%</span>
        </div>
        <input
          type="range"
          min="0" max="100" step="5"
          value={form.progress || 0}
          onChange={(e) => handleProgressChange(Number(e.target.value))}
          style={{ '--progress': `${form.progress || 0}%` }}
        />
      </div>

      {/* コメント */}
      <textarea
        value={form.comment || ''}
        onChange={set('comment')}
        rows={2}
        placeholder="コメント（任意）"
        className="nm-input px-3 py-2 text-xs resize-none"
      />

      {/* フッターボタン */}
      <div className="flex items-center justify-between pt-1">
        {confirmDelete ? (
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => { onDelete(task.id); onCollapse() }}
              className="nm-btn-danger px-3 py-1.5 text-xs"
            >
              確認
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="nm-btn px-3 py-1.5 text-xs"
              style={{ color: 'var(--nm-muted)' }}
            >
              戻る
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="nm-btn flex items-center gap-1 px-3 py-1.5 text-xs"
            style={{ color: '#ef4444' }}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            削除
          </button>
        )}

        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={onCollapse}
            className="nm-btn px-3 py-1.5 text-xs"
            style={{ color: 'var(--nm-muted)' }}
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="nm-btn-primary px-3 py-1.5 text-xs"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}

export default function TaskList({ tasks, allTasks = [], projects, onSave, onDelete, onStatusChange, onNewTask, onEdit, onSubtaskCreate }) {
  const [expandedId, setExpandedId] = useState(null)
  const [draggedTaskId, setDraggedTaskId] = useState(null)
  const [dragOverCol, setDragOverCol] = useState(null)

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64" style={{ color: 'var(--nm-muted)' }}>
        <div className="nm-raised p-5 mb-3 flex items-center justify-center" style={{ width: 60, height: 60 }}>
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ opacity: 0.45 }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <p className="text-sm">タスクがありません</p>
        <p className="text-xs mt-1">ガント表示から新規タスクを追加してください</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 16, height: '100%', minHeight: 0 }}>
      {COLUMNS.map(col => {
        const colTasks = tasks.filter(t => t.status === col.key)

        return (
          <div
            key={col.key}
            style={{ flex: 1, minWidth: 220, minHeight: 0, display: 'flex', flexDirection: 'column' }}
          >
            {/* カラムヘッダー */}
            <div
              className="nm-raised-sm flex items-center gap-2.5 px-4 py-3 flex-shrink-0"
              style={{ marginBottom: 12, background: `${col.color}18`, borderBottom: `2px solid ${col.color}44` }}
            >
              <span
                className="flex-shrink-0"
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  backgroundColor: col.color,
                  boxShadow: `2px 2px 4px var(--nm-dark), -1px -1px 3px var(--nm-light)`,
                }}
              />
              <span className="text-sm font-bold" style={{ color: col.color }}>{col.label}</span>
              <span
                className="nm-pressed-xs text-xs font-semibold"
                style={{ color: col.color, padding: '2px 8px' }}
              >
                {colTasks.length}
              </span>
              <div style={{ flex: 1 }} />
              {col.key !== 'done' && (
                <button
                  onClick={() => onNewTask(col.key)}
                  className="nm-btn flex items-center justify-center flex-shrink-0"
                  style={{ width: 24, height: 24, color: 'var(--nm-muted)' }}
                  title={`${col.label}のタスクを追加`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              )}
            </div>

            {/* カード領域（縦スクロール・ドロップターゲット） */}
            <div
              className="nm-pressed overflow-y-auto"
              style={{
                flex: 1, minHeight: 0, borderRadius: 8, padding: 12,
                outline: dragOverCol === col.key && draggedTaskId ? `2px solid ${col.color}88` : '2px solid transparent',
                transition: 'outline 0.15s ease',
              }}
              onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.key) }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverCol(null) }}
              onDrop={(e) => {
                e.preventDefault()
                const task = tasks.find(t => t.id === draggedTaskId)
                if (task && task.status !== col.key) onStatusChange(task, col.key)
                setDraggedTaskId(null)
                setDragOverCol(null)
              }}
            >
              {colTasks.length === 0 ? (
                <div
                  className="flex flex-col items-center justify-center h-full"
                  style={{ color: 'var(--nm-muted)', opacity: dragOverCol === col.key ? 0.7 : 0.45, minHeight: 80, transition: 'opacity 0.15s' }}
                >
                  <svg className="w-7 h-7 mb-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  <p className="text-xs">タスクなし</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {colTasks.map(task => {
                    const subs = allTasks.filter(t => t.parent_id === task.id)
                    return (
                      <KanbanCard
                        key={task.id}
                        task={task}
                        projects={projects}
                        subtasks={subs}
                        isExpanded={expandedId === task.id}
                        onExpand={() => setExpandedId(task.id)}
                        onCollapse={() => setExpandedId(null)}
                        onSave={onSave}
                        onDelete={onDelete}
                        onStatusChange={onStatusChange}
                        onEdit={onEdit}
                        onSubtaskCreate={onSubtaskCreate}
                        isDragging={draggedTaskId === task.id}
                        onDragStart={() => { setDraggedTaskId(task.id); setExpandedId(null) }}
                        onDragEnd={() => { setDraggedTaskId(null); setDragOverCol(null) }}
                      />
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
