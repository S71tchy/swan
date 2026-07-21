import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { Logo } from '../components/Logo'
import type { UserPublic } from '../types'

function LoginBackdrop() {
  return (
    <svg
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
    >
      <defs>
        <radialGradient id="seaLogin" cx="50%" cy="45%" r="80%">
          <stop offset="0%" stopColor="#13253F" />
          <stop offset="100%" stopColor="#0B1729" />
        </radialGradient>
      </defs>
      <rect width="1440" height="900" fill="url(#seaLogin)" />
      <g fill="#1E3556" stroke="#2C4A76" strokeWidth="1.5" strokeLinejoin="round" opacity=".8">
        <path d="M585,-20 L560,40 L600,75 L650,60 L680,95 L740,80 L790,100 L830,70 L840,-20 Z" />
        <path d="M560,150 C540,165 515,190 502,225 C490,258 478,285 470,310 C466,332 480,352 515,368 C545,380 585,388 625,396 C665,404 690,436 693,485 C695,535 685,585 668,635 C660,672 668,705 693,725 C720,742 752,730 763,698 C782,645 798,595 806,552 C818,505 836,470 858,442 C880,415 898,390 903,372 C908,352 892,342 866,336 C846,330 834,306 832,276 C830,240 838,212 843,196 C846,178 830,168 800,164 C755,158 700,150 655,144 C615,140 580,142 560,150 Z" />
        <path d="M868,160 L850,200 L862,250 L905,300 L965,320 L1010,290 L1030,235 L1000,185 L940,160 Z" />
        <path d="M-20,470 L60,455 L145,490 L190,560 L175,650 L120,740 L60,830 L-20,860 Z" />
      </g>
      <g opacity=".5">
        <circle cx="790" cy="592" r="8" fill="#CF4527" />
        <circle cx="790" cy="592" r="18" fill="none" stroke="#CF4527" strokeWidth="1" />
        <circle cx="628" cy="392" r="6" fill="#ED8C00" />
        <circle cx="534" cy="372" r="6" fill="#ED8C00" />
        <circle cx="850" cy="468" r="5" fill="#EED58E" />
        <circle cx="756" cy="700" r="5" fill="#EED58E" />
      </g>
    </svg>
  )
}

function GoogleGrid() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="6" height="6" fill="#1B365F" />
      <rect x="9" y="1" width="6" height="6" fill="#1B365F" opacity=".7" />
      <rect x="1" y="9" width="6" height="6" fill="#1B365F" opacity=".7" />
      <rect x="9" y="9" width="6" height="6" fill="#1B365F" opacity=".45" />
    </svg>
  )
}

const loginInput: React.CSSProperties = {
  width: '100%',
  height: 46,
  borderRadius: 12,
  background: 'rgba(255,255,255,.05)',
  border: '1px solid var(--border-strong)',
  padding: '0 14px',
  color: '#fff',
  font: '400 13px var(--font-body)',
  outline: 'none',
}

export default function Login() {
  const { login, loginWithPassword } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [accounts, setAccounts] = useState<UserPublic[]>([])
  const [showSwitcher, setShowSwitcher] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    void api.accounts().then(setAccounts).catch(() => setAccounts([]))
  }, [])

  async function signIn(demoEmail?: string) {
    setBusy(true)
    setError('')
    try {
      await login(demoEmail)
      navigate('/')
    } catch {
      setError('Sign-in failed — is the API running?')
      setBusy(false)
    }
  }

  async function signInPassword() {
    if (!email.trim() || !password) {
      setError('Enter your email and password.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await loginWithPassword(email.trim(), password)
      navigate('/')
    } catch {
      setError('Invalid email or password.')
      setBusy(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: 'var(--bg-deep)' }}>
      <LoginBackdrop />
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,14,26,.45)' }} />

      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%,-50%)',
          width: 420,
          borderRadius: 22,
          background: 'var(--glass-88)',
          border: '1px solid var(--border-strong)',
          backdropFilter: 'blur(20px)',
          boxShadow: 'var(--shadow-modal)',
          padding: '44px 40px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          animation: 'swanFadeIn .4s ease',
        }}
      >
        <Logo height={44} />
        <div
          style={{
            font: "700 26px var(--font-display)",
            color: '#fff',
            letterSpacing: '6px',
            marginTop: 20,
          }}
        >
          SWAN
        </div>
        <div
          style={{
            font: '400 12.5px/1.6 var(--font-body)',
            color: 'var(--t-55)',
            textAlign: 'center',
            marginTop: 8,
          }}
        >
          Strategic Warning &amp; Alert Network
          <br />
          Live disruption awareness across the AGL network
        </div>

        {/* Primary: username (email) + password */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void signInPassword()
          }}
          style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10, marginTop: 28 }}
        >
          <input
            type="email"
            autoComplete="username"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={loginInput}
          />
          <input
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={loginInput}
          />
          <button
            type="submit"
            disabled={busy}
            style={{
              width: '100%',
              height: 50,
              marginTop: 4,
              border: 'none',
              borderRadius: 25,
              background: 'var(--agl-yellow)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              font: '600 14px var(--font-display)',
              color: 'var(--agl-navy)',
              boxShadow: 'var(--shadow-cta)',
              opacity: busy ? 0.7 : 1,
              cursor: busy ? 'default' : 'pointer',
            }}
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {error && (
          <div style={{ font: '400 11.5px var(--font-body)', color: 'var(--sev-critical-text)', marginTop: 12 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', margin: '18px 0 14px' }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.1)' }} />
          <span style={{ font: '400 10px var(--font-body)', color: 'var(--t-35)', letterSpacing: '1px' }}>OR</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.1)' }} />
        </div>

        <button
          onClick={() => signIn()}
          disabled={busy}
          style={{
            width: '100%',
            height: 46,
            border: '1px solid rgba(255,255,255,.2)',
            borderRadius: 23,
            background: 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            font: '500 13px var(--font-body)',
            color: '#fff',
            opacity: busy ? 0.7 : 1,
            cursor: busy ? 'default' : 'pointer',
          }}
        >
          <GoogleGrid />
          Sign in with your AGL account (SSO)
        </button>

        <div style={{ width: '100%', height: 1, background: 'rgba(255,255,255,.1)', margin: '26px 0 16px' }} />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            font: '400 11px var(--font-body)',
            color: 'var(--t-45)',
          }}
        >
          <span className="glow-dot" style={{ width: 7, height: 7, background: 'var(--agl-yellow)' }} />
          14 active alerts on the network right now
        </div>

        {/* Dev-only identity switcher — a stubbed-SSO convenience to demo the
            different rights profiles (contributor vs publisher vs manager). */}
        {accounts.length > 0 && (
          <div style={{ width: '100%', marginTop: 18 }}>
            <button
              onClick={() => setShowSwitcher((s) => !s)}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                color: 'var(--t-40)',
                font: '400 10.5px var(--font-body)',
                textAlign: 'center',
              }}
            >
              {showSwitcher ? '▲ hide demo identities' : '▼ demo: sign in as another identity'}
            </button>
            {showSwitcher && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                {accounts.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => signIn(a.email)}
                    disabled={busy}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 12px',
                      borderRadius: 10,
                      background: 'rgba(255,255,255,.04)',
                      border: '1px solid rgba(255,255,255,.1)',
                      color: '#fff',
                      font: '500 11.5px var(--font-body)',
                    }}
                  >
                    <span>{a.name}</span>
                    <span style={{ color: 'var(--t-45)', fontSize: 10 }}>{a.role_label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 22,
          textAlign: 'center',
          font: '400 10.5px var(--font-body)',
          color: 'var(--t-30)',
        }}
      >
        Internal AGL tool · access is governed by location-based publication rights · all actions are
        audited
      </div>
    </div>
  )
}
