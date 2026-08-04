import { useEffect, useState } from 'react'
import { api, ApiError } from '../api'
import { Avatar } from './Avatar'
import { Button, ModalBackdrop, ModalCard, SectionLabel } from './ui'
import { SubscriptionEditor } from './SubscriptionEditor'
import {
  Chip,
  CountryPicker,
  Field,
  FormError,
  PendingBadge,
  ToggleRow,
  inputStyle,
} from './adminUi'
import type { AdminUserRow, CountryRef, ProfileRow, Subscription } from '../types'

// The user identity + rights + subscriptions editor, opened from Settings →
// Users. Lives in components/ (not the screen) because the screen is now just
// the list; the editor is the substantial half.
//
// It is a centred modal rather than the settings Drawer, and it is stepped.
// Both for the same reason: as one 560px slide-over this was a ~1200px scroll
// (10 identity fields, a password field, 4 rights toggles/pickers, then the
// subscription list), so the Create button sat below the fold of a column that
// itself contained three inner scrollers — the exact failure mode that moved
// CustomPlaceForm out of its anchored dropdown. ModalCard gives a fixed-height
// card whose body scrolls internally, so the footer actions never move.

export type UserForm = {
  email: string
  name: string
  initials: string
  job_title: string
  branch: string
  role_label: string
  home_country: string
  phone: string
  locale: string
  timezone: string
  avatar_gold: boolean
  can_create: boolean
  is_rights_manager: boolean
  internal_pub_countries: string[]
  external_pub_countries: string[]
  client_scope: string[]
  profiles: string[]
  password: string
  status: string
}

export function emptyUser(): UserForm {
  return {
    email: '',
    name: '',
    initials: '',
    job_title: '',
    branch: '',
    role_label: 'Field Contributor',
    home_country: '',
    phone: '',
    locale: 'en',
    timezone: 'UTC',
    avatar_gold: false,
    can_create: true,
    is_rights_manager: false,
    internal_pub_countries: [],
    external_pub_countries: [],
    client_scope: [],
    profiles: [],
    password: '',
    status: 'active',
  }
}

export function rowToForm(u: AdminUserRow): UserForm {
  return {
    email: u.email,
    name: u.name,
    initials: u.initials,
    job_title: u.job_title,
    branch: u.branch,
    role_label: u.role_label,
    home_country: u.home_country,
    phone: u.phone,
    locale: u.locale,
    timezone: u.timezone,
    avatar_gold: u.avatar_gold,
    can_create: u.can_create,
    is_rights_manager: u.is_rights_manager,
    internal_pub_countries: [...u.internal_pub_countries],
    external_pub_countries: [...u.external_pub_countries],
    client_scope: [...u.client_scope],
    profiles: [...u.profiles],
    password: '',
    status: u.status,
  }
}

type StepId = 'identity' | 'rights' | 'notifications'

// One tab per step. Clicking a completed/visited step jumps straight to it when
// editing; on a new user the steps run in order because step 2 can't be saved
// without step 1's required fields.
function StepTabs({
  steps,
  current,
  onPick,
}: {
  steps: { id: StepId; label: string }[]
  current: StepId
  onPick: (id: StepId) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {steps.map((s, i) => {
        const on = s.id === current
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onPick(s.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '7px 13px',
              borderRadius: 9,
              cursor: 'pointer',
              font: `600 11.5px var(--font-display)`,
              color: on ? 'var(--agl-yellow)' : 'var(--t-55)',
              background: on ? 'var(--yellow-tint)' : 'transparent',
              border: `1px solid ${on ? 'var(--yellow-border-strong)' : 'transparent'}`,
            }}
          >
            <span
              style={{
                width: 17,
                height: 17,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                font: '700 9.5px var(--font-display)',
                color: on ? 'var(--agl-navy)' : 'var(--t-55)',
                background: on ? 'var(--agl-yellow)' : 'rgba(255,255,255,.1)',
                flex: 'none',
              }}
            >
              {i + 1}
            </span>
            {s.label}
          </button>
        )
      })}
    </div>
  )
}

export function UserEditor({
  initial,
  isNew,
  countries,
  profiles,
  roles,
  categories,
  editingSelf,
  hasPassword,
  userId,
  onClose,
  onSaved,
  onDeleted,
}: {
  initial: UserForm
  isNew: boolean
  countries: CountryRef[]
  profiles: ProfileRow[]
  roles: string[]
  categories: string[]
  editingSelf: boolean
  hasPassword: boolean
  userId?: string
  onClose: () => void
  onSaved: (payload: UserForm, id?: string) => Promise<void>
  onDeleted?: () => Promise<void>
}) {
  const [form, setForm] = useState<UserForm>(initial)
  const [step, setStep] = useState<StepId>('identity')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [subs, setSubs] = useState<Subscription[]>([])

  useEffect(() => {
    if (userId) void api.adminUserSubscriptions(userId).then(setSubs).catch(() => setSubs([]))
  }, [userId])
  async function reloadSubs() {
    if (userId) setSubs(await api.adminUserSubscriptions(userId))
  }

  // Escape closes, matching every other overlay in the app.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function set<K extends keyof UserForm>(key: K, value: UserForm[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }
  function toggleIn(list: keyof UserForm, code: string) {
    const cur = form[list] as string[]
    set(list, (cur.includes(code) ? cur.filter((x) => x !== code) : [...cur, code]) as never)
  }

  // Subscriptions need a saved user to hang off, so that step only exists on edit.
  const steps: { id: StepId; label: string }[] = [
    { id: 'identity', label: 'Identity' },
    { id: 'rights', label: 'Rights' },
    ...(userId ? [{ id: 'notifications' as StepId, label: 'Notifications' }] : []),
  ]

  function identityError(): string | null {
    if (!form.name.trim() || !form.email.trim()) return 'Name and email are required.'
    return null
  }

  // Guard the step change rather than the save: on a new user, failing required
  // fields at the Create button means backtracking through the whole form.
  function goto(next: StepId) {
    if (isNew && step === 'identity' && next !== 'identity') {
      const bad = identityError()
      if (bad) {
        setError(bad)
        return
      }
    }
    setError(null)
    setStep(next)
  }

  async function save() {
    const bad = identityError()
    if (bad) {
      setError(bad)
      setStep('identity')
      return
    }
    setError(null)
    setBusy(true)
    try {
      await onSaved(form)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save.')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!onDeleted) return
    setError(null)
    setBusy(true)
    try {
      await onDeleted()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not delete.')
      setBusy(false)
    }
  }

  async function validateNow() {
    setError(null)
    setBusy(true)
    try {
      await onSaved({ ...form, status: 'active' })
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not validate.')
      setBusy(false)
    }
  }

  const isPending = !isNew && form.status === 'pending'
  const stepIndex = steps.findIndex((s) => s.id === step)
  const isLastStep = stepIndex === steps.length - 1

  return (
    <ModalBackdrop onClose={onClose}>
      {/* A fixed height, not just a max: without it the card resizes on every
          step change and the footer buttons walk up and down the screen. */}
      <ModalCard width={720} style={{ padding: 0, height: 'min(680px, calc(100vh - 40px))' }}>
        {/* ---- Header (fixed) ---- */}
        <div
          style={{
            padding: '20px 24px 0',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            flex: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar
              initials={(form.initials || form.name.slice(0, 2) || '?').toUpperCase()}
              gold={form.avatar_gold}
              size={40}
            />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ font: '600 16px var(--font-display)', color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                {isNew ? 'New user' : form.name}
                {isPending && <PendingBadge />}
              </div>
              <div style={{ font: '400 11.5px var(--font-body)', color: 'var(--t-45)' }}>
                {isNew ? 'Create an identity and grant its rights' : 'Edit identity & rights'}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{
                width: 30,
                height: 30,
                borderRadius: 9,
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
                background: 'rgba(255,255,255,.05)',
                border: '1px solid var(--border-soft)',
                color: 'var(--t-60)',
                font: '400 14px sans-serif',
                flex: 'none',
              }}
            >
              ✕
            </button>
          </div>
          <StepTabs steps={steps} current={step} onPick={goto} />
          <div style={{ height: 1, background: 'rgba(255,255,255,.08)' }} />
        </div>

        {/* ---- Body (the only scroller) ---- */}
        <div
          className="scroll-y"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: '18px 24px 22px',
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}
        >
          {isPending && (
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
                  Awaiting validation
                </div>
                <div style={{ font: '400 11px/1.5 var(--font-body)', color: 'var(--t-60)' }}>
                  This account self-registered with no rights. Configure the rights below, then validate — or activate now and grant rights later.
                </div>
              </div>
              <Button variant="primary" disabled={busy} onClick={validateNow}>
                Validate &amp; activate
              </Button>
            </div>
          )}

          {step === 'identity' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Full name">
                  <input style={inputStyle} value={form.name} onChange={(e) => set('name', e.target.value)} />
                </Field>
                <Field label="Email">
                  <input style={inputStyle} value={form.email} onChange={(e) => set('email', e.target.value)} />
                </Field>
                <Field label="Job title">
                  <input style={inputStyle} value={form.job_title} onChange={(e) => set('job_title', e.target.value)} />
                </Field>
                <Field label="Branch">
                  <input style={inputStyle} value={form.branch} onChange={(e) => set('branch', e.target.value)} />
                </Field>
                <Field label="Role">
                  <select
                    style={{ ...inputStyle, appearance: 'none' }}
                    value={roles.includes(form.role_label) ? form.role_label : ''}
                    onChange={(e) => set('role_label', e.target.value)}
                  >
                    <option value="" disabled>
                      — Select a role —
                    </option>
                    {roles.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Home country">
                  <select
                    style={{ ...inputStyle, appearance: 'none' }}
                    value={form.home_country}
                    onChange={(e) => set('home_country', e.target.value)}
                  >
                    <option value="">— none —</option>
                    {countries.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Phone">
                  <input style={inputStyle} value={form.phone} onChange={(e) => set('phone', e.target.value)} />
                </Field>
                <Field label="Initials (optional)">
                  <input
                    style={inputStyle}
                    maxLength={3}
                    placeholder="auto"
                    value={form.initials}
                    onChange={(e) => set('initials', e.target.value.toUpperCase())}
                  />
                </Field>
                <Field label="Locale">
                  <input style={inputStyle} value={form.locale} onChange={(e) => set('locale', e.target.value)} />
                </Field>
                <Field label="Timezone">
                  <input style={inputStyle} value={form.timezone} onChange={(e) => set('timezone', e.target.value)} />
                </Field>
              </div>

              <ToggleRow
                label="Gold avatar"
                hint="Highlight this identity with the AGL-yellow avatar"
                on={form.avatar_gold}
                onToggle={() => set('avatar_gold', !form.avatar_gold)}
              />

              <Field
                label={
                  isNew
                    ? 'Password (optional — email is the username)'
                    : hasPassword
                      ? 'Reset password (leave blank to keep current)'
                      : 'Set password (none yet)'
                }
              >
                <input
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => set('password', e.target.value)}
                  placeholder={hasPassword ? '••••••••' : 'min 6 characters'}
                  style={inputStyle}
                />
              </Field>
            </>
          )}

          {step === 'rights' && (
            <>
              <ToggleRow
                label="Creation"
                hint="May create and save draft alerts"
                on={form.can_create}
                onToggle={() => set('can_create', !form.can_create)}
              />
              <ToggleRow
                label="Rights Manager"
                hint={editingSelf ? 'You cannot revoke your own manager access' : 'May administer users, profiles and rights'}
                on={form.is_rights_manager}
                onToggle={() => !editingSelf && set('is_rights_manager', !form.is_rights_manager)}
              />

              <div>
                <div style={{ font: '500 11.5px var(--font-body)', color: 'var(--t-70)', marginBottom: 8 }}>
                  Profiles <span style={{ color: 'var(--t-40)' }}>— grant internal reach in bulk</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                  {profiles.length === 0 && (
                    <span style={{ font: '400 11.5px var(--font-body)', color: 'var(--t-40)' }}>No profiles defined.</span>
                  )}
                  {profiles.map((p) => (
                    <Chip
                      key={p.name}
                      label={p.name}
                      on={form.profiles.includes(p.name)}
                      onClick={() => toggleIn('profiles', p.name)}
                    />
                  ))}
                </div>
                <GrantedByProfiles form={form} profiles={profiles} />
              </div>

              <div>
                <div style={{ font: '500 11.5px var(--font-body)', color: 'var(--t-70)', marginBottom: 8 }}>
                  Internal publication <span style={{ color: 'var(--t-40)' }}>— publish directly here (else route to approval)</span>
                </div>
                <CountryPicker countries={countries} selected={form.internal_pub_countries} onToggle={(c) => toggleIn('internal_pub_countries', c)} />
              </div>

              <div>
                <div style={{ font: '500 11.5px var(--font-body)', color: 'var(--t-70)', marginBottom: 8 }}>
                  External publication
                </div>
                <CountryPicker countries={countries} selected={form.external_pub_countries} onToggle={(c) => toggleIn('external_pub_countries', c)} />
              </div>

              <div>
                <div style={{ font: '500 11.5px var(--font-body)', color: 'var(--t-70)', marginBottom: 8 }}>
                  Client scope
                </div>
                <CountryPicker countries={countries} selected={form.client_scope} onToggle={(c) => toggleIn('client_scope', c)} />
              </div>
            </>
          )}

          {step === 'notifications' && userId && (
            <div>
              <SectionLabel>Email subscriptions</SectionLabel>
              <div style={{ font: '400 11px var(--font-body)', color: 'var(--t-45)', margin: '4px 0 12px' }}>
                What this user is emailed about — by event, zone, type and criticality.
              </div>
              <SubscriptionEditor
                subscriptions={subs}
                countries={countries}
                profiles={profiles.map((p) => p.name)}
                categories={categories}
                handlers={{
                  create: (b) => api.adminCreateUserSubscription(userId, b),
                  update: (id, b) => api.adminUpdateUserSubscription(userId, id, b),
                  remove: (id) => api.adminDeleteUserSubscription(userId, id),
                }}
                onChanged={reloadSubs}
              />
            </div>
          )}
        </div>

        {/* ---- Footer (fixed) ---- */}
        <div
          style={{
            flex: 'none',
            borderTop: '1px solid rgba(255,255,255,.08)',
            padding: '14px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {error && <FormError>{error}</FormError>}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {!isNew && onDeleted && (
              <Button variant="danger" disabled={busy} onClick={remove}>
                Delete
              </Button>
            )}
            <div style={{ flex: 1 }} />
            {stepIndex > 0 && (
              <Button variant="ghost" onClick={() => goto(steps[stepIndex - 1].id)}>
                ← Back
              </Button>
            )}
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            {/* A new user must reach the last step before it can be created; an
                existing one can be saved from wherever the manager is standing. */}
            {isNew && !isLastStep ? (
              <Button variant="primary" onClick={() => goto(steps[stepIndex + 1].id)}>
                Next →
              </Button>
            ) : (
              <Button variant="primary" disabled={busy} onClick={save}>
                {isNew ? 'Create user' : 'Save changes'}
              </Button>
            )}
          </div>
        </div>
      </ModalCard>
    </ModalBackdrop>
  )
}

// Makes profile-granted reach visible at the point of granting it. Ticking
// SOUTHERN-AFRICA silently adds MZ and ZM to a user's effective perimeter; the
// picker below shows only the explicit list, so without this the extra reach
// first appears on the Users list as countries nobody chose.
function GrantedByProfiles({ form, profiles }: { form: UserForm; profiles: ProfileRow[] }) {
  const held = profiles.filter((p) => form.profiles.includes(p.name))
  const granted = [...new Set(held.flatMap((p) => p.countries))].sort()
  const extra = granted.filter((c) => !form.internal_pub_countries.includes(c))
  if (granted.length === 0) return null
  return (
    <div
      style={{
        marginTop: 9,
        borderRadius: 10,
        border: '1px solid var(--border-soft)',
        background: 'rgba(255,255,255,.04)',
        padding: '9px 11px',
        font: '400 11px/1.55 var(--font-body)',
        color: 'var(--t-55)',
      }}
    >
      These profiles also grant internal publication in{' '}
      <b style={{ color: 'var(--t-80)' }}>{granted.join(', ')}</b>
      {extra.length > 0 && (
        <>
          {' '}— including <b style={{ color: 'var(--agl-yellow)' }}>{extra.join(', ')}</b>, which
          are not ticked below.
        </>
      )}
      .
    </div>
  )
}
