import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { TopBar } from '../components/TopBar'
import { LeftRail } from '../components/LeftRail'
import { MapBackdrop } from '../components/MapBackdrop'
import { Avatar } from '../components/Avatar'
import { CountryFlag } from '../components/CountryFlag'
import { SubscriptionEditor } from '../components/SubscriptionEditor'
import { Button, SectionLabel } from '../components/ui'
import { api } from '../api'
import { fmtAgo } from '../lib/format'
import type { CountryRef } from '../types'

function Card({
  children,
  style,
  className,
}: {
  children: React.ReactNode
  style?: React.CSSProperties
  className?: string
}) {
  return (
    <div
      className={className}
      style={{
        borderRadius: 18,
        background: 'var(--glass-90)',
        border: '1px solid var(--border-mid)',
        backdropFilter: 'blur(18px)',
        padding: 24,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

const rightsDot = (color: string) => (
  <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flex: 'none' }} />
)

export default function Profile() {
  const { user, refresh, logout } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [countries, setCountries] = useState<CountryRef[]>([])
  const [profiles, setProfiles] = useState<string[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const subsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void api.countries().then(setCountries).catch(() => setCountries([]))
    void api.taxonomy().then((t) => {
      setProfiles(t.profiles)
      setCategories(Object.keys(t.categories))
    }).catch(() => {})
  }, [])

  // Settings → "My notifications" deep-links straight to the subscriptions card.
  useEffect(() => {
    if (params.get('section') === 'notifications') {
      subsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [params])

  if (!user) return null

  async function handleSignOut() {
    await logout()
    navigate('/login', { replace: true })
  }

  const r = user.rights
  const rightsCards = [
    {
      dot: 'var(--sev-watch)',
      title: 'Creation',
      body: r.can_create ? '✓ May create and save draft alerts' : '— Not permitted',
    },
    {
      dot: 'var(--sev-warning)',
      title: 'Internal publication',
      body:
        r.internal_countries.length > 0
          ? `${r.internal_countries.join(', ')} — other locations route to approval`
          : '— None (all locations route to approval)',
    },
    {
      dot: 'var(--sev-info)',
      title: 'External publication',
      body: r.external_countries.length > 0 ? r.external_countries.join(', ') : '— None',
    },
    {
      dot: 'var(--sev-info)',
      title: 'Client scope',
      body: r.client_scope.length > 0 ? r.client_scope.join(', ') : '— None',
    },
  ]

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: 'var(--bg-deep)' }}>
      <MapBackdrop opacity={0.45} blur={2} overlay="rgba(8,14,26,.5)" />
      <TopBar breadcrumb="My profile" />
      <LeftRail />

      <div
        style={{
          position: 'absolute',
          left: 100,
          right: 24,
          top: 92,
          bottom: 24,
          display: 'grid',
          gridTemplateColumns: '360px 1fr',
          gap: 16,
        }}
      >
        {/* identity column */}
        <div className="scroll-y" style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingRight: 4 }}>
          <Card style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Avatar initials={user.initials} size={76} ring />
            <div style={{ font: '600 18px var(--font-display)', color: '#fff', marginTop: 10 }}>{user.name}</div>
            <div style={{ font: '400 12.5px var(--font-body)', color: 'var(--t-55)' }}>
              {user.job_title} · {user.branch}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              <span style={{ padding: '4px 10px', borderRadius: 14, background: 'var(--yellow-tint)', border: '1px solid var(--yellow-border)', font: '500 10.5px var(--font-body)', color: 'var(--agl-yellow)' }}>
                {user.role_label}
              </span>
              <span style={{ padding: '4px 10px', borderRadius: 14, border: '1px solid rgba(255,255,255,.15)', font: '500 10.5px var(--font-body)', color: 'var(--t-60)' }}>
                {user.home_country_name}
              </span>
            </div>
            <div style={{ width: '100%', height: 1, background: 'rgba(255,255,255,.08)', margin: '16px 0 12px' }} />
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 9, font: '400 12px var(--font-body)', color: 'var(--t-70, rgba(255,255,255,.7))' }}>
              {[
                ['Email', user.email],
                ['Phone', user.phone || '—'],
                ['Locale', `${user.locale.toUpperCase()} — ${user.timezone}`],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--t-40)' }}>{k}</span>
                  <span>{v}</span>
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              onClick={handleSignOut}
              style={{ width: '100%', marginTop: 18 }}
            >
              Sign out
            </Button>
          </Card>

          <Card style={{ padding: '20px 24px' }}>
            <SectionLabel style={{ marginBottom: 14 }}>Activity</SectionLabel>
            <div style={{ display: 'flex', gap: 24 }}>
              <div>
                <div style={{ font: "700 24px var(--font-display)", color: '#fff' }}>{user.stats.created}</div>
                <div style={{ font: '400 11px var(--font-body)', color: 'var(--t-50)' }}>Alerts created</div>
              </div>
              <div>
                <div style={{ font: "700 24px var(--font-display)", color: '#fff' }}>{user.stats.published}</div>
                <div style={{ font: '400 11px var(--font-body)', color: 'var(--t-50)' }}>Published</div>
              </div>
              <div>
                <div style={{ font: '600 13px var(--font-display)', color: '#fff', marginTop: 8 }}>
                  {user.stats.last_alert ? fmtAgo(user.stats.last_alert) : '—'}
                </div>
                <div style={{ font: '400 11px var(--font-body)', color: 'var(--t-50)' }}>Last alert</div>
              </div>
            </div>
          </Card>

          <div ref={subsRef} style={{ scrollMarginTop: 12 }}>
          <Card style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <SectionLabel>Email subscriptions</SectionLabel>
              <div style={{ font: '400 11px/1.5 var(--font-body)', color: 'var(--t-45)', marginTop: 4 }}>
                Choose what emails you — by trigger, and for network alerts by zone, type and criticality.
              </div>
            </div>
            {user.email_opt_out && (
              <div
                style={{
                  borderRadius: 12,
                  border: '1px solid var(--yellow-border-strong)',
                  background: 'var(--yellow-tint)',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ font: '600 12.5px var(--font-body)', color: 'var(--agl-yellow)' }}>
                    All email is paused
                  </div>
                  <div style={{ font: '400 11px/1.5 var(--font-body)', color: 'var(--t-60)' }}>
                    You stopped every SWAN notification from an email link. The subscriptions below
                    stay as they are and resume the moment you turn this back on.
                  </div>
                </div>
                <Button
                  variant="primary"
                  onClick={() => void api.setEmailOptOut(false).then(refresh)}
                >
                  Resume email
                </Button>
              </div>
            )}
            <SubscriptionEditor
              subscriptions={user.subscriptions}
              countries={countries}
              profiles={profiles}
              categories={categories}
              handlers={{
                create: (body) => api.createSubscription(body),
                update: (id, body) => api.updateSubscription(id, body),
                remove: (id) => api.deleteSubscription(id),
              }}
              onChanged={refresh}
            />
          </Card>
          </div>
        </div>

        {/* rights column */}
        <Card className="scroll-y" style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ font: '600 15px var(--font-display)', color: '#fff' }}>My rights</div>
            {r.is_rights_manager ? (
              <Button variant="outline" onClick={() => navigate('/admin/users')} style={{ height: 34, padding: '0 14px', font: '600 12px var(--font-display)' }}>
                Manage users &amp; rights →
              </Button>
            ) : (
              <span style={{ padding: '5px 12px', borderRadius: 8, background: 'rgba(255,255,255,.06)', border: '1px solid var(--border-mid)', font: '400 11px var(--font-body)', color: 'var(--t-55)' }}>
                Read-only — contact a Rights Manager to change
              </span>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {rightsCards.map((c) => (
              <div key={c.title} style={{ borderRadius: 14, background: 'rgba(255,255,255,.04)', border: '1px solid var(--border-soft)', padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  {rightsDot(c.dot)}
                  <span style={{ font: '600 12px var(--font-display)', color: '#fff' }}>{c.title}</span>
                </div>
                <div style={{ font: '400 12px/1.5 var(--font-body)', color: 'var(--t-65)' }}>{c.body}</div>
              </div>
            ))}
          </div>

          <div>
            <SectionLabel style={{ marginBottom: 10 }}>Internal publication perimeter</SectionLabel>
            <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border-soft)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', padding: '10px 16px', background: 'rgba(255,255,255,.05)', font: '600 10px var(--font-display)', color: 'var(--t-45)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                <span>Location</span>
                <span>Source</span>
                <span>Internal</span>
                <span>External</span>
              </div>
              {user.perimeter.map((row) => (
                <div key={row.country} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,.07)', font: '400 12.5px var(--font-body)', color: 'var(--t-80)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                    <CountryFlag code={row.country} size={15} />
                    {row.country_name}
                  </span>
                  <span style={{ color: 'var(--t-50)' }}>{row.source}</span>
                  <span style={{ color: row.internal ? 'var(--agl-yellow)' : 'var(--t-50)' }}>
                    {row.internal ? '✓ Publish' : 'Submit for approval'}
                  </span>
                  <span style={{ color: row.external ? 'var(--agl-yellow)' : 'var(--t-35)' }}>
                    {row.external ? '✓ Publish' : '—'}
                  </span>
                </div>
              ))}
              {user.perimeter.length === 0 && (
                <div style={{ padding: '14px 16px', borderTop: '1px solid rgba(255,255,255,.07)', font: '400 12px/1.6 var(--font-body)', color: 'var(--t-50)' }}>
                  No publication rights granted — every location you create routes to approval.
                </div>
              )}
            </div>
            <div style={{ font: '400 11px/1.5 var(--font-body)', color: 'var(--t-45)', marginTop: 8 }}>
              Only granted countries are listed. Anything not shown here routes to approval.
            </div>
          </div>

          <div style={{ marginTop: 'auto', borderRadius: 12, border: '1px solid var(--yellow-border)', background: 'var(--yellow-tint-soft)', padding: '12px 14px', font: '400 11.5px/1.5 var(--font-body)', color: 'var(--t-70, rgba(255,255,255,.7))' }}>
            Every rights change is audited — actor, before/after diff and timestamp are recorded.
          </div>
        </Card>
      </div>
    </div>
  )
}
