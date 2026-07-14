import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { Avatar } from './Avatar'
import { Logo, Wordmark } from './Logo'
import { PlusIcon, SearchIcon } from './icons'

interface TopBarProps {
  breadcrumb?: string
  showSearch?: boolean
  showCreate?: boolean
}

export function TopBar({ breadcrumb, showSearch = false, showCreate = true }: TopBarProps) {
  const navigate = useNavigate()
  const { user } = useAuth()

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        height: 68,
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        padding: '0 24px',
        background: 'linear-gradient(180deg,rgba(10,18,32,.85),rgba(10,18,32,0))',
        zIndex: 20,
      }}
    >
      <Logo height={34} />
      <div style={{ width: 1, height: 26, background: 'rgba(255,255,255,.15)' }} />
      <Wordmark />
      {breadcrumb && (
        <span style={{ font: '400 13px var(--font-body)', color: 'var(--t-45)' }}>
          / {breadcrumb}
        </span>
      )}
      <div style={{ flex: 1 }} />

      {showSearch && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            width: 380,
            height: 42,
            padding: '0 16px',
            borderRadius: 21,
            background: 'rgba(22,38,63,.75)',
            border: '1px solid var(--border-mid)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <SearchIcon size={15} stroke="rgba(255,255,255,.5)" />
          <span style={{ font: '400 13px var(--font-body)', color: 'var(--t-45)' }}>
            Search country, city or port…
          </span>
        </div>
      )}

      {showCreate && (
        <button
          onClick={() => navigate('/create')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            height: 42,
            padding: '0 20px',
            border: 'none',
            borderRadius: 21,
            background: 'var(--agl-yellow)',
            color: 'var(--agl-navy)',
            font: '600 13px var(--font-display)',
            boxShadow: 'var(--shadow-cta)',
          }}
        >
          <PlusIcon size={13} stroke="var(--agl-navy)" style={{ marginRight: -2 }} />
          Create alert
        </button>
      )}

      {user && (
        <Avatar
          initials={user.initials}
          gold={user.avatar_gold}
          onClick={() => navigate('/profile')}
          title={user.name}
        />
      )}
    </div>
  )
}
