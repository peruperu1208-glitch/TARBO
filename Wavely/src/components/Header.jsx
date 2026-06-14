const VIEW_TABS = [
  { key: 'gantt', label: 'ガント', icon: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  )},
  { key: 'list', label: 'リスト', icon: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  )},
]

export default function Header({ view, onViewChange, selectedProject, taskCount }) {
  return (
    <header
      className="flex items-center px-6 py-4 flex-shrink-0"
      style={{ boxShadow: '0 4px 15px var(--nm-dark), 0 -1px 8px var(--nm-light)', background: 'var(--nm-bg)', zIndex: 10 }}
    >
      {/* 左: プロジェクト名 */}
      <div className="flex-1 flex items-center gap-3 min-w-0">
        {selectedProject && (
          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: selectedProject.color }} />
        )}
        <h1 className="text-base font-bold truncate" style={{ color: 'var(--nm-text)' }}>
          {selectedProject ? selectedProject.name : '全タスク'}
        </h1>
        <span className="nm-pressed-xs text-xs px-2 py-0.5 flex-shrink-0" style={{ color: 'var(--nm-muted)' }}>
          {taskCount}
        </span>
      </div>

      {/* 中央: ビュー切り替え */}
      <div className="nm-pressed flex items-center p-1 gap-1">
        {VIEW_TABS.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => onViewChange(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-all ${view === key ? 'nm-raised-xs' : ''}`}
            style={{ borderRadius: 4, color: view === key ? 'var(--nm-accent)' : 'var(--nm-muted)' }}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {/* 右: センタリング用スペーサー */}
      <div className="flex-1" />
    </header>
  )
}
