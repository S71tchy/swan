interface AvatarProps {
  initials: string
  size?: number
  gold?: boolean
  ring?: boolean
  onClick?: () => void
  title?: string
}

export function Avatar({ initials, size = 38, gold = false, ring = false, onClick, title }: AvatarProps) {
  const fontSize = Math.round(size * 0.32)
  return (
    <div
      onClick={onClick}
      title={title}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: gold ? 'var(--agl-yellow)' : 'var(--agl-navy)',
        border: ring
          ? '2px solid rgba(238,213,142,.5)'
          : gold
            ? 'none'
            : '1.5px solid rgba(255,255,255,.25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        font: `600 ${fontSize}px var(--font-display)`,
        color: gold ? 'var(--agl-navy)' : '#fff',
        cursor: onClick ? 'pointer' : 'default',
        flex: 'none',
      }}
    >
      {initials}
    </div>
  )
}
