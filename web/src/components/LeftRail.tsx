import { useEffect, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api } from '../api'
import {
  ApprovalsIcon,
  FeedIcon,
  HomeIcon,
  PlusIcon,
  RightsIcon,
  SearchIcon,
  SettingsIcon,
} from './icons'

interface Item {
  key: string
  title: string
  path: string
  icon: (active: boolean) => ReactNode
  badge?: number
}

function RailButton({ item, active }: { item: Item; active: boolean }) {
  const navigate = useNavigate()
  const [hover, setHover] = useState(false)
  return (
    <div
      title={item.title}
      onClick={() => navigate(item.path)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        width: 40,
        height: 40,
        borderRadius: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        background: active
          ? 'rgba(238,213,142,.16)'
          : hover
            ? 'rgba(255,255,255,.06)'
            : 'transparent',
        border: active ? '1px solid var(--yellow-border)' : '1px solid transparent',
      }}
    >
      {item.icon(active)}
      {item.badge ? (
        <span
          style={{
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
            font: "700 9.5px var(--font-display)",
            color: '#fff',
          }}
        >
          {item.badge}
        </span>
      ) : null}
    </div>
  )
}

export function LeftRail() {
  const location = useLocation()
  const [approvals, setApprovals] = useState(0)

  useEffect(() => {
    void api
      .approvals()
      .then((q) => setApprovals(q.pending))
      .catch(() => setApprovals(0))
  }, [location.pathname])

  const activeStroke = (a: boolean) => (a ? 'var(--agl-yellow)' : 'rgba(255,255,255,.6)')

  const items: Item[] = [
    { key: 'home', title: 'Home', path: '/', icon: (a) => <HomeIcon stroke={activeStroke(a)} /> },
    { key: 'feed', title: 'Live feed', path: '/feed', icon: (a) => <FeedIcon stroke={activeStroke(a)} /> },
    { key: 'create', title: 'Create', path: '/create', icon: (a) => <PlusIcon stroke={activeStroke(a)} /> },
    // deep-links to the feed with its search box focused (press "/" once there)
    { key: 'search', title: 'Search alerts', path: '/feed?focus=search', icon: (a) => <SearchIcon stroke={activeStroke(a)} /> },
    {
      key: 'approvals',
      title: 'Approvals',
      path: '/approvals',
      icon: (a) => <ApprovalsIcon stroke={activeStroke(a)} />,
      badge: approvals || undefined,
    },
    { key: 'rights', title: 'My profile & rights', path: '/profile', icon: (a) => <RightsIcon stroke={activeStroke(a)} /> },
  ]

  const activeKey = (() => {
    if (location.pathname === '/') return 'home'
    if (location.pathname.startsWith('/feed')) return 'feed'
    if (location.pathname.startsWith('/create')) return 'create'
    if (location.pathname.startsWith('/approvals')) return 'approvals'
    if (location.pathname.startsWith('/admin')) return 'settings'
    if (location.pathname.startsWith('/profile')) return 'rights'
    return ''
  })()

  return (
    <div
      style={{
        position: 'absolute',
        left: 20,
        top: 88,
        width: 56,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: '10px 0',
        borderRadius: 16,
        background: 'var(--glass-80)',
        border: '1px solid var(--border-soft)',
        backdropFilter: 'blur(14px)',
        alignItems: 'center',
        zIndex: 15,
      }}
    >
      {items.map((it) => (
        <RailButton key={it.key} item={it} active={activeKey === it.key} />
      ))}
      <div style={{ width: 28, height: 1, background: 'rgba(255,255,255,.12)', margin: '4px 0' }} />
      {/* One settings door for everyone — the hub itself gates its sections by
          rights, so non-managers land on a page they can actually use. */}
      <RailButton
        item={{
          key: 'settings',
          title: 'Settings',
          path: '/admin',
          icon: (a) => <SettingsIcon stroke={activeStroke(a)} />,
        }}
        active={activeKey === 'settings'}
      />
    </div>
  )
}
