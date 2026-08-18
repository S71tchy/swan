import { useEffect, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { ApprovalsIcon, ChartIcon, FeedIcon, HomeIcon, RightsIcon, SettingsIcon } from './icons'

// The rail is DESTINATIONS ONLY. Actions live in the TopBar (Create alert) and
// search lives where the data is (the feed's own search box, the dashboard's map
// search) — an earlier version had a Search icon that just routed to /feed, i.e.
// a second door to the screen sitting directly above it.
//
// At rest it's the mock's 56px icon rail; hovering expands it to reveal labels,
// because Feed / Approvals / Rights are not self-evident as icons alone.

const COLLAPSED = 56
const EXPANDED = 194

interface Item {
  key: string
  title: string
  path: string
  icon: (active: boolean) => ReactNode
  badge?: number
}

function RailButton({
  item,
  active,
  expanded,
}: {
  item: Item
  active: boolean
  expanded: boolean
}) {
  const navigate = useNavigate()
  const [hover, setHover] = useState(false)
  return (
    <div
      title={expanded ? undefined : item.title}
      onClick={() => navigate(item.path)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: expanded ? EXPANDED - 16 : 40,
        height: 40,
        paddingLeft: expanded ? 11 : 0,
        justifyContent: expanded ? 'flex-start' : 'center',
        borderRadius: 12,
        cursor: 'pointer',
        background: active
          ? 'rgba(238,213,142,.16)'
          : hover
            ? 'rgba(255,255,255,.06)'
            : 'transparent',
        border: active ? '1px solid var(--yellow-border)' : '1px solid transparent',
        transition: 'width .18s ease, padding .18s ease, background .12s',
        overflow: 'hidden',
      }}
    >
      <span style={{ display: 'flex', flex: 'none', width: expanded ? 'auto' : '100%', justifyContent: 'center' }}>
        {item.icon(active)}
      </span>

      {expanded && (
        <span
          style={{
            font: '600 12px var(--font-display)',
            color: active ? 'var(--agl-yellow)' : 'var(--t-70, rgba(255,255,255,.7))',
            whiteSpace: 'nowrap',
            flex: 1,
          }}
        >
          {item.title}
        </span>
      )}

      {item.badge ? (
        <span
          style={
            expanded
              ? {
                  marginRight: 10,
                  minWidth: 18,
                  height: 18,
                  padding: '0 5px',
                  borderRadius: 9,
                  background: 'var(--agl-orange)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  font: '700 10px var(--font-display)',
                  color: '#fff',
                  flex: 'none',
                }
              : {
                  position: 'absolute',
                  right: 2,
                  top: 2,
                  minWidth: 16,
                  height: 16,
                  padding: '0 3px',
                  borderRadius: 8,
                  background: 'var(--agl-orange)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  font: '700 9.5px var(--font-display)',
                  color: '#fff',
                }
          }
        >
          {item.badge}
        </span>
      ) : null}
    </div>
  )
}

export function LeftRail() {
  const location = useLocation()
  const { user } = useAuth()
  const [approvals, setApprovals] = useState(0)
  const [expanded, setExpanded] = useState(false)

  // Someone with no internal perimeter can never have anything queued, and a
  // Rights Manager can always receive escalations — so gate on that, not on a
  // blanket "everyone sees Approvals".
  const canApprove =
    (user?.rights.internal_countries.length ?? 0) > 0 || !!user?.rights.is_rights_manager

  useEffect(() => {
    if (!canApprove) {
      setApprovals(0)
      return
    }
    void api
      .approvals()
      .then((q) => setApprovals(q.pending))
      .catch(() => setApprovals(0))
  }, [location.pathname, canApprove])

  const activeStroke = (a: boolean) => (a ? 'var(--agl-yellow)' : 'rgba(255,255,255,.6)')

  const items: Item[] = [
    { key: 'home', title: 'Map', path: '/', icon: (a) => <HomeIcon stroke={activeStroke(a)} /> },
    { key: 'feed', title: 'Live feed', path: '/feed', icon: (a) => <FeedIcon stroke={activeStroke(a)} /> },
    // A destination, not an action: statistics across the whole corpus, which is
    // a different question from "what is happening now" (Map) or "what was
    // published" (Live feed) rather than another door to either.
    { key: 'analytics', title: 'Analytics', path: '/analytics', icon: (a) => <ChartIcon stroke={activeStroke(a)} /> },
    ...(canApprove
      ? [
          {
            key: 'approvals',
            title: 'Approvals',
            path: '/approvals',
            icon: (a: boolean) => <ApprovalsIcon stroke={activeStroke(a)} />,
            badge: approvals || undefined,
          },
        ]
      : []),
    { key: 'profile', title: 'My profile', path: '/profile', icon: (a) => <RightsIcon stroke={activeStroke(a)} /> },
  ]

  const activeKey = (() => {
    if (location.pathname === '/') return 'home'
    if (location.pathname.startsWith('/feed')) return 'feed'
    if (location.pathname.startsWith('/analytics')) return 'analytics'
    if (location.pathname.startsWith('/approvals')) return 'approvals'
    if (location.pathname.startsWith('/admin')) return 'settings'
    if (location.pathname.startsWith('/profile')) return 'profile'
    return ''
  })()

  return (
    <div
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      style={{
        position: 'absolute',
        left: 20,
        top: 88,
        width: expanded ? EXPANDED : COLLAPSED,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: '10px 0',
        borderRadius: 16,
        background: expanded ? 'var(--glass-92)' : 'var(--glass-80)',
        border: '1px solid var(--border-soft)',
        backdropFilter: 'blur(14px)',
        boxShadow: expanded ? 'var(--shadow-panel)' : 'none',
        alignItems: 'center',
        // above floating panels while expanded so labels are never clipped
        zIndex: expanded ? 30 : 15,
        transition: 'width .18s ease, background .18s ease',
      }}
    >
      {items.map((it) => (
        <RailButton key={it.key} item={it} active={activeKey === it.key} expanded={expanded} />
      ))}

      <div
        style={{
          width: expanded ? EXPANDED - 32 : 28,
          height: 1,
          background: 'rgba(255,255,255,.12)',
          margin: '4px 0',
          transition: 'width .18s ease',
        }}
      />

      {/* One settings door for everyone — the hub gates its own sections. */}
      <RailButton
        item={{
          key: 'settings',
          title: 'Settings',
          path: '/admin',
          icon: (a) => <SettingsIcon stroke={activeStroke(a)} />,
        }}
        active={activeKey === 'settings'}
        expanded={expanded}
      />
    </div>
  )
}
