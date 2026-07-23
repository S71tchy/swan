import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '../api'
import { useAuth } from '../auth'
import { TopBar } from '../components/TopBar'
import { LeftRail } from '../components/LeftRail'
import { MapBackdrop } from '../components/MapBackdrop'
import { Avatar } from '../components/Avatar'
import { Button, SectionLabel } from '../components/ui'
import { PlusIcon } from '../components/icons'
import { CountryFlag } from '../components/CountryFlag'
import { Drawer, Field, inputStyle, AdminGate } from '../components/adminUi'
import { SubscriptionEditor } from '../components/SubscriptionEditor'
import type { AdminUserRow, CountryRef, ProfileRow, Subscription } from '../types'

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        width: 40,
        height: 22,
        borderRadius: 11,
        background: on ? 'var(--agl-yellow)' : 'rgba(255,255,255,.15)',
        position: 'relative',
        cursor: 'pointer',
        transition: 'background .15s',
        flex: 'none',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: on ? 20 : 2,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: on ? 'var(--agl-navy)' : 'rgba(255,255,255,.6)',
          transition: 'left .15s',
        }}
      />
    </div>
  )
}

function ToggleRow({
  label,
  hint,
  on,
  onToggle,
}: {
  label: string
  hint: string
  on: boolean
  onToggle: () => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <div>
        <div style={{ font: '600 12.5px var(--font-body)', color: '#fff' }}>{label}</div>
        <div style={{ font: '400 11px var(--font-body)', color: 'var(--t-45)' }}>{hint}</div>
      </div>
      <Toggle on={on} onClick={onToggle} />
    </div>
  )
}

function Chip({
  label,
  on,
  onClick,
}: {
  label: React.ReactNode
  on: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '6px 11px',
        borderRadius: 18,
        cursor: 'pointer',
        font: '500 11.5px var(--font-body)',
        color: on ? 'var(--agl-yellow)' : 'var(--t-65)',
        background: on ? 'var(--yellow-tint)' : 'transparent',
        border: `1px solid ${on ? 'var(--yellow-border-strong)' : 'rgba(255,255,255,.16)'}`,
      }}
    >
      {label}
    </button>
  )
}

function PendingBadge() {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '2px 8px',
        borderRadius: 11,
        background: 'var(--yellow-tint)',
        border: '1px solid var(--yellow-border-strong)',
        font: '600 9.5px var(--font-display)',
        letterSpacing: '.5px',
        textTransform: 'uppercase',
        color: 'var(--agl-yellow)',
        flex: 'none',
      }}
    >
      <span className="glow-dot" style={{ width: 6, height: 6, background: 'var(--agl-yellow)' }} />
      Pending
    </span>
  )
}

function CountryPicker({
  countries,
  selected,
  onToggle,
}: {
  countries: CountryRef[]
  selected: string[]
  onToggle: (code: string) => void
}) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  // Selected always visible; the rest filtered by the search box (54 countries).
  const shown = countries.filter(
    (c) => selected.includes(c.code) || !q || c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q),
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <input
        placeholder={`Filter ${countries.length} countries…`}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ ...inputStyle, height: 34, fontSize: 12 }}
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, maxHeight: 168, overflowY: 'auto' }} className="scroll-y">
        {shown.map((c) => (
          <Chip
            key={c.code}
            label={
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <CountryFlag code={c.code} size={14} title={c.name} />
                {c.code}
              </span>
            }
            on={selected.includes(c.code)}
            onClick={() => onToggle(c.code)}
          />
        ))}
        {shown.length === 0 && (
          <span style={{ font: '400 11.5px var(--font-body)', color: 'var(--t-40)' }}>No matches.</span>
        )}
      </div>
    </div>
  )
}

// --------------------------------------------------------------------------- //
// User editor drawer
// --------------------------------------------------------------------------- //
type UserForm = {
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

function emptyUser(): UserForm {
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

function rowToForm(u: AdminUserRow): UserForm {
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

function UserEditor({
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

        {error && (
          <div
            style={{
              borderRadius: 10,
              border: '1px solid rgba(207,69,39,.5)',
              background: 'rgba(207,69,39,.12)',
              padding: '10px 12px',
              font: '400 12px var(--font-body)',
              color: 'var(--sev-critical-text)',
            }}
          >
            {error}
          </div>
        )}

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

// --------------------------------------------------------------------------- //
// Profile editor drawer
// --------------------------------------------------------------------------- //
function ProfileEditor({
  initial,
  isNew,
  countries,
  onClose,
  onSaved,
  onDeleted,
}: {
  initial: { name: string; countries: string[]; embeds_rights_manager: boolean }
  isNew: boolean
  countries: CountryRef[]
  onClose: () => void
  onSaved: (payload: { name: string; countries: string[]; embeds_rights_manager: boolean }) => Promise<void>
  onDeleted?: () => Promise<void>
}) {
  const [form, setForm] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleCountry(code: string) {
    setForm((f) => ({
      ...f,
      countries: f.countries.includes(code) ? f.countries.filter((x) => x !== code) : [...f.countries, code],
    }))
  }

  async function save() {
    setError(null)
    if (!form.name.trim()) {
      setError('Profile name is required.')
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

  return (
    <Drawer onClose={onClose}>
      <div style={{ padding: '26px 26px 30px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <div style={{ font: '600 17px var(--font-display)', color: '#fff' }}>
            {isNew ? 'New profile' : form.name}
          </div>
          <div style={{ font: '400 11.5px var(--font-body)', color: 'var(--t-45)' }}>
            A named bundle of country rights. Editing it propagates live to every holder.
          </div>
        </div>

        <Field label="Profile name">
          <input
            style={{ ...inputStyle, opacity: isNew ? 1 : 0.6, textTransform: 'uppercase' }}
            value={form.name}
            disabled={!isNew}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value.toUpperCase() }))}
          />
        </Field>

        <div>
          <div style={{ font: '500 11.5px var(--font-body)', color: 'var(--t-70)', marginBottom: 8 }}>
            Countries ({form.countries.length})
          </div>
          <CountryPicker countries={countries} selected={form.countries} onToggle={toggleCountry} />
        </div>

        <ToggleRow
          label="Embeds Rights Manager"
          hint="Holders of this profile gain administration access"
          on={form.embeds_rights_manager}
          onToggle={() => setForm((f) => ({ ...f, embeds_rights_manager: !f.embeds_rights_manager }))}
        />

        {error && (
          <div
            style={{
              borderRadius: 10,
              border: '1px solid rgba(207,69,39,.5)',
              background: 'rgba(207,69,39,.12)',
              padding: '10px 12px',
              font: '400 12px var(--font-body)',
              color: 'var(--sev-critical-text)',
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 4 }}>
          <Button variant="primary" disabled={busy} onClick={save}>
            {isNew ? 'Create profile' : 'Save changes'}
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

// --------------------------------------------------------------------------- //
// Screen
// --------------------------------------------------------------------------- //
type Tab = 'users' | 'profiles'
const TAB_LABEL: Record<Tab, string> = { users: 'Users', profiles: 'Profiles' }

export default function RightsAdmin() {
  const { user, refresh } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('users')
  const [onlyPending, setOnlyPending] = useState(false)
  const [countries, setCountries] = useState<CountryRef[]>([])
  const [roles, setRoles] = useState<string[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [profiles, setProfiles] = useState<ProfileRow[]>([])
  const [editUser, setEditUser] = useState<{ form: UserForm; id?: string; hasPassword?: boolean } | null>(null)
  const [editProfile, setEditProfile] = useState<{
    data: { name: string; countries: string[]; embeds_rights_manager: boolean }
    isNew: boolean
  } | null>(null)

  const isManager = user?.rights.is_rights_manager

  async function reload() {
    const [u, p] = await Promise.all([api.adminUsers(), api.adminProfiles()])
    setUsers(u)
    setProfiles(p)
  }

  useEffect(() => {
    if (!isManager) return
    void api.adminCountries().then(setCountries).catch(() => setCountries([]))
    void api.taxonomy().then((t) => {
      setRoles(t.roles)
      setCategories(Object.keys(t.categories))
    }).catch(() => setRoles([]))
    void reload()
  }, [isManager])

  if (!user) return null
  if (!isManager) return <AdminGate breadcrumb="Rights administration" />

  // --- user save/delete ---
  async function saveUser(payload: UserForm, id?: string) {
    if (id) await api.adminUpdateUser(id, payload)
    else await api.adminCreateUser(payload)
    setEditUser(null)
    await reload()
    if (id && id === user!.id) await refresh() // my own rights may have changed
  }
  async function deleteUser(id: string) {
    await api.adminDeleteUser(id)
    setEditUser(null)
    await reload()
  }
  // One-click activation from the list (no drawer). Rights stay zero until edited.
  async function validateUser(id: string) {
    await api.adminUpdateUser(id, { status: 'active' })
    await reload()
  }

  // --- profile save/delete ---
  async function saveProfile(
    payload: { name: string; countries: string[]; embeds_rights_manager: boolean },
    isNew: boolean,
  ) {
    if (isNew) await api.adminCreateProfile(payload)
    else await api.adminUpdateProfile(payload.name, {
      countries: payload.countries,
      embeds_rights_manager: payload.embeds_rights_manager,
    })
    setEditProfile(null)
    await reload()
    await refresh()
  }
  async function deleteProfile(name: string) {
    await api.adminDeleteProfile(name)
    setEditProfile(null)
    await reload()
    await refresh()
  }

  const pendingCount = users.filter((u) => u.status === 'pending').length
  const shownUsers = onlyPending ? users.filter((u) => u.status === 'pending') : users

  const reachLabel = (codes: string[]) =>
    codes.length === 0 ? (
      '—'
    ) : (
      <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 7, alignItems: 'center' }}>
        {codes.map((c) => (
          <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <CountryFlag code={c} size={13} />
            {c}
          </span>
        ))}
      </span>
    )

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: 'var(--bg-deep)' }}>
      <MapBackdrop opacity={0.45} blur={2} overlay="rgba(8,14,26,.5)" />
      <TopBar breadcrumb="Rights administration" showCreate={false} />
      <LeftRail />

      <div
        style={{
          position: 'absolute',
          left: 100,
          right: 24,
          top: 92,
          bottom: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div>
            <div style={{ font: '700 22px var(--font-display)', color: '#fff' }}>Rights administration</div>
            <div style={{ font: '400 12px var(--font-body)', color: 'var(--t-50)' }}>
              Create users, assign the four rights dimensions, and manage profiles. Every change is audited.
            </div>
          </div>
          <div style={{ flex: 1 }} />
          {tab === 'users' && (
            <button
              onClick={() => setOnlyPending((v) => !v)}
              title="Show only accounts awaiting validation"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 14px',
                borderRadius: 10,
                cursor: 'pointer',
                font: '600 12px var(--font-display)',
                color: onlyPending ? 'var(--agl-navy)' : pendingCount > 0 ? 'var(--agl-yellow)' : 'var(--t-60)',
                background: onlyPending ? 'var(--agl-yellow)' : pendingCount > 0 ? 'var(--yellow-tint)' : 'rgba(255,255,255,.05)',
                border: `1px solid ${onlyPending || pendingCount > 0 ? 'var(--yellow-border-strong)' : 'var(--border-soft)'}`,
              }}
            >
              {pendingCount > 0 && !onlyPending && (
                <span className="glow-dot" style={{ width: 7, height: 7, background: 'var(--agl-yellow)' }} />
              )}
              {onlyPending ? 'Show all' : `Pending${pendingCount > 0 ? ` · ${pendingCount}` : ''}`}
            </button>
          )}
          <button
            onClick={() => navigate('/admin/data')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              borderRadius: 10,
              border: '1px solid var(--border-soft)',
              background: 'rgba(255,255,255,.05)',
              color: 'var(--t-70)',
              font: '600 12px var(--font-display)',
            }}
          >
            Master data →
          </button>
          <button
            onClick={() => navigate('/admin/templates')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              borderRadius: 10,
              border: '1px solid var(--border-soft)',
              background: 'rgba(255,255,255,.05)',
              color: 'var(--t-70)',
              font: '600 12px var(--font-display)',
            }}
          >
            Templates →
          </button>
          <div
            style={{
              display: 'flex',
              gap: 4,
              padding: 4,
              borderRadius: 12,
              background: 'rgba(255,255,255,.05)',
              border: '1px solid var(--border-soft)',
            }}
          >
            {(['users', 'profiles'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 9,
                  border: 'none',
                  cursor: 'pointer',
                  font: '600 12.5px var(--font-display)',
                  background: tab === t ? 'var(--agl-yellow)' : 'transparent',
                  color: tab === t ? 'var(--agl-navy)' : 'var(--t-60)',
                }}
              >
                {TAB_LABEL[t]} · {t === 'users' ? users.length : profiles.length}
              </button>
            ))}
          </div>
          <Button
            variant="primary"
            onClick={() => {
              if (tab === 'users') setEditUser({ form: emptyUser() })
              else setEditProfile({ data: { name: '', countries: [], embeds_rights_manager: false }, isNew: true })
            }}
          >
            <PlusIcon size={13} stroke="var(--agl-navy)" />
            {tab === 'users' ? 'New user' : 'New profile'}
          </Button>
        </div>

        {/* body */}
        {tab === 'users' ? (
          <div
            className="scroll-y"
            style={{
              flex: 1,
              overflowY: 'auto',
              borderRadius: 18,
              background: 'var(--glass-90)',
              border: '1px solid var(--border-mid)',
              backdropFilter: 'blur(18px)',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '2.4fr 1.3fr .8fr 1.6fr 1.6fr .9fr',
                gap: 12,
                padding: '14px 22px',
                position: 'sticky',
                top: 0,
                background: 'rgba(15,27,46,.9)',
                backdropFilter: 'blur(10px)',
                borderBottom: '1px solid rgba(255,255,255,.08)',
                font: '600 10px var(--font-display)',
                color: 'var(--t-45)',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                zIndex: 1,
              }}
            >
              <span>User</span>
              <span>Role</span>
              <span>Create</span>
              <span>Internal reach</span>
              <span>External reach</span>
              <span>Manager</span>
            </div>
            {shownUsers.map((u) => {
              const pending = u.status === 'pending'
              return (
              <div
                key={u.id}
                onClick={() => setEditUser({ form: rowToForm(u), id: u.id, hasPassword: u.has_password })}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2.4fr 1.3fr .8fr 1.6fr 1.6fr .9fr',
                  gap: 12,
                  padding: '13px 22px',
                  borderBottom: '1px solid rgba(255,255,255,.055)',
                  borderLeft: pending ? '2px solid var(--agl-yellow)' : '2px solid transparent',
                  alignItems: 'center',
                  cursor: 'pointer',
                  font: '400 12.5px var(--font-body)',
                  color: 'var(--t-80)',
                  background: pending ? 'rgba(238,213,142,.05)' : 'transparent',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = pending ? 'rgba(238,213,142,.09)' : 'rgba(255,255,255,.03)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = pending ? 'rgba(238,213,142,.05)' : 'transparent')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                  <Avatar initials={u.initials} gold={u.avatar_gold} size={34} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ font: '600 12.5px var(--font-body)', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: 7 }}>
                      {u.name}
                      {u.id === user.id && (
                        <span style={{ color: 'var(--agl-yellow)', font: '500 10px var(--font-body)' }}>you</span>
                      )}
                      {pending && <PendingBadge />}
                    </div>
                    <div style={{ font: '400 11px var(--font-body)', color: 'var(--t-45)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {u.email}
                    </div>
                  </div>
                </div>
                {pending ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      void validateUser(u.id)
                    }}
                    style={{
                      justifySelf: 'start',
                      padding: '6px 12px',
                      borderRadius: 9,
                      cursor: 'pointer',
                      font: '600 11px var(--font-display)',
                      color: 'var(--agl-navy)',
                      background: 'var(--agl-yellow)',
                      border: 'none',
                    }}
                  >
                    Validate
                  </button>
                ) : (
                  <span style={{ color: 'var(--t-65)' }}>{u.role_label}</span>
                )}
                <span style={{ color: u.can_create ? 'var(--agl-yellow)' : 'var(--t-40)' }}>
                  {u.can_create ? '✓' : '—'}
                </span>
                <span style={{ color: 'var(--t-70)' }}>{reachLabel(u.effective_internal)}</span>
                <span style={{ color: 'var(--t-70)' }}>{reachLabel(u.effective_external)}</span>
                <span style={{ color: u.is_effective_manager ? 'var(--agl-yellow)' : 'var(--t-40)' }}>
                  {u.is_effective_manager ? '✓' : '—'}
                </span>
              </div>
              )
            })}
            {shownUsers.length === 0 && (
              <div style={{ padding: '16px 22px', font: '400 11.5px var(--font-body)', color: 'var(--t-40)' }}>
                No accounts are awaiting validation.
              </div>
            )}
            <div style={{ padding: '14px 22px', font: '400 11.5px var(--font-body)', color: 'var(--t-40)' }}>
              Self-registered accounts arrive with zero rights and a Pending flag — configure their rights and validate them here.
            </div>
          </div>
        ) : (
          <div className="scroll-y" style={{ flex: 1, overflowY: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
              {profiles.map((p) => (
                <div
                  key={p.name}
                  onClick={() => setEditProfile({ data: { name: p.name, countries: [...p.countries], embeds_rights_manager: p.embeds_rights_manager }, isNew: false })}
                  style={{
                    borderRadius: 16,
                    background: 'var(--glass-90)',
                    border: '1px solid var(--border-mid)',
                    backdropFilter: 'blur(18px)',
                    padding: 18,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ font: '600 14px var(--font-display)', color: '#fff' }}>{p.name}</div>
                    <span style={{ font: '400 11px var(--font-body)', color: 'var(--t-45)' }}>
                      {p.holders} holder{p.holders === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {p.countries.length === 0 && (
                      <span style={{ font: '400 11.5px var(--font-body)', color: 'var(--t-40)' }}>No countries</span>
                    )}
                    {p.countries.map((c) => (
                      <span
                        key={c}
                        style={{
                          padding: '3px 8px',
                          borderRadius: 14,
                          background: 'rgba(255,255,255,.06)',
                          border: '1px solid var(--border-soft)',
                          font: '500 10.5px var(--font-body)',
                          color: 'var(--t-75)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                        }}
                      >
                        <CountryFlag code={c} size={13} />
                        {c}
                      </span>
                    ))}
                  </div>
                  {p.embeds_rights_manager && (
                    <span
                      style={{
                        alignSelf: 'flex-start',
                        padding: '3px 9px',
                        borderRadius: 12,
                        background: 'var(--yellow-tint)',
                        border: '1px solid var(--yellow-border)',
                        font: '500 10px var(--font-body)',
                        color: 'var(--agl-yellow)',
                      }}
                    >
                      Embeds Rights Manager
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {editUser && (
        <UserEditor
          initial={editUser.form}
          isNew={!editUser.id}
          userId={editUser.id}
          countries={countries}
          profiles={profiles}
          roles={roles}
          categories={categories}
          editingSelf={editUser.id === user.id}
          hasPassword={editUser.hasPassword ?? false}
          onClose={() => setEditUser(null)}
          onSaved={(payload) => saveUser(payload, editUser.id)}
          onDeleted={editUser.id ? () => deleteUser(editUser.id!) : undefined}
        />
      )}

      {editProfile && (
        <ProfileEditor
          initial={editProfile.data}
          isNew={editProfile.isNew}
          countries={countries}
          onClose={() => setEditProfile(null)}
          onSaved={(payload) => saveProfile(payload, editProfile.isNew)}
          onDeleted={!editProfile.isNew ? () => deleteProfile(editProfile.data.name) : undefined}
        />
      )}
    </div>
  )
}
