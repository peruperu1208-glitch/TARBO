import { useEffect, useRef, useState } from 'react'


export default function SplashScreen({ percent, label, done, onDone }) {
  const [fading, setFading] = useState(false)
  const calledRef = useRef(false)
  const videoEndedRef = useRef(false)
  const startupDoneRef = useRef(false)

  const tryFadeOut = () => {
    if (!videoEndedRef.current || !startupDoneRef.current) return
    if (calledRef.current) return
    calledRef.current = true
    setFading(true)
  }

  const onVideoEnd = () => { videoEndedRef.current = true; tryFadeOut() }

  useEffect(() => {
    if (!done) return
    startupDoneRef.current = true
    tryFadeOut()
  }, [done])

  // 動画が読み込めない場合の安全弁（30秒）
  useEffect(() => {
    const t = setTimeout(() => { videoEndedRef.current = true; tryFadeOut() }, 30000)
    return () => clearTimeout(t)
  }, [])

  return (
    <div
      className={`fixed inset-0 z-[200]${fading ? ' splash-fadeout' : ''}`}
      style={{ background: '#000' }}
      onAnimationEnd={(e) => { if (e.animationName === 'splashFadeOut') onDone?.() }}
    >
      {/* 背景動画 */}
      <video
        src="./splash.mp4"
        autoPlay
        muted
        playsInline
        preload="auto"
        onEnded={onVideoEnd}
        onError={onVideoEnd}
        style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.9 }}
      />

      {/* 下部中央の進捗エリア */}
      <div style={{
        position: 'absolute', bottom: 48, left: 0, right: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
      }}>
        {/* 現在のステップラベル */}
        <span style={{
          fontSize: 12,
          color: done ? '#10b981' : 'rgba(255,255,255,0.75)',
          letterSpacing: '0.03em',
          transition: 'color 0.3s',
        }}>
          {label}
        </span>

        {/* プログレスバー（幅200px、中央） */}
        <div style={{ width: 200, height: 3, borderRadius: 999, background: 'rgba(255,255,255,0.18)', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${percent}%`,
            background: done ? '#10b981' : 'rgba(255,255,255,0.8)',
            borderRadius: 999,
            transition: 'width 0.45s cubic-bezier(0.4, 0, 0.2, 1), background 0.3s',
          }} />
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
