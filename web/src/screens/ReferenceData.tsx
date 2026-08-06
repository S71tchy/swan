import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { api, ApiError } from '../api'
import { useAuth } from '../auth'
import { CountryFlag } from '../components/CountryFlag'
import { AdminGate, AdminScreen, Drawer, Field, FormError, inputStyle } from '../components/adminUi'
import { Button } from '../components/ui'
import { SEVERITY_COLOR, SEVERITY_LABEL } from '../lib/format'
import type { CategoryRow, CountryRef, IndustryRow, Taxonomy } from '../types'

// --------------------------------------------------------------------------- //
// Settings → Reference data
//
// Two halves, and the split is the point:
//
//   Editable — alert categories, their sub-categories, and industries. These are
//   vocabulary. Operators meet event types nobody anticipated ("Cyber", "Labour
//   dispute") and should not need a deploy to record one, so they live in tables
//   (`categories`, `industries`) seeded from enums.py, exactly as the gazetteer
//   is seeded from reference.PLACES.
//
//   Read-only — severities, transport modes, flows, roles, profiles, countries.
//   These are not labels: severity drives map colour and the subscription
//   threshold, modes and flows are a matched vocabulary in lib/alertSearch, and
//   countries are generated from Natural Earth by ops/build_geo.py. Renaming any
//   of them is a code change, not a data edit.
//
// The editors talk to /admin/* and are gated on Rights Manager. Renames cascade
// server-side across alerts and subscription filters; deletes are refused while
// anything still references the value. See routers/admin.py for why.
// --------------------------------------------------------------------------- //

function Panel({
  title,
  count,
  action,
  children,
}: {
  title: string
  count: number
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <div
      style={{
        borderRadius: 16,
        background: 'var(--glass-90)',
        border: '1px solid var(--border-mid)',
        backdropFilter: 'blur(18px)',
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{ font: '600 13.5px var(--font-display)', color: '#fff' }}>{title}</span>
        <span style={{ font: '400 11px var(--font-body)', color: 'var(--t-45)' }}>{count}</span>
        <span style={{ flex: 1 }} />
        {action}
      </div>
      {children}
    </div>
  )
}

function Tag({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 14,
        background: 'rgba(255,255,255,.05)',
        border: `1px solid ${color ? color : 'var(--border-soft)'}`,
        font: '500 11.5px var(--font-body)',
        color: 'var(--t-75)',
      }}
    >
      {children}
    </span>
  )
}

/** "5 alerts · 1 subscription" — what a rename would move, what a delete blocks. */
function UsageNote({ alerts, subscriptions }: { alerts: number; subscriptions?: number }) {
  const parts: string[] = []
  if (alerts) parts.push(`${alerts} alert${alerts === 1 ? '' : 's'}`)
  if (subscriptions) parts.push(`${subscriptions} subscription${subscriptions === 1 ? '' : 's'}`)
  return (
    <span style={{ font: '400 10.5px var(--font-body)', color: parts.length ? 'var(--t-50)' : 'var(--t-35)' }}>
      {parts.length ? parts.join(' · ') : 'unused'}
    </span>
  )
}

const smallBtn: React.CSSProperties = {
  height: 26,
  padding: '0 10px',
  borderRadius: 8,
  border: '1px solid var(--border-strong)',
  background: 'rgba(255,255,255,.05)',
  color: 'var(--t-70)',
  font: '600 11px var(--font-body)',
  cursor: 'pointer',
}

// --------------------------------------------------------------------------- //
// Category editor
// --------------------------------------------------------------------------- //
function CategoryEditor({
  row,
  onClose,
  onSaved,
}: {
  row: CategoryRow | 'new'
  onClose: () => void
  onSaved: () => void
}) {
  const isNew = row === 'new'
  const original = isNew ? null : row
  const [name, setName] = useState(original?.name ?? '')
  // Sub-categories are tracked with the name they *started* with, so an edit in
  // place can be sent as a rename (which carries its alerts) rather than as a
  // remove plus an add (which the server refuses while the old value is in use).
  const [subs, setSubs] = useState<{ was: string | null; now: string }[]>(
    (original?.sub_categories ?? []).map((s) => ({ was: s, now: s })),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const subUsage = original?.sub_usage ?? {}

  async function save() {
    setBusy(true)
    setError(null)
    try {
      const list = subs.map((s) => s.now.trim()).filter(Boolean)
      if (isNew) {
        await api.adminCreateCategory({ name: name.trim(), sub_categories: list })
      } else {
        const renames: Record<string, string> = {}
        for (const s of subs) {
          const next = s.now.trim()
          if (s.was && next && s.was !== next) renames[s.was] = next
        }
        await api.adminUpdateCategory(original!.name, {
          name: name.trim() !== original!.name ? name.trim() : undefined,
          sub_categories: list,
          rename_sub: Object.keys(renames).length ? renames : undefined,
        })
      }
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save.')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!original) return
    setBusy(true)
    setError(null)
    try {
      await api.adminDeleteCategory(original.name)
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not delete.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Drawer onClose={onClose}>
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <div style={{ font: '600 16px var(--font-display)', color: '#fff' }}>
            {isNew ? 'Add category' : `Edit ${original!.name}`}
          </div>
          <div style={{ font: '400 12px/1.6 var(--font-body)', color: 'var(--t-50)', marginTop: 4 }}>
            {isNew
              ? 'It becomes selectable on the create-alert form immediately.'
              : 'Renaming updates every alert already filed under this name, and every notification subscription filtering on it.'}
          </div>
        </div>

        {error && <FormError>{error}</FormError>}

        <Field label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} autoFocus />
        </Field>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ font: '600 11px var(--font-display)', color: 'var(--t-60)', textTransform: 'uppercase', letterSpacing: '1.1px' }}>
              Sub-categories
            </span>
            <span style={{ flex: 1 }} />
            <button style={smallBtn} onClick={() => setSubs([...subs, { was: null, now: '' }])}>
              ＋ Add
            </button>
          </div>
          {subs.map((s, i) => {
            const used = s.was ? subUsage[s.was] ?? 0 : 0
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  value={s.now}
                  placeholder="e.g. Port congestion"
                  onChange={(e) =>
                    setSubs(subs.map((x, j) => (j === i ? { ...x, now: e.target.value } : x)))
                  }
                  style={{ ...inputStyle, height: 36 }}
                />
                <span style={{ width: 64, textAlign: 'right' }}>
                  <UsageNote alerts={used} />
                </span>
                <button
                  title={used ? `${used} alert(s) use this — rename it instead` : 'Remove'}
                  onClick={() => setSubs(subs.filter((_, j) => j !== i))}
                  style={{ ...smallBtn, opacity: used ? 0.45 : 1 }}
                >
                  ✕
                </button>
              </div>
            )
          })}
          {subs.length === 0 && (
            <span style={{ font: '400 11.5px var(--font-body)', color: 'var(--t-40)' }}>
              None yet — the sub-category field will stay empty for this category.
            </span>
          )}
        </div>

        {!isNew && (
          <div style={{ font: '400 11px/1.6 var(--font-body)', color: 'var(--t-45)' }}>
            In use by <strong style={{ color: 'var(--t-70)' }}>{original!.usage}</strong> alert(s) and{' '}
            <strong style={{ color: 'var(--t-70)' }}>{original!.subscriptions}</strong> subscription(s). A category can
            only be deleted once nothing references it.
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          {!isNew && (
            <Button variant="ghost" onClick={remove} disabled={busy}>
              Delete
            </Button>
          )}
          <span style={{ flex: 1 }} />
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={busy || !name.trim()}>
            {isNew ? 'Add category' : 'Save changes'}
          </Button>
        </div>
      </div>
    </Drawer>
  )
}

// --------------------------------------------------------------------------- //
// Industries — flat enough to edit inline, no drawer needed
// --------------------------------------------------------------------------- //
function Industries({ rows, reload }: { rows: IndustryRow[]; reload: () => void }) {
  const [adding, setAdding] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function run(fn: () => Promise<unknown>) {
    setError(null)
    try {
      await fn()
      reload()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save.')
    }
  }

  return (
    <Panel
      title="Industries"
      count={rows.length}
      action={
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            value={adding}
            placeholder="Add an industry…"
            onChange={(e) => setAdding(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && adding.trim()) {
                void run(() => api.adminCreateIndustry(adding.trim())).then(() => setAdding(''))
              }
            }}
            style={{ ...inputStyle, height: 30, width: 180, fontSize: 12 }}
          />
          <button
            style={smallBtn}
            disabled={!adding.trim()}
            onClick={() => void run(() => api.adminCreateIndustry(adding.trim())).then(() => setAdding(''))}
          >
            ＋ Add
          </button>
        </div>
      }
    >
      {error && <FormError>{error}</FormError>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.map((r) => (
          <div
            key={r.name}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '7px 12px',
              borderRadius: 10,
              border: '1px solid var(--border-soft)',
              background: 'rgba(255,255,255,.035)',
            }}
          >
            {editing === r.name ? (
              <input
                value={draft}
                autoFocus
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setEditing(null)
                  if (e.key === 'Enter' && draft.trim()) {
                    void run(() => api.adminUpdateIndustry(r.name, { name: draft.trim() })).then(() =>
                      setEditing(null),
                    )
                  }
                }}
                style={{ ...inputStyle, height: 30, flex: 1, fontSize: 12.5 }}
              />
            ) : (
              <span style={{ flex: 1, font: '500 12.5px var(--font-body)', color: 'var(--t-80)' }}>{r.name}</span>
            )}
            <UsageNote alerts={r.usage} />
            {editing === r.name ? (
              <>
                <button style={smallBtn} onClick={() => setEditing(null)}>
                  Cancel
                </button>
                <button
                  style={smallBtn}
                  disabled={!draft.trim()}
                  onClick={() =>
                    void run(() => api.adminUpdateIndustry(r.name, { name: draft.trim() })).then(() =>
                      setEditing(null),
                    )
                  }
                >
                  Save
                </button>
              </>
            ) : (
              <>
                <button
                  style={smallBtn}
                  onClick={() => {
                    setEditing(r.name)
                    setDraft(r.name)
                  }}
                >
                  Rename
                </button>
                <button
                  style={{ ...smallBtn, opacity: r.usage ? 0.45 : 1 }}
                  title={r.usage ? `${r.usage} alert(s) use this — rename it instead` : 'Delete'}
                  onClick={() => void run(() => api.adminDeleteIndustry(r.name))}
                >
                  ✕
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </Panel>
  )
}

// --------------------------------------------------------------------------- //
export default function ReferenceData() {
  const { user } = useAuth()
  const [taxonomy, setTaxonomy] = useState<Taxonomy | null>(null)
  const [countries, setCountries] = useState<CountryRef[]>([])
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [industries, setIndustries] = useState<IndustryRow[]>([])
  const [editing, setEditing] = useState<CategoryRow | 'new' | null>(null)
  const [query, setQuery] = useState('')

  const isManager = user?.rights.is_rights_manager

  const reload = useCallback(() => {
    void api.adminCategories().then(setCategories).catch(() => setCategories([]))
    void api.adminIndustries().then(setIndustries).catch(() => setIndustries([]))
    // The create form reads /meta/taxonomy, so refetch it too — otherwise the
    // counts on this screen and the options on that one drift apart.
    void api.taxonomy().then(setTaxonomy).catch(() => setTaxonomy(null))
  }, [])

  useEffect(() => {
    if (!isManager) return
    reload()
    void api.adminCountries().then(setCountries).catch(() => setCountries([]))
  }, [isManager, reload])

  if (!user) return null
  if (!isManager) return <AdminGate breadcrumb="Settings · Reference data" />

  const q = query.trim().toLowerCase()
  const shownCountries = q
    ? countries.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q))
    : countries

  return (
    <AdminScreen
      title="Reference data"
      description="The vocabulary alerts are classified with. Categories and industries are yours to edit."
    >
      <div
        className="scroll-y"
        style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, paddingRight: 4 }}
      >
        <div
          style={{
            borderRadius: 12,
            border: '1px solid var(--border-soft)',
            background: 'rgba(255,255,255,.035)',
            padding: '12px 16px',
            font: '400 11.5px/1.6 var(--font-body)',
            color: 'var(--t-55)',
          }}
        >
          <strong style={{ color: 'var(--t-75)' }}>Categories and industries are editable here</strong> — a change takes
          effect on the create-alert form immediately. Renaming one also updates every alert already filed under it and
          every notification subscription filtering on it, so nobody silently stops receiving alerts; deleting is
          refused while anything still references it.
          <br />
          Severities, transport modes, flows, roles and profiles stay fixed: those drive behaviour (map colour,
          notification thresholds, search vocabulary), not just labels. Countries are generated from Natural Earth by{' '}
          <code style={{ color: 'var(--t-75)' }}>ops/build_geo.py</code>, and locations live under{' '}
          <strong style={{ color: 'var(--t-75)' }}>Settings → Locations</strong>.
        </div>

        {/* categories — editable */}
        <Panel
          title="Alert categories"
          count={categories.length}
          action={
            <button style={smallBtn} onClick={() => setEditing('new')}>
              ＋ Add category
            </button>
          }
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {categories.map((c) => (
              <div
                key={c.name}
                onClick={() => setEditing(c)}
                style={{
                  borderRadius: 12,
                  border: '1px solid var(--border-soft)',
                  background: 'rgba(255,255,255,.035)',
                  padding: 14,
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                  <span style={{ font: '600 12px var(--font-display)', color: 'var(--agl-yellow)' }}>{c.name}</span>
                  <span style={{ flex: 1 }} />
                  <UsageNote alerts={c.usage} subscriptions={c.subscriptions} />
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {c.sub_categories.map((s) => (
                    <span
                      key={s}
                      style={{
                        padding: '3px 9px',
                        borderRadius: 12,
                        background: 'rgba(255,255,255,.05)',
                        border: '1px solid var(--border-soft)',
                        font: '400 11px var(--font-body)',
                        color: 'var(--t-70)',
                      }}
                    >
                      {s}
                    </span>
                  ))}
                  {c.sub_categories.length === 0 && (
                    <span style={{ font: '400 11px var(--font-body)', color: 'var(--t-40)' }}>No sub-categories</span>
                  )}
                </div>
              </div>
            ))}
            {categories.length === 0 && (
              <span style={{ font: '400 11.5px var(--font-body)', color: 'var(--t-40)' }}>
                No categories — no alert can be classified until one exists.
              </span>
            )}
          </div>
        </Panel>

        {/* industries — editable */}
        <Industries rows={industries} reload={reload} />

        {/* countries — generated, read-only */}
        <Panel title="Countries" count={countries.length}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: -6 }}>
            <span style={{ font: '400 11px var(--font-body)', color: 'var(--t-45)' }}>
              showing {shownCountries.length}
            </span>
            <span style={{ flex: 1 }} />
            <input
              placeholder="Filter countries…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ ...inputStyle, height: 32, width: 200, fontSize: 12 }}
            />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {shownCountries.map((c) => (
              <Tag key={c.code}>
                <CountryFlag code={c.code} size={14} title={c.name} />
                {c.name}
                <span style={{ color: 'var(--t-45)', font: '500 10.5px var(--font-display)' }}>{c.code}</span>
              </Tag>
            ))}
            {shownCountries.length === 0 && (
              <span style={{ font: '400 11.5px var(--font-body)', color: 'var(--t-40)' }}>No countries match.</span>
            )}
          </div>
        </Panel>

        {taxonomy && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            <Panel title="Severities" count={taxonomy.severities.length}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {taxonomy.severities.map((s) => (
                  <Tag key={s} color={SEVERITY_COLOR[s]}>
                    <span
                      style={{ width: 8, height: 8, borderRadius: '50%', background: SEVERITY_COLOR[s], flex: 'none' }}
                    />
                    {SEVERITY_LABEL[s]}
                  </Tag>
                ))}
              </div>
            </Panel>

            <Panel title="Transport modes" count={taxonomy.modes.length}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {taxonomy.modes.map((m) => (
                  <Tag key={m}>{m}</Tag>
                ))}
              </div>
            </Panel>

            <Panel title="Flows" count={taxonomy.flows.length}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {taxonomy.flows.map((f) => (
                  <Tag key={f}>{f}</Tag>
                ))}
              </div>
            </Panel>

            <Panel title="Roles" count={taxonomy.roles.length}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {taxonomy.roles.map((r) => (
                  <Tag key={r}>{r}</Tag>
                ))}
              </div>
            </Panel>

            <Panel title="Standard profiles" count={taxonomy.profiles.length}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {taxonomy.profiles.map((p) => (
                  <Tag key={p}>{p}</Tag>
                ))}
              </div>
            </Panel>
          </div>
        )}
      </div>

      {editing && <CategoryEditor row={editing} onClose={() => setEditing(null)} onSaved={reload} />}
    </AdminScreen>
  )
}
