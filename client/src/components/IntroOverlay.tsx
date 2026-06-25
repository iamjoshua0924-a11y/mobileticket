const METEORS = [
  { left: '8%', delay: '0.05s', duration: '1.55s' },
  { left: '19%', delay: '0.18s', duration: '1.7s' },
  { left: '31%', delay: '0.35s', duration: '1.6s' },
  { left: '47%', delay: '0.12s', duration: '1.8s' },
  { left: '63%', delay: '0.28s', duration: '1.65s' },
  { left: '76%', delay: '0.42s', duration: '1.72s' },
  { left: '88%', delay: '0.22s', duration: '1.58s' }
]

export default function IntroOverlay() {
  return (
    <div className="intro-overlay" aria-hidden="true">
      <div className="intro-backdrop" />
      <div className="intro-nocturne-glow" />

      <div className="intro-meteors">
        {METEORS.map((meteor, idx) => (
          <span
            key={idx}
            className="intro-meteor"
            style={{
              left: meteor.left,
              animationDelay: meteor.delay,
              animationDuration: meteor.duration
            }}
          />
        ))}
      </div>

      <div className="intro-warm-rise" />

      <div className="intro-burst-wrap">
        <span className="intro-burst-core" />
        <span className="intro-burst-ring" />
        <span className="intro-burst-ring intro-burst-ring-2" />
      </div>
    </div>
  )
}

