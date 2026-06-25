import { useState, useEffect } from 'react'

export default function Sidebar({
  projects,
  archivedProjects = [],
  selectedProjectId,
  onSelectProject,
  onNewProject,
  onEditProject,
  onDeleteProject,
  onArchiveProject,
  onUnarchiveProject,
  onReorderProjects,
  completedProjectIds,
  projectSearch,
  onProjectSearch,
  showArchived,
  onToggleShowArchived,
  theme,
  onToggleTheme,
}) {
  const [sidebarMode, setSidebarMode] = useState('normal') // 'normal' | 'edit' | 'delete' | 'archive'
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [confirmArchiveId, setConfirmArchiveId] = useState(null)
  const [dragProjectId, setDragProjectId] = useState(null)
  const [dragOverProjectId, setDragOverProjectId] = useState(null)
  const [dragInsertAbove, setDragInsertAbove] = useState(true)
  const [archiveSearch, setArchiveSearch] = useState('')
  const [archivedMode, setArchivedMode] = useState('normal') // 'normal' | 'delete' | 'restore'
  const [confirmDeleteArchivedId, setConfirmDeleteArchivedId] = useState(null)

  const resetMode = () => {
    setSidebarMode('normal')
    setConfirmDeleteId(null)
    setConfirmArchiveId(null)
  }

  const toggleMode = (mode) => {
    if (sidebarMode === mode) resetMode()
    else {
      setSidebarMode(mode)
      setConfirmDeleteId(null)
      setConfirmArchiveId(null)
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
        setConfirmArchiveId(null)
      }
    } else if (sidebarMode === 'archive') {
      if (confirmArchiveId === project.id) {
        onArchiveProject(project.id)
        resetMode()
      } else {
        setConfirmArchiveId(project.id)
        setConfirmDeleteId(null)
      }
    } else {
      onSelectProject(project.id)
    }
  }

  // トグル切り替え時にモードをリセット
  useEffect(() => {
    resetMode()
    setArchiveSearch('')
    setArchivedMode('normal')
    setConfirmDeleteArchivedId(null)
  }, [showArchived])

  const displayProjects = projectSearch
    ? projects.filter(p => p.name.toLowerCase().includes(projectSearch.toLowerCase()))
    : projects

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

      {/* 固定ヘッダー（ラベル・ボタン・検索） */}
      <div className="flex-shrink-0 px-4">
        <div className="pt-3 pb-2 px-3">
          <span className="text-sm font-medium" style={{ color: 'var(--nm-muted)' }}>
            {showArchived ? 'アーカイブ済みプロジェクト' : 'プロジェクト'}
          </span>

          {/* アーカイブ済み用操作ボタン */}
          {showArchived && (
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={() => { setArchivedMode(m => m === 'restore' ? 'normal' : 'restore'); setConfirmDeleteArchivedId(null) }}
                className={`flex items-center justify-center flex-shrink-0 ${archivedMode === 'restore' ? 'nm-pressed-xs' : 'nm-btn'}`}
                style={{ width: 34, height: 34, color: archivedMode === 'restore' ? 'var(--nm-accent)' : 'var(--nm-muted)' }}
                title="復元モード"
              >
                <svg style={{ width: 18, height: 18 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
              </button>
              <button
                onClick={() => { setArchivedMode(m => m === 'delete' ? 'normal' : 'delete'); setConfirmDeleteArchivedId(null) }}
                className={`flex items-center justify-center flex-shrink-0 ${archivedMode === 'delete' ? 'nm-pressed-xs' : 'nm-btn'}`}
                style={{ width: 34, height: 34, color: archivedMode === 'delete' ? '#ef4444' : 'var(--nm-muted)' }}
                title="完全削除モード"
              >
                <svg style={{ width: 18, height: 18 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          )}

          {/* 操作ボタン（トグルOFFのみ表示） */}
          {!showArchived && (
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={() => { onSelectProject(null); resetMode() }}
                className={`flex items-center justify-center flex-shrink-0 ${!selectedProjectId ? 'nm-pressed-xs' : 'nm-btn'}`}
                style={{
                  width: 34, height: 34,
                  color: !selectedProjectId ? 'var(--nm-accent)' : 'var(--nm-muted)',
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: 14,
                  letterSpacing: '0.05em',
                }}
                title="全タスク"
              >
                ALL
              </button>
              <button
                onClick={() => { onNewProject(); resetMode() }}
                className="nm-btn flex items-center justify-center flex-shrink-0"
                style={{ width: 34, height: 34, color: 'var(--nm-muted)' }}
                title="新規プロジェクト"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
              <button
                onClick={() => toggleMode('edit')}
                className={`flex items-center justify-center flex-shrink-0 ${sidebarMode === 'edit' ? 'nm-pressed-xs' : 'nm-btn'}`}
                style={{ width: 34, height: 34, color: sidebarMode === 'edit' ? 'var(--nm-accent)' : 'var(--nm-muted)' }}
                title="プロジェクトを編集"
              >
                <svg style={{ width: 18, height: 18 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                onClick={() => toggleMode('archive')}
                className={`flex items-center justify-center flex-shrink-0 ${sidebarMode === 'archive' ? 'nm-pressed-xs' : 'nm-btn'}`}
                style={{ width: 34, height: 34, color: sidebarMode === 'archive' ? '#f59e0b' : 'var(--nm-muted)' }}
                title="プロジェクトをアーカイブ"
              >
                <svg style={{ width: 18, height: 18 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-2.25-2.25M12 17.25l2.25-2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* トグルOFF：検索・モードヒント */}
        {!showArchived && (
          <>
            <div className="px-1 pb-1 pt-1">
              <div className="nm-pressed-sm flex items-center px-3" style={{ borderRadius: 8, height: 36, position: 'relative' }}>
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--nm-muted)', opacity: 0.7 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={projectSearch}
                  onChange={(e) => onProjectSearch(e.target.value)}
                  placeholder="絞り込む..."
                  style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', outline: 'none', fontSize: 13, color: 'var(--nm-text)', marginLeft: 8, paddingRight: projectSearch ? 24 : 0 }}
                />
                {projectSearch && (
                  <button
                    onClick={() => onProjectSearch('')}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', padding: 2, cursor: 'pointer', display: 'flex', color: 'var(--nm-muted)' }}
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* モードヒント */}
            {sidebarMode !== 'normal' && (
              <div className="px-3 py-1">
                <span className="text-xs" style={{
                  color: sidebarMode === 'delete' ? '#ef4444'
                    : sidebarMode === 'archive' ? '#f59e0b'
                    : 'var(--nm-accent)'
                }}>
                  {sidebarMode === 'edit' ? '編集するプロジェクトを選択'
                    : sidebarMode === 'archive' ? 'アーカイブするプロジェクトを選択'
                    : '削除するプロジェクトを選択'}
                </span>
              </div>
            )}

          </>
        )}

        {/* トグルON：アーカイブ検索・モードヒント */}
        {showArchived && (
          <>
            <div className="px-1 pb-1 pt-1">
              <div className="nm-pressed-sm flex items-center px-3" style={{ borderRadius: 8, height: 36, position: 'relative' }}>
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--nm-muted)', opacity: 0.7 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={archiveSearch}
                  onChange={(e) => setArchiveSearch(e.target.value)}
                  placeholder="絞り込む..."
                  style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', outline: 'none', fontSize: 13, color: 'var(--nm-text)', marginLeft: 8, paddingRight: archiveSearch ? 24 : 0 }}
                />
                {archiveSearch && (
                  <button
                    onClick={() => setArchiveSearch('')}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', padding: 2, cursor: 'pointer', display: 'flex', color: 'var(--nm-muted)' }}
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
            {archivedMode !== 'normal' && (
              <div className="px-3 py-1">
                <span className="text-xs" style={{ color: archivedMode === 'delete' ? '#ef4444' : 'var(--nm-accent)' }}>
                  {archivedMode === 'delete' ? '完全削除するプロジェクトを選択' : '復元するプロジェクトを選択'}
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* スクロール対象：プロジェクト一覧のみ */}
      <nav className="flex-1 overflow-y-auto px-4 py-1 space-y-1">

        {/* トグルOFF：進行中プロジェクト一覧 */}
        {!showArchived && (
          <>
            {/* 検索結果なし */}
            {projectSearch && displayProjects.length === 0 && (
              <div className="px-3 py-2 text-xs" style={{ color: 'var(--nm-muted)', opacity: 0.6 }}>
                一致するプロジェクトがありません
              </div>
            )}

            {displayProjects.map((project) => {
              const isConfirmingDelete  = confirmDeleteId  === project.id
              const isConfirmingArchive = confirmArchiveId === project.id
              const isConfirming = isConfirmingDelete || isConfirmingArchive
              const isSelected = selectedProjectId === project.id && sidebarMode === 'normal'
              const isDragging = dragProjectId === project.id
              const isDropTarget = dragOverProjectId === project.id && dragProjectId !== project.id

              return (
                <div key={project.id} style={{ position: 'relative' }}>
                  {isDropTarget && dragInsertAbove && (
                    <div style={{ height: 2, borderRadius: 999, background: 'var(--nm-accent)', margin: '2px 4px' }} />
                  )}
                  <button
                    onClick={() => handleProjectClick(project)}
                    draggable={sidebarMode === 'normal'}
                    onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setDragProjectId(project.id) }}
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
                      color: isConfirmingDelete
                        ? '#ef4444'
                        : isConfirmingArchive
                          ? '#f59e0b'
                          : sidebarMode === 'edit'
                            ? 'var(--nm-accent)'
                            : sidebarMode === 'delete' || sidebarMode === 'archive'
                              ? 'var(--nm-muted)'
                              : isSelected ? 'var(--nm-accent)' : 'var(--nm-text)',
                      background: isConfirmingDelete
                        ? 'rgba(239,68,68,0.08)'
                        : isConfirmingArchive
                          ? 'rgba(245,158,11,0.08)'
                          : undefined,
                    }}
                  >
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: project.color }} />
                    <span className="truncate flex-1 text-left">{project.name}</span>
                    {completedProjectIds?.has(project.id) && !isConfirming && (
                      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="#10b981" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {isConfirmingDelete && (
                      <span className="text-xs flex-shrink-0" style={{ color: '#ef4444' }}>削除?</span>
                    )}
                    {isConfirmingArchive && (
                      <span className="text-xs flex-shrink-0" style={{ color: '#f59e0b' }}>アーカイブ?</span>
                    )}
                  </button>
                  {isDropTarget && !dragInsertAbove && (
                    <div style={{ height: 2, borderRadius: 999, background: 'var(--nm-accent)', margin: '2px 4px' }} />
                  )}
                </div>
              )
            })}
          </>
        )}

        {/* トグルON：アーカイブ済みプロジェクト一覧 */}
        {showArchived && (
          <>
            {(() => {
              const filtered = archiveSearch
                ? archivedProjects.filter(p => p.name.toLowerCase().includes(archiveSearch.toLowerCase()))
                : archivedProjects
              if (filtered.length === 0) return (
                <div className="px-3 py-4 text-xs text-center" style={{ color: 'var(--nm-muted)', opacity: 0.6 }}>
                  {archiveSearch ? '一致するプロジェクトがありません' : 'アーカイブ済みの\nプロジェクトはありません'}
                </div>
              )
              return filtered.map(project => {
                const isSelected = selectedProjectId === project.id
                const isConfirming = confirmDeleteArchivedId === project.id
                const isActionMode = archivedMode !== 'normal'
                return (
                  <button
                    key={project.id}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-all rounded-lg
                      ${isSelected && !isActionMode ? 'nm-nav-active' : ''}
                      ${isConfirming ? 'nm-pressed-xs' : ''}`}
                    style={{
                      background: isConfirming ? 'rgba(239,68,68,0.08)' : undefined,
                      color: isConfirming ? '#ef4444'
                        : archivedMode === 'restore' ? 'var(--nm-accent)'
                        : archivedMode === 'delete' ? 'var(--nm-muted)'
                        : isSelected ? 'var(--nm-accent)' : 'var(--nm-text)',
                    }}
                    onClick={() => {
                      if (archivedMode === 'delete') {
                        if (isConfirming) { onDeleteProject(project.id); setConfirmDeleteArchivedId(null) }
                        else setConfirmDeleteArchivedId(project.id)
                      } else if (archivedMode === 'restore') {
                        onUnarchiveProject(project.id)
                      } else {
                        onSelectProject(project.id)
                      }
                    }}
                  >
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: project.color }} />
                    <span className="truncate flex-1 text-left">{project.name}</span>
                    {isConfirming && (
                      <span className="text-xs flex-shrink-0" style={{ color: '#ef4444' }}>完全削除?</span>
                    )}
                  </button>
                )
              })
            })()}
          </>
        )}
      </nav>

      {/* フッター */}
      <div className="p-4 flex items-center justify-between">
        <button
          onClick={onToggleShowArchived}
          className={`flex items-center gap-1.5 px-3 text-xs font-medium transition-all ${showArchived ? 'nm-pressed-xs' : 'nm-btn'}`}
          style={{
            height: 34,
            borderRadius: 8,
            color: showArchived ? '#f59e0b' : 'var(--nm-muted)',
          }}
          title={showArchived ? 'アーカイブを非表示' : 'アーカイブ一覧を表示'}
        >
          <svg style={{ width: 15, height: 15, flexShrink: 0 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-2.25-2.25M12 17.25l2.25-2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
          </svg>
          アーカイブ表示
        </button>
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
