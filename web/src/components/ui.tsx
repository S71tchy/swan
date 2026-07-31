import type { CSSProperties, ReactNode } from 'react'
import type { Severity } from '../types'
import { SEVERITY_COLOR, SEVERITY_LABEL } from '../lib/format'

export function GlowDot({ color, size = 8 }: { color: string; size?: number }) {
  return <span className="glow-dot" style={{ width: size, height: size, background: color }} />
}

export function SectionLabel({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        font: '600 10.5px var(--font-display)',
        color: 'var(--t-45)',
        textTransform: 'uppercase',
        letterSpacing: '1.2px',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// Solid severity badge (detail panel / approval preview header).
export function SeverityBadge({ severity }: { severity: Severity }) {
  const navyText = severity === 'watch' || severity === 'info'
  return (
    <span
      style={{
        padding: '4px 10px',
        borderRadius: 6,
        background: SEVERITY_COLOR[severity],
        font: "700 10.5px var(--font-display)",
        color: navyText ? 'var(--agl-navy)' : '#fff',
        letterSpacing: '1px',
      }}
    >
      {SEVERITY_LABEL[severity]}
    </span>
  )
}

export function ChipOutline({ children, accent = false }: { children: ReactNode; accent?: boolean }) {
  return (
    <span
      style={{
        padding: '3px 9px',
        borderRadius: 20,
        border: `1px solid ${accent ? 'var(--yellow-border-strong)' : 'rgba(255,255,255,.18)'}`,
        background: accent ? 'var(--yellow-tint-soft)' : 'transparent',
        font: '500 10.5px var(--font-body)',
        color: accent ? 'var(--agl-yellow)' : 'var(--t-75)',
      }}
    >
      {children}
    </span>
  )
}

export function CategoryChip({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        padding: '4px 10px',
        borderRadius: 6,
        background: 'rgba(255,255,255,.12)',
        font: '500 10.5px var(--font-body)',
        color: '#fff',
      }}
    >
      {children}
    </span>
  )
}

type BtnVariant = 'primary' | 'outline' | 'ghost' | 'danger'

export function Button({
  variant = 'primary',
  children,
  onClick,
  disabled,
  style,
  type = 'button',
}: {
  variant?: BtnVariant
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  style?: CSSProperties
  type?: 'button' | 'submit'
}) {
  const variants: Record<BtnVariant, CSSProperties> = {
    primary: {
      background: 'var(--agl-yellow)',
      color: 'var(--agl-navy)',
      font: '600 13px var(--font-display)',
      boxShadow: 'var(--shadow-cta)',
      border: 'none',
    },
    outline: {
      background: 'transparent',
      color: '#fff',
      font: '500 13px var(--font-body)',
      border: '1px solid rgba(255,255,255,.2)',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--t-60)',
      font: '500 13px var(--font-body)',
      border: '1px solid transparent',
    },
    danger: {
      background: 'transparent',
      color: 'var(--sev-critical-text)',
      font: '500 13px var(--font-body)',
      border: '1px solid rgba(207,69,39,.5)',
    },
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        height: 42,
        padding: '0 20px',
        borderRadius: 21,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        ...variants[variant],
        ...style,
      }}
    >
      {children}
    </button>
  )
}

/** Centred modal shell. Anything that takes over the screen for a focused
 *  sub-task uses this pair, so overlays don't drift apart visually — and so a
 *  tall form is never anchored to a control that might sit near the fold. */
export function ModalBackdrop({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  return (
    <div
      onClick={onClose ? (e) => e.target === e.currentTarget && onClose() : undefined}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(6,11,20,.6)',
        display: 'grid',
        placeItems: 'center',
        padding: 20,
        zIndex: 60,
        animation: 'swanFadeIn .15s ease',
      }}
    >
      {children}
    </div>
  )
}

export function ModalCard({
  width = 520,
  children,
  style,
}: {
  width?: number
  children: ReactNode
  style?: CSSProperties
}) {
  return (
    <div
      style={{
        width,
        maxWidth: 'calc(100vw - 40px)',
        // Never taller than the viewport: the body scrolls internally instead,
        // so the footer actions stay reachable without scrolling the page.
        maxHeight: 'calc(100vh - 40px)',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 18,
        background: 'var(--glass-97)',
        border: '1px solid var(--border-strong)',
        boxShadow: 'var(--shadow-modal)',
        padding: 26,
        animation: 'swanScaleIn .18s ease-out',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export function GlassPanel({
  children,
  style,
  className,
}: {
  children: ReactNode
  style?: CSSProperties
  className?: string
}) {
  return (
    <div
      className={className}
      style={{
        borderRadius: 18,
        background: 'var(--glass-90)',
        border: '1px solid var(--border-mid)',
        backdropFilter: 'blur(18px)',
        boxShadow: 'var(--shadow-panel)',
        ...style,
      }}
    >
      {children}
    </div>
  )
}
