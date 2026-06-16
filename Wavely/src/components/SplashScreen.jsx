import { useEffect, useRef, useState } from 'react'

export default function SplashScreen({ onDone }) {
  const [fading, setFading] = useState(false)
  const calledRef = useRef(false)

  const startFadeOut = () => {
    if (calledRef.current) return
    calledRef.current = true
    setFading(true)
  }

  // 動画が読み込めなかった場合の安全弁（30秒）
  useEffect(() => {
    const fallback = setTimeout(startFadeOut, 30000)
    return () => clearTimeout(fallback)
  }, [])

  return (
    <div
      className={`fixed inset-0 z-[200]${fading ? ' splash-fadeout' : ''}`}
      style={{ background: '#000' }}
      onAnimationEnd={(e) => {
        if (e.animationName === 'splashFadeOut') onDone()
      }}
    >
      <video
        src="./splash.mp4"
        autoPlay
        muted
        playsInline
        preload="auto"
        onEnded={startFadeOut}
        onError={startFadeOut}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </div>
  )
}
