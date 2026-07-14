// Inline 16px line icons, 1.6px stroke — recreated from the mock markup.
import type { CSSProperties } from 'react'

interface IconProps {
  size?: number
  stroke?: string
  style?: CSSProperties
}

const base = (size: number) => ({ width: size, height: size, fill: 'none' as const })

export function HomeIcon({ size = 17, stroke = 'currentColor', style }: IconProps) {
  return (
    <svg viewBox="0 0 17 17" style={style} {...base(size)}>
      <path
        d="M2 7.5L8.5 2L15 7.5V15H10.5V10.5H6.5V15H2V7.5Z"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function FeedIcon({ size = 16, stroke = 'currentColor', style }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" style={style} {...base(size)}>
      <path d="M2 3.5H14M2 8H14M2 12.5H9" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function PlusIcon({ size = 16, stroke = 'currentColor', style }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" style={style} {...base(size)}>
      <path d="M8 2V14M2 8H14" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function SearchIcon({ size = 16, stroke = 'currentColor', style }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" style={style} {...base(size)}>
      <circle cx="7" cy="7" r="5" stroke={stroke} strokeWidth="1.6" />
      <path d="M11 11L15 15" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function ApprovalsIcon({ size = 16, stroke = 'currentColor', style }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" style={style} {...base(size)}>
      <path
        d="M3 14V9M3 9V2M3 9H13M13 14V9M13 9V2"
        stroke={stroke}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function RightsIcon({ size = 16, stroke = 'currentColor', style }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" style={style} {...base(size)}>
      <circle cx="8" cy="5" r="3" stroke={stroke} strokeWidth="1.6" />
      <path
        d="M2.5 14.5C3.5 11.5 5.5 10 8 10C10.5 10 12.5 11.5 13.5 14.5"
        stroke={stroke}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function SettingsIcon({ size = 16, stroke = 'currentColor', style }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" style={style} {...base(size)}>
      <circle cx="8" cy="8" r="2.5" stroke={stroke} strokeWidth="1.6" />
      <circle cx="8" cy="8" r="6" stroke="rgba(255,255,255,.35)" strokeWidth="1.4" strokeDasharray="2.5 3" />
    </svg>
  )
}
