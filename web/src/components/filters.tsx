import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronRightIcon, SearchIcon } from './icons'

// Filter-bar controls shared by the feed (and reusable by any future list
// screen). Everything reads from tokens.css — no hardcoded brand values.

const CONTROL_HEIGHT = 34

const controlBase: React.CSSProperties = {
  height: CONTROL_HEIGHT,
  borderRadius: 9,
  border: '1px solid var(--border-strong)',
  background: 'rgba(255,255,255,.05)',
  color: 'var(--t-70, rgba(255,255,255,.7))',
  font: '500 11.5px var(--font-body)',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 7,
  padding: '0 11px',
  whiteSpace: 'nowrap',
}

/** Closes the popover on outside click or Escape. */
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, close])
  return ref
}

// --------------------------------------------------------------------------- //
// Segmented control — a true view switch, visually distinct from filter chips
// so it never reads as "just another filter".
// --------------------------------------------------------------------------- //
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string; badge?: number }[]
  onChange: (v: T) => void
}) {
  return (
    <div
      role="tablist"
      style={{
        display: 'inline-flex',
        gap: 3,
        padding: 3,
        borderRadius: 11,
        background: 'rgba(255,255,255,.05)',
        border: '1px solid var(--border-soft)',
      }}
    >
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.value)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '7px 15px',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              font: '600 12px var(--font-display)',
              background: on ? 'var(--agl-yellow)' : 'transparent',
              color: on ? 'var(--agl-navy)' : 'var(--t-60)',
              transition: 'background .12s, color .12s',
            }}
          >
            {o.label}
            {o.badge != null && (
              <span
                style={{
                  font: '600 10px var(--font-display)',
                  padding: '1px 6px',
                  borderRadius: 8,
                  background: on ? 'rgba(27,54,95,.18)' : 'rgba(255,255,255,.09)',
                  color: on ? 'var(--agl-navy)' : 'var(--t-55)',
                }}
              >
                {o.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// --------------------------------------------------------------------------- //
// Search
// --------------------------------------------------------------------------- //
export function SearchField({
  value,
  onChange,
  placeholder = 'Search…',
  inputRef,
  width = 260,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  inputRef?: React.RefObject<HTMLInputElement>
  width?: number | string
}) {
  const [focus, setFocus] = useState(false)
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        height: CONTROL_HEIGHT,
        width,
        maxWidth: '100%',
        padding: '0 11px',
        borderRadius: 9,
        background: 'rgba(255,255,255,.05)',
        border: `1px solid ${focus ? 'var(--yellow-border-strong)' : 'var(--border-strong)'}`,
        transition: 'border-color .12s',
      }}
    >
      <SearchIcon size={14} stroke={focus ? 'var(--agl-yellow)' : 'var(--t-45)'} />
      <input
        ref={inputRef}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        // Escape clears rather than only blurring — faster to get back to "all".
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            if (value) {
              e.stopPropagation()
              onChange('')
            } else {
              e.currentTarget.blur()
            }
          }
        }}
        style={{
          flex: 1,
          minWidth: 0,
          background: 'none',
          border: 'none',
          outline: 'none',
          color: '#fff',
          font: '400 12px var(--font-body)',
        }}
      />
      {value ? (
        <button
          onClick={() => onChange('')}
          title="Clear search"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t-45)', font: '600 13px var(--font-display)', lineHeight: 1, padding: 0 }}
        >
          ×
        </button>
      ) : (
        <kbd
          style={{
            font: '600 9.5px var(--font-display)',
            color: 'var(--t-35)',
            border: '1px solid var(--border-soft)',
            borderRadius: 4,
            padding: '1px 5px',
          }}
        >
          /
        </kbd>
      )}
    </div>
  )
}

// --------------------------------------------------------------------------- //
// Dropdowns
// --------------------------------------------------------------------------- //
function Popover({ children, align = 'left' }: { children: ReactNode; align?: 'left' | 'right' }) {
  return (
    <div
      className="scroll-y"
      style={{
        position: 'absolute',
        top: CONTROL_HEIGHT + 6,
        [align]: 0,
        minWidth: 210,
        maxHeight: 320,
        overflowY: 'auto',
        padding: 6,
        borderRadius: 12,
        background: 'var(--glass-97)',
        border: '1px solid var(--border-strong)',
        boxShadow: 'var(--shadow-modal)',
        backdropFilter: 'blur(18px)',
        zIndex: 40,
        animation: 'swanFadeIn .12s ease',
      }}
    >
      {children}
    </div>
  )
}

const rowStyle = (on: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 9,
  width: '100%',
  padding: '7px 9px',
  borderRadius: 8,
  border: 'none',
  cursor: 'pointer',
  textAlign: 'left',
  background: on ? 'var(--yellow-tint)' : 'transparent',
  color: on ? 'var(--agl-yellow)' : 'var(--t-70, rgba(255,255,255,.7))',
  font: '500 12px var(--font-body)',
})

function Check({ on }: { on: boolean }) {
  return (
    <span
      style={{
        width: 14,
        height: 14,
        flex: 'none',
        borderRadius: 4,
        border: `1.5px solid ${on ? 'var(--agl-yellow)' : 'var(--t-30)'}`,
        background: on ? 'var(--agl-yellow)' : 'transparent',
        display: 'grid',
        placeItems: 'center',
        font: '700 9px var(--font-display)',
        color: 'var(--agl-navy)',
      }}
    >
      {on ? '✓' : ''}
    </span>
  )
}

export interface Option {
  value: string
  label: string
  /** Optional leading swatch/flag/dot. */
  adornment?: ReactNode
  count?: number
}

/** Multi-select filter. The trigger shows how many are active. */
export function MultiSelect({
  label,
  options,
  selected,
  onChange,
  searchable,
  align = 'left',
}: {
  label: string
  options: Option[]
  selected: string[]
  onChange: (next: string[]) => void
  searchable?: boolean
  align?: 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useDismiss(open, () => setOpen(false))
  const active = selected.length > 0

  const q = query.trim().toLowerCase()
  const shown = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options

  function toggle(v: string) {
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v])
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          ...controlBase,
          background: active ? 'var(--yellow-tint)' : 'rgba(255,255,255,.05)',
          border: `1px solid ${active ? 'var(--yellow-border-strong)' : 'var(--border-strong)'}`,
          color: active ? 'var(--agl-yellow)' : 'var(--t-70, rgba(255,255,255,.7))',
        }}
      >
        {label}
        {active && (
          <span
            style={{
              font: '600 10px var(--font-display)',
              padding: '1px 6px',
              borderRadius: 8,
              background: 'rgba(238,213,142,.22)',
            }}
          >
            {selected.length}
          </span>
        )}
        <span style={{ display: 'flex', transform: open ? 'rotate(-90deg)' : 'rotate(90deg)', transition: 'transform .12s' }}>
          <ChevronRightIcon size={11} stroke="currentColor" />
        </span>
      </button>

      {open && (
        <Popover align={align}>
          {searchable && (
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Filter ${options.length}…`}
              style={{
                width: '100%',
                height: 30,
                marginBottom: 4,
                borderRadius: 7,
                background: 'rgba(255,255,255,.05)',
                border: '1px solid var(--border-strong)',
                padding: '0 9px',
                color: '#fff',
                font: '400 11.5px var(--font-body)',
                outline: 'none',
              }}
            />
          )}
          {shown.map((o) => {
            const on = selected.includes(o.value)
            return (
              <button key={o.value} onClick={() => toggle(o.value)} style={rowStyle(on)}>
                <Check on={on} />
                {o.adornment}
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.label}</span>
                {o.count != null && (
                  <span style={{ font: '400 10.5px var(--font-body)', color: 'var(--t-40)' }}>{o.count}</span>
                )}
              </button>
            )
          })}
          {shown.length === 0 && (
            <div style={{ padding: '8px 9px', font: '400 11.5px var(--font-body)', color: 'var(--t-40)' }}>
              No matches.
            </div>
          )}
          {active && (
            <button
              onClick={() => onChange([])}
              style={{ ...rowStyle(false), marginTop: 4, borderTop: '1px solid var(--border-soft)', borderRadius: 0, color: 'var(--t-50)' }}
            >
              Clear {label.toLowerCase()}
            </button>
          )}
        </Popover>
      )}
    </div>
  )
}

/** Single-select dropdown (sort order). */
export function SelectMenu({
  label,
  options,
  value,
  onChange,
  align = 'right',
}: {
  label?: string
  options: Option[]
  value: string
  onChange: (v: string) => void
  align?: 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const ref = useDismiss(open, () => setOpen(false))
  const current = options.find((o) => o.value === value)

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen((o) => !o)} style={controlBase}>
        {label && <span style={{ color: 'var(--t-45)' }}>{label}</span>}
        {current?.label ?? value}
        <span style={{ display: 'flex', transform: open ? 'rotate(-90deg)' : 'rotate(90deg)', transition: 'transform .12s' }}>
          <ChevronRightIcon size={11} stroke="currentColor" />
        </span>
      </button>
      {open && (
        <Popover align={align}>
          {options.map((o) => (
            <button
              key={o.value}
              onClick={() => {
                onChange(o.value)
                setOpen(false)
              }}
              style={rowStyle(o.value === value)}
            >
              <span style={{ flex: 1 }}>{o.label}</span>
              {o.value === value && <span style={{ font: '700 11px var(--font-display)' }}>✓</span>}
            </button>
          ))}
        </Popover>
      )}
    </div>
  )
}

// --------------------------------------------------------------------------- //
// Active-filter summary
// --------------------------------------------------------------------------- //
export function FilterPill({
  children,
  color,
  onRemove,
}: {
  children: ReactNode
  color?: string
  onRemove: () => void
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 8px 3px 10px',
        borderRadius: 13,
        background: 'rgba(255,255,255,.06)',
        border: `1px solid ${color ?? 'var(--border-strong)'}`,
        font: '500 11px var(--font-body)',
        color: color ?? 'var(--t-70, rgba(255,255,255,.7))',
      }}
    >
      {children}
      <button
        onClick={onRemove}
        title="Remove filter"
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', font: '600 12px var(--font-display)', lineHeight: 1, padding: 0, opacity: 0.75 }}
      >
        ×
      </button>
    </span>
  )
}

/** Two-state icon switch for card density. */
export function DensityToggle({
  value,
  onChange,
}: {
  value: 'comfortable' | 'compact'
  onChange: (v: 'comfortable' | 'compact') => void
}) {
  const opts: { v: 'comfortable' | 'compact'; title: string; bars: number[] }[] = [
    { v: 'comfortable', title: 'Comfortable cards', bars: [4, 4] },
    { v: 'compact', title: 'Compact rows', bars: [2, 2, 2] },
  ]
  return (
    <div style={{ display: 'inline-flex', gap: 2, padding: 2, borderRadius: 9, background: 'rgba(255,255,255,.05)', border: '1px solid var(--border-strong)' }}>
      {opts.map((o) => {
        const on = o.v === value
        return (
          <button
            key={o.v}
            title={o.title}
            onClick={() => onChange(o.v)}
            style={{
              width: 28,
              height: 28,
              borderRadius: 7,
              border: 'none',
              cursor: 'pointer',
              background: on ? 'var(--yellow-tint)' : 'transparent',
              display: 'grid',
              placeItems: 'center',
              gap: 2,
              gridAutoRows: 'min-content',
              padding: 6,
            }}
          >
            {o.bars.map((_, i) => (
              <span
                key={i}
                style={{
                  display: 'block',
                  width: 14,
                  height: o.v === 'comfortable' ? 4 : 2,
                  borderRadius: 1,
                  background: on ? 'var(--agl-yellow)' : 'var(--t-40)',
                }}
              />
            ))}
          </button>
        )
      })}
    </div>
  )
}
