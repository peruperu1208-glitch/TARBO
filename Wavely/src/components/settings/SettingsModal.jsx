import { useState, useEffect } from 'react'

const ZOOM_OPTIONS  = [50, 75, 100, 125, 150]
const DAYS_OPTIONS  = [30, 60, 90]

export default function SettingsModal({ theme, onThemeChange, onClose }) {
  const [zoom, setZoom] = useState(() => {
    const v = Number(localStorage.getItem('turbo-zoom'))
    return ZOOM_OPTIONS.includes(v) ? v : 100
  })
  const [daysToShow, setDaysToShow] = useState(() => {
    const v = Number(localStorage.getItem('turbo-days'))
    return DAYS_OPTIONS.includes(v) ? v : 60
  })
  const [dbPath, setDbPath] = useState('')
  const [dbChanging, setDbChanging] = useState(false)

  useEffect(() => {
    window.electronAPI.getDbPath().then(setDbPath)
  }, [])

  const handleZoomChange = (v) => {
    setZoom(v)
    localStorage.setItem('turbo-zoom', v)
    window.dispatchEvent(new CustomEvent('turbo-gantt-settings', { detail: { zoom: v } }))
  }

  const handleDaysChange = (v) => {
    setDaysToShow(v)
    localStorage.setItem('turbo-days', v)
    window.dispatchEvent(new CustomEvent('turbo-gantt-settings', { detail: { daysToShow: v } }))
  }

  const handleChooseDbFolder = async () => {
    setDbChanging(true)
    const newPath = await window.electronAPI.chooseDbFolder()
    if (newPath) setDbPath(newPath)
    setDbChanging(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* バックドロップ（左側） */}
      <div
        className="flex-1"
        style={{ background: 'rgba(163,177,198,0.35)', backdropFilter: 'blur(3px)' }}
        onClick={onClose}
      />

      {/* パネル（右側・スライドイン） */}
      <div
        className="drawer-enter-right flex flex-col flex-shrink-0"
        style={{
          width: 360,
          borderRadius: 0,
          background: 'var(--nm-bg)',
          boxShadow: '-10px 0 40px var(--nm-dark), -2px 0 12px var(--nm-light)',
        }}
      >
        {/* ヘッダー */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--nm-line)' }}
        >
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--nm-accent)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="font-bold text-sm" style={{ color: 'var(--nm-text)' }}>設定</span>
          </div>
          <button
            onClick={onClose}
            className="nm-btn flex items-center justify-center"
            style={{ width: 28, height: 28, color: 'var(--nm-muted)' }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-6">

          {/* テーマ */}
          <section>
            <p className="text-xs font-semibold mb-3" style={{ color: 'var(--nm-muted)', letterSpacing: '0.08em' }}>
              表示テーマ
            </p>
            <div className="nm-pressed flex gap-1.5 p-1.5" style={{ borderRadius: 8 }}>
              {[['light', '☀ ライトモード'], ['dark', '🌙 ダークモード']].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => onThemeChange(key)}
                  className={`flex-1 py-2 text-xs font-medium transition-all ${theme === key ? 'nm-raised-xs' : ''}`}
                  style={{ borderRadius: 6, color: theme === key ? 'var(--nm-accent)' : 'var(--nm-muted)' }}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          {/* デフォルト表示倍率 */}
          <section>
            <p className="text-xs font-semibold mb-3" style={{ color: 'var(--nm-muted)', letterSpacing: '0.08em' }}>
              デフォルト表示倍率
            </p>
            <div className="nm-pressed flex gap-1 p-1.5" style={{ borderRadius: 8 }}>
              {ZOOM_OPTIONS.map(v => (
                <button
                  key={v}
                  onClick={() => handleZoomChange(v)}
                  className={`flex-1 py-2 text-xs font-medium transition-all ${zoom === v ? 'nm-raised-xs' : ''}`}
                  style={{ borderRadius: 6, color: zoom === v ? 'var(--nm-accent)' : 'var(--nm-muted)' }}
                >
                  {v}%
                </button>
              ))}
            </div>
          </section>

          {/* デフォルト表示日数 */}
          <section>
            <p className="text-xs font-semibold mb-3" style={{ color: 'var(--nm-muted)', letterSpacing: '0.08em' }}>
              デフォルト表示日数
            </p>
            <div className="nm-pressed flex gap-2 p-1.5" style={{ borderRadius: 8 }}>
              {DAYS_OPTIONS.map(v => (
                <button
                  key={v}
                  onClick={() => handleDaysChange(v)}
                  className={`flex-1 py-2 text-xs font-medium transition-all ${daysToShow === v ? 'nm-raised-xs' : ''}`}
                  style={{ borderRadius: 6, color: daysToShow === v ? 'var(--nm-accent)' : 'var(--nm-muted)' }}
                >
                  {v}日
                </button>
              ))}
            </div>
          </section>

          {/* データベース保存先 */}
          <section>
            <p className="text-xs font-semibold mb-3" style={{ color: 'var(--nm-muted)', letterSpacing: '0.08em' }}>
              データベース保存先
            </p>
            <div className="nm-pressed px-3 py-2.5 mb-3" style={{ borderRadius: 8 }}>
              <p className="text-xs break-all" style={{ color: 'var(--nm-text)', lineHeight: 1.7, wordBreak: 'break-all' }}>
                {dbPath || '読み込み中...'}
              </p>
            </div>
            <button
              onClick={handleChooseDbFolder}
              disabled={dbChanging}
              className="nm-btn px-4 py-2 text-xs font-medium"
              style={{ color: 'var(--nm-accent)', opacity: dbChanging ? 0.6 : 1 }}
            >
              {dbChanging ? '処理中...' : 'フォルダを変更...'}
            </button>
            <p className="mt-2.5 text-xs leading-relaxed" style={{ color: 'var(--nm-muted)', opacity: 0.7 }}>
              変更すると現在のデータが新しい場所に移動されます。
            </p>
          </section>

        </div>
      </div>
    </div>
  )
}
