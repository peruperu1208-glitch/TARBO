import { useState, useEffect } from 'react'

const COLORS = [
  '#6366f1', '#3b82f6', '#06b6d4', '#10b981',
  '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899',
]

export default function ProjectModal({ project, onSave, onClose }) {
  const [form, setForm] = useState({ name: '', description: '', color: COLORS[0] })

  useEffect(() => {
    if (project) setForm({ name: project.name, description: project.description || '', color: project.color })
  }, [project])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    onSave(project ? { ...form, id: project.id } : form)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(163, 177, 198, 0.45)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />

      <div className="nm-raised relative w-full mx-4" style={{ maxWidth: 360 }}>
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <h2 className="text-base font-bold" style={{ color: 'var(--nm-text)' }}>
            {project ? 'プロジェクトを編集' : '新規プロジェクト'}
          </h2>
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

        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
          {/* 名前 */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--nm-muted)' }}>
              プロジェクト名 *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
              required
              autoFocus
              placeholder="プロジェクト名を入力"
              className="nm-input px-4 py-2.5 text-sm"
            />
          </div>

          {/* 説明 */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--nm-muted)' }}>
              説明
            </label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="任意"
              className="nm-input px-4 py-2.5 text-sm"
            />
          </div>

          {/* カラー */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--nm-muted)' }}>
              カラー
            </label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, color }))}
                  className="transition-all"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    backgroundColor: color,
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: form.color === color
                      ? `inset 2px 2px 4px rgba(0,0,0,0.2), 0 0 0 3px var(--nm-bg), 0 0 0 5px ${color}`
                      : '3px 3px 6px var(--nm-dark), -2px -2px 4px var(--nm-light)',
                    transform: form.color === color ? 'scale(1.15)' : 'scale(1)',
                    transition: 'all 0.15s ease',
                  }}
                />
              ))}
            </div>
          </div>

          {/* ボタン */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="nm-btn flex-1 py-2.5 text-sm font-medium"
              style={{ color: 'var(--nm-muted)' }}
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="nm-btn-primary flex-1 py-2.5 text-sm"
            >
              {project ? '更新' : '作成'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
