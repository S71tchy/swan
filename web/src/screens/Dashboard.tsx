import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import maplibregl from 'maplibre-gl'
import { api } from '../api'
import { useAuth } from '../auth'
import { TopBar } from '../components/TopBar'
import { LeftRail } from '../components/LeftRail'
import { MapSearch } from '../components/MapSearch'
import { AlertTicker } from '../components/AlertTicker'
import { matchAlerts } from '../lib/alertSearch'
import { AlertDetailPanel } from '../components/AlertDetailPanel'
import { swanMapStyle } from '../lib/mapStyle'
import { addDetailOverlay, setNationwideHighlights, setZoneShapes, type ZoneShape } from '../lib/mapOverlay'
import { MARKER_SPEC, SEVERITY_COLOR, SEVERITY_HEX, maxSeverity } from '../lib/format'
import type { Alert, DashboardStats, Severity } from '../types'

interface Cluster {
  code: string
  lat: number
  lng: number
  alerts: Alert[]
  severity: Severity
}

function buildClusters(alerts: Alert[]): Cluster[] {
  const byCode = new Map<string, Cluster>()
  for (const a of alerts) {
    const loc = a.locations[0]
    if (!loc) continue
    const key = loc.code || `${loc.lat},${loc.lng}`
    const existing = byCode.get(key)
    if (existing) {
      existing.alerts.push(a)
      existing.severity = maxSeverity(existing.severity, a.severity)
    } else {
      byCode.set(key, { code: key, lat: loc.lat, lng: loc.lng, alerts: [a], severity: a.severity })
    }
  }
  return [...byCode.values()]
}

function markerElement(cluster: Cluster, selected: boolean, dimmed: boolean): HTMLElement {
  const spec = MARKER_SPEC[cluster.severity]
  const color = SEVERITY_COLOR[cluster.severity]
  const el = document.createElement('div')
  el.style.position = 'relative'
  el.style.cursor = 'pointer'
  el.style.width = '0'
  el.style.height = '0'
  // Search narrows the map: non-matching clusters fade back rather than vanish,
  // so you keep the geographic context while the hits stand out.
  el.style.opacity = dimmed ? '0.2' : '1'
  el.style.transition = 'opacity .2s'

  if (cluster.severity === 'critical' && !dimmed) {
    const ring = document.createElement('div')
    ring.style.cssText = `position:absolute;left:${-spec.size / 2}px;top:${-spec.size / 2}px;width:${spec.size}px;height:${spec.size}px;border-radius:50%;background:${color};animation:swanPulse 2.2s ease-out infinite;`
    el.appendChild(ring)
  }

  const badge = document.createElement('div')
  const navyText = cluster.severity === 'watch' || cluster.severity === 'info'
  badge.style.cssText = [
    `position:absolute`,
    `left:${-spec.size / 2}px`,
    `top:${-spec.size / 2}px`,
    `width:${spec.size}px`,
    `height:${spec.size}px`,
    `border-radius:50%`,
    `background:${color}`,
    `border:${cluster.severity === 'critical' ? '2.5px' : '2px'} solid ${spec.border}`,
    `box-shadow:0 0 ${cluster.severity === 'critical' ? 24 : 14}px ${color}${selected ? ',0 0 0 4px rgba(238,213,142,.6)' : ''}`,
    `display:flex`,
    `align-items:center`,
    `justify-content:center`,
    `font:700 ${Math.round(spec.size * 0.42)}px 'Space Grotesk',sans-serif`,
    `color:${navyText ? '#1B365F' : '#fff'}`,
    `transition:box-shadow .2s`,
  ].join(';')
  badge.textContent = String(cluster.alerts.length)
  el.appendChild(badge)
  return el
}

const bigNum = { font: "700 26px var(--font-display)", color: '#fff' } as const
const statLabel = {
  font: '400 11px var(--font-body)',
  color: 'var(--t-50)',
  marginTop: 2,
} as const

// One segment of the unified stat strip.
function Segment({
  children,
  accent = false,
  onClick,
}: {
  children: React.ReactNode
  accent?: boolean
  onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '12px 22px',
        cursor: onClick ? 'pointer' : 'default',
        background: accent ? 'var(--yellow-tint-soft)' : 'transparent',
      }}
    >
      {children}
    </div>
  )
}

const SegDivider = () => <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--border-soft)' }} />

/** How often the map checks for new data. Cheap because it polls the change
 *  stamp, not the feed — see the refresh block in Dashboard. */
const REFRESH_MS = 60_000

/** Right-hand inset for the ticker when nothing else is open.
 *
 * MapLibre's zoom control sits bottom-right and reaches 39px in from the edge
 * (measured, not guessed: two 29px buttons plus its own 10px margin). The
 * ticker used to stop at 20px and ran underneath it, swallowing the top half of
 * the "+" button. Keeping the buttons and shortening the strip is the better
 * trade — they're the only discoverable way to zoom without a scroll wheel. */
const ZOOM_CONTROL_INSET = 52

/** Right-hand inset when the detail panel is open: its 380px plus its 20px
 *  margin, so headlines stop at the panel's edge rather than sliding behind it. */
const PANEL_INSET = 420

interface SyncState {
  at: Date | null // last successful check
  busy: boolean
  failed: boolean
}

function agoLabel(at: Date | null): string {
  if (!at) return 'connecting…'
  const secs = Math.floor((Date.now() - at.getTime()) / 1000)
  if (secs < 45) return 'updated just now'
  const mins = Math.round(secs / 60)
  if (mins < 60) return `updated ${mins} min ago`
  const hrs = Math.round(mins / 60)
  return `updated ${hrs} h ago`
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<maplibregl.Marker[]>([])

  const [alerts, setAlerts] = useState<Alert[]>([])
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  // Layers can only be added after the style loads; alerts usually arrive first.
  const [styleReady, setStyleReady] = useState(false)
  const [sync, setSync] = useState<SyncState>({ at: null, busy: true, failed: false })
  // Last stamp we hold data for. A ref, not state: changing it must never on its
  // own trigger a render, or the poll re-renders the map every minute.
  const versionRef = useRef<string | null>(null)

  const clusters = useMemo(() => buildClusters(alerts), [alerts])
  const selected = alerts.find((a) => a.id === selectedId) ?? null

  // Ids that appeared in the most recent refresh, so the ticker can flash them.
  // A ref holds the previous id set: it must not be state, or recording what we
  // have just seen would trigger another render and immediately clear itself.
  // Seeded on the first load so the opening ticker doesn't flash all ten.
  const seenIdsRef = useRef<Set<string> | null>(null)
  const [newIds, setNewIds] = useState<Set<string>>(new Set())
  useEffect(() => {
    const ids = new Set(alerts.map((a) => a.id))
    const seen = seenIdsRef.current
    seenIdsRef.current = ids
    if (seen === null) return // first load — everything is "new", so nothing is
    const arrived = [...ids].filter((id) => !seen.has(id))
    if (arrived.length) setNewIds(new Set(arrived))
  }, [alerts])

  // Ids the current query matches; empty query means "no dimming at all".
  const matchedIds = useMemo(() => {
    if (!searchQuery.trim()) return null
    return new Set(matchAlerts(alerts, searchQuery).map((a) => a.id))
  }, [alerts, searchQuery])

  // ISO2 → colour for the nationwide country washes. Reduced to one colour per
  // country by severity, the same way markers collapse: two alerts on Nigeria
  // must paint one polygon, at the higher of the two severities — not two
  // stacked translucent fills that read as a third colour.
  const countryColours = useMemo(() => {
    const worst: Record<string, Severity> = {}
    for (const a of alerts) {
      // Search dims the map; keep the washes in step with the markers.
      if (matchedIds !== null && !matchedIds.has(a.id)) continue
      for (const l of a.locations) {
        if (l.scope !== 'country' || !l.country) continue
        worst[l.country] = worst[l.country] ? maxSeverity(worst[l.country], a.severity) : a.severity
      }
    }
    return Object.fromEntries(
      Object.entries(worst).map(([cc, sev]) => [cc, SEVERITY_HEX[sev]]),
    )
  }, [alerts, matchedIds])

  // Custom zone shapes, reduced the same way as the country washes: one fill per
  // zone at the worst severity on it, so two alerts on Hormuz paint one area.
  // The geometry comes off the alert itself, not from master data, so an alert
  // keeps drawing as it was filed even after the zone is edited.
  const zoneShapes = useMemo<ZoneShape[]>(() => {
    const worst: Record<string, { sev: Severity; name: string; geometry: ZoneShape['geometry'] }> = {}
    for (const a of alerts) {
      if (matchedIds !== null && !matchedIds.has(a.id)) continue
      for (const l of a.locations) {
        if (l.scope !== 'zone' || !l.code || !l.geometry) continue
        const cur = worst[l.code]
        worst[l.code] = {
          sev: cur ? maxSeverity(cur.sev, a.severity) : a.severity,
          name: l.name,
          geometry: l.geometry,
        }
      }
    }
    return Object.entries(worst).map(([code, z]) => ({
      code,
      name: z.name,
      colour: SEVERITY_HEX[z.sev],
      geometry: z.geometry,
    }))
  }, [alerts, matchedIds])

  const flyTo = useCallback((lng: number, lat: number, zoom = 5) => {
    mapRef.current?.flyTo({ center: [lng, lat], zoom, speed: 1.1 })
  }, [])

  /** Open an alert: select it and bring the map to it.
   *
   * Shared by the map search and the ticker on purpose — picking an alert should
   * mean the same thing wherever you picked it from. */
  const openAlert = useCallback(
    (a: Alert) => {
      setSelectedId(a.id)
      const loc = a.locations[0]
      if (loc) flyTo(loc.lng, loc.lat, 5)
    },
    [flyTo],
  )

  // --------------------------------------------------------------------- //
  // Live refresh
  //
  // The pill used to read a hardcoded "updated just now" over data fetched once
  // on mount, so it claimed to be live while going stale for as long as the tab
  // stayed open.
  //
  // The feed is too expensive to poll directly — it inlines every alert picture
  // as a data URI (~130 KB for 13 alerts, and it grows per illustrated alert),
  // so a naive 60s timer would re-download every photo every minute. Instead we
  // poll `/alerts/live-version` (41 bytes) and only refetch when the stamp
  // moves. A quiet map therefore costs ~40 bytes/min.
  // --------------------------------------------------------------------- //
  const refresh = useCallback(async (force = false) => {
    setSync((s) => ({ ...s, busy: true }))
    try {
      const { version } = await api.liveVersion()
      if (force || version !== versionRef.current) {
        const [feed, dash] = await Promise.all([api.feed('map'), api.dashboard()])
        versionRef.current = version
        setAlerts(feed)
        setStats(dash)
      }
      // Timestamp the successful *check*: with nothing changed the map is still
      // current as of now, which is exactly what the indicator is claiming.
      setSync({ at: new Date(), busy: false, failed: false })
    } catch {
      // Keep whatever is on screen — a failed poll must not blank the map.
      setSync((s) => ({ ...s, busy: false, failed: true }))
    }
  }, [])

  useEffect(() => {
    void refresh(true)
    const id = setInterval(() => {
      // Polling a tab nobody is looking at is pure waste; the visibility
      // handler below catches it up the moment it comes back.
      if (document.visibilityState === 'visible') void refresh()
    }, REFRESH_MS)
    const onVisible = () => document.visibilityState === 'visible' && void refresh()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh])

  // Re-render the relative label on its own cadence, so "just now" ages into
  // "3 min ago" without waiting for the next poll.
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 15_000)
    return () => clearInterval(id)
  }, [])

  // Init map once
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: swanMapStyle,
      center: [20, 3],
      zoom: 2.4,
      attributionControl: false,
      maxZoom: 8,
      minZoom: 1.5,
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')
    map.on('load', () => {
      addDetailOverlay(map)
      setStyleReady(true)
    })
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Sync the nationwide country washes whenever the alert set or search changes
  useEffect(() => {
    const map = mapRef.current
    if (!map || !styleReady) return
    setNationwideHighlights(map, countryColours)
  }, [countryColours, styleReady])

  // Sync the drawn zone shapes on the same terms as the country washes
  useEffect(() => {
    const map = mapRef.current
    if (!map || !styleReady) return
    setZoneShapes(map, zoneShapes)
  }, [zoneShapes, styleReady])

  // Sync markers whenever clusters or selection change
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = clusters.map((cluster) => {
      const top = [...cluster.alerts].sort(
        (a, b) => Number(b.severity === 'critical') - Number(a.severity === 'critical'),
      )[0]
      const isSel = cluster.alerts.some((a) => a.id === selectedId)
      const dimmed = matchedIds !== null && !cluster.alerts.some((a) => matchedIds.has(a.id))
      const el = markerElement(cluster, isSel, dimmed)
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        setSelectedId(top.id)
        map.flyTo({ center: [cluster.lng, cluster.lat], zoom: Math.max(map.getZoom(), 4), speed: 0.8 })
      })
      return new maplibregl.Marker({ element: el }).setLngLat([cluster.lng, cluster.lat]).addTo(map)
    })
  }, [clusters, selectedId, matchedIds])

  async function handleCloseAlert() {
    if (!selected) return
    await api.close(selected.id)
    setSelectedId(null)
    void refresh(true) // our own write — don't wait for the stamp to be noticed
  }

  const canClose =
    !!selected &&
    (selected.author.id === user?.id ||
      selected.locations.some((l) => user?.rights.internal_countries.includes(l.country)))

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: 'var(--bg-deep)' }}>
      <div ref={mapContainer} style={{ position: 'absolute', inset: 0 }} />

      <TopBar
        search={
          <MapSearch
            alerts={alerts}
            onQueryChange={setSearchQuery}
            onPickPlace={(p) => flyTo(p.lng, p.lat, 6)}
            onPickAlert={openAlert}
          />
        }
      />
      <LeftRail />

      {/* Stat strip — one floating glass panel, segmented */}
      <div
        style={{
          position: 'absolute',
          left: 100,
          top: 88,
          display: 'flex',
          alignItems: 'stretch',
          zIndex: 15,
          borderRadius: 16,
          background: 'var(--glass-82)',
          border: '1px solid var(--border-soft)',
          backdropFilter: 'blur(14px)',
          boxShadow: 'var(--shadow-panel)',
          overflow: 'hidden',
        }}
      >
        <Segment>
          <div style={bigNum}>{stats?.active_alerts ?? '—'}</div>
          <div style={statLabel}>Active alerts</div>
        </Segment>

        <SegDivider />

        <Segment>
          <div style={{ display: 'flex', gap: 14 }}>
            {(['critical', 'warning', 'watch', 'info'] as Severity[]).map((s) => (
              <div
                key={s}
                title={s.charAt(0).toUpperCase() + s.slice(1)}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: SEVERITY_COLOR[s], flex: 'none' }} />
                <span style={{ font: '700 18px var(--font-display)', color: '#fff' }}>
                  {stats?.severity[s] ?? 0}
                </span>
              </div>
            ))}
          </div>
          <div style={statLabel}>By severity</div>
        </Segment>

        <SegDivider />

        <Segment accent onClick={() => navigate('/approvals')}>
          <div style={{ ...bigNum, color: 'var(--agl-yellow)' }}>
            {stats?.awaiting_your_approval ?? 0}
          </div>
          <div style={statLabel}>Awaiting your approval</div>
        </Segment>

        <SegDivider />

        <Segment>
          <div style={bigNum}>{stats?.countries_affected ?? '—'}</div>
          <div style={statLabel}>Countries affected</div>
        </Segment>
      </div>

      {/* Severity legend */}
      <div
        style={{
          position: 'absolute',
          left: 20,
          bottom: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          height: 40,
          padding: '0 18px',
          borderRadius: 20,
          background: 'var(--glass-80)',
          border: '1px solid var(--border-soft)',
          backdropFilter: 'blur(14px)',
          zIndex: 15,
        }}
      >
        {(['info', 'watch', 'warning', 'critical'] as Severity[]).map((s) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: SEVERITY_COLOR[s] }} />
            <span style={{ font: '500 11px var(--font-body)', color: 'var(--t-65)', textTransform: 'capitalize' }}>
              {s}
            </span>
          </div>
        ))}
      </div>

      {/* Live pill */}
      {/* Click to refresh now; otherwise it refreshes itself every REFRESH_MS. */}
      <button
        onClick={() => void refresh(true)}
        disabled={sync.busy}
        title={
          sync.failed
            ? 'Last refresh failed — showing the most recent data. Click to retry.'
            : sync.at
              ? `Last checked ${sync.at.toLocaleTimeString()} · refreshes every ${REFRESH_MS / 1000}s · click to refresh now`
              : 'Loading…'
        }
        style={{
          position: 'absolute',
          left: 380,
          bottom: 20,
          height: 40,
          padding: '0 18px',
          borderRadius: 20,
          background: 'var(--glass-80)',
          border: '1px solid var(--border-soft)',
          backdropFilter: 'blur(14px)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          zIndex: 15,
          cursor: sync.busy ? 'default' : 'pointer',
        }}
      >
        <span
          className={sync.busy || sync.failed ? undefined : 'glow-dot'}
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: sync.failed ? 'var(--agl-grey)' : 'var(--agl-orange)',
            opacity: sync.busy ? 0.5 : 1,
            transition: 'opacity .2s',
          }}
        />
        <span style={{ font: '600 12px var(--font-display)', color: '#fff' }}>
          {sync.failed ? 'Reconnecting…' : `Live · ${agoLabel(sync.at)}`}
        </span>
      </button>

      {/* Live ticker. Starts clear of the legend and the Live pill, and yields
          the right-hand 400px when the detail panel is open so headlines never
          scroll underneath it. */}
      <AlertTicker
        alerts={alerts}
        newIds={newIds}
        onPick={openAlert}
        left={600}
        right={selected ? PANEL_INSET : ZOOM_CONTROL_INSET}
      />

      {selected && (
        <AlertDetailPanel
          alert={selected}
          onClose={() => setSelectedId(null)}
          onCloseAlert={handleCloseAlert}
          canClose={canClose}
        />
      )}
    </div>
  )
}
