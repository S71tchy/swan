import { useState } from 'react'
import { Button } from './ui'
import type { ExternalVariant } from '../types'

// Two-step publication confirmation (spec §5.4):
//   1. content-correctness confirmation
//   2. internal-only vs internal+external choice (with optional modification)
// Delivery of the external variant is Phase 3 — here we only capture the intent.

type Step = 'content' | 'external' | 'modify'
type Choice = 'identical' | 'modified' | 'none'

function Backdrop({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(6,11,20,.6)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 60,
        animation: 'swanFadeIn .15s ease',
      }}
    >
      {children}
    </div>
  )
}

function Card({ width = 520, children }: { width?: number; children: React.ReactNode }) {
  return (
    <div
      style={{
        width,
        maxWidth: 'calc(100vw - 40px)',
        borderRadius: 18,
        background: 'var(--glass-97)',
        border: '1px solid var(--border-strong)',
        boxShadow: 'var(--shadow-modal)',
        padding: 26,
        animation: 'swanScaleIn .18s ease-out',
      }}
    >
      {children}
    </div>
  )
}

interface Props {
  onCancel: () => void
  onConfirm: (external: ExternalVariant) => void
  busy?: boolean
  title?: string
  /** False when the actor lacks External Publication rights for some location —
   *  the client-facing options are then shown disabled rather than offered and
   *  rejected by the server. Defaults to true so existing callers are unchanged. */
  canExternal?: boolean
  /** Countries blocking the external choice, for the explanation line. */
  externalUncovered?: string[]
  /** Surfaced inside the dialog so a failed publish is visible where it happened. */
  error?: string | null
}

export function PublishDialogs({
  onCancel,
  onConfirm,
  busy,
  title,
  canExternal = true,
  externalUncovered = [],
  error,
}: Props) {
  const [step, setStep] = useState<Step>('content')
  const [choice, setChoice] = useState<Choice>('none')
  const [extTitle, setExtTitle] = useState(title ?? '')
  const [extBody, setExtBody] = useState('')

  const ErrorNote = () =>
    error ? (
      <div
        style={{
          borderRadius: 10,
          border: '1px solid rgba(207,69,39,.5)',
          background: 'rgba(207,69,39,.12)',
          padding: '10px 12px',
          font: '400 12px/1.5 var(--font-body)',
          color: 'var(--sev-critical-text)',
          marginBottom: 16,
        }}
      >
        {error}
      </div>
    ) : null

  if (step === 'content') {
    return (
      <Backdrop>
        <Card width={460}>
          <div style={{ font: '600 17px var(--font-display)', color: '#fff', marginBottom: 10 }}>
            Confirm publication
          </div>
          <div style={{ font: '400 13px/1.6 var(--font-body)', color: 'var(--t-75)', marginBottom: 22 }}>
            Please confirm all information is correct. Once published, this alert becomes visible on
            the live map and in the feed to everyone in scope.
          </div>
          <ErrorNote />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => setStep('external')}>
              Confirm content →
            </Button>
          </div>
        </Card>
      </Backdrop>
    )
  }

  if (step === 'modify') {
    return (
      <Backdrop>
        <Card width={560}>
          <div style={{ font: '600 17px var(--font-display)', color: '#fff', marginBottom: 6 }}>
            External variant
          </div>
          <div style={{ font: '400 12px/1.5 var(--font-body)', color: 'var(--t-55)', marginBottom: 18 }}>
            Adapt the wording for client consumption. Stored now; delivered to the client portal in
            Phase 3.
          </div>
          <div style={{ font: '600 11px var(--font-body)', color: 'var(--t-55)', marginBottom: 6 }}>
            Client-facing title
          </div>
          <input
            value={extTitle}
            onChange={(e) => setExtTitle(e.target.value)}
            style={{
              width: '100%',
              height: 44,
              borderRadius: 12,
              background: 'rgba(255,255,255,.05)',
              border: '1px solid var(--border-strong)',
              padding: '0 14px',
              color: '#fff',
              font: '500 13px var(--font-body)',
              marginBottom: 14,
              outline: 'none',
            }}
          />
          <div style={{ font: '600 11px var(--font-body)', color: 'var(--t-55)', marginBottom: 6 }}>
            Client-facing summary
          </div>
          <textarea
            value={extBody}
            onChange={(e) => setExtBody(e.target.value)}
            style={{
              width: '100%',
              height: 90,
              borderRadius: 12,
              background: 'rgba(255,255,255,.05)',
              border: '1px solid var(--border-strong)',
              padding: '12px 14px',
              color: '#fff',
              font: '400 12.5px/1.55 var(--font-body)',
              resize: 'none',
              marginBottom: 20,
              outline: 'none',
            }}
          />
          <ErrorNote />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button variant="ghost" onClick={() => setStep('external')}>
              ← Back
            </Button>
            <Button
              variant="primary"
              disabled={busy}
              onClick={() => onConfirm({ mode: 'modified', title: extTitle, description: extBody })}
            >
              Confirm &amp; publish
            </Button>
          </div>
        </Card>
      </Backdrop>
    )
  }

  // step === 'external'
  const options: { value: Choice; label: string; hint: string }[] = [
    { value: 'identical', label: 'Yes — publish identical variant', hint: 'Client sees the same content.' },
    { value: 'modified', label: 'Yes, with modification', hint: 'Adapt wording for clients first.' },
    { value: 'none', label: 'No — internal only', hint: 'Not shared with clients.' },
  ]

  return (
    <Backdrop>
      <Card>
        <div style={{ font: '600 17px var(--font-display)', color: '#fff', marginBottom: 8 }}>
          External publication
        </div>
        <div style={{ font: '400 12.5px/1.6 var(--font-body)', color: 'var(--t-70, rgba(255,255,255,.7))', marginBottom: 18 }}>
          To provide our customers more insight, this alert can be published both internally and
          externally. Do you agree?
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          {options.map((o) => {
            const on = choice === o.value
            // Only "internal only" stays available without external rights.
            const locked = !canExternal && o.value !== 'none'
            return (
              <div
                key={o.value}
                onClick={() => !locked && setChoice(o.value)}
                title={locked ? 'You do not hold External Publication rights for all locations' : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 14px',
                  borderRadius: 12,
                  cursor: locked ? 'not-allowed' : 'pointer',
                  opacity: locked ? 0.45 : 1,
                  background: on ? 'var(--yellow-tint-soft)' : 'rgba(255,255,255,.03)',
                  border: `1px solid ${on ? 'var(--yellow-border-strong)' : 'var(--border-mid)'}`,
                }}
              >
                <span
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    border: `2px solid ${on ? 'var(--agl-yellow)' : 'var(--t-40)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flex: 'none',
                  }}
                >
                  {on && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--agl-yellow)' }} />}
                </span>
                <div>
                  <div style={{ font: '500 13px var(--font-body)', color: '#fff' }}>{o.label}</div>
                  <div style={{ font: '400 11px var(--font-body)', color: 'var(--t-45)' }}>
                    {locked ? 'Requires External Publication rights' : o.hint}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {!canExternal && (
          <div
            style={{
              borderRadius: 10,
              border: '1px solid var(--border-soft)',
              background: 'rgba(255,255,255,.04)',
              padding: '10px 12px',
              font: '400 11.5px/1.55 var(--font-body)',
              color: 'var(--t-55)',
              marginBottom: 16,
            }}
          >
            You hold Internal Publication for this alert but not External
            {externalUncovered.length > 0 && (
              <> for <b style={{ color: 'var(--t-75)' }}>{externalUncovered.join(', ')}</b></>
            )}
            , so it can only be published internally.
          </div>
        )}

        <ErrorNote />
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button variant="ghost" onClick={() => setStep('content')}>
            ← Back
          </Button>
          <Button
            variant="primary"
            disabled={busy}
            onClick={() => {
              if (choice === 'modified') setStep('modify')
              else onConfirm({ mode: choice })
            }}
          >
            {choice === 'modified' ? 'Adapt variant →' : 'Confirm & publish'}
          </Button>
        </div>
      </Card>
    </Backdrop>
  )
}
