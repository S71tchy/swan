import { useState } from 'react'

// Small circular flat country flag. Public-domain "circle-flags" set, bundled at
// /flags/{iso2}.svg (~0.5 KB each, already circular) — offline-safe and reusable
// site-wide in place of the emoji placeholders. Falls back to a neutral disc with
// the country code if a flag isn't bundled.
interface Props {
  code: string | null | undefined
  size?: number
  title?: string
  style?: React.CSSProperties
}

export function CountryFlag({ code, size = 16, title, style }: Props) {
  const cc = (code ?? '').trim().toLowerCase()
  const [errored, setErrored] = useState(false)
  const label = title ?? (code ?? '').toUpperCase()

  const base: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: '50%',
    flex: 'none',
    display: 'inline-block',
    verticalAlign: 'middle',
    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.2), 0 1px 2px rgba(0,0,0,.35)',
    ...style,
  }

  if (!cc || errored) {
    return (
      <span
        title={label}
        style={{
          ...base,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(255,255,255,.12)',
          color: 'var(--t-60)',
          font: `600 ${Math.round(size * 0.42)}px var(--font-display)`,
          letterSpacing: 0,
        }}
      >
        {(code ?? '').slice(0, 2).toUpperCase()}
      </span>
    )
  }

  return (
    <img
      src={`/flags/${cc}.svg`}
      width={size}
      height={size}
      alt={label}
      title={label}
      loading="lazy"
      onError={() => setErrored(true)}
      style={{ ...base, objectFit: 'cover' }}
    />
  )
}
