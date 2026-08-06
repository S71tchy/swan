import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { CountryFlag } from './CountryFlag'
import { SEVERITY_COLOR, SEVERITY_LABEL } from '../lib/format'
import type { Alert } from '../types'

// --------------------------------------------------------------------------- //
// Live alert ticker
//
// A newsroom-style strip along the bottom of the dashboard carrying the most
// recently published alerts. It is deliberately a *view* of data the dashboard
// already holds — the same `scope=map` set the pins are drawn from, refreshed by
// the same 60s change-stamp poll — so it costs no extra network and can never
// disagree with the map. If the ticker names an alert, there is a pin for it.
//
// Two things here are less obvious than they look:
//
//   Constant speed. The item list is rendered twice and the track is translated
//   by -50%, so the loop seam is invisible. The animation *duration* is computed
//   from the measured track width rather than fixed, otherwise a quiet day with
//   three alerts would scroll them past at a crawl and a busy one would blur.
//
//   Pausing. A moving click target is genuinely hostile, so the track pauses on
//   hover and on keyboard focus, and honours prefers-reduced-motion by not
//   animating at all (it becomes a normal horizontally scrollable strip).
// --------------------------------------------------------------------------- //

/** Pixels per second. Slow enough to read a headline without chasing it. */
const SPEED = 42

/** How many headlines the ticker carries. */
const MAX_ITEMS = 10

function agoLabel(iso: string | null): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const mins = Math.floor((Date.now() - then) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

/** Countries on an alert, de-duplicated, in the order the author listed them. */
function countriesOf(alert: Alert): string[] {
  const seen: string[] = []
  for (const l of alert.locations ?? []) {
    if (l.country && !seen.includes(l.country)) seen.push(l.country)
  }
  return seen
}

export function tickerAlerts(alerts: Alert[]): Alert[] {
  // Newest first. `published_at` is the right key rather than `created_at`: the
  // ticker is a feed of what has been *announced*, and a draft written last week
  // and published this morning is this morning's news.
  return [...alerts]
    .sort((a, b) => {
      const at = a.published_at ?? a.created_at
      const bt = b.published_at ?? b.created_at
      return new Date(bt).getTime() - new Date(at).getTime()
    })
    .slice(0, MAX_ITEMS)
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    const mq = matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

function Headline({
  alert,
  isNew,
  onPick,
}: {
  alert: Alert
  isNew: boolean
  onPick: (a: Alert) => void
}) {
  const colour = SEVERITY_COLOR[alert.severity]
  const countries = countriesOf(alert)
  const when = agoLabel(alert.published_at)
  return (
    <button
      onClick={() => onPick(alert)}
      title={`${SEVERITY_LABEL[alert.severity]} · ${alert.title}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        height: 28,
        padding: '0 12px',
        borderRadius: 14,
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        color: 'var(--t-80)',
        font: '500 12px var(--font-body)',
        // The flash marks an alert that arrived in the most recent poll. It runs
        // once and settles to transparent, so it reads as "this just landed"
        // rather than as a permanent state.
        animation: isNew ? 'swanTickerNew 6s ease-out 1' : undefined,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: colour,
          flex: 'none',
          boxShadow: `0 0 8px ${colour}`,
        }}
      />
      {countries.slice(0, 2).map((cc) => (
        <CountryFlag key={cc} code={cc} size={14} />
      ))}
      {countries.length > 2 && (
        <span style={{ font: '500 10.5px var(--font-display)', color: 'var(--t-45)' }}>
          +{countries.length - 2}
        </span>
      )}
      <span style={{ color: '#fff' }}>{alert.title}</span>
      {when && <span style={{ color: 'var(--t-45)', font: '400 11px var(--font-body)' }}>{when}</span>}
    </button>
  )
}

export function AlertTicker({
  alerts,
  newIds,
  onPick,
  left,
  right,
}: {
  alerts: Alert[]
  /** Ids that arrived in the most recent refresh — flashed once on entry. */
  newIds: Set<string>
  onPick: (a: Alert) => void
  left: number
  right: number
}) {
  const items = useMemo(() => tickerAlerts(alerts), [alerts])
  const reduced = usePrefersReducedMotion()
  const trackRef = useRef<HTMLDivElement>(null)
  const [duration, setDuration] = useState(0)
  const [paused, setPaused] = useState(false)

  // Measure after layout so the first paint already has the right duration —
  // measuring in an effect would show one frame at the wrong speed.
  useLayoutEffect(() => {
    const el = trackRef.current
    if (!el) return
    // scrollWidth covers both copies; one loop travels half of it.
    const half = el.scrollWidth / 2
    setDuration(half > 0 ? half / SPEED : 0)
  }, [items, left, right])

  if (items.length === 0) return null

  const track = (
    <div
      ref={trackRef}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        animation: reduced || duration === 0 ? undefined : `swanTicker ${duration}s linear infinite`,
        animationPlayState: paused ? 'paused' : 'running',
        willChange: 'transform',
      }}
    >
      {/* Rendered twice so the loop has no visible seam. The duplicate is
          inert to assistive tech — it is the same ten alerts. */}
      {[0, 1].map((copy) => (
        <div key={copy} aria-hidden={copy === 1} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {items.map((a) => (
            <span key={`${copy}-${a.id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Headline alert={a} isNew={newIds.has(a.id)} onPick={onPick} />
              <span style={{ color: 'var(--t-25, rgba(255,255,255,.18))', font: '400 11px var(--font-body)' }}>•</span>
            </span>
          ))}
        </div>
      ))}
    </div>
  )

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      aria-label="Latest alerts"
      style={{
        position: 'absolute',
        left,
        right,
        bottom: 20,
        height: 40,
        borderRadius: 20,
        background: 'var(--glass-80)',
        border: '1px solid var(--border-soft)',
        backdropFilter: 'blur(14px)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        paddingLeft: 14,
        overflow: 'hidden',
        zIndex: 15,
        // The panel can appear and disappear beside it; ease the resize rather
        // than snapping the strip's width.
        transition: 'left .25s ease, right .25s ease',
      }}
    >
      <span
        style={{
          flex: 'none',
          font: '600 10px var(--font-display)',
          letterSpacing: '1.1px',
          textTransform: 'uppercase',
          color: 'var(--agl-yellow)',
        }}
      >
        Latest
      </span>
      <div
        className={reduced ? 'scroll-x' : undefined}
        style={{
          flex: 1,
          minWidth: 0,
          overflowX: reduced ? 'auto' : 'hidden',
          // Fade the strip out at the right edge so headlines dissolve rather
          // than being guillotined by the pill's border radius.
          maskImage: 'linear-gradient(to right, #000 92%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to right, #000 92%, transparent 100%)',
        }}
      >
        {track}
      </div>
    </div>
  )
}
