import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from './TopBar'
import { LeftRail } from './LeftRail'
import { MapBackdrop } from './MapBackdrop'
import { CountryFlag } from './CountryFlag'
import { Button } from './ui'
import { ArrowLeftIcon } from './icons'
import type { CountryRef } from '../types'

// Shared building blocks for the settings screens (Users, Profiles, Locations,
// Templates, Reference data, API): the page shell, the form input style, a
// labelled field, the right-hand editor drawer, the shared form controls, and
// the "manager access required" gate.

export const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 40,
  borderRadius: 10,
  background: 'rgba(255,255,255,.05)',
  border: '1px solid var(--border-strong)',
  padding: '0 12px',
  color: '#fff',
  font: '400 13px var(--font-body)',
  outline: 'none',
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ font: '500 11px var(--font-body)', color: 'var(--t-55)' }}>{label}</span>
      {children}
    </label>
  )
}

export function Drawer({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(6,11,20,.55)' }} />
      <div
        className="scroll-y"
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: 560,
          maxWidth: '100vw',
          background: 'var(--glass-slideover, rgba(15,27,46,.97))',
          borderLeft: '1px solid var(--border-mid)',
          backdropFilter: 'blur(20px)',
          boxShadow: '-30px 0 80px rgba(0,0,0,.5)',
          animation: 'swanSlideOver .28s ease-out',
          overflowY: 'auto',
        }}
      >
        {children}
      </div>
    </div>
  )
}

// --------------------------------------------------------------------------- //
// Page shell
//
// Every settings section is a child of the Settings home, so they all share the
// same frame: backdrop + top bar + rail, a "← Settings" crumb, the title block,
// and a right-aligned slot for that section's own actions. Keeping this in one
// place is what stops the header turning back into a navigation dumping ground.
// --------------------------------------------------------------------------- //
export function AdminScreen({
  title,
  description,
  actions,
  children,
}: {
  title: string
  description: string
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  const navigate = useNavigate()
  const [hover, setHover] = useState(false)
  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: 'var(--bg-deep)' }}>
      <MapBackdrop opacity={0.45} blur={2} overlay="rgba(8,14,26,.5)" />
      <TopBar breadcrumb={`Settings · ${title}`} showCreate={false} />
      <LeftRail />

      <div
        style={{
          position: 'absolute',
          left: 100,
          right: 24,
          top: 92,
          bottom: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          minHeight: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={() => navigate('/admin')}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '8px 14px',
              borderRadius: 10,
              cursor: 'pointer',
              border: '1px solid var(--border-soft)',
              background: hover ? 'rgba(255,255,255,.09)' : 'rgba(255,255,255,.05)',
              color: hover ? '#fff' : 'var(--t-70)',
              font: '600 12px var(--font-display)',
              flex: 'none',
            }}
          >
            <ArrowLeftIcon size={13} stroke="currentColor" />
            Settings
          </button>
          <div style={{ minWidth: 0 }}>
            <div style={{ font: '700 22px var(--font-display)', color: '#fff' }}>{title}</div>
            <div style={{ font: '400 12px var(--font-body)', color: 'var(--t-50)' }}>{description}</div>
          </div>
          <div style={{ flex: 1 }} />
          {actions}
        </div>

        {children}
      </div>
    </div>
  )
}

// --------------------------------------------------------------------------- //
// Shared form controls (used by the user, profile and place editors)
// --------------------------------------------------------------------------- //
export function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        width: 40,
        height: 22,
        borderRadius: 11,
        background: on ? 'var(--agl-yellow)' : 'rgba(255,255,255,.15)',
        position: 'relative',
        cursor: 'pointer',
        transition: 'background .15s',
        flex: 'none',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: on ? 20 : 2,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: on ? 'var(--agl-navy)' : 'rgba(255,255,255,.6)',
          transition: 'left .15s',
        }}
      />
    </div>
  )
}

export function ToggleRow({
  label,
  hint,
  on,
  onToggle,
}: {
  label: string
  hint: string
  on: boolean
  onToggle: () => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <div>
        <div style={{ font: '600 12.5px var(--font-body)', color: '#fff' }}>{label}</div>
        <div style={{ font: '400 11px var(--font-body)', color: 'var(--t-45)' }}>{hint}</div>
      </div>
      <Toggle on={on} onClick={onToggle} />
    </div>
  )
}

export function Chip({
  label,
  on,
  onClick,
}: {
  label: React.ReactNode
  on: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '6px 11px',
        borderRadius: 18,
        cursor: 'pointer',
        font: '500 11.5px var(--font-body)',
        color: on ? 'var(--agl-yellow)' : 'var(--t-65)',
        background: on ? 'var(--yellow-tint)' : 'transparent',
        border: `1px solid ${on ? 'var(--yellow-border-strong)' : 'rgba(255,255,255,.16)'}`,
      }}
    >
      {label}
    </button>
  )
}

export function PendingBadge() {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '2px 8px',
        borderRadius: 11,
        background: 'var(--yellow-tint)',
        border: '1px solid var(--yellow-border-strong)',
        font: '600 9.5px var(--font-display)',
        letterSpacing: '.5px',
        textTransform: 'uppercase',
        color: 'var(--agl-yellow)',
        flex: 'none',
      }}
    >
      <span className="glow-dot" style={{ width: 6, height: 6, background: 'var(--agl-yellow)' }} />
      Pending
    </span>
  )
}

export function CountryPicker({
  countries,
  selected,
  onToggle,
}: {
  countries: CountryRef[]
  selected: string[]
  onToggle: (code: string) => void
}) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  // Selected always visible; the rest filtered by the search box (54 countries).
  const shown = countries.filter(
    (c) => selected.includes(c.code) || !q || c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q),
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <input
        placeholder={`Filter ${countries.length} countries…`}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ ...inputStyle, height: 34, fontSize: 12 }}
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, maxHeight: 168, overflowY: 'auto' }} className="scroll-y">
        {shown.map((c) => (
          <Chip
            key={c.code}
            label={
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <CountryFlag code={c.code} size={14} title={c.name} />
                {c.code}
              </span>
            }
            on={selected.includes(c.code)}
            onClick={() => onToggle(c.code)}
          />
        ))}
        {shown.length === 0 && (
          <span style={{ font: '400 11.5px var(--font-body)', color: 'var(--t-40)' }}>No matches.</span>
        )}
      </div>
    </div>
  )
}

// Inline error box shared by every editor drawer.
export function FormError({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        borderRadius: 10,
        border: '1px solid rgba(207,69,39,.5)',
        background: 'rgba(207,69,39,.12)',
        padding: '10px 12px',
        font: '400 12px var(--font-body)',
        color: 'var(--sev-critical-text)',
      }}
    >
      {children}
    </div>
  )
}

// The panel every section's body sits in: one glass card that scrolls.
export const listPanelStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  borderRadius: 18,
  background: 'var(--glass-90)',
  border: '1px solid var(--border-mid)',
  backdropFilter: 'blur(18px)',
}

// Full-screen "you need Rights Manager" gate, shared by the gated sections.
export function AdminGate({ breadcrumb }: { breadcrumb: string }) {
  const navigate = useNavigate()
  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: 'var(--bg-deep)' }}>
      <MapBackdrop opacity={0.45} blur={2} overlay="rgba(8,14,26,.5)" />
      <TopBar breadcrumb={breadcrumb} showCreate={false} />
      <LeftRail />
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
        <div
          style={{
            width: 420,
            maxWidth: 'calc(100vw - 40px)',
            borderRadius: 18,
            background: 'var(--glass-90)',
            border: '1px solid var(--border-mid)',
            backdropFilter: 'blur(18px)',
            padding: 30,
            textAlign: 'center',
          }}
        >
          <div style={{ font: '600 17px var(--font-display)', color: '#fff', marginBottom: 8 }}>
            Rights Manager access required
          </div>
          <div style={{ font: '400 12.5px/1.6 var(--font-body)', color: 'var(--t-60)', marginBottom: 18 }}>
            This area manages users, profiles and reference data. Ask a Rights Manager to grant you access.
          </div>
          <Button variant="outline" onClick={() => navigate('/admin')}>
            Back to settings
          </Button>
        </div>
      </div>
    </div>
  )
}
