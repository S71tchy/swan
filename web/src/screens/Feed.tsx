import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { TopBar } from '../components/TopBar'
import { LeftRail } from '../components/LeftRail'
import { MapBackdrop } from '../components/MapBackdrop'
import { AlertDetailPanel } from '../components/AlertDetailPanel'
import { CountryFlag } from '../components/CountryFlag'
import { Avatar } from '../components/Avatar'
import { CategoryChip, ChipOutline, SectionLabel, SeverityBadge } from '../components/ui'
import {
  DensityToggle,
  FilterPill,
  MultiSelect,
  SearchField,
  SegmentedControl,
  SelectMenu,
  type Option,
} from '../components/filters'
import {
  MODE_GLYPH,
  MODE_LABEL,
  SEVERITY_COLOR,
  SEVERITY_LABEL,
  SEVERITY_TEXT,
  fmtAgo,
  fmtFeedTime,
  dayGroup,
  modesLabel,
  placeLabel,
  locationLabel,
  alertSources,
} from '../lib/format'
import type { Alert, AlertStatus, Severity } from '../types'

const DAY_ORDER = ['Today', 'Yesterday', 'Earlier this week', 'Earlier']
const SEVERITIES: Severity[] = ['critical', 'warning', 'watch', 'info']
const MINE_STATUSES: AlertStatus[] = ['draft', 'rejected', 'submitted', 'published', 'closed']

type View = 'feed' | 'mine'
type Scope = 'all' | 'perimeter'
type Density = 'comfortable' | 'compact'
type Sort = 'newest' | 'oldest' | 'severity'

const SORTS: Option[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'severity', label: 'Most severe first' },
]
const SEVERITY_RANK: Record<Severity, number> = { critical: 0, warning: 1, watch: 2, info: 3 }

const STATUS_STYLE: Record<AlertStatus, { label: string; color: string; navy?: boolean }> = {
  draft: { label: 'Draft', color: 'var(--agl-grey)', navy: true },
  submitted: { label: 'Submitted', color: 'var(--sev-watch)', navy: true },
  published: { label: 'Published', color: 'var(--agl-turquoise)', navy: true },
  rejected: { label: 'Rejected', color: 'var(--sev-critical)' },
  closed: { label: 'Closed', color: 'rgba(255,255,255,.25)' },
  expired: { label: 'Expired', color: 'rgba(255,255,255,.25)' },
}

function StatusBadge({ status }: { status: AlertStatus }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.draft
  return (
    <span
      style={{
        padding: '3px 9px',
        borderRadius: 6,
        background: s.color,
        font: '700 9.5px var(--font-display)',
        color: s.navy ? 'var(--agl-navy)' : '#fff',
        letterSpacing: '.8px',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {s.label}
    </span>
  )
}

// --------------------------------------------------------------------------- //
// Search
// --------------------------------------------------------------------------- //
/** Everything a query is matched against — kept in one place so the haystack
 *  and the highlighter can never drift apart. */
function haystack(a: Alert): string {
  return [
    a.title,
    a.description,
    a.impacts,
    a.action_plan,
    a.category,
    a.sub_category,
    a.industry ?? '',
    a.author.name,
    ...a.locations.flatMap((l) => [l.name, l.country_name, l.country, ...l.modes]),
  ]
    .join(' ')
    .toLowerCase()
}

/** Wraps case-insensitive matches of `q` in a highlight span. */
function Highlight({ text, q }: { text: string; q: string }) {
  if (!q.trim()) return <>{text}</>
  const needle = q.trim().toLowerCase()
  const out: ReactNode[] = []
  let i = 0
  let n = 0
  const lower = text.toLowerCase()
  while (i < text.length) {
    const at = lower.indexOf(needle, i)
    if (at === -1) {
      out.push(text.slice(i))
      break
    }
    if (at > i) out.push(text.slice(i, at))
    out.push(
      <mark
        key={n++}
        style={{ background: 'rgba(238,213,142,.28)', color: 'inherit', borderRadius: 3, padding: '0 1px' }}
      >
        {text.slice(at, at + needle.length)}
      </mark>,
    )
    i = at + needle.length
  }
  return <>{out}</>
}

// --------------------------------------------------------------------------- //
// Cards
// --------------------------------------------------------------------------- //
/** Every country on the alert, deduped — not just locations[0]. */
function LocationSummary({ alert, size = 13 }: { alert: Alert; size?: number }) {
  const countries = [...new Set(alert.locations.map((l) => l.country).filter(Boolean))]
  const first = alert.locations[0]
  if (!first) return null
  const extra = alert.locations.length - 1
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
      {countries.slice(0, 3).map((c) => (
        <CountryFlag key={c} code={c} size={size} title={c} />
      ))}
      {countries.length > 3 && (
        <span style={{ font: '500 10px var(--font-display)', color: 'var(--t-40)' }}>+{countries.length - 3}</span>
      )}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {locationLabel(first)}
        {extra > 0 && <span style={{ color: 'var(--t-40)' }}> +{extra} more</span>}
      </span>
    </span>
  )
}

/** The feed card uses the same vocabulary as AlertDetailPanel — solid severity
 *  badge, category chip, outlined fact chips, section-labelled body, avatar
 *  footer — so the card and the panel read as one thing at two zoom levels.
 *  It previously flattened all of that into two runs of muted grey text. */
function FeedCard({ alert, q, onClick }: { alert: Alert; q: string; onClick: () => void }) {
  const [hover, setHover] = useState(false)
  const modes = [...new Set(alert.locations.flatMap((l) => l.modes))]
  // Impact is the operationally useful field; description is often a restatement
  // of the title, so it's only the fallback.
  const body = alert.impacts?.trim() || alert.description
  const bodyLabel = alert.impacts?.trim() ? 'Impact' : 'Summary'
  const sources = alertSources(alert.urls)

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        borderRadius: 14,
        background: hover ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,.04)',
        border: '1px solid rgba(255,255,255,.09)',
        borderTop: `3px solid ${SEVERITY_COLOR[alert.severity]}`,
        padding: '14px 16px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        cursor: 'pointer',
        transform: hover ? 'translateY(-1px)' : 'none',
        transition: 'background .12s, transform .12s',
        minWidth: 0,
        overflow: 'hidden',
      }}
    >
      {/* Picture band. Bleeds to the card edges by cancelling the card padding,
          so it reads as part of the card rather than an inset thumbnail. */}
      {alert.picture_url && (
        <img
          src={alert.picture_url}
          alt=""
          style={{
            margin: '-14px -16px 0',
            width: 'calc(100% + 32px)',
            height: 132,
            objectFit: 'cover',
            display: 'block',
          }}
        />
      )}

      {/* status row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <SeverityBadge severity={alert.severity} />
        <CategoryChip>
          {alert.category}
          {alert.sub_category ? ` · ${alert.sub_category}` : ''}
        </CategoryChip>
        <span style={{ flex: 1 }} />
        <span
          style={{ font: '500 10.5px var(--font-body)', color: 'var(--t-50)', flex: 'none', whiteSpace: 'nowrap' }}
        >
          {fmtFeedTime(alert.published_at)}
        </span>
      </div>

      <div style={{ font: '600 15px/1.35 var(--font-display)', color: '#fff' }}>
        <Highlight text={alert.title} q={q} />
      </div>

      {body && (
        <div>
          <SectionLabel style={{ marginBottom: 4 }}>{bodyLabel}</SectionLabel>
          <div
            style={{
              font: '400 12px/1.6 var(--font-body)',
              color: 'var(--t-75)',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            <Highlight text={body} q={q} />
          </div>
        </div>
      )}

      {/* facts — each one its own chip instead of a middot-separated run */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {modes.map((m) => (
          <ChipOutline key={m}>
            {MODE_GLYPH[m]} {MODE_LABEL[m]}
          </ChipOutline>
        ))}
        {alert.locations.slice(0, 2).map((l, i) => (
          <ChipOutline key={`${l.code}-${i}`} accent>
            <CountryFlag code={l.country} size={12} title={l.country_name} style={{ marginRight: 4 }} />
            {l.scope === 'country' ? locationLabel(l) : `${placeLabel(l.name)}, ${l.country}`}
          </ChipOutline>
        ))}
        {alert.locations.length > 2 && (
          <ChipOutline accent>+{alert.locations.length - 2} more</ChipOutline>
        )}
        <ChipOutline>
          {alert.valid_to_label === 'until further notice'
            ? 'Until further notice'
            : `Until ${alert.valid_to_label}`}
        </ChipOutline>
      </div>

      {/* author footer, divided like the panel's */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          paddingTop: 10,
          borderTop: '1px solid rgba(255,255,255,.08)',
          minWidth: 0,
        }}
      >
        <Avatar initials={alert.author.initials} size={24} />
        <span
          style={{
            font: '500 11px var(--font-body)',
            color: 'var(--t-65)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {alert.author.name}
          {alert.author.branch && <span style={{ color: 'var(--t-40)' }}> · {alert.author.branch}</span>}
        </span>
        {sources.length > 0 && (
          <>
            <span style={{ flex: 1 }} />
            {/* The card itself opens the detail panel, so the source link has to
                stop the click from bubbling or it would do both. */}
            <a
              href={sources[0].href}
              target="_blank"
              rel="noopener noreferrer"
              title={sources[0].href}
              onClick={(e) => e.stopPropagation()}
              style={{
                font: '500 10.5px var(--font-body)',
                color: 'var(--agl-yellow)',
                textDecoration: 'none',
                flex: 'none',
                maxWidth: 130,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {sources[0].label}
              {sources.length > 1 ? ` +${sources.length - 1}` : ''} ↗
            </a>
          </>
        )}
      </div>
    </div>
  )
}

/** Compact density: one scannable row per alert. */
function FeedRow({ alert, q, onClick }: { alert: Alert; q: string; onClick: () => void }) {
  const modes = [...new Set(alert.locations.flatMap((l) => l.modes))]
  return (
    <div
      onClick={onClick}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,.06)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,.03)')}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '9px 14px',
        borderRadius: 10,
        background: 'rgba(255,255,255,.03)',
        border: '1px solid rgba(255,255,255,.07)',
        borderLeft: `3px solid ${SEVERITY_COLOR[alert.severity]}`,
        cursor: 'pointer',
        minWidth: 0,
      }}
    >
      <span
        style={{
          font: '700 9.5px var(--font-display)',
          letterSpacing: '.8px',
          color: SEVERITY_TEXT[alert.severity],
          width: 62,
          flex: 'none',
        }}
      >
        {alert.severity.toUpperCase()}
      </span>
      <span style={{ font: '600 12.5px var(--font-display)', color: '#fff', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        <Highlight text={alert.title} q={q} />
      </span>
      <span style={{ font: '400 11px var(--font-body)', color: 'var(--t-45)', flex: 'none' }}>
        <LocationSummary alert={alert} size={12} />
      </span>
      <span style={{ font: '400 11px var(--font-body)', color: 'var(--t-40)', flex: 'none', width: 110, textAlign: 'right' }}>
        {modesLabel(modes)}
      </span>
      <span style={{ font: '400 10.5px var(--font-body)', color: 'var(--t-35)', flex: 'none', width: 92, textAlign: 'right' }}>
        {fmtFeedTime(alert.published_at)}
      </span>
    </div>
  )
}

// Mirrors the server's routing_for_locations: an editable alert will publish
// directly only if the author holds internal rights for every location country.
function routeHint(
  a: Alert,
  perimeter: string[],
  canCreate: boolean,
): { publish: boolean; uncovered: string[] } | null {
  if (a.status !== 'draft' && a.status !== 'rejected') return null
  const countries = [...new Set(a.locations.map((l) => l.country).filter(Boolean))]
  if (countries.length === 0) return null
  const uncovered = countries.filter((c) => !perimeter.includes(c))
  return { publish: canCreate && uncovered.length === 0, uncovered }
}

function MineRow({
  alert: a,
  q,
  perimeter,
  canCreate,
  onEdit,
  onView,
}: {
  alert: Alert
  q: string
  perimeter: string[]
  canCreate: boolean
  onEdit: (a: Alert) => void
  onView: (a: Alert) => void
}) {
  const editable = a.status === 'draft' || a.status === 'rejected'
  const route = routeHint(a, perimeter, canCreate)
  return (
    <div
      onClick={() => (editable ? onEdit(a) : onView(a))}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        borderRadius: 12,
        background: 'rgba(255,255,255,.035)',
        border: '1px solid rgba(255,255,255,.08)',
        borderLeft: `3px solid ${SEVERITY_COLOR[a.severity]}`,
        padding: '13px 16px',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,.06)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,.035)')}
    >
      <StatusBadge status={a.status} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ font: '600 13.5px var(--font-display)', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          <Highlight text={a.title || '(untitled draft)'} q={q} />
        </div>
        <div style={{ font: '400 11px var(--font-body)', color: 'var(--t-45)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span>{a.category}</span>
          {a.locations.length > 0 && (
            <>
              <span>·</span>
              <LocationSummary alert={a} size={12} />
            </>
          )}
          <span>· updated {fmtAgo(a.updated_at)}</span>
          {a.status === 'rejected' && a.rejection_comment && (
            <span style={{ color: 'var(--sev-critical-text)' }}>· “{a.rejection_comment}”</span>
          )}
        </div>
      </div>
      {route && (
        <span
          title={
            route.publish
              ? 'You hold publication rights for every location — this will publish directly.'
              : `You lack rights for ${route.uncovered.join(', ')} — this will route to an approver.`
          }
          style={{
            padding: '3px 9px',
            borderRadius: 12,
            whiteSpace: 'nowrap',
            font: '500 10.5px var(--font-body)',
            color: route.publish ? 'var(--agl-turquoise)' : 'var(--sev-warning)',
            background: route.publish ? 'rgba(0,166,193,.12)' : 'rgba(237,140,0,.12)',
            border: `1px solid ${route.publish ? 'rgba(0,166,193,.4)' : 'rgba(237,140,0,.4)'}`,
          }}
        >
          {route.publish ? 'Will publish' : 'Will submit for approval'}
        </span>
      )}
      <span style={{ font: '500 11.5px var(--font-body)', color: editable ? 'var(--agl-yellow)' : 'var(--t-45)', whiteSpace: 'nowrap' }}>
        {editable ? 'Continue →' : 'View'}
      </span>
    </div>
  )
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div style={{ color: 'var(--t-45)', font: '400 13px/1.7 var(--font-body)', textAlign: 'center', marginTop: 50 }}>
      {children}
    </div>
  )
}

// --------------------------------------------------------------------------- //
// Screen
// --------------------------------------------------------------------------- //
export default function Feed() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [selected, setSelected] = useState<Alert | null>(null)
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null)
  const [, forceTick] = useState(0)
  const searchRef = useRef<HTMLInputElement>(null)

  // ---- URL-backed state: every filter is shareable and survives back/forward
  const view = (params.get('view') as View) || 'feed'
  const scope = (params.get('scope') as Scope) || 'all'
  const query = params.get('q') ?? ''
  const sort = (params.get('sort') as Sort) || 'newest'
  const density = (params.get('density') as Density) || 'comfortable'
  const sevFilter = useMemo(() => (params.get('sev') ? params.get('sev')!.split(',') : []), [params])
  const catFilter = useMemo(() => (params.get('cat') ? params.get('cat')!.split(',') : []), [params])
  const countryFilter = useMemo(() => (params.get('country') ? params.get('country')!.split(',') : []), [params])
  const statusFilter = useMemo(() => (params.get('status') ? params.get('status')!.split(',') : []), [params])

  const setParam = useCallback(
    (key: string, value: string | string[] | null) => {
      const next = new URLSearchParams(params)
      const v = Array.isArray(value) ? value.join(',') : value
      if (!v) next.delete(key)
      else next.set(key, v)
      // Typing replaces (one history entry per keystroke would make Back
      // useless); discrete toggles push, so Back undoes a filter.
      const replace = key === 'q' || key === 'focus'
      setParams(next, { replace })
    },
    [params, setParams],
  )

  // 'mine' pulls the caller's own alerts across every status; the feed reads the
  // published set and filters client-side.
  const load = useCallback(() => {
    const source = view === 'mine' ? 'mine' : 'published'
    return api
      .feed(source)
      .then((rows) => {
        setAlerts(rows)
        setFetchedAt(new Date())
      })
      .catch(() => setAlerts([]))
  }, [view])

  useEffect(() => {
    void load()
  }, [load])

  // Keep the "updated Nm ago" label honest without refetching.
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 30_000)
    return () => clearInterval(t)
  }, [])

  // "/" focuses search from anywhere on the screen; the rail's Search icon
  // deep-links here with ?focus=search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement
      const typing = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || (el as HTMLElement)?.isContentEditable
      if (e.key === '/' && !typing) {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (params.get('focus') === 'search') {
      searchRef.current?.focus()
      setParam('focus', null)
    }
  }, [params, setParam])

  const perimeter = user?.rights.internal_countries ?? []

  // Scope narrows the candidate set; counts below are derived from THIS, so the
  // chips always agree with what the body is showing.
  const scoped = useMemo(() => {
    if (view === 'mine' || scope !== 'perimeter') return alerts
    return alerts.filter((a) => a.locations.some((l) => perimeter.includes(l.country)))
  }, [alerts, view, scope, perimeter])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const out = scoped.filter((a) => {
      if (sevFilter.length && !sevFilter.includes(a.severity)) return false
      if (catFilter.length && !catFilter.includes(a.category)) return false
      if (countryFilter.length && !a.locations.some((l) => countryFilter.includes(l.country))) return false
      if (view === 'mine' && statusFilter.length && !statusFilter.includes(a.status)) return false
      if (q && !haystack(a).includes(q)) return false
      return true
    })
    const time = (a: Alert) => (view === 'mine' ? a.updated_at : a.published_at || a.created_at) ?? ''
    out.sort((a, b) => {
      if (sort === 'severity') {
        const d = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
        if (d !== 0) return d
        return time(b).localeCompare(time(a))
      }
      return sort === 'oldest' ? time(a).localeCompare(time(b)) : time(b).localeCompare(time(a))
    })
    return out
  }, [scoped, query, sevFilter, catFilter, countryFilter, statusFilter, sort, view])

  const counts = useMemo(() => {
    const c: Record<Severity, number> = { critical: 0, warning: 0, watch: 0, info: 0 }
    for (const a of scoped) c[a.severity]++
    return c
  }, [scoped])

  // Filter options come from the loaded data, so we never offer a category or
  // country that would return nothing.
  const categoryOptions: Option[] = useMemo(() => {
    const m = new Map<string, number>()
    for (const a of scoped) m.set(a.category, (m.get(a.category) ?? 0) + 1)
    return [...m.entries()].sort().map(([value, count]) => ({ value, label: value, count }))
  }, [scoped])

  const countryOptions: Option[] = useMemo(() => {
    const m = new Map<string, { name: string; n: number }>()
    for (const a of scoped)
      for (const l of a.locations) {
        if (!l.country) continue
        const cur = m.get(l.country)
        m.set(l.country, { name: l.country_name || l.country, n: (cur?.n ?? 0) + 1 })
      }
    return [...m.entries()]
      .sort((a, b) => a[1].name.localeCompare(b[1].name))
      .map(([value, v]) => ({
        value,
        label: v.name,
        count: v.n,
        adornment: <CountryFlag code={value} size={13} />,
      }))
  }, [scoped])

  const groups = useMemo(() => {
    if (sort === 'severity') return null // severity order would fight day grouping
    const map = new Map<string, Alert[]>()
    for (const a of visible) {
      const g = dayGroup(view === 'mine' ? a.updated_at : a.published_at)
      if (!map.has(g)) map.set(g, [])
      map.get(g)!.push(a)
    }
    return DAY_ORDER.filter((g) => map.has(g)).map((g) => [g, map.get(g)!] as const)
  }, [visible, sort, view])

  const activeCount =
    sevFilter.length +
    catFilter.length +
    countryFilter.length +
    (view === 'mine' ? statusFilter.length : 0) +
    (scope === 'perimeter' ? 1 : 0) +
    (query.trim() ? 1 : 0)

  function clearAll() {
    const next = new URLSearchParams(params)
    for (const k of ['q', 'sev', 'cat', 'country', 'status', 'scope']) next.delete(k)
    setParams(next)
  }

  const updatedLabel = fetchedAt ? `Updated ${fmtAgo(fetchedAt.toISOString())}` : 'Loading…'

  // Cards grow with the viewport rather than multiplying: the track floor is 340px
  // on a laptop but scales to ~20% of the panel on a wide monitor, so a 4K display
  // gets ~6 readable columns instead of ten narrow ones.
  const gridStyle: React.CSSProperties =
    density === 'comfortable'
      ? {
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(340px, 20%, 560px), 1fr))',
          gap: 12,
        }
      : { display: 'flex', flexDirection: 'column', gap: 6 }

  const renderItems = (rows: Alert[]) =>
    rows.map((a) =>
      density === 'comfortable' ? (
        <FeedCard key={a.id} alert={a} q={query} onClick={() => setSelected(a)} />
      ) : (
        <FeedRow key={a.id} alert={a} q={query} onClick={() => setSelected(a)} />
      ),
    )

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: 'var(--bg-deep)' }}>
      <MapBackdrop opacity={0.45} blur={2} overlay="rgba(8,14,26,.5)" />
      <TopBar breadcrumb="Live feed" />
      <LeftRail />

      <div
        style={{
          position: 'absolute',
          left: 100,
          right: 24,
          top: 92,
          bottom: 24,
          borderRadius: 18,
          background: 'var(--glass-90)',
          border: '1px solid var(--border-mid)',
          backdropFilter: 'blur(18px)',
          boxShadow: 'var(--shadow-panel)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* ---- title row: view switch lives here, not with the filters ---- */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '16px 26px 14px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ font: '600 17px var(--font-display)', color: '#fff' }}>Live feed</div>
          <SegmentedControl<View>
            value={view}
            onChange={(v) => {
              // status only applies to My alerts — drop it when leaving
              const next = new URLSearchParams(params)
              next.set('view', v)
              if (v === 'feed') next.delete('status')
              else next.delete('scope')
              setParams(next)
            }}
            options={[
              { value: 'feed', label: 'Feed' },
              { value: 'mine', label: 'My alerts' },
            ]}
          />
          <div style={{ flex: 1 }} />
          <button
            onClick={() => void load()}
            title="Refresh now"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              height: 28,
              padding: '0 12px',
              borderRadius: 14,
              cursor: 'pointer',
              background: 'rgba(255,255,255,.05)',
              border: '1px solid var(--border-soft)',
            }}
          >
            <span className="glow-dot" style={{ width: 7, height: 7, background: 'var(--agl-orange)' }} />
            <span style={{ font: '500 11px var(--font-body)', color: 'var(--t-65)' }}>{updatedLabel}</span>
          </button>
        </div>

        {/* ---- filter bar ---- */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '0 26px 14px',
            flexWrap: 'wrap',
          }}
        >
          <SearchField
            value={query}
            onChange={(v) => setParam('q', v)}
            inputRef={searchRef}
            placeholder={view === 'mine' ? 'Search my alerts…' : 'Search alerts, places, people…'}
          />

          {view === 'feed' ? (
            <SelectMenu
              align="left"
              options={[
                { value: 'all', label: 'All alerts' },
                { value: 'perimeter', label: 'My perimeter' },
              ]}
              value={scope}
              onChange={(v) => setParam('scope', v === 'all' ? null : v)}
            />
          ) : (
            <MultiSelect
              label="Status"
              options={MINE_STATUSES.map((s) => ({ value: s, label: STATUS_STYLE[s].label }))}
              selected={statusFilter}
              onChange={(v) => setParam('status', v)}
            />
          )}

          {/* severity chips keep their own colour when active — you can tell
              at a glance WHICH severity is filtered, not just that one is */}
          <div style={{ display: 'flex', gap: 6 }}>
            {SEVERITIES.map((s) => {
              const on = sevFilter.includes(s)
              return (
                <button
                  key={s}
                  onClick={() =>
                    setParam('sev', on ? sevFilter.filter((x) => x !== s) : [...sevFilter, s])
                  }
                  title={SEVERITY_LABEL[s]}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    height: 34,
                    padding: '0 11px',
                    borderRadius: 9,
                    cursor: 'pointer',
                    border: `1px solid ${on ? SEVERITY_COLOR[s] : 'var(--border-strong)'}`,
                    background: on ? `color-mix(in srgb, ${SEVERITY_COLOR[s]} 16%, transparent)` : 'transparent',
                    font: '600 11.5px var(--font-display)',
                    color: on ? SEVERITY_TEXT[s] : 'var(--t-55)',
                  }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: SEVERITY_COLOR[s] }} />
                  {counts[s]}
                </button>
              )
            })}
          </div>

          <MultiSelect
            label="Category"
            options={categoryOptions}
            selected={catFilter}
            onChange={(v) => setParam('cat', v)}
          />
          <MultiSelect
            label="Country"
            options={countryOptions}
            selected={countryFilter}
            onChange={(v) => setParam('country', v)}
            searchable
          />

          <div style={{ flex: 1 }} />
          <SelectMenu options={SORTS} value={sort} onChange={(v) => setParam('sort', v === 'newest' ? null : v)} />
          <DensityToggle
            value={density}
            onChange={(v) => setParam('density', v === 'comfortable' ? null : v)}
          />
        </div>

        {/* ---- result summary + active filters ---- */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '0 26px 14px',
            flexWrap: 'wrap',
            borderBottom: '1px solid rgba(255,255,255,.08)',
            paddingBottom: 14,
          }}
        >
          <span style={{ font: '500 11.5px var(--font-body)', color: 'var(--t-55)' }}>
            {visible.length} {visible.length === 1 ? 'alert' : 'alerts'}
            {activeCount > 0 && <span style={{ color: 'var(--t-35)' }}> of {alerts.length}</span>}
          </span>

          {query.trim() && (
            <FilterPill onRemove={() => setParam('q', null)}>“{query.trim()}”</FilterPill>
          )}
          {scope === 'perimeter' && (
            <FilterPill onRemove={() => setParam('scope', null)}>My perimeter</FilterPill>
          )}
          {sevFilter.map((s) => (
            <FilterPill
              key={s}
              color={SEVERITY_COLOR[s as Severity]}
              onRemove={() => setParam('sev', sevFilter.filter((x) => x !== s))}
            >
              {SEVERITY_LABEL[s as Severity]}
            </FilterPill>
          ))}
          {catFilter.map((c) => (
            <FilterPill key={c} onRemove={() => setParam('cat', catFilter.filter((x) => x !== c))}>
              {c}
            </FilterPill>
          ))}
          {countryFilter.map((c) => (
            <FilterPill key={c} onRemove={() => setParam('country', countryFilter.filter((x) => x !== c))}>
              <CountryFlag code={c} size={12} />
              {countryOptions.find((o) => o.value === c)?.label ?? c}
            </FilterPill>
          ))}
          {statusFilter.map((s) => (
            <FilterPill key={s} onRemove={() => setParam('status', statusFilter.filter((x) => x !== s))}>
              {STATUS_STYLE[s as AlertStatus]?.label ?? s}
            </FilterPill>
          ))}

          {activeCount > 0 && (
            <button
              onClick={clearAll}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--agl-yellow)', font: '500 11.5px var(--font-body)', padding: 0 }}
            >
              Clear all
            </button>
          )}
        </div>

        {/* ---- body ---- */}
        <div
          className="scroll-y"
          style={{ flex: 1, padding: '18px 26px', display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          {visible.length === 0 && (
            <EmptyState>
              {view === 'mine' && alerts.length === 0 ? (
                <>
                  You haven't created any alerts yet.
                  <br />
                  Use <span style={{ color: 'var(--agl-yellow)' }}>Create alert</span> to start one.
                </>
              ) : activeCount > 0 ? (
                <>
                  No alerts match these filters.
                  <br />
                  <button
                    onClick={clearAll}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--agl-yellow)', font: '500 13px var(--font-body)', marginTop: 6 }}
                  >
                    Clear all filters
                  </button>
                </>
              ) : (
                'Nothing to show yet.'
              )}
            </EmptyState>
          )}

          {view === 'mine'
            ? visible.map((a) => (
                <MineRow
                  key={a.id}
                  alert={a}
                  q={query}
                  perimeter={perimeter}
                  canCreate={user?.rights.can_create ?? false}
                  onEdit={(x) => navigate(`/create/${x.id}`)}
                  onView={(x) => setSelected(x)}
                />
              ))
            : groups
              ? groups.map(([group, groupAlerts]) => (
                  <div key={group} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div
                      style={{
                        font: '600 10.5px var(--font-display)',
                        color: 'var(--t-40)',
                        textTransform: 'uppercase',
                        letterSpacing: '1.5px',
                      }}
                    >
                      {group}
                      <span style={{ color: 'var(--t-30)', marginLeft: 8 }}>{groupAlerts.length}</span>
                    </div>
                    <div style={gridStyle}>{renderItems(groupAlerts)}</div>
                  </div>
                ))
              : <div style={gridStyle}>{renderItems(visible)}</div>}
        </div>
      </div>

      {selected && <AlertDetailPanel alert={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
