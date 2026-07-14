import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { TopBar } from '../components/TopBar'
import { MapBackdrop } from '../components/MapBackdrop'
import { Button, SectionLabel, SeverityBadge } from '../components/ui'
import { PublishDialogs } from '../components/PublishDialogs'
import { fmtAgo, fmtDateShort, modesLabel, MODE_GLYPH } from '../lib/format'
import type { Alert, ApprovalQueue, ExternalVariant } from '../types'

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

function RejectDialog({ onCancel, onReject, busy }: { onCancel: () => void; onReject: (c: string) => void; busy?: boolean }) {
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
  const [draft, setDraft] = useState<{ title: string; impacts: string; action_plan: string }>({
    title: '',
    impacts: '',
    action_plan: '',
  })

  async function reload(keepId?: string) {
    const q = await api.approvals()
    setQueue(q)
    const next = keepId && q.alerts.some((a) => a.id === keepId) ? keepId : (q.alerts[0]?.id ?? null)
    setSelectedId(next)
  }

  useEffect(() => {
    void reload()
  }, [])

  const selected: Alert | undefined = queue?.alerts.find((a) => a.id === selectedId)

  function startEdit() {
    if (!selected) return
    setDraft({ title: selected.title, impacts: selected.impacts, action_plan: selected.action_plan })
    setEditing(true)
  }

  async function saveEdit() {
    if (!selected) return
    setBusy(true)
    await api.updateAlert(selected.id, draft)
    await reload(selected.id)
    setEditing(false)
    setBusy(false)
  }

  async function confirmPublish(external: ExternalVariant) {
    if (!selected) return
    setBusy(true)
    try {
      await api.publish(selected.id, external)
      setShowPublish(false)
      await reload()
    } finally {
      setBusy(false)
    }
  }

  async function doReject(comment: string) {
    if (!selected) return
    setBusy(true)
    try {
      await api.reject(selected.id, comment)
      setShowReject(false)
      await reload()
    } finally {
      setBusy(false)
    }
  }

  const loc = selected?.locations[0]

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: 'var(--bg-deep)' }}>
      <MapBackdrop opacity={0.6} blur={0} overlay="" stroke />
      <TopBar showCreate={false} />

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
            </div>
          </div>
          <div className="scroll-y" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 14px 14px' }}>
            {queue?.alerts.length === 0 && (
              <div style={{ color: 'var(--t-45)', font: '400 12.5px var(--font-body)', padding: '20px 6px' }}>
                Nothing awaiting approval in your perimeter.
              </div>
            )}
            {queue?.alerts.map((a) => {
              const on = a.id === selectedId
              const cat = CAT_COLOR[a.category] ?? { color: 'var(--sev-info)', navy: true }
              return (
                <div
                  key={a.id}
                  onClick={() => {
                    setSelectedId(a.id)
                    setEditing(false)
                  }}
                  style={{
                    borderRadius: 14,
                    background: on ? 'rgba(238,213,142,.09)' : 'transparent',
                    border: `1px solid ${on ? 'var(--yellow-border-strong)' : 'var(--border-soft)'}`,
                    padding: 14,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', gap: 6, marginBottom: 7, alignItems: 'center' }}>
                    <CategoryPill label={a.category.toUpperCase()} color={cat.color} navy={cat.navy} />
                    <span style={{ font: '400 10.5px var(--font-body)', color: 'var(--t-40)' }}>
                      {fmtAgo(a.submitted_at)}
                    </span>
                  </div>
                  <div style={{ font: '600 13px/1.4 var(--font-display)', color: '#fff' }}>{a.title}</div>
                  <div style={{ font: '400 11px var(--font-body)', color: 'var(--t-45)', marginTop: 5 }}>
                    {a.locations[0]?.flag} {a.locations[0]?.country_name} · {modesLabel(a.locations[0]?.modes ?? [])} ·{' '}
                    {a.author.name}
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
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <SeverityBadge severity={selected.severity} />
                <span style={{ padding: '4px 10px', borderRadius: 6, background: 'rgba(255,255,255,.1)', font: '500 10.5px var(--font-body)', color: '#fff' }}>
                  {selected.category} · {selected.sub_category}
                </span>
                <span style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,.15)', font: '500 10.5px var(--font-body)', color: 'var(--t-70, rgba(255,255,255,.7))' }}>
                  Submitted {fmtAgo(selected.submitted_at)}
                </span>
              </div>

              {editing ? (
                <input
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  style={{ font: '600 18px var(--font-display)', color: '#fff', background: 'rgba(255,255,255,.05)', border: '1px solid var(--border-strong)', borderRadius: 10, padding: '10px 12px', outline: 'none' }}
                />
              ) : (
                <div style={{ font: '600 20px/1.35 var(--font-display)', color: '#fff' }}>{selected.title}</div>
              )}

              <div style={{ font: '400 13px/1.65 var(--font-body)', color: 'var(--t-75)' }}>{selected.description}</div>

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

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, font: '400 11.5px var(--font-body)', color: 'var(--t-50)', flexWrap: 'wrap' }}>
                {loc && (
                  <>
                    <span>📍 {loc.name}</span>
                    <span>·</span>
                    <span>{loc.modes.map((m) => `${MODE_GLYPH[m]}`).join(' ')} {modesLabel(loc.modes)}</span>
                    <span>·</span>
                    <span>{selected.locations.length > 1 ? `${selected.locations.length} locations` : loc.flow + ' flow'}</span>
                    <span>·</span>
                    <span>Visible {fmtDateShort(selected.valid_from)} → {selected.valid_to ? fmtDateShort(selected.valid_to) : 'open'}</span>
                  </>
                )}
              </div>

              <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ borderRadius: 12, border: '1px solid var(--yellow-border)', background: 'var(--yellow-tint-soft)', padding: '12px 14px', font: '400 11.5px/1.5 var(--font-body)', color: 'var(--t-70, rgba(255,255,255,.7))' }}>
                  On publish you'll be asked to confirm content, then choose internal-only or internal
                  + external variant.
                </div>
                {editing ? (
                  <div style={{ display: 'flex', gap: 10 }}>
                    <Button variant="primary" disabled={busy} onClick={saveEdit}>Save changes</Button>
                    <Button variant="ghost" onClick={() => setEditing(false)}>Cancel edit</Button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <Button variant="primary" style={{ height: 46, borderRadius: 23 }} onClick={() => setShowPublish(true)}>
                      ✓ Internal publication
                    </Button>
                    <Button variant="outline" style={{ height: 46, borderRadius: 23 }} onClick={startEdit}>
                      Edit then publish
                    </Button>
                    <Button variant="danger" style={{ height: 46, borderRadius: 23 }} onClick={() => setShowReject(true)}>
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

      {showPublish && selected && (
        <PublishDialogs title={selected.title} onCancel={() => setShowPublish(false)} onConfirm={confirmPublish} busy={busy} />
      )}
      {showReject && <RejectDialog onCancel={() => setShowReject(false)} onReject={doReject} busy={busy} />}
    </div>
  )
}
