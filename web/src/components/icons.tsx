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

// --------------------------------------------------------------------------- //
// Settings-section icons — same 16px / 1.6px-stroke line family as above.
// --------------------------------------------------------------------------- //

export function UsersIcon({ size = 16, stroke = 'currentColor', style }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" style={style} {...base(size)}>
      <circle cx="6" cy="5.5" r="2.6" stroke={stroke} strokeWidth="1.6" />
      <path d="M1.5 14c.8-2.6 2.4-4 4.5-4s3.7 1.4 4.5 4" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M11 3.4a2.6 2.6 0 0 1 0 4.9M12.4 10.3c1.1.6 1.9 1.8 2.3 3.4" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function ProfilesIcon({ size = 16, stroke = 'currentColor', style }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" style={style} {...base(size)}>
      <rect x="1.5" y="3" width="13" height="10" rx="2" stroke={stroke} strokeWidth="1.6" />
      <circle cx="5.6" cy="7.2" r="1.7" stroke={stroke} strokeWidth="1.4" />
      <path d="M3.2 11c.5-1.2 1.4-1.8 2.4-1.8s1.9.6 2.4 1.8" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" />
      <path d="M10 6.6h3M10 9.4h3" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

export function PinIcon({ size = 16, stroke = 'currentColor', style }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" style={style} {...base(size)}>
      <path d="M8 14.5s5-4.6 5-8a5 5 0 0 0-10 0c0 3.4 5 8 5 8Z" stroke={stroke} strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="8" cy="6.4" r="1.9" stroke={stroke} strokeWidth="1.5" />
    </svg>
  )
}

export function MailIcon({ size = 16, stroke = 'currentColor', style }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" style={style} {...base(size)}>
      <rect x="1.5" y="3.5" width="13" height="9" rx="2" stroke={stroke} strokeWidth="1.6" />
      <path d="m2.5 5 5.5 4 5.5-4" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function CodeIcon({ size = 16, stroke = 'currentColor', style }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" style={style} {...base(size)}>
      <path d="m5.2 4.8-3.4 3.2 3.4 3.2M10.8 4.8l3.4 3.2-3.4 3.2" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.4 2.6 6.6 13.4" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

export function BookIcon({ size = 16, stroke = 'currentColor', style }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" style={style} {...base(size)}>
      <path d="M2 3.2c1.8-.7 4-.7 6 .6v9c-2-1.3-4.2-1.3-6-.6V3.2Z" stroke={stroke} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M14 3.2c-1.8-.7-4-.7-6 .6v9c2-1.3 4.2-1.3 6-.6V3.2Z" stroke={stroke} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  )
}

export function BellIcon({ size = 16, stroke = 'currentColor', style }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" style={style} {...base(size)}>
      <path d="M4 7a4 4 0 0 1 8 0c0 2.4.6 3.6 1.2 4.3H2.8C3.4 10.6 4 9.4 4 7Z" stroke={stroke} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M6.6 13.2a1.6 1.6 0 0 0 2.8 0" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function ChevronRightIcon({ size = 16, stroke = 'currentColor', style }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" style={style} {...base(size)}>
      <path d="m6 3.5 5 4.5-5 4.5" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function ArrowLeftIcon({ size = 16, stroke = 'currentColor', style }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" style={style} {...base(size)}>
      <path d="M13 8H3M6.5 4.2 2.8 8l3.7 3.8" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function ExternalLinkIcon({ size = 16, stroke = 'currentColor', style }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" style={style} {...base(size)}>
      <path d="M12.5 9.2v3.3a1.6 1.6 0 0 1-1.6 1.6H3.6A1.6 1.6 0 0 1 2 12.5V5.2a1.6 1.6 0 0 1 1.6-1.6h3.3" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 2h4v4M14 2 7.6 8.4" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
