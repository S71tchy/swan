import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import type { UserMe } from '../types'
import { Avatar } from './Avatar'
import { Logo, Wordmark } from './Logo'
import { PlusIcon, SearchIcon } from './icons'

interface TopBarProps {
  breadcrumb?: string
  showSearch?: boolean
  showCreate?: boolean
}

// Avatar with a small dropdown: My profile / Sign out.
function AvatarMenu({ user }: { user: UserMe }) {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  async function signOut() {
    setOpen(false)
    await logout()
    navigate('/login', { replace: true })
  }

  const item: React.CSSProperties = {
    padding: '10px 14px',
    font: '500 12.5px var(--font-body)',
    color: 'var(--t-80)',
    cursor: 'pointer',
    textAlign: 'left',
    background: 'transparent',
    border: 'none',
    width: '100%',
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <Avatar
        initials={user.initials}
        gold={user.avatar_gold}
        onClick={() => setOpen((o) => !o)}
        title={user.name}
      />
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 48,
            right: 0,
            minWidth: 190,
            borderRadius: 12,
            background: 'var(--glass-97)',
            border: '1px solid var(--border-strong)',
            backdropFilter: 'blur(18px)',
            boxShadow: 'var(--shadow-panel)',
            overflow: 'hidden',
            zIndex: 40,
            animation: 'swanFadeIn .12s ease',
          }}
        >
          <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
            <div style={{ font: '600 12.5px var(--font-body)', color: '#fff' }}>{user.name}</div>
            <div style={{ font: '400 10.5px var(--font-body)', color: 'var(--t-45)' }}>
              {user.role_label}
            </div>
          </div>
          <button
            style={item}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,.06)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            onClick={() => {
              setOpen(false)
              navigate('/profile')
            }}
          >
            My profile
          </button>
          <button
            style={item}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,.06)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            onClick={signOut}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
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

      {user && <AvatarMenu user={user} />}
    </div>
  )
}
