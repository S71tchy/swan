import { useState } from 'react'
import type { CountryRef, Severity, Subscription, SubscriptionInput } from '../types'
import { CountryFlag } from './CountryFlag'
import { SEVERITY_COLOR } from '../lib/format'

const EVENTS: { key: 'published' | 'closed' | 'submitted'; label: string }[] = [
  { key: 'published', label: 'Published' },
  { key: 'closed', label: 'Closed' },
  { key: 'submitted', label: 'Submitted' },
]

const SEVERITIES: Severity[] = ['info', 'watch', 'warning', 'critical']

interface Handlers {
  create: (body: SubscriptionInput) => Promise<unknown>
  update: (id: string, body: Partial<SubscriptionInput>) => Promise<unknown>
  remove: (id: string) => Promise<void>
}

interface Props {
  subscriptions: Subscription[]
  countries: CountryRef[]
  profiles: string[]
  categories: string[]
  handlers: Handlers
  onChanged: () => void
}

function emptyDraft(): SubscriptionInput {
  return { name: '', active: true, events: ['published'], countries: [], profiles: [], categories: [], min_severity: 'info' }
}

function Pill({ on, onClick, children, color }: { on: boolean; onClick: () => void; children: React.ReactNode; color?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '5px 10px',
        borderRadius: 14,
        cursor: 'pointer',
        font: '500 11px var(--font-body)',
        color: on ? (color ? 'var(--agl-navy)' : 'var(--agl-yellow)') : 'var(--t-60)',
        background: on ? (color ?? 'var(--yellow-tint)') : 'transparent',
        border: `1px solid ${on ? (color ? 'transparent' : 'var(--yellow-border-strong)') : 'rgba(255,255,255,.16)'}`,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {children}
    </button>
  )
}

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v]
}

function summarise(s: Subscription): string {
  const ev = s.events.length ? s.events.map((e) => e[0].toUpperCase() + e.slice(1)).join(' · ') : 'No events'
  const zone =
    s.countries.length || s.profiles.length
      ? [...s.profiles, ...s.countries].join(', ')
      : 'Any zone'
  const type = s.categories.length ? s.categories.join(', ') : 'All types'
  return `${ev}  ·  ${zone}  ·  ${type}  ·  ≥ ${s.min_severity}`
}

function Editor({
  draft,
  countries,
  profiles,
  categories,
  onField,
}: {
  draft: SubscriptionInput
  countries: CountryRef[]
  profiles: string[]
  categories: string[]
  onField: (patch: Partial<SubscriptionInput>) => void
}) {
  const [q, setQ] = useState('')
  const ql = q.trim().toLowerCase()
  const shownCountries = countries.filter(
    (c) => draft.countries.includes(c.code) || !ql || c.name.toLowerCase().includes(ql) || c.code.toLowerCase().includes(ql),
  )
  const label = { display: 'block', font: '500 10px var(--font-display)', letterSpacing: '.5px', textTransform: 'uppercase' as const, color: 'var(--t-45)', margin: '2px 0 7px' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <input
        placeholder="Subscription name"
        value={draft.name}
        onChange={(e) => onField({ name: e.target.value })}
        style={{ width: '100%', height: 36, borderRadius: 9, background: 'rgba(255,255,255,.05)', border: '1px solid var(--border-strong)', padding: '0 11px', color: '#fff', font: '400 13px var(--font-body)', outline: 'none' }}
      />

      <div>
        <span style={label}>Events</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {EVENTS.map((e) => (
            <Pill key={e.key} on={draft.events.includes(e.key)} onClick={() => onField({ events: toggle(draft.events, e.key) })}>
              {e.label}
            </Pill>
          ))}
        </div>
      </div>

      <div>
        <span style={label}>Criticality — at or above</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {SEVERITIES.map((s) => (
            <Pill key={s} on={draft.min_severity === s} color={SEVERITY_COLOR[s]} onClick={() => onField({ min_severity: s })}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: draft.min_severity === s ? 'var(--agl-navy)' : SEVERITY_COLOR[s] }} />
              {s[0].toUpperCase() + s.slice(1)}
            </Pill>
          ))}
        </div>
      </div>

      <div>
        <span style={label}>Type — categories (blank = all)</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {categories.map((c) => (
            <Pill key={c} on={draft.categories.includes(c)} onClick={() => onField({ categories: toggle(draft.categories, c) })}>
              {c}
            </Pill>
          ))}
        </div>
      </div>

      {profiles.length > 0 && (
        <div>
          <span style={label}>Zone — profiles</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {profiles.map((p) => (
              <Pill key={p} on={draft.profiles.includes(p)} onClick={() => onField({ profiles: toggle(draft.profiles, p) })}>
                {p}
              </Pill>
            ))}
          </div>
        </div>
      )}

      <div>
        <span style={label}>Zone — countries (blank = any)</span>
        <input
          placeholder={`Filter ${countries.length} countries…`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ width: '100%', height: 32, borderRadius: 8, background: 'rgba(255,255,255,.05)', border: '1px solid var(--border-strong)', padding: '0 10px', color: '#fff', font: '400 12px var(--font-body)', outline: 'none', marginBottom: 7 }}
        />
        <div className="scroll-y" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 132, overflowY: 'auto' }}>
          {shownCountries.map((c) => (
            <Pill key={c.code} on={draft.countries.includes(c.code)} onClick={() => onField({ countries: toggle(draft.countries, c.code) })}>
              <CountryFlag code={c.code} size={13} title={c.name} />
              {c.code}
            </Pill>
          ))}
        </div>
      </div>
    </div>
  )
}

export function SubscriptionEditor({ subscriptions, countries, profiles, categories, handlers, onChanged }: Props) {
  // `editing` holds the id being edited ('new' for a fresh draft), plus its draft.
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState<SubscriptionInput>(emptyDraft())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function startNew() {
    setDraft(emptyDraft())
    setEditing('new')
    setError(null)
  }
  function startEdit(s: Subscription) {
    setDraft({ name: s.name, active: s.active, events: [...s.events], countries: [...s.countries], profiles: [...s.profiles], categories: [...s.categories], min_severity: s.min_severity })
    setEditing(s.id)
    setError(null)
  }

  async function save() {
    if (!draft.name.trim()) {
      setError('Give the subscription a name.')
      return
    }
    if (draft.events.length === 0) {
      setError('Pick at least one event.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      if (editing === 'new') await handlers.create(draft)
      else if (editing) await handlers.update(editing, draft)
      setEditing(null)
      await onChanged()
    } catch {
      setError('Could not save.')
    } finally {
      setBusy(false)
    }
  }

  async function toggleActive(s: Subscription) {
    await handlers.update(s.id, { active: !s.active })
    await onChanged()
  }
  async function remove(id: string) {
    await handlers.remove(id)
    if (editing === id) setEditing(null)
    await onChanged()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {subscriptions.length === 0 && editing !== 'new' && (
        <div style={{ font: '400 11.5px var(--font-body)', color: 'var(--t-45)' }}>
          No subscriptions yet — add one to receive email when matching alerts occur.
        </div>
      )}

      {subscriptions.map((s) =>
        editing === s.id ? (
          <div key={s.id} style={{ borderRadius: 12, border: '1px solid var(--yellow-border-strong)', background: 'rgba(255,255,255,.03)', padding: 14 }}>
            <Editor draft={draft} countries={countries} profiles={profiles} categories={categories} onField={(p) => setDraft((d) => ({ ...d, ...p }))} />
            {error && <div style={{ font: '400 11px var(--font-body)', color: 'var(--sev-critical-text)', marginTop: 10 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={save} disabled={busy} style={btnPrimary}>Save</button>
              <button onClick={() => setEditing(null)} style={btnGhost}>Cancel</button>
              <button onClick={() => remove(s.id)} style={{ ...btnGhost, color: 'var(--sev-critical-text)', marginLeft: 'auto' }}>Delete</button>
            </div>
          </div>
        ) : (
          <div key={s.id} style={{ borderRadius: 12, border: '1px solid var(--border-soft)', background: 'rgba(255,255,255,.03)', padding: '11px 13px', opacity: s.active ? 1 : 0.55 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: '600 12.5px var(--font-body)', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name || 'Untitled'}</div>
                <div style={{ font: '400 10.5px var(--font-body)', color: 'var(--t-50)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{summarise(s)}</div>
              </div>
              <button onClick={() => toggleActive(s)} title={s.active ? 'Active — click to pause' : 'Paused — click to activate'} style={{ font: '600 10px var(--font-display)', textTransform: 'uppercase', letterSpacing: '.5px', padding: '4px 9px', borderRadius: 8, cursor: 'pointer', border: '1px solid var(--border-soft)', background: s.active ? 'var(--yellow-tint)' : 'transparent', color: s.active ? 'var(--agl-yellow)' : 'var(--t-45)' }}>
                {s.active ? 'On' : 'Off'}
              </button>
              <button onClick={() => startEdit(s)} style={{ ...btnGhost, padding: '4px 10px' }}>Edit</button>
            </div>
          </div>
        ),
      )}

      {editing === 'new' && (
        <div style={{ borderRadius: 12, border: '1px solid var(--yellow-border-strong)', background: 'rgba(255,255,255,.03)', padding: 14 }}>
          <Editor draft={draft} countries={countries} profiles={profiles} categories={categories} onField={(p) => setDraft((d) => ({ ...d, ...p }))} />
          {error && <div style={{ font: '400 11px var(--font-body)', color: 'var(--sev-critical-text)', marginTop: 10 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button onClick={save} disabled={busy} style={btnPrimary}>Create</button>
            <button onClick={() => setEditing(null)} style={btnGhost}>Cancel</button>
          </div>
        </div>
      )}

      {editing !== 'new' && (
        <button onClick={startNew} style={{ ...btnGhost, alignSelf: 'flex-start', color: 'var(--agl-yellow)', border: '1px dashed var(--yellow-border-strong)' }}>
          + New subscription
        </button>
      )}
    </div>
  )
}

const btnPrimary: React.CSSProperties = {
  padding: '8px 16px', borderRadius: 9, border: 'none', cursor: 'pointer',
  font: '600 12px var(--font-display)', background: 'var(--agl-yellow)', color: 'var(--agl-navy)',
}
const btnGhost: React.CSSProperties = {
  padding: '8px 14px', borderRadius: 9, cursor: 'pointer',
  font: '600 12px var(--font-display)', background: 'transparent',
  border: '1px solid var(--border-soft)', color: 'var(--t-70)',
}
