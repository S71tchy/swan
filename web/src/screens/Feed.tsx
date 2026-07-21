import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { TopBar } from '../components/TopBar'
import { LeftRail } from '../components/LeftRail'
import { MapBackdrop } from '../components/MapBackdrop'
import { AlertDetailPanel } from '../components/AlertDetailPanel'
import {
  SEVERITY_COLOR,
  SEVERITY_TEXT,
  fmtAgo,
  fmtFeedTime,
  dayGroup,
  modesLabel,
} from '../lib/format'
import type { Alert, AlertStatus, Severity } from '../types'

const DAY_ORDER = ['Today', 'Yesterday', 'Earlier this week', 'Earlier']
const SEVERITIES: Severity[] = ['critical', 'warning', 'watch', 'info']

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
      }}
    >
      {s.label}
    </span>
  )
}

function FeedCard({ alert, onClick }: { alert: Alert; onClick: () => void }) {
  const [hover, setHover] = useState(false)
  const loc = alert.locations[0]
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
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span
          style={{
            font: "700 10px var(--font-display)",
            color: SEVERITY_TEXT[alert.severity],
            letterSpacing: '1px',
          }}
        >
          {alert.severity.toUpperCase()} · {alert.category.toUpperCase()}
        </span>
        <span style={{ font: '400 10.5px var(--font-body)', color: 'var(--t-35)' }}>
          {fmtFeedTime(alert.published_at)}
        </span>
      </div>
      <div style={{ font: '600 14px/1.4 var(--font-display)', color: '#fff' }}>{alert.title}</div>
      <div
        style={{
          font: '400 12px/1.55 var(--font-body)',
          color: 'var(--t-60)',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {alert.description}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          font: '400 11px var(--font-body)',
          color: 'var(--t-45)',
        }}
      >
        {loc && (
          <span>
            {loc.flag} {loc.name.split(' — ')[0]} · {modesLabel(loc.modes)} · {alert.valid_to_label}
          </span>
        )}
        <span style={{ flex: 1 }} />
        <span style={{ color: 'var(--t-55)' }}>{alert.author.name}</span>
      </div>
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

function MineList({
  alerts,
  perimeter,
  canCreate,
  onEdit,
  onView,
}: {
  alerts: Alert[]
  perimeter: string[]
  canCreate: boolean
  onEdit: (a: Alert) => void
  onView: (a: Alert) => void
}) {
  const sorted = [...alerts].sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  return (
    <div className="scroll-y" style={{ flex: 1, padding: '18px 26px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {sorted.length === 0 && (
        <div style={{ color: 'var(--t-45)', font: '400 13px var(--font-body)', textAlign: 'center', marginTop: 40 }}>
          You haven't created any alerts yet. Use <span style={{ color: 'var(--agl-yellow)' }}>Create alert</span> to start one.
        </div>
      )}
      {sorted.map((a) => {
        const editable = a.status === 'draft' || a.status === 'rejected'
        const loc = a.locations[0]
        const route = routeHint(a, perimeter, canCreate)
        return (
          <div
            key={a.id}
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
                {a.title || '(untitled draft)'}
              </div>
              <div style={{ font: '400 11px var(--font-body)', color: 'var(--t-45)', marginTop: 3 }}>
                {a.category}
                {loc ? ` · ${loc.flag} ${loc.name.split(' — ')[0]}` : ''} · updated {fmtAgo(a.updated_at)}
                {a.status === 'rejected' && a.rejection_comment ? ` · “${a.rejection_comment}”` : ''}
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
      })}
    </div>
  )
}

function ScopeChip({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <span
      onClick={onClick}
      style={{
        padding: '6px 14px',
        borderRadius: 16,
        cursor: 'pointer',
        background: active ? 'var(--yellow-tint)' : 'transparent',
        border: `1px solid ${active ? 'var(--yellow-border-strong)' : 'var(--border-strong)'}`,
        font: '500 11.5px var(--font-body)',
        color: active ? 'var(--agl-yellow)' : 'var(--t-55)',
      }}
    >
      {children}
    </span>
  )
}

type Scope = 'all' | 'perimeter' | 'mine'

export default function Feed() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [scope, setScope] = useState<Scope>('all')
  const [sevFilter, setSevFilter] = useState<Set<Severity>>(new Set())
  const [selected, setSelected] = useState<Alert | null>(null)

  // 'mine' pulls the caller's own alerts across every status; the others read
  // the published feed and filter client-side.
  useEffect(() => {
    const source = scope === 'mine' ? 'mine' : 'published'
    void api.feed(source).then(setAlerts).catch(() => setAlerts([]))
  }, [scope])

  const perimeter = user?.rights.internal_countries ?? []

  const visible = useMemo(() => {
    return alerts.filter((a) => {
      if (scope === 'perimeter' && !a.locations.some((l) => perimeter.includes(l.country))) return false
      if (sevFilter.size && !sevFilter.has(a.severity)) return false
      return true
    })
  }, [alerts, scope, sevFilter, perimeter])

  const counts = useMemo(() => {
    const c: Record<Severity, number> = { critical: 0, warning: 0, watch: 0, info: 0 }
    for (const a of alerts) c[a.severity]++
    return c
  }, [alerts])

  const groups = useMemo(() => {
    const map = new Map<string, Alert[]>()
    for (const a of visible) {
      const g = dayGroup(a.published_at)
      if (!map.has(g)) map.set(g, [])
      map.get(g)!.push(a)
    }
    return DAY_ORDER.filter((g) => map.has(g)).map((g) => [g, map.get(g)!] as const)
  }, [visible])

  function toggleSev(s: Severity) {
    setSevFilter((prev) => {
      const next = new Set(prev)
      next.has(s) ? next.delete(s) : next.add(s)
      return next
    })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: 'var(--bg-deep)' }}>
      <MapBackdrop opacity={0.45} blur={2} overlay="rgba(8,14,26,.5)" />
      <TopBar breadcrumb="Live feed" showCreate />
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
        {/* header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '20px 26px',
            borderBottom: '1px solid rgba(255,255,255,.08)',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ font: '600 17px var(--font-display)', color: '#fff' }}>Live feed</div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              height: 28,
              padding: '0 12px',
              borderRadius: 14,
              background: 'rgba(255,255,255,.05)',
              border: '1px solid var(--border-soft)',
            }}
          >
            <span className="glow-dot" style={{ width: 7, height: 7, background: 'var(--agl-orange)' }} />
            <span style={{ font: '500 11px var(--font-body)', color: 'var(--t-65)' }}>
              Updated just now
            </span>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', gap: 6 }}>
            <ScopeChip active={scope === 'all'} onClick={() => setScope('all')}>
              All alerts
            </ScopeChip>
            <ScopeChip active={scope === 'perimeter'} onClick={() => setScope('perimeter')}>
              My perimeter
            </ScopeChip>
            <ScopeChip active={scope === 'mine'} onClick={() => setScope('mine')}>
              My alerts
            </ScopeChip>
          </div>
          <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,.1)' }} />
          <div style={{ display: 'flex', gap: 6 }}>
            {SEVERITIES.map((s) => (
              <span
                key={s}
                onClick={() => toggleSev(s)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  borderRadius: 16,
                  cursor: 'pointer',
                  border: `1px solid ${sevFilter.has(s) ? 'var(--yellow-border-strong)' : 'var(--border-strong)'}`,
                  background: sevFilter.has(s) ? 'var(--yellow-tint)' : 'transparent',
                  font: '500 11.5px var(--font-body)',
                  color: 'var(--t-70, rgba(255,255,255,.7))',
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: SEVERITY_COLOR[s] }} />
                {counts[s]}
              </span>
            ))}
          </div>
        </div>

        {/* body */}
        {scope === 'mine' ? (
          <MineList
            alerts={visible}
            perimeter={perimeter}
            canCreate={user?.rights.can_create ?? false}
            onEdit={(a) => navigate(`/create/${a.id}`)}
            onView={(a) => setSelected(a)}
          />
        ) : (
          <div className="scroll-y" style={{ flex: 1, padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {groups.length === 0 && (
              <div style={{ color: 'var(--t-45)', font: '400 13px var(--font-body)', textAlign: 'center', marginTop: 40 }}>
                No alerts match these filters.
              </div>
            )}
            {groups.map(([group, groupAlerts]) => (
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
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {groupAlerts.map((a) => (
                    <FeedCard key={a.id} alert={a} onClick={() => setSelected(a)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selected && <AlertDetailPanel alert={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
