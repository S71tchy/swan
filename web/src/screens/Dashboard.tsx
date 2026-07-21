import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import maplibregl from 'maplibre-gl'
import { api } from '../api'
import { useAuth } from '../auth'
import { TopBar } from '../components/TopBar'
import { LeftRail } from '../components/LeftRail'
import { AlertDetailPanel } from '../components/AlertDetailPanel'
import { swanMapStyle } from '../lib/mapStyle'
import { addDetailOverlay } from '../lib/mapOverlay'
import { MARKER_SPEC, SEVERITY_COLOR, maxSeverity } from '../lib/format'
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

function markerElement(cluster: Cluster, selected: boolean): HTMLElement {
  const spec = MARKER_SPEC[cluster.severity]
  const color = SEVERITY_COLOR[cluster.severity]
  const el = document.createElement('div')
  el.style.position = 'relative'
  el.style.cursor = 'pointer'
  el.style.width = '0'
  el.style.height = '0'

  if (cluster.severity === 'critical') {
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

function StatCard({
  children,
  width,
  accent = false,
  onClick,
}: {
  children: React.ReactNode
  width: number
  accent?: boolean
  onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      style={{
        width,
        borderRadius: 16,
        background: 'var(--glass-82)',
        border: `1px solid ${accent ? 'var(--yellow-border)' : 'var(--border-soft)'}`,
        backdropFilter: 'blur(14px)',
        padding: '14px 16px',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {children}
    </div>
  )
}

const bigNum = { font: "700 26px var(--font-display)", color: '#fff' } as const
const statLabel = {
  font: '400 11px var(--font-body)',
  color: 'var(--t-50)',
  marginTop: 2,
} as const

export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<maplibregl.Marker[]>([])

  const [alerts, setAlerts] = useState<Alert[]>([])
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const clusters = useMemo(() => buildClusters(alerts), [alerts])
  const selected = alerts.find((a) => a.id === selectedId) ?? null

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
    map.on('load', () => addDetailOverlay(map))
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

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
      const el = markerElement(cluster, isSel)
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        setSelectedId(top.id)
        map.flyTo({ center: [cluster.lng, cluster.lat], zoom: Math.max(map.getZoom(), 4), speed: 0.8 })
      })
      return new maplibregl.Marker({ element: el }).setLngLat([cluster.lng, cluster.lat]).addTo(map)
    })
  }, [clusters, selectedId])

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

      <TopBar showSearch showCreate />
      <LeftRail />

      {/* Stat strip */}
      <div style={{ position: 'absolute', left: 100, top: 88, display: 'flex', gap: 10, zIndex: 15 }}>
        <StatCard width={150}>
          <div style={bigNum}>{stats?.active_alerts ?? '—'}</div>
          <div style={statLabel}>Active alerts</div>
        </StatCard>
        <StatCard width={190}>
          <div style={bigNum}>
            {stats?.severity.critical ?? 0}
            <span style={{ fontSize: 15, color: 'var(--t-45)' }}> critical</span>
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
            {stats &&
              (['critical', 'warning', 'watch', 'info'] as Severity[]).map((s) => {
                const count = stats.severity[s]
                if (!count) return null
                return (
                  <span
                    key={s}
                    style={{
                      width: Math.max(12, count * 13),
                      height: 5,
                      borderRadius: 3,
                      background: SEVERITY_COLOR[s],
                    }}
                  />
                )
              })}
          </div>
        </StatCard>
        <StatCard width={160} accent onClick={() => navigate('/approvals')}>
          <div style={{ ...bigNum, color: 'var(--agl-yellow)' }}>
            {stats?.awaiting_your_approval ?? 0}
          </div>
          <div style={statLabel}>Awaiting your approval</div>
        </StatCard>
        <StatCard width={150}>
          <div style={bigNum}>{stats?.countries_affected ?? '—'}</div>
          <div style={statLabel}>Countries affected</div>
        </StatCard>
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
