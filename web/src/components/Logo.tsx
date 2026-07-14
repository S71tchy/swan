export function Logo({ height = 34 }: { height?: number }) {
  return <img src="/agl-logo-white.svg" alt="AGL" style={{ height, width: 'auto' }} />
}

export function Wordmark({ size = 17 }: { size?: number }) {
  return (
    <div
      style={{
        font: `700 ${size}px var(--font-display)`,
        color: '#fff',
        letterSpacing: '2.5px',
      }}
    >
      SWAN
    </div>
  )
}
