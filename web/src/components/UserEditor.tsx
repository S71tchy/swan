import { useEffect, useState } from 'react'
import { api, ApiError } from '../api'
import { Avatar } from './Avatar'
import { Button, SectionLabel } from './ui'
import { SubscriptionEditor } from './SubscriptionEditor'
import {
  Chip,
  CountryPicker,
  Drawer,
  Field,
  FormError,
  PendingBadge,
  ToggleRow,
  inputStyle,
} from './adminUi'
import type { AdminUserRow, CountryRef, ProfileRow, Subscription } from '../types'

// The user identity + rights + subscriptions drawer, opened from Settings →
// Users. Lives in components/ (not the screen) because the screen is now just
// the list; the drawer is the substantial half.

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
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [subs, setSubs] = useState<Subscription[]>([])

  useEffect(() => {
    if (userId) void api.adminUserSubscriptions(userId).then(setSubs).catch(() => setSubs([]))
  }, [userId])
  async function reloadSubs() {
    if (userId) setSubs(await api.adminUserSubscriptions(userId))
  }

  function set<K extends keyof UserForm>(key: K, value: UserForm[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }
  function toggleIn(list: keyof UserForm, code: string) {
    const cur = form[list] as string[]
    set(list, (cur.includes(code) ? cur.filter((x) => x !== code) : [...cur, code]) as never)
  }

  async function save() {
    setError(null)
    if (!form.email.trim() || !form.name.trim()) {
      setError('Name and email are required.')
      return
    }
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

  return (
    <Drawer onClose={onClose}>
      <div style={{ padding: '26px 26px 30px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar initials={(form.initials || form.name.slice(0, 2) || '?').toUpperCase()} gold={form.avatar_gold} size={44} />
          <div>
            <div style={{ font: '600 17px var(--font-display)', color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
              {isNew ? 'New user' : form.name}
              {isPending && <PendingBadge />}
            </div>
            <div style={{ font: '400 11.5px var(--font-body)', color: 'var(--t-45)' }}>
              {isNew ? 'Create an identity and grant its rights' : 'Edit identity & rights'}
            </div>
          </div>
        </div>

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

        <SectionLabel>Identity</SectionLabel>
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

        <Field label={isNew ? 'Password (optional — email is the username)' : hasPassword ? 'Reset password (leave blank to keep current)' : 'Set password (none yet)'}>
          <input
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => set('password', e.target.value)}
            placeholder={hasPassword ? '••••••••' : 'min 6 characters'}
            style={inputStyle}
          />
        </Field>

        <div style={{ height: 1, background: 'rgba(255,255,255,.08)' }} />

        <SectionLabel>Rights</SectionLabel>
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

        {userId && (
          <>
            <div style={{ height: 1, background: 'rgba(255,255,255,.08)' }} />
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
          </>
        )}

        {error && <FormError>{error}</FormError>}

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 4 }}>
          <Button variant="primary" disabled={busy} onClick={save}>
            {isNew ? 'Create user' : 'Save changes'}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          {!isNew && onDeleted && (
            <Button variant="danger" disabled={busy} onClick={remove} style={{ marginLeft: 'auto' }}>
              Delete
            </Button>
          )}
        </div>
      </div>
    </Drawer>
  )
}
