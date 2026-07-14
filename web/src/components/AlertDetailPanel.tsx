import type { Alert } from '../types'
import {
  SEVERITY_COLOR,
  flowLabel,
  fmtDate,
  MODE_GLYPH,
  MODE_LABEL,
} from '../lib/format'
import { Avatar } from './Avatar'
import { CategoryChip, ChipOutline, SectionLabel, SeverityBadge } from './ui'

function TrackMotif({ color }: { color: string }) {
  return (
    <svg
      viewBox="0 0 380 120"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.5 }}
    >
      <path
        d="M0,85 Q60,55 120,75 T240,65 T380,80"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeDasharray="5 4"
        opacity="0.7"
      />
      <circle cx="240" cy="65" r="22" fill="none" stroke={color} strokeWidth="1.5" opacity="0.5" />
      <circle cx="240" cy="65" r="10" fill="none" stroke={color} strokeWidth="1.5" opacity="0.8" />
    </svg>
  )
}

interface Props {
  alert: Alert
  onClose: () => void
  onCloseAlert?: () => void
  canClose?: boolean
}

export function AlertDetailPanel({ alert, onClose, onCloseAlert, canClose }: Props) {
  const loc = alert.locations[0]
  const modes = loc?.modes ?? []
  const published = alert.published_at
    ? new Date(alert.published_at).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : ''

  return (
    <div
      style={{
        position: 'absolute',
        right: 20,
        top: 88,
        bottom: 20,
        width: 380,
        borderRadius: 18,
        background: 'var(--glass-92)',
        border: '1px solid var(--border-mid)',
        backdropFilter: 'blur(18px)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-panel)',
        zIndex: 25,
        animation: 'swanSlideIn .25s ease-out',
      }}
    >
      {/* header band */}
      <div
        style={{
          height: 120,
          background: 'linear-gradient(135deg,#1B365F,#0F2340)',
          position: 'relative',
          display: 'flex',
          alignItems: 'flex-end',
          padding: 16,
          flex: 'none',
        }}
      >
        <TrackMotif color={SEVERITY_COLOR[alert.severity]} />
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: 12,
            right: 14,
            background: 'transparent',
            border: 'none',
            color: 'var(--t-55)',
            font: '400 18px sans-serif',
          }}
        >
          ✕
        </button>
        <div style={{ position: 'relative', display: 'flex', gap: 8 }}>
          <SeverityBadge severity={alert.severity} />
          <CategoryChip>
            {alert.category}
            {alert.sub_category ? ` · ${alert.sub_category}` : ''}
          </CategoryChip>
        </div>
      </div>

      {/* body */}
      <div
        className="scroll-y"
        style={{
          flex: 1,
          padding: '18px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div style={{ font: '600 17px/1.35 var(--font-display)', color: '#fff' }}>{alert.title}</div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {modes.map((m) => (
            <ChipOutline key={m}>
              {MODE_GLYPH[m]} {MODE_LABEL[m]}
            </ChipOutline>
          ))}
          {loc && <ChipOutline>{flowLabel(loc.flow)}</ChipOutline>}
          {loc && (
            <ChipOutline accent>
              {loc.flag} {loc.name.split(' — ')[0]}, {loc.country}
            </ChipOutline>
          )}
        </div>

        <div>
          <SectionLabel style={{ marginBottom: 5 }}>Impact</SectionLabel>
          <div style={{ font: '400 12.5px/1.6 var(--font-body)', color: 'var(--t-80)' }}>
            {alert.impacts}
          </div>
        </div>

        <div>
          <SectionLabel style={{ marginBottom: 5 }}>Reactive action plan</SectionLabel>
          <div style={{ font: '400 12.5px/1.6 var(--font-body)', color: 'var(--t-80)' }}>
            {alert.action_plan}
          </div>
        </div>

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              paddingTop: 12,
              borderTop: '1px solid rgba(255,255,255,.08)',
            }}
          >
            <Avatar initials={alert.author.initials} size={30} />
            <div style={{ flex: 1 }}>
              <div style={{ font: '600 11.5px var(--font-body)', color: '#fff' }}>
                {alert.author.name} · {alert.author.branch}
              </div>
              <div style={{ font: '400 10.5px var(--font-body)', color: 'var(--t-40)' }}>
                {alert.status === 'published' ? `Published ${published}` : alert.status}
                {' · '}
                {alert.valid_to_label === 'until further notice'
                  ? 'until further notice'
                  : `until ${fmtDate(alert.valid_to)}`}
              </div>
            </div>
            {alert.urls.length > 0 && (
              <span style={{ font: '500 11px var(--font-body)', color: 'var(--agl-yellow)', cursor: 'pointer' }}>
                {alert.urls.length} source{alert.urls.length > 1 ? 's' : ''} ↗
              </span>
            )}
          </div>
          {canClose && onCloseAlert && (
            <button
              onClick={onCloseAlert}
              style={{
                alignSelf: 'flex-start',
                height: 32,
                padding: '0 14px',
                borderRadius: 16,
                background: 'transparent',
                border: '1px solid rgba(255,255,255,.2)',
                color: 'var(--t-75)',
                font: '500 11.5px var(--font-body)',
              }}
            >
              Close this alert
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
