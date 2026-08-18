import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api, ApiError } from '../api'
import { Logo } from '../components/Logo'
import { MapBackdrop } from '../components/MapBackdrop'
import type { UnsubscribeScope, UnsubscribeState } from '../types'

// --------------------------------------------------------------------------- //
// Unsubscribe landing page
//
// Reached from the footer of any SWAN email, by someone who is almost certainly
// not signed in — the signed token in the URL is the whole authorisation, and it
// grants nothing but the ability to silence this person's own notifications.
//
// The page *asks* rather than acts. Loading it changes nothing: corporate link
// scanners and Outlook's preview fetcher hit every URL in a message, so a page
// that unsubscribed on load would unsubscribe people who never opened the mail.
// Both choices are POSTs behind a button, and "resume" undoes either of them,
// because the mail client's own one-click button has no confirmation step.
// --------------------------------------------------------------------------- //

const card: React.CSSProperties = {
  position: 'absolute',
  left: '50%',
  top: '50%',
  transform: 'translate(-50%,-50%)',
  width: 460,
  maxWidth: 'calc(100vw - 32px)',
  borderRadius: 22,
  background: 'var(--glass-88)',
  border: '1px solid var(--border-strong)',
  backdropFilter: 'blur(20px)',
  boxShadow: 'var(--shadow-modal)',
  padding: '40px 36px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  animation: 'swanFadeIn .4s ease',
}

function Button({
  children,
  onClick,
  variant = 'primary',
  disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  variant?: 'primary' | 'outline'
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%',
        height: 46,
        borderRadius: 23,
        cursor: disabled ? 'default' : 'pointer',
        font: '600 13px var(--font-display)',
        opacity: disabled ? 0.6 : 1,
        border: variant === 'primary' ? 'none' : '1px solid rgba(255,255,255,.2)',
        background: variant === 'primary' ? 'var(--agl-yellow)' : 'transparent',
        color: variant === 'primary' ? 'var(--agl-navy)' : '#fff',
        boxShadow: variant === 'primary' ? 'var(--shadow-cta)' : 'none',
      }}
    >
      {children}
    </button>
  )
}

export default function Unsubscribe() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') ?? ''
  const [state, setState] = useState<UnsubscribeState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<UnsubscribeScope | null>(null)

  useEffect(() => {
    if (!token) {
      setError('This link is missing its token. Open the link from the email again.')
      return
    }
    void api
      .unsubscribePreview(token)
      .then(setState)
      .catch((e) =>
        setError(e instanceof ApiError ? e.message : 'This unsubscribe link could not be read.'),
      )
  }, [token])

  async function act(scope: UnsubscribeScope) {
    setBusy(true)
    setError(null)
    try {
      setState(await api.unsubscribe(token, scope))
      setDone(scope)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not apply that change.')
    } finally {
      setBusy(false)
    }
  }

  const title = (t: string) => (
    <div style={{ font: '700 19px var(--font-display)', color: '#fff', marginTop: 22, textAlign: 'center' }}>{t}</div>
  )
  const note = (t: React.ReactNode) => (
    <div
      style={{
        font: '400 12.5px/1.65 var(--font-body)',
        color: 'var(--t-60)',
        textAlign: 'center',
        marginTop: 10,
      }}
    >
      {t}
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: 'var(--bg-deep)' }}>
      <MapBackdrop opacity={0.5} blur={2} overlay="rgba(8,14,26,.45)" />
      <div style={card}>
        <Logo height={38} />

        {error && !state && (
          <>
            {title('Link not valid')}
            {note(error)}
            <div style={{ width: '100%', marginTop: 24 }}>
              <Button variant="outline" onClick={() => navigate('/')}>
                Go to SWAN
              </Button>
            </div>
          </>
        )}

        {!error && !state && note('Checking your link…')}

        {state && done === null && (
          <>
            {title('Email preferences')}
            {note(
              <>
                Signed in as <strong style={{ color: 'var(--t-80)' }}>{state.email}</strong>. Nothing has
                changed yet.
              </>,
            )}

            {state.subscription_name && (
              <div
                style={{
                  width: '100%',
                  marginTop: 20,
                  borderRadius: 12,
                  border: '1px solid var(--border-soft)',
                  background: 'rgba(255,255,255,.04)',
                  padding: '12px 14px',
                }}
              >
                <div style={{ font: '600 12.5px var(--font-body)', color: '#fff' }}>
                  {state.subscription_name}
                  {state.subscription_active === false && (
                    <span style={{ color: 'var(--t-45)', font: '400 11px var(--font-body)' }}> — already paused</span>
                  )}
                </div>
                {state.subscription_summary && (
                  <div style={{ font: '400 11px/1.5 var(--font-body)', color: 'var(--t-50)', marginTop: 4 }}>
                    {state.subscription_summary}
                  </div>
                )}
              </div>
            )}

            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
              {state.subscription_id && state.subscription_active !== false && (
                <Button disabled={busy} onClick={() => act('subscription')}>
                  Stop these emails
                </Button>
              )}
              <Button variant="outline" disabled={busy || state.opted_out} onClick={() => act('all')}>
                {state.opted_out ? 'All emails already stopped' : 'Stop all SWAN emails'}
              </Button>
            </div>

            {note(
              state.active_subscriptions > 1 ? (
                <>
                  You have <strong style={{ color: 'var(--t-80)' }}>{state.active_subscriptions}</strong> active
                  subscriptions. Stopping these emails leaves the others running.
                </>
              ) : (
                'You can restart any of this from your profile at any time.'
              ),
            )}
          </>
        )}

        {state && done !== null && (
          <>
            {title(done === 'resume' ? 'Emails resumed' : 'Done — you are unsubscribed')}
            {note(
              done === 'all'
                ? 'You will not receive any SWAN notification emails. Alerts stay visible in the app.'
                : done === 'resume'
                  ? 'You are receiving SWAN notifications again.'
                  : `“${state.subscription_name}” is paused. Your other subscriptions are unaffected.`,
            )}
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10, marginTop: 22 }}>
              {done !== 'resume' && (
                <Button variant="outline" disabled={busy} onClick={() => act('resume')}>
                  Undo
                </Button>
              )}
              <Button onClick={() => navigate('/profile?section=notifications')}>Manage preferences</Button>
            </div>
          </>
        )}

        {error && state && (
          <div style={{ font: '400 11.5px var(--font-body)', color: 'var(--sev-critical-text)', marginTop: 14 }}>
            {error}
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
        Internal AGL tool · unsubscribing never removes your access · all actions are audited
      </div>
    </div>
  )
}
