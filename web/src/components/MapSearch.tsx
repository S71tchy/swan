import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { CountryFlag } from './CountryFlag'
import { SearchIcon } from './icons'
import { SEVERITY_COLOR } from '../lib/format'
import type { Alert, Place } from '../types'

// Dashboard map search. Replaces the placeholder box that used to sit here —
// it looked like a search field but had no input, state or handler.
//
// Two result kinds: gazetteer LOCATIONS (fly the map there) and matching live
// ALERTS (open the detail panel). While a query is active the dashboard dims
// markers that don't match, so the map narrows as you type.

export interface MapSearchHandlers {
  onPickPlace: (p: Place) => void
  onPickAlert: (a: Alert) => void
  onQueryChange: (q: string) => void
}

/** Alerts whose title, location or country match the query. Exported so the
 *  dashboard dims the same set it would offer as results. */
export function matchAlerts(alerts: Alert[], query: string): Alert[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return alerts.filter((a) =>
    [a.title, a.category, ...a.locations.flatMap((l) => [l.name, l.country_name, l.country])]
      .join(' ')
      .toLowerCase()
      .includes(q),
  )
}

export function MapSearch({ alerts, onPickPlace, onPickAlert, onQueryChange }: MapSearchHandlers & { alerts: Alert[] }) {
  const [query, setQuery] = useState('')
  const [places, setPlaces] = useState<Place[]>([])
  const [open, setOpen] = useState(false)
  const [focus, setFocus] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const alertHits = matchAlerts(alerts, query).slice(0, 5)

  // Gazetteer lookup, debounced. This is the seam where a real geocoder goes in
  // Phase 2 — the places table already acts as the local cache/override layer.
  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setPlaces([])
      return
    }
    const t = setTimeout(() => {
      void api
        .places(q)
        .then((rows) => setPlaces(rows.slice(0, 6)))
        .catch(() => setPlaces([]))
    }, 180)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    onQueryChange(query)
  }, [query, onQueryChange])

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  // "/" focuses search, matching the feed.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = document.activeElement
      const typing =
        el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || (el as HTMLElement)?.isContentEditable
      if (e.key === '/' && !typing) {
        e.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  function clear() {
    setQuery('')
    setOpen(false)
  }

  const hasResults = places.length > 0 || alertHits.length > 0

  return (
    <div ref={ref} style={{ position: 'relative', width: 380 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          height: 42,
          padding: '0 16px',
          borderRadius: 21,
          background: 'rgba(22,38,63,.75)',
          border: `1px solid ${focus ? 'var(--yellow-border-strong)' : 'var(--border-mid)'}`,
          backdropFilter: 'blur(12px)',
          transition: 'border-color .12s',
        }}
      >
        <SearchIcon size={15} stroke={focus ? 'var(--agl-yellow)' : 'rgba(255,255,255,.5)'} />
        <input
          ref={inputRef}
          value={query}
          placeholder="Search country, city or port…"
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => {
            setFocus(true)
            setOpen(true)
          }}
          onBlur={() => setFocus(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              if (query) clear()
              else e.currentTarget.blur()
            }
            // Enter takes the first result — location first, else alert.
            if (e.key === 'Enter') {
              if (places[0]) {
                onPickPlace(places[0])
                setOpen(false)
              } else if (alertHits[0]) {
                onPickAlert(alertHits[0])
                setOpen(false)
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
            font: '400 13px var(--font-body)',
          }}
        />
        {query ? (
          <button
            onClick={clear}
            title="Clear"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t-45)', font: '600 15px var(--font-display)', lineHeight: 1, padding: 0 }}
          >
            ×
          </button>
        ) : (
          <kbd style={{ font: '600 10px var(--font-display)', color: 'var(--t-35)', border: '1px solid var(--border-soft)', borderRadius: 4, padding: '1px 5px' }}>
            /
          </kbd>
        )}
      </div>

      {open && query.trim() && (
        <div
          className="scroll-y"
          style={{
            position: 'absolute',
            top: 50,
            left: 0,
            right: 0,
            maxHeight: 380,
            overflowY: 'auto',
            padding: 6,
            borderRadius: 14,
            background: 'var(--glass-97)',
            border: '1px solid var(--border-strong)',
            boxShadow: 'var(--shadow-modal)',
            backdropFilter: 'blur(18px)',
            zIndex: 40,
            animation: 'swanFadeIn .12s ease',
          }}
        >
          {!hasResults && (
            <div style={{ padding: '12px 10px', font: '400 12px var(--font-body)', color: 'var(--t-45)' }}>
              Nothing matches “{query.trim()}”.
            </div>
          )}

          {places.length > 0 && <GroupLabel>Locations</GroupLabel>}
          {places.map((p) => (
            <ResultRow
              key={p.code}
              onClick={() => {
                onPickPlace(p)
                setOpen(false)
              }}
              leading={<CountryFlag code={p.country} size={15} />}
              title={p.name}
              meta={`${p.country_name} · ${p.code}`}
            />
          ))}

          {alertHits.length > 0 && <GroupLabel>Alerts on the map</GroupLabel>}
          {alertHits.map((a) => (
            <ResultRow
              key={a.id}
              onClick={() => {
                onPickAlert(a)
                setOpen(false)
              }}
              leading={
                <span
                  style={{ width: 9, height: 9, borderRadius: '50%', background: SEVERITY_COLOR[a.severity], flex: 'none' }}
                />
              }
              title={a.title}
              meta={`${a.category} · ${a.locations.map((l) => l.country).join(', ')}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: '8px 10px 4px',
        font: '600 9.5px var(--font-display)',
        letterSpacing: '1px',
        textTransform: 'uppercase',
        color: 'var(--t-40)',
      }}
    >
      {children}
    </div>
  )
}

function ResultRow({
  leading,
  title,
  meta,
  onClick,
}: {
  leading: React.ReactNode
  title: string
  meta: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,.06)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '8px 10px',
        borderRadius: 9,
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      {leading}
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'block', font: '500 12.5px var(--font-body)', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
        </span>
        <span style={{ display: 'block', font: '400 10.5px var(--font-body)', color: 'var(--t-45)' }}>{meta}</span>
      </span>
    </button>
  )
}
