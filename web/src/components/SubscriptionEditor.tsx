import { useEffect, useState } from 'react'
import { api } from '../api'
import type {
  CountryRef,
  NotificationTrigger,
  Severity,
  Subscription,
  SubscriptionInput,
} from '../types'
import { CountryFlag } from './CountryFlag'
import { SEVERITY_COLOR } from '../lib/format'

// --------------------------------------------------------------------------- //
// Subscription editor
//
// The trigger list comes from the server (`/meta/notification-triggers`, built
// from the email template catalog) rather than a constant here. It used to be a
// hard-coded array of three — published / closed / submitted — while nine
// templates existed, so six triggers had no way to be switched on or off at all
// and their recipients were decided in code.
//
// Filters are shown only when a selected trigger actually uses them. "Your alert
// was rejected" is about your own item: offering a zone filter beside it would
// imply a narrowing that never happens, and someone setting it would quietly
// stop receiving replies to their own submissions. `trigger.filters` decides,
// and it is the same field the server matches on.
// --------------------------------------------------------------------------- //

const SEVERITIES: Severity[] = ['info', 'watch', 'warning', 'critical']

// Which group a trigger is shown under. Mirrors the catalog's `audience`.
const GROUPS: { key: NotificationTrigger['audience']; label: string; hint: string }[] = [
  { key: 'zone', label: 'Network alerts', hint: 'Alerts across your zone — filtered below' },
  { key: 'participant', label: 'Your activity', hint: 'Replies about alerts and account changes of your own' },
  { key: 'managers', label: 'Administration', hint: 'Rights Manager duties' },
]

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

function Pill({ on, onClick, children, color, title }: { on: boolean; onClick: () => void; children: React.ReactNode; color?: string; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
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
        textAlign: 'left',
      }}
    >
      {children}
    </button>
  )
}

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v]
}

/** Which filters any of the chosen triggers actually use. */
function activeFilters(events: string[], triggers: NotificationTrigger[]): Set<string> {
  const out = new Set<string>()
  for (const t of triggers) if (events.includes(t.event)) t.filters.forEach((f) => out.add(f))
  return out
}

function summarise(s: Subscription, triggers: NotificationTrigger[]): string {
  const label = (e: string) => triggers.find((t) => t.event === e)?.label ?? e
  const ev = s.events.length ? s.events.map(label).join(' · ') : 'No triggers'
  // Only describe the filters that this subscription's triggers actually apply,
  // or a personal-activity rule reads as though it were scoped to a region.
  const uses = activeFilters(s.events, triggers)
  if (uses.size === 0) return ev
  const bits = [ev]
  if (uses.has('zone')) bits.push(s.countries.length || s.profiles.length ? [...s.profiles, ...s.countries].join(', ') : 'Any zone')
  if (uses.has('category')) bits.push(s.categories.length ? s.categories.join(', ') : 'All types')
  if (uses.has('severity')) bits.push(`≥ ${s.min_severity}`)
  return bits.join('  ·  ')
}

function Editor({
  draft,
  countries,
  profiles,
  categories,
  triggers,
  onField,
}: {
  draft: SubscriptionInput
  countries: CountryRef[]
  profiles: string[]
  categories: string[]
  triggers: NotificationTrigger[]
  onField: (patch: Partial<SubscriptionInput>) => void
}) {
  const [q, setQ] = useState('')
  const ql = q.trim().toLowerCase()
  const shownCountries = countries.filter(
    (c) => draft.countries.includes(c.code) || !ql || c.name.toLowerCase().includes(ql) || c.code.toLowerCase().includes(ql),
  )
  const label = { display: 'block', font: '500 10px var(--font-display)', letterSpacing: '.5px', textTransform: 'uppercase' as const, color: 'var(--t-45)', margin: '2px 0 7px' }
  const uses = activeFilters(draft.events, triggers)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <input
        placeholder="Subscription name"
        value={draft.name}
        onChange={(e) => onField({ name: e.target.value })}
        style={{ width: '100%', height: 36, borderRadius: 9, background: 'rgba(255,255,255,.05)', border: '1px solid var(--border-strong)', padding: '0 11px', color: '#fff', font: '400 13px var(--font-body)', outline: 'none' }}
      />

      {GROUPS.map((g) => {
        const rows = triggers.filter((t) => t.audience === g.key)
        if (rows.length === 0) return null
        return (
          <div key={g.key}>
            <span style={label}>
              {g.label} <span style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--t-35)' }}>— {g.hint}</span>
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {rows.map((t) => (
                <Pill
                  key={t.event}
                  title={t.description}
                  on={draft.events.includes(t.event)}
                  onClick={() => onField({ events: toggle(draft.events, t.event) })}
                >
                  {t.label}
                </Pill>
              ))}
            </div>
          </div>
        )
      })}

      {uses.size === 0 && draft.events.length > 0 && (
        <div style={{ font: '400 10.5px/1.5 var(--font-body)', color: 'var(--t-40)' }}>
          These triggers are about your own alerts and account, so zone, type and criticality
          filters don't apply — you'll be told about all of them.
        </div>
      )}

      {uses.has('severity') && (
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
      )}

      {uses.has('category') && (
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
      )}

      {uses.has('zone') && profiles.length > 0 && (
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

      {uses.has('zone') && (
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
      )}
    </div>
  )
}

export function SubscriptionEditor({ subscriptions, countries, profiles, categories, handlers, onChanged }: Props) {
  // `editing` holds the id being edited ('new' for a fresh draft), plus its draft.
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState<SubscriptionInput>(emptyDraft())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [triggers, setTriggers] = useState<NotificationTrigger[]>([])

  useEffect(() => {
    void api.notificationTriggers().then(setTriggers).catch(() => setTriggers([]))
  }, [])

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
      setError('Pick at least one trigger.')
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

  const editorProps = { countries, profiles, categories, triggers }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {subscriptions.length === 0 && editing !== 'new' && (
        <div style={{ font: '400 11.5px/1.55 var(--font-body)', color: 'var(--t-45)' }}>
          No subscriptions — this account currently receives <strong style={{ color: 'var(--t-65)' }}>no
          email at all</strong>, including replies to its own submissions. Add one to change that.
        </div>
      )}

      {subscriptions.map((s) =>
        editing === s.id ? (
          <div key={s.id} style={{ borderRadius: 12, border: '1px solid var(--yellow-border-strong)', background: 'rgba(255,255,255,.03)', padding: 14 }}>
            <Editor draft={draft} {...editorProps} onField={(p) => setDraft((d) => ({ ...d, ...p }))} />
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
                <div style={{ font: '400 10.5px var(--font-body)', color: 'var(--t-50)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{summarise(s, triggers)}</div>
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
          <Editor draft={draft} {...editorProps} onField={(p) => setDraft((d) => ({ ...d, ...p }))} />
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
