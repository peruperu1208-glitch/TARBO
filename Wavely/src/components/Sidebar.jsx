import { useState } from 'react'

export default function Sidebar({
  projects,
  selectedProjectId,
  onSelectProject,
  onNewProject,
  onEditProject,
  onDeleteProject,
  onReorderProjects,
  completedProjectIds,
  projectSearch,
  onProjectSearch,
  theme,
  onToggleTheme,
}) {
  const [sidebarMode, setSidebarMode] = useState('normal') // 'normal' | 'edit' | 'delete'
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [dragProjectId, setDragProjectId] = useState(null)
  const [dragOverProjectId, setDragOverProjectId] = useState(null)
  const [dragInsertAbove, setDragInsertAbove] = useState(true)

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
      <div className="py-5 flex justify-center">
        <span style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 30,
          letterSpacing: '0.15em',
          color: 'var(--nm-muted)',
          textShadow: '3px 3px 6px var(--nm-dark), -2px -2px 4px var(--nm-light)',
          lineHeight: 1,
        }}>
          TARBO
        </span>
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

        {/* プロジェクト検索 */}
        {!selectedProjectId && (
          <div className="px-1 pb-1">
            <div
              className="nm-pressed-sm flex items-center gap-2 px-2.5"
              style={{ borderRadius: 8, height: 30 }}
            >
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--nm-muted)', opacity: 0.7 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={projectSearch}
                onChange={(e) => onProjectSearch(e.target.value)}
                placeholder="絞り込む..."
                style={{
                  flex: 1, background: 'none', border: 'none', outline: 'none',
                  fontSize: 12, color: 'var(--nm-text)',
                }}
              />
              {projectSearch && (
                <button
                  onClick={() => onProjectSearch('')}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', color: 'var(--nm-muted)' }}
                  title="クリア"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}

        {/* モードヒント */}
        {sidebarMode !== 'normal' && (
          <div className="px-3 pb-1">
            <span className="text-xs" style={{ color: sidebarMode === 'delete' ? '#ef4444' : 'var(--nm-accent)' }}>
              {sidebarMode === 'edit' ? '編集するプロジェクトを選択' : '削除するプロジェクトを選択'}
            </span>
          </div>
        )}

        {/* プロジェクト行 */}
        {projectSearch && !selectedProjectId && projects.filter(p => p.name.toLowerCase().includes(projectSearch.toLowerCase())).length === 0 && (
          <div className="px-3 py-2 text-xs" style={{ color: 'var(--nm-muted)', opacity: 0.6 }}>
            一致するプロジェクトがありません
          </div>
        )}
        {(projectSearch && !selectedProjectId
          ? projects.filter(p => p.name.toLowerCase().includes(projectSearch.toLowerCase()))
          : projects
        ).map((project) => {
          const isConfirming = confirmDeleteId === project.id
          const isSelected = selectedProjectId === project.id && sidebarMode === 'normal'
          const isDragging = dragProjectId === project.id
          const isDropTarget = dragOverProjectId === project.id && dragProjectId !== project.id

          return (
            <div key={project.id} style={{ position: 'relative' }}>
              {/* 上インジケーター */}
              {isDropTarget && dragInsertAbove && (
                <div style={{ height: 2, borderRadius: 999, background: 'var(--nm-accent)', margin: '2px 4px' }} />
              )}
              <button
                onClick={() => handleProjectClick(project)}
                draggable={sidebarMode === 'normal'}
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'move'
                  setDragProjectId(project.id)
                }}
                onDragEnd={() => { setDragProjectId(null); setDragOverProjectId(null) }}
                onDragOver={(e) => {
                  e.preventDefault()
                  const rect = e.currentTarget.getBoundingClientRect()
                  setDragOverProjectId(project.id)
                  setDragInsertAbove(e.clientY < rect.top + rect.height / 2)
                }}
                onDragLeave={() => setDragOverProjectId(null)}
                onDrop={(e) => {
                  e.preventDefault()
                  if (dragProjectId && dragProjectId !== project.id) {
                    onReorderProjects(dragProjectId, project.id, dragInsertAbove)
                  }
                  setDragProjectId(null)
                  setDragOverProjectId(null)
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-all rounded-lg
                  ${isSelected ? 'nm-nav-active' : ''}
                  ${isConfirming ? 'nm-pressed-xs' : ''}`}
                style={{
                  opacity: isDragging ? 0.4 : 1,
                  cursor: sidebarMode === 'normal' ? 'grab' : undefined,
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
              {/* 下インジケーター */}
              {isDropTarget && !dragInsertAbove && (
                <div style={{ height: 2, borderRadius: 999, background: 'var(--nm-accent)', margin: '2px 4px' }} />
              )}
            </div>
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
