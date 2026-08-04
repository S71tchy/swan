import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import maplibregl from 'maplibre-gl'
import { api } from '../api'
import { useAuth } from '../auth'
import { TopBar } from '../components/TopBar'
import { LeftRail } from '../components/LeftRail'
import { MapSearch } from '../components/MapSearch'
import { matchAlerts } from '../lib/alertSearch'
import { AlertDetailPanel } from '../components/AlertDetailPanel'
import { swanMapStyle } from '../lib/mapStyle'
import { addDetailOverlay, setNationwideHighlights } from '../lib/mapOverlay'
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

  const clusters = useMemo(() => buildClusters(alerts), [alerts])
  const selected = alerts.find((a) => a.id === selectedId) ?? null

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

  const flyTo = useCallback((lng: number, lat: number, zoom = 5) => {
    mapRef.current?.flyTo({ center: [lng, lat], zoom, speed: 1.1 })
  }, [])

  // Load data
  useEffect(() => {
    void api.feed('map').then(setAlerts).catch(() => setAlerts([]))
    void api.dashboard().then(setStats).catch(() => setStats(null))
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
    void api.feed('map').then(setAlerts)
    void api.dashboard().then(setStats)
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
            onPickAlert={(a) => {
              setSelectedId(a.id)
              const loc = a.locations[0]
              if (loc) flyTo(loc.lng, loc.lat, 5)
            }}
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
      <div
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
        }}
      >
        <span className="glow-dot" style={{ width: 8, height: 8, background: 'var(--agl-orange)' }} />
        <span style={{ font: '600 12px var(--font-display)', color: '#fff' }}>Live · updated just now</span>
      </div>

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
