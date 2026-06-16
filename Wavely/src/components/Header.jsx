const VIEW_TABS = [
  { key: 'gantt', label: 'ガント', icon: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <line x1="3" y1="6"  x2="3"  y2="18" strokeWidth={1.5} strokeOpacity={0.4} />
      <rect x="4"  y="4.5"  width="10" height="3" rx="1.5" fill="currentColor" stroke="none" opacity={0.9} />
      <rect x="8"  y="10.5" width="12" height="3" rx="1.5" fill="currentColor" stroke="none" opacity={0.9} />
      <rect x="5"  y="16.5" width="8"  height="3" rx="1.5" fill="currentColor" stroke="none" opacity={0.9} />
    </svg>
  )},
  { key: 'list', label: 'リスト', icon: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <rect x="2"  y="3" width="6" height="2" rx="1" opacity={0.5} />
      <rect x="2"  y="6" width="6" height="7" rx="1.5" opacity={0.9} />
      <rect x="2"  y="14" width="6" height="4" rx="1.5" opacity={0.9} />
      <rect x="9"  y="3" width="6" height="2" rx="1" opacity={0.5} />
      <rect x="9"  y="6" width="6" height="4" rx="1.5" opacity={0.9} />
      <rect x="9"  y="11" width="6" height="7" rx="1.5" opacity={0.9} />
      <rect x="16" y="3" width="6" height="2" rx="1" opacity={0.5} />
      <rect x="16" y="6" width="6" height="10" rx="1.5" opacity={0.9} />
    </svg>
  )},
]

export default function Header({ view, onViewChange, selectedProject, taskCount, onOpenSettings }) {
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

      {/* 右: 設定ボタン */}
      <div className="flex-1 flex justify-end">
        <button
          onClick={onOpenSettings}
          className="nm-btn flex items-center justify-center"
          style={{ width: 32, height: 32, color: 'var(--nm-muted)' }}
          title="設定"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>
    </header>
  )
}
