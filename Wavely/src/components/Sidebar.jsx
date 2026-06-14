import { useState } from 'react'

export default function Sidebar({
  projects,
  selectedProjectId,
  onSelectProject,
  onNewProject,
  onEditProject,
  onDeleteProject,
  completedProjectIds,
  theme,
  onToggleTheme,
}) {
  const [sidebarMode, setSidebarMode] = useState('normal') // 'normal' | 'edit' | 'delete'
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  const resetMode = () => {
    setSidebarMode('normal')
    setConfirmDeleteId(null)
  }

  const toggleMode = (mode) => {
    if (sidebarMode === mode) {
      resetMode()
    } else {
      setSidebarMode(mode)
      setConfirmDeleteId(null)
    }
  }

  const handleProjectClick = (project) => {
    if (sidebarMode === 'edit') {
      onEditProject(project)
      resetMode()
    } else if (sidebarMode === 'delete') {
      if (confirmDeleteId === project.id) {
        onDeleteProject(project.id)
        resetMode()
      } else {
        setConfirmDeleteId(project.id)
      }
    } else {
      onSelectProject(project.id)
    }
  }

  return (
    <aside className="nm-sidebar flex flex-col h-screen flex-shrink-0" style={{ width: 260 }}>
      {/* ロゴ */}
      <div className="px-5 py-5">
        <div
          className="flex items-center gap-3"
          style={{
            WebkitMaskImage: 'linear-gradient(to right, black 10%, rgba(0,0,0,0.35) 100%)',
            maskImage:        'linear-gradient(to right, black 10%, rgba(0,0,0,0.35) 100%)',
          }}
        >
          {/* rotate(45) で右上に飛ぶロケット。鼻先→右上、炎→左下 */}
          <svg width="22" height="22" viewBox="0 2 18 18" fill="none" stroke="var(--nm-text)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <g transform="rotate(45, 9, 12)">
              <path d="M7 3.5 Q9 0.5 11 3.5 C12 7 12 11 12 14 L6 14 C6 11 6 7 7 3.5Z" />
              <circle cx="9" cy="8" r="1.8" strokeWidth="1.8" />
              <path d="M6 12 L3.5 16 L6 16" />
              <path d="M12 12 L14.5 16 L12 16" />
              <line x1="6" y1="16" x2="12" y2="16" />
              <path d="M7 16 Q9 22 11 16" />
            </g>
          </svg>
          <span style={{ fontWeight: 800, fontSize: 22, letterSpacing: '0.06em', color: 'var(--nm-text)' }}>
            TARBO
          </span>
        </div>
      </div>

      {/* ナビゲーション */}
      <nav className="flex-1 overflow-y-auto px-4 py-2 space-y-1">
        {/* 全タスク */}
        <button
          onClick={() => { onSelectProject(null); resetMode() }}
          className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-all rounded-lg
            ${!selectedProjectId ? 'nm-nav-active' : ''}`}
          style={{ color: !selectedProjectId ? 'var(--nm-accent)' : 'var(--nm-muted)' }}
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
          全タスク
        </button>

        {/* プロジェクト一覧ヘッダー */}
        <div className="pt-4 pb-1 px-3 flex items-center justify-between">
          <span className="text-sm font-medium" style={{ color: 'var(--nm-muted)' }}>
            プロジェクト
          </span>
          <div className="flex items-center gap-1">
            {/* 追加ボタン */}
            <button
              onClick={() => { onNewProject(); resetMode() }}
              className="nm-btn flex items-center justify-center flex-shrink-0"
              style={{ width: 28, height: 28, color: 'var(--nm-muted)' }}
              title="新規プロジェクト"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            {/* 編集モードボタン */}
            <button
              onClick={() => toggleMode('edit')}
              className={`flex items-center justify-center flex-shrink-0 ${sidebarMode === 'edit' ? 'nm-pressed-xs' : 'nm-btn'}`}
              style={{ width: 28, height: 28, color: sidebarMode === 'edit' ? 'var(--nm-accent)' : 'var(--nm-muted)' }}
              title="プロジェクトを編集"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            {/* 削除モードボタン */}
            <button
              onClick={() => toggleMode('delete')}
              className={`flex items-center justify-center flex-shrink-0 ${sidebarMode === 'delete' ? 'nm-pressed-xs' : 'nm-btn'}`}
              style={{ width: 28, height: 28, color: sidebarMode === 'delete' ? '#ef4444' : 'var(--nm-muted)' }}
              title="プロジェクトを削除"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* モードヒント */}
        {sidebarMode !== 'normal' && (
          <div className="px-3 pb-1">
            <span className="text-xs" style={{ color: sidebarMode === 'delete' ? '#ef4444' : 'var(--nm-accent)' }}>
              {sidebarMode === 'edit' ? '編集するプロジェクトを選択' : '削除するプロジェクトを選択'}
            </span>
          </div>
        )}

        {/* プロジェクト行 */}
        {projects.map((project) => {
          const isConfirming = confirmDeleteId === project.id
          const isSelected = selectedProjectId === project.id && sidebarMode === 'normal'

          return (
            <button
              key={project.id}
              onClick={() => handleProjectClick(project)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-all rounded-lg
                ${isSelected ? 'nm-nav-active' : ''}
                ${isConfirming ? 'nm-pressed-xs' : ''}`}
              style={{
                color: isConfirming
                  ? '#ef4444'
                  : sidebarMode === 'edit'
                    ? 'var(--nm-accent)'
                    : sidebarMode === 'delete'
                      ? 'var(--nm-muted)'
                      : isSelected ? 'var(--nm-accent)' : 'var(--nm-text)',
                background: isConfirming ? 'rgba(239,68,68,0.08)' : undefined,
              }}
            >
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: project.color }}
              />
              <span className="truncate flex-1 text-left">{project.name}</span>
              {completedProjectIds?.has(project.id) && !isConfirming && (
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="#10b981" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
              {isConfirming && (
                <span className="text-xs flex-shrink-0" style={{ color: '#ef4444' }}>削除?</span>
              )}
            </button>
          )
        })}
      </nav>

      {/* フッター */}
      <div className="p-4 flex items-center justify-end">
        <button
          onClick={onToggleTheme}
          className="nm-btn flex items-center justify-center flex-shrink-0"
          style={{ width: 38, height: 38, color: 'var(--nm-muted)' }}
          title={theme === 'dark' ? 'ライトモード' : 'ダークモード'}
        >
          {theme === 'dark' ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>
      </div>
    </aside>
  )
}
