import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '../api'
import { TopBar } from '../components/TopBar'
import { MapBackdrop } from '../components/MapBackdrop'
import { Button, SectionLabel, SeverityBadge } from '../components/ui'
import { PublishDialogs } from '../components/PublishDialogs'
import { CountryFlag } from '../components/CountryFlag'
import { fmtAgo, fmtDateShort, modesLabel } from '../lib/format'
import type { ApprovalItem, ApprovalQueue, ExternalVariant } from '../types'

function CategoryPill({ label, navy = false, color }: { label: string; navy?: boolean; color: string }) {
  return (
    <span
      style={{
        padding: '2px 8px',
        borderRadius: 5,
        background: color,
        font: "700 9.5px var(--font-display)",
        color: navy ? 'var(--agl-navy)' : '#fff',
        letterSpacing: '.8px',
      }}
    >
      {label}
    </span>
  )
}

const CAT_COLOR: Record<string, { color: string; navy: boolean }> = {
  Weather: { color: 'var(--sev-warning)', navy: false },
  Strike: { color: 'var(--sev-warning)', navy: false },
  Congestion: { color: 'var(--sev-info)', navy: true },
  Regulatory: { color: 'var(--sev-watch)', navy: true },
  Security: { color: 'var(--sev-warning)', navy: false },
  Health: { color: 'var(--sev-info)', navy: true },
  Infrastructure: { color: 'var(--sev-info)', navy: true },
  Accident: { color: 'var(--sev-critical)', navy: false },
}

function TintCard({ label, body }: { label: string; body: string }) {
  return (
    <div style={{ borderRadius: 12, background: 'rgba(255,255,255,.04)', border: '1px solid var(--border-soft)', padding: 14 }}>
      <SectionLabel style={{ marginBottom: 6 }}>{label}</SectionLabel>
      <div style={{ font: '400 12px/1.55 var(--font-body)', color: 'var(--t-80)' }}>{body}</div>
    </div>
  )
}

function EscalatedBadge() {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '2px 8px',
        borderRadius: 11,
        background: 'rgba(237,140,0,.15)',
        border: '1px solid rgba(237,140,0,.55)',
        font: '600 9.5px var(--font-display)',
        letterSpacing: '.5px',
        textTransform: 'uppercase',
        color: 'var(--agl-orange)',
        flex: 'none',
      }}
    >
      Escalated
    </span>
  )
}

/** All countries on an alert, flagged, deduped — not just locations[0]. */
function CountryList({ item, size = 13 }: { item: ApprovalItem; size?: number }) {
  return (
    <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 7, alignItems: 'center' }}>
      {item.countries.map((c) => {
        const mine = item.covered.includes(c)
        return (
          <span
            key={c}
            title={mine ? 'In your perimeter' : 'Outside your perimeter'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              color: mine ? 'var(--t-70)' : 'var(--agl-orange)',
            }}
          >
            <CountryFlag code={c} size={size} />
            {c}
          </span>
        )
      })}
    </span>
  )
}

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        borderRadius: 12,
        border: '1px solid rgba(207,69,39,.5)',
        background: 'rgba(207,69,39,.12)',
        padding: '11px 13px',
        font: '400 12px/1.5 var(--font-body)',
        color: 'var(--sev-critical-text)',
      }}
    >
      <span style={{ flex: 1 }}>{message}</span>
      <button
        onClick={onDismiss}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', font: '600 13px var(--font-display)', lineHeight: 1 }}
      >
        ×
      </button>
    </div>
  )
}

function RejectDialog({
  onCancel,
  onReject,
  busy,
  error,
}: {
  onCancel: () => void
  onReject: (c: string) => void
  busy?: boolean
  error?: string | null
}) {
  const [comment, setComment] = useState('')
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(6,11,20,.6)', display: 'grid', placeItems: 'center', zIndex: 60 }}>
      <div style={{ width: 460, maxWidth: 'calc(100vw - 40px)', borderRadius: 18, background: 'var(--glass-97)', border: '1px solid var(--border-strong)', boxShadow: 'var(--shadow-modal)', padding: 26 }}>
        <div style={{ font: '600 16px var(--font-display)', color: '#fff', marginBottom: 12 }}>Reject with comment</div>
        <textarea
          autoFocus
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Explain what needs to change before this can be published…"
          style={{ width: '100%', height: 100, borderRadius: 12, background: 'rgba(255,255,255,.05)', border: '1px solid var(--border-strong)', padding: '12px 14px', color: '#fff', font: '400 12.5px/1.55 var(--font-body)', resize: 'none', outline: 'none', marginBottom: 18 }}
        />
        {error && (
          <div style={{ borderRadius: 10, border: '1px solid rgba(207,69,39,.5)', background: 'rgba(207,69,39,.12)', padding: '10px 12px', font: '400 12px/1.5 var(--font-body)', color: 'var(--sev-critical-text)', marginBottom: 16 }}>
            {error}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant="danger" disabled={busy || !comment.trim()} onClick={() => onReject(comment.trim())}>
            Reject &amp; return to author
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function Approvals() {
  const navigate = useNavigate()
  const [queue, setQueue] = useState<ApprovalQueue | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showPublish, setShowPublish] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<{ title: string; description: string; impacts: string; action_plan: string }>({
    title: '',
    description: '',
    impacts: '',
    action_plan: '',
  })

  async function reload(keepId?: string) {
    const q = await api.approvals()
    setQueue(q)
    const next =
      keepId && q.items.some((i) => i.alert.id === keepId) ? keepId : (q.items[0]?.alert.id ?? null)
    setSelectedId(next)
    return q
  }

  useEffect(() => {
    void reload().catch(() => setError('Could not load the approval queue.'))
  }, [])

  const item: ApprovalItem | undefined = queue?.items.find((i) => i.alert.id === selectedId)
  const selected = item?.alert

  /** Every action funnels through here so no failure can be silent again.
   *  A 409 means someone else already actioned it — refresh rather than nag. */
  async function run(fn: () => Promise<unknown>, fallback: string, onOk?: () => void) {
    setBusy(true)
    setError(null)
    try {
      await fn()
      onOk?.()
      await reload()
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setError('This alert was already actioned by someone else. The queue has been refreshed.')
        await reload().catch(() => {})
      } else {
        setError(e instanceof ApiError ? e.message : fallback)
      }
    } finally {
      setBusy(false)
    }
  }

  function startEdit() {
    if (!selected) return
    setDraft({
      title: selected.title,
      description: selected.description,
      impacts: selected.impacts,
      action_plan: selected.action_plan,
    })
    setError(null)
    setEditing(true)
  }

  async function saveEdit() {
    if (!selected) return
    const id = selected.id
    setBusy(true)
    setError(null)
    try {
      await api.updateAlert(id, draft)
      await reload(id)
      setEditing(false)
    } catch (e) {
      // Stay in edit mode so the entered text isn't lost.
      setError(e instanceof ApiError ? e.message : 'Could not save your changes.')
    } finally {
      setBusy(false)
    }
  }

  async function confirmPublish(external: ExternalVariant) {
    if (!selected) return
    const id = selected.id
    await run(() => api.publish(id, external), 'Could not publish this alert.', () =>
      setShowPublish(false),
    )
  }

  async function doReject(comment: string) {
    if (!selected) return
    const id = selected.id
    await run(() => api.reject(id, comment), 'Could not reject this alert.', () =>
      setShowReject(false),
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: 'var(--bg-deep)' }}>
      <MapBackdrop opacity={0.6} blur={0} overlay="" stroke />
      <TopBar />

      {/* slide-over */}
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: 820,
          maxWidth: '100vw',
          background: 'var(--glass-slideover)',
          borderLeft: '1px solid var(--border-mid)',
          backdropFilter: 'blur(20px)',
          display: 'flex',
          boxShadow: '-30px 0 80px rgba(0,0,0,.5)',
          animation: 'swanSlideOver .28s ease-out',
        }}
      >
        {/* list */}
        <div style={{ width: 340, borderRight: '1px solid rgba(255,255,255,.08)', display: 'flex', flexDirection: 'column', paddingTop: 68 }}>
          <div style={{ padding: '22px 20px 14px' }}>
            <div style={{ font: '600 16px var(--font-display)', color: '#fff' }}>Approval queue</div>
            <div style={{ font: '400 11.5px var(--font-body)', color: 'var(--t-45)', marginTop: 3 }}>
              Your perimeter: <span style={{ color: 'var(--agl-yellow)' }}>{queue?.perimeter_label ?? '—'}</span>
              {' · '}
              {queue?.pending ?? 0} pending
              {(queue?.escalated ?? 0) > 0 && (
                <> · <span style={{ color: 'var(--agl-orange)' }}>{queue!.escalated} escalated</span></>
              )}
            </div>
            <div
              style={{
                marginTop: 10,
                borderRadius: 10,
                border: '1px solid var(--border-soft)',
                background: 'rgba(255,255,255,.03)',
                padding: '8px 11px',
                font: '400 10.5px/1.5 var(--font-body)',
                color: 'var(--t-50)',
              }}
            >
              Shows <b style={{ color: 'var(--t-70)' }}>submitted</b> alerts whose locations are all inside your
              perimeter — everything here you can action.
              {(queue?.escalated ?? 0) > 0 && (
                <>
                  {' '}
                  <b style={{ color: 'var(--agl-orange)' }}>Escalated</b> ones reach no other perimeter and need a
                  Rights Manager.
                </>
              )}
            </div>
          </div>
          <div className="scroll-y" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 14px 14px' }}>
            {queue?.items.length === 0 && (
              <div style={{ color: 'var(--t-45)', font: '400 12.5px var(--font-body)', padding: '20px 6px' }}>
                Nothing awaiting approval in your perimeter.
              </div>
            )}
            {queue?.items.map((it) => {
              const a = it.alert
              const on = a.id === selectedId
              const cat = CAT_COLOR[a.category] ?? { color: 'var(--sev-info)', navy: true }
              // Union of modes across every location block, not just the first.
              const modes = [...new Set(a.locations.flatMap((l) => l.modes))]
              return (
                <div
                  key={a.id}
                  onClick={() => {
                    setSelectedId(a.id)
                    setEditing(false)
                    setError(null)
                  }}
                  style={{
                    borderRadius: 14,
                    background: on ? 'rgba(238,213,142,.09)' : 'transparent',
                    border: `1px solid ${
                      on
                        ? 'var(--yellow-border-strong)'
                        : it.escalated
                          ? 'rgba(237,140,0,.35)'
                          : 'var(--border-soft)'
                    }`,
                    padding: 14,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', gap: 6, marginBottom: 7, alignItems: 'center', flexWrap: 'wrap' }}>
                    <CategoryPill label={a.category.toUpperCase()} color={cat.color} navy={cat.navy} />
                    {it.escalated && <EscalatedBadge />}
                    <span style={{ font: '400 10.5px var(--font-body)', color: 'var(--t-40)' }}>
                      {fmtAgo(a.submitted_at)}
                    </span>
                  </div>
                  <div style={{ font: '600 13px/1.4 var(--font-display)', color: '#fff' }}>{a.title}</div>
                  <div
                    style={{
                      font: '400 11px var(--font-body)',
                      color: 'var(--t-45)',
                      marginTop: 5,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      flexWrap: 'wrap',
                    }}
                  >
                    <CountryList item={it} />
                    <span>· {modesLabel(modes)}</span>
                    <span>· {a.author.name}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* preview */}
        <div className="scroll-y" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '90px 26px 22px', gap: 16 }}>
          {!selected && (
            <div style={{ color: 'var(--t-45)', font: '400 13px var(--font-body)', marginTop: 40 }}>
              Select a submission to review.
            </div>
          )}
          {selected && (
            <>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <SeverityBadge severity={selected.severity} />
                <span style={{ padding: '4px 10px', borderRadius: 6, background: 'rgba(255,255,255,.1)', font: '500 10.5px var(--font-body)', color: '#fff' }}>
                  {selected.category} · {selected.sub_category}
                </span>
                <span style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,.15)', font: '500 10.5px var(--font-body)', color: 'var(--t-70, rgba(255,255,255,.7))' }}>
                  Submitted {fmtAgo(selected.submitted_at)}
                </span>
                {item?.escalated && <EscalatedBadge />}
              </div>

              {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

              {editing ? (
                <input
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  style={{ font: '600 18px var(--font-display)', color: '#fff', background: 'rgba(255,255,255,.05)', border: '1px solid var(--border-strong)', borderRadius: 10, padding: '10px 12px', outline: 'none' }}
                />
              ) : (
                <div style={{ font: '600 20px/1.35 var(--font-display)', color: '#fff' }}>{selected.title}</div>
              )}

              {/* An approver who can reword the title, impact and action plan
                  but not the description would be editing around the one field
                  that carries the event's own timing (spec §5.2). */}
              {editing ? (
                <textarea
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  style={{ height: 84, borderRadius: 12, background: 'rgba(255,255,255,.05)', border: '1px solid var(--border-strong)', padding: 12, color: '#fff', font: '400 13px/1.65 var(--font-body)', resize: 'none', outline: 'none' }}
                />
              ) : (
                selected.description?.trim() && (
                  <div style={{ font: '400 13px/1.65 var(--font-body)', color: 'var(--t-75)' }}>{selected.description}</div>
                )
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {editing ? (
                  <>
                    <textarea value={draft.impacts} onChange={(e) => setDraft({ ...draft, impacts: e.target.value })} style={{ height: 110, borderRadius: 12, background: 'rgba(255,255,255,.05)', border: '1px solid var(--border-strong)', padding: 12, color: '#fff', font: '400 12px/1.55 var(--font-body)', resize: 'none', outline: 'none' }} />
                    <textarea value={draft.action_plan} onChange={(e) => setDraft({ ...draft, action_plan: e.target.value })} style={{ height: 110, borderRadius: 12, background: 'rgba(255,255,255,.05)', border: '1px solid var(--border-strong)', padding: 12, color: '#fff', font: '400 12px/1.55 var(--font-body)', resize: 'none', outline: 'none' }} />
                  </>
                ) : (
                  <>
                    <TintCard label="Impact" body={selected.impacts} />
                    <TintCard label="Action plan" body={selected.action_plan} />
                  </>
                )}
              </div>

              {/* every location block, not just the first */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <SectionLabel>
                  {selected.locations.length} location{selected.locations.length === 1 ? '' : 's'}
                </SectionLabel>
                {selected.locations.map((l, i) => {
                  const mine = item?.covered.includes(l.country)
                  return (
                    <div
                      key={`${l.code}-${i}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        flexWrap: 'wrap',
                        font: '400 11.5px var(--font-body)',
                        color: 'var(--t-65)',
                      }}
                    >
                      <CountryFlag code={l.country} size={14} />
                      <span style={{ color: '#fff' }}>{l.name}</span>
                      <span style={{ color: 'var(--t-45)' }}>{l.country_name}</span>
                      <span style={{ color: 'var(--t-45)' }}>· {modesLabel(l.modes)}</span>
                      <span style={{ color: 'var(--t-45)' }}>· {l.flow} flow</span>
                      {!mine && (
                        <span style={{ color: 'var(--agl-orange)', font: '500 10.5px var(--font-body)' }}>
                          outside your perimeter
                        </span>
                      )}
                    </div>
                  )
                })}
                <div style={{ font: '400 11.5px var(--font-body)', color: 'var(--t-50)', marginTop: 2 }}>
                  Visible {fmtDateShort(selected.valid_from)} →{' '}
                  {selected.valid_to ? fmtDateShort(selected.valid_to) : 'until further notice'}
                </div>
              </div>

              <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {item?.escalated ? (
                  <div style={{ borderRadius: 12, border: '1px solid rgba(237,140,0,.5)', background: 'rgba(237,140,0,.1)', padding: '12px 14px', font: '400 11.5px/1.5 var(--font-body)', color: 'var(--t-70, rgba(255,255,255,.7))' }}>
                    <b style={{ color: 'var(--agl-orange)' }}>Escalated to you as a Rights Manager.</b> No single
                    perimeter covers {item.uncovered.join(', ')}, so this submission would otherwise reach nobody.
                    Publishing it here is recorded in the audit trail as an escalation.
                  </div>
                ) : (
                  <div style={{ borderRadius: 12, border: '1px solid var(--yellow-border)', background: 'var(--yellow-tint-soft)', padding: '12px 14px', font: '400 11.5px/1.5 var(--font-body)', color: 'var(--t-70, rgba(255,255,255,.7))' }}>
                    On publish you'll be asked to confirm content, then choose internal-only
                    {item?.can_publish_external ? ' or internal + external variant.' : '.'}
                    {item && !item.can_publish_external && (
                      <> External publication needs rights you don't hold for this alert.</>
                    )}
                  </div>
                )}
                {editing ? (
                  <div style={{ display: 'flex', gap: 10 }}>
                    <Button variant="primary" disabled={busy} onClick={saveEdit}>Save changes</Button>
                    <Button variant="ghost" onClick={() => setEditing(false)}>Cancel edit</Button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <Button
                      variant="primary"
                      style={{ height: 46, borderRadius: 23 }}
                      // clear first: an error is scoped to the attempt that raised it,
                      // so a stale one must never surface inside a fresh dialog
                      onClick={() => {
                        setError(null)
                        setShowPublish(true)
                      }}
                    >
                      ✓ Internal publication
                    </Button>
                    <Button variant="outline" style={{ height: 46, borderRadius: 23 }} onClick={startEdit}>
                      Edit then publish
                    </Button>
                    <Button
                      variant="danger"
                      style={{ height: 46, borderRadius: 23 }}
                      onClick={() => {
                        setError(null)
                        setShowReject(true)
                      }}
                    >
                      Reject with comment
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* close slide-over -> back to dashboard */}
      <div
        onClick={() => navigate('/')}
        style={{ position: 'absolute', left: 0, top: 68, bottom: 0, right: 820, cursor: 'pointer' }}
      />

      {showPublish && selected && item && (
        <PublishDialogs
          title={selected.title}
          onCancel={() => {
            setShowPublish(false)
            setError(null)
          }}
          onConfirm={confirmPublish}
          busy={busy}
          canExternal={item.can_publish_external}
          externalUncovered={item.external_uncovered}
          error={error}
        />
      )}
      {showReject && (
        <RejectDialog
          onCancel={() => {
            setShowReject(false)
            setError(null)
          }}
          onReject={doReject}
          busy={busy}
          error={error}
        />
      )}
    </div>
  )
}
