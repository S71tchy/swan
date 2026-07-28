import { useEffect, useState, type ReactNode } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'
import { CountryFlag } from '../components/CountryFlag'
import { AdminGate, AdminScreen } from '../components/adminUi'
import { SEVERITY_COLOR, SEVERITY_LABEL } from '../lib/format'
import type { CountryRef, Taxonomy } from '../types'

// --------------------------------------------------------------------------- //
// Settings → Reference data
//
// The taxonomy the whole product is keyed on. It lives in code today
// (server/app/enums.py + reference.py), not in a table, so this view is
// deliberately read-only — it exists so a Rights Manager can see the exact
// vocabulary without reading Python. When Phase 2 moves any of it into the
// Signal Store, this screen is where the editors land.
// --------------------------------------------------------------------------- //

function Panel({ title, count, children }: { title: string; count: number; children: ReactNode }) {
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
        <span style={{ flex: 1 }} />
        <span style={{ font: '400 11px var(--font-body)', color: 'var(--t-45)' }}>{count}</span>
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

export default function ReferenceData() {
  const { user } = useAuth()
  const [taxonomy, setTaxonomy] = useState<Taxonomy | null>(null)
  const [countries, setCountries] = useState<CountryRef[]>([])
  const [query, setQuery] = useState('')

  const isManager = user?.rights.is_rights_manager

  useEffect(() => {
    if (!isManager) return
    void api.taxonomy().then(setTaxonomy).catch(() => setTaxonomy(null))
    void api.adminCountries().then(setCountries).catch(() => setCountries([]))
  }, [isManager])

  if (!user) return null
  if (!isManager) return <AdminGate breadcrumb="Settings · Reference data" />

  const q = query.trim().toLowerCase()
  const shownCountries = q
    ? countries.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q))
    : countries

  return (
    <AdminScreen
      title="Reference data"
      description="The vocabulary alerts are classified with. Defined in code today — read-only here."
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
          These lists are constants in <code style={{ color: 'var(--t-75)' }}>server/app/enums.py</code> and{' '}
          <code style={{ color: 'var(--t-75)' }}>server/app/reference.py</code>, so a change is a deployment rather than
          an edit. Locations are the exception — they live in the database and are editable under{' '}
          <strong style={{ color: 'var(--t-75)' }}>Settings → Locations</strong>.
        </div>

        {/* countries */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ font: '600 13.5px var(--font-display)', color: '#fff' }}>Countries</span>
            <span style={{ font: '400 11px var(--font-body)', color: 'var(--t-45)' }}>
              {shownCountries.length} of {countries.length}
            </span>
            <span style={{ flex: 1 }} />
            <input
              placeholder="Filter countries…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{
                width: 200,
                height: 32,
                borderRadius: 9,
                background: 'rgba(255,255,255,.05)',
                border: '1px solid var(--border-strong)',
                padding: '0 11px',
                color: '#fff',
                font: '400 12px var(--font-body)',
                outline: 'none',
              }}
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
        </div>

        {taxonomy && (
          <>
            {/* categories — the only nested list */}
            <Panel title="Alert categories" count={Object.keys(taxonomy.categories).length}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
                {Object.entries(taxonomy.categories).map(([cat, subs]) => (
                  <div
                    key={cat}
                    style={{
                      borderRadius: 12,
                      border: '1px solid var(--border-soft)',
                      background: 'rgba(255,255,255,.035)',
                      padding: 14,
                    }}
                  >
                    <div style={{ font: '600 12px var(--font-display)', color: 'var(--agl-yellow)', marginBottom: 8 }}>
                      {cat}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {subs.map((s) => (
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
                      {subs.length === 0 && (
                        <span style={{ font: '400 11px var(--font-body)', color: 'var(--t-40)' }}>
                          No sub-categories
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

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

              <Panel title="Industries" count={taxonomy.industries.length}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                  {taxonomy.industries.map((i) => (
                    <Tag key={i}>{i}</Tag>
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
          </>
        )}
      </div>
    </AdminScreen>
  )
}
