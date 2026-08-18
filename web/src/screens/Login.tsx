import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '../api'
import { useAuth } from '../auth'
import { Logo } from '../components/Logo'
import { MapBackdrop } from '../components/MapBackdrop'
import type { UserPublic } from '../types'

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
  const { login, loginWithPassword, register } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'signin' | 'register'>('signin')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [accounts, setAccounts] = useState<UserPublic[]>([])
  const [showSwitcher, setShowSwitcher] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [corporateOnly, setCorporateOnly] = useState(false)

  useEffect(() => {
    void api.accounts().then(setAccounts).catch(() => setAccounts([]))
    // Only whether a work address is required — never which domains are blocked.
    // That list is internal; the refusal on submit names the one that matters.
    void api
      .registrationPolicy()
      .then((p) => setCorporateOnly(p.corporate_only))
      .catch(() => setCorporateOnly(false))
  }, [])

  function switchMode(next: 'signin' | 'register') {
    setMode(next)
    setError('')
    setPassword('')
    setConfirm('')
  }

  async function registerAccount() {
    if (!name.trim() || !email.trim() || !password) {
      setError('Enter your name, email and a password.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await register(name.trim(), email.trim(), password)
      navigate('/')
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 409
          ? 'An account with that email already exists.'
          : e instanceof ApiError
            ? e.message
            : 'Registration failed — is the API running?',
      )
      setBusy(false)
    }
  }

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
      <MapBackdrop opacity={0.5} blur={2} overlay="rgba(8,14,26,.45)" />

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

        {/* Primary: sign in (email + password) or register a new account */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (mode === 'register') void registerAccount()
            else void signInPassword()
          }}
          style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10, marginTop: 28 }}
        >
          {mode === 'register' && (
            <input
              type="text"
              autoComplete="name"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={loginInput}
            />
          )}
          <input
            type="email"
            autoComplete="username"
            placeholder={mode === 'register' && corporateOnly ? 'Work email' : 'Email'}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={loginInput}
          />
          <input
            type="password"
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={loginInput}
          />
          {mode === 'register' && (
            <input
              type="password"
              autoComplete="new-password"
              placeholder="Confirm password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              style={loginInput}
            />
          )}
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
            {busy
              ? mode === 'register'
                ? 'Creating account…'
                : 'Signing in…'
              : mode === 'register'
                ? 'Create account'
                : 'Sign in'}
          </button>
        </form>

        {error && (
          <div style={{ font: '400 11.5px var(--font-body)', color: 'var(--sev-critical-text)', marginTop: 12 }}>
            {error}
          </div>
        )}

        {mode === 'register' && !error && (
          <div style={{ font: '400 11px/1.55 var(--font-body)', color: 'var(--t-45)', marginTop: 12, textAlign: 'center' }}>
            {corporateOnly && (
              <>
                Register with your corporate email address — personal and disposable addresses are not accepted.
                <br />
              </>
            )}
            New accounts start with no access. A Rights Manager reviews and activates your profile before you can create or publish.
          </div>
        )}

        <button
          onClick={() => switchMode(mode === 'register' ? 'signin' : 'register')}
          style={{
            marginTop: 14,
            background: 'transparent',
            border: 'none',
            color: 'var(--t-55)',
            font: '400 12px var(--font-body)',
            cursor: 'pointer',
          }}
        >
          {mode === 'register' ? (
            <>Already have an account? <span style={{ color: 'var(--agl-yellow)' }}>Sign in</span></>
          ) : (
            <>New to SWAN? <span style={{ color: 'var(--agl-yellow)' }}>Create an account</span></>
          )}
        </button>

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
