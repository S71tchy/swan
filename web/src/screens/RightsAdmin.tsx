import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '../api'
import { useAuth } from '../auth'
import { TopBar } from '../components/TopBar'
import { LeftRail } from '../components/LeftRail'
import { MapBackdrop } from '../components/MapBackdrop'
import { Avatar } from '../components/Avatar'
import { Button, SectionLabel } from '../components/ui'
import { PlusIcon } from '../components/icons'
import { LocationPinPicker } from '../components/LocationPinPicker'
import type { AdminUserRow, CountryRef, PlaceRow, ProfileRow } from '../types'

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 40,
  borderRadius: 10,
  background: 'rgba(255,255,255,.05)',
  border: '1px solid var(--border-strong)',
  padding: '0 12px',
  color: '#fff',
  font: '400 13px var(--font-body)',
  outline: 'none',
}

const ROLE_SUGGESTIONS = [
  'Field Contributor',
  'Country/Region Publisher',
  'Rights Manager',
  'Rights Administrator',
]

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ font: '500 11px var(--font-body)', color: 'var(--t-55)' }}>{label}</span>
      {children}
    </label>
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
  label: string
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

function CountryPicker({
  countries,
  selected,
  onToggle,
}: {
  countries: CountryRef[]
  selected: string[]
  onToggle: (code: string) => void
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
      {countries.map((c) => (
        <Chip
          key={c.code}
          label={`${c.flag} ${c.code}`}
          on={selected.includes(c.code)}
          onClick={() => onToggle(c.code)}
        />
      ))}
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
  }
}

function Drawer({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(6,11,20,.55)' }} />
      <div
        className="scroll-y"
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: 560,
          maxWidth: '100vw',
          background: 'var(--glass-slideover, rgba(15,27,46,.97))',
          borderLeft: '1px solid var(--border-mid)',
          backdropFilter: 'blur(20px)',
          boxShadow: '-30px 0 80px rgba(0,0,0,.5)',
          animation: 'swanSlideOver .28s ease-out',
          overflowY: 'auto',
        }}
      >
        {children}
      </div>
    </div>
  )
}

function UserEditor({
  initial,
  isNew,
  countries,
  profiles,
  editingSelf,
  onClose,
  onSaved,
  onDeleted,
}: {
  initial: UserForm
  isNew: boolean
  countries: CountryRef[]
  profiles: ProfileRow[]
  editingSelf: boolean
  userId?: string
  onClose: () => void
  onSaved: (payload: UserForm, id?: string) => Promise<void>
  onDeleted?: () => Promise<void>
}) {
  const [form, setForm] = useState<UserForm>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <Drawer onClose={onClose}>
      <div style={{ padding: '26px 26px 30px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar initials={(form.initials || form.name.slice(0, 2) || '?').toUpperCase()} gold={form.avatar_gold} size={44} />
          <div>
            <div style={{ font: '600 17px var(--font-display)', color: '#fff' }}>
              {isNew ? 'New user' : form.name}
            </div>
            <div style={{ font: '400 11.5px var(--font-body)', color: 'var(--t-45)' }}>
              {isNew ? 'Create an identity and grant its rights' : 'Edit identity & rights'}
            </div>
          </div>
        </div>

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
          <Field label="Role label">
            <input
              style={inputStyle}
              list="role-suggestions"
              value={form.role_label}
              onChange={(e) => set('role_label', e.target.value)}
            />
            <datalist id="role-suggestions">
              {ROLE_SUGGESTIONS.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
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
// Place editor drawer
// --------------------------------------------------------------------------- //
type PlaceForm = { code: string; name: string; country: string; lat: number | null; lng: number | null; aliases: string }

function PlaceEditor({
  initial,
  isNew,
  countries,
  usage,
  onClose,
  onSaved,
  onDeleted,
}: {
  initial: PlaceForm
  isNew: boolean
  countries: CountryRef[]
  usage: number
  onClose: () => void
  onSaved: (payload: PlaceForm) => Promise<void>
  onDeleted?: () => Promise<void>
}) {
  const [form, setForm] = useState<PlaceForm>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ready = form.code.trim() && form.name.trim() && form.country && form.lat != null && form.lng != null

  async function save() {
    setError(null)
    if (!ready) {
      setError('Code, name, country and a map pin are all required.')
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
      <div style={{ padding: '26px 26px 30px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <div style={{ font: '600 17px var(--font-display)', color: '#fff' }}>{isNew ? 'New location' : form.name}</div>
          <div style={{ font: '400 11.5px var(--font-body)', color: 'var(--t-45)' }}>
            {isNew ? 'Add a place to the master gazetteer' : `Referenced by ${usage} alert${usage === 1 ? '' : 's'}`}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Code (LOCODE-ish)">
            <input
              style={{ ...inputStyle, textTransform: 'uppercase', opacity: isNew ? 1 : 0.6 }}
              value={form.code}
              disabled={!isNew}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
            />
          </Field>
          <Field label="Country">
            <select
              style={{ ...inputStyle, appearance: 'none' }}
              value={form.country}
              onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
            >
              <option value="">Select…</option>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Name">
          <input style={inputStyle} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </Field>
        <Field label="Aliases (comma-separated, for search)">
          <input style={inputStyle} value={form.aliases} onChange={(e) => setForm((f) => ({ ...f, aliases: e.target.value }))} />
        </Field>
        <div>
          <div style={{ font: '500 11px var(--font-body)', color: 'var(--t-55)', marginBottom: 6 }}>Coordinates</div>
          <LocationPinPicker lat={form.lat} lng={form.lng} onChange={(la, ln) => setForm((f) => ({ ...f, lat: la, lng: ln }))} height={210} />
        </div>

        {error && (
          <div style={{ borderRadius: 10, border: '1px solid rgba(207,69,39,.5)', background: 'rgba(207,69,39,.12)', padding: '10px 12px', font: '400 12px var(--font-body)', color: 'var(--sev-critical-text)' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 4 }}>
          <Button variant="primary" disabled={busy} onClick={save}>
            {isNew ? 'Create location' : 'Save changes'}
          </Button>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          {!isNew && onDeleted && (
            <Button variant="danger" disabled={busy} onClick={remove} style={{ marginLeft: 'auto' }}>Delete</Button>
          )}
        </div>
      </div>
    </Drawer>
  )
}

// --------------------------------------------------------------------------- //
// Screen
// --------------------------------------------------------------------------- //
type Tab = 'users' | 'profiles' | 'places'
const TAB_LABEL: Record<Tab, string> = { users: 'Users', profiles: 'Profiles', places: 'Locations' }

export default function RightsAdmin() {
  const { user, refresh } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('users')
  const [countries, setCountries] = useState<CountryRef[]>([])
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [profiles, setProfiles] = useState<ProfileRow[]>([])
  const [places, setPlaces] = useState<PlaceRow[]>([])
  const [editUser, setEditUser] = useState<{ form: UserForm; id?: string } | null>(null)
  const [editProfile, setEditProfile] = useState<{
    data: { name: string; countries: string[]; embeds_rights_manager: boolean }
    isNew: boolean
  } | null>(null)
  const [editPlace, setEditPlace] = useState<{ form: PlaceForm; isNew: boolean; usage: number } | null>(null)

  const flagOf = useMemo(() => {
    const m: Record<string, string> = {}
    countries.forEach((c) => (m[c.code] = c.flag))
    return m
  }, [countries])

  const isManager = user?.rights.is_rights_manager

  async function reload() {
    const [u, p, pl] = await Promise.all([api.adminUsers(), api.adminProfiles(), api.adminPlaces()])
    setUsers(u)
    setProfiles(p)
    setPlaces(pl)
  }

  useEffect(() => {
    if (!isManager) return
    void api.adminCountries().then(setCountries).catch(() => setCountries([]))
    void reload()
  }, [isManager])

  if (!user) return null

  if (!isManager) {
    return (
      <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: 'var(--bg-deep)' }}>
        <MapBackdrop opacity={0.45} blur={2} overlay="rgba(8,14,26,.5)" />
        <TopBar breadcrumb="Rights administration" showCreate={false} />
        <LeftRail />
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
          <div
            style={{
              width: 420,
              maxWidth: 'calc(100vw - 40px)',
              borderRadius: 18,
              background: 'var(--glass-90)',
              border: '1px solid var(--border-mid)',
              backdropFilter: 'blur(18px)',
              padding: 30,
              textAlign: 'center',
            }}
          >
            <div style={{ font: '600 17px var(--font-display)', color: '#fff', marginBottom: 8 }}>
              Rights Manager access required
            </div>
            <div style={{ font: '400 12.5px/1.6 var(--font-body)', color: 'var(--t-60)', marginBottom: 18 }}>
              This area manages users, profiles and rights. Ask a Rights Manager to grant you access.
            </div>
            <Button variant="outline" onClick={() => navigate('/profile')}>
              Back to my profile
            </Button>
          </div>
        </div>
      </div>
    )
  }

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

  // --- place save/delete ---
  async function savePlace(form: PlaceForm, isNew: boolean) {
    const aliases = form.aliases.split(',').map((a) => a.trim()).filter(Boolean)
    if (isNew) {
      await api.adminCreatePlace({ code: form.code, name: form.name, country: form.country, lat: form.lat as number, lng: form.lng as number, aliases })
    } else {
      await api.adminUpdatePlace(form.code, { name: form.name, country: form.country, lat: form.lat as number, lng: form.lng as number, aliases })
    }
    setEditPlace(null)
    await reload()
  }
  async function deletePlace(code: string) {
    await api.adminDeletePlace(code)
    setEditPlace(null)
    await reload()
  }

  const reachLabel = (codes: string[]) =>
    codes.length === 0 ? '—' : codes.map((c) => `${flagOf[c] ?? ''}${c}`).join(' ')

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
            {(['users', 'profiles', 'places'] as Tab[]).map((t) => (
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
                {TAB_LABEL[t]} · {t === 'users' ? users.length : t === 'profiles' ? profiles.length : places.length}
              </button>
            ))}
          </div>
          <Button
            variant="primary"
            onClick={() => {
              if (tab === 'users') setEditUser({ form: emptyUser() })
              else if (tab === 'profiles') setEditProfile({ data: { name: '', countries: [], embeds_rights_manager: false }, isNew: true })
              else setEditPlace({ form: { code: '', name: '', country: '', lat: null, lng: null, aliases: '' }, isNew: true, usage: 0 })
            }}
          >
            <PlusIcon size={13} stroke="var(--agl-navy)" />
            {tab === 'users' ? 'New user' : tab === 'profiles' ? 'New profile' : 'New location'}
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
            {users.map((u) => (
              <div
                key={u.id}
                onClick={() => setEditUser({ form: rowToForm(u), id: u.id })}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2.4fr 1.3fr .8fr 1.6fr 1.6fr .9fr',
                  gap: 12,
                  padding: '13px 22px',
                  borderBottom: '1px solid rgba(255,255,255,.055)',
                  alignItems: 'center',
                  cursor: 'pointer',
                  font: '400 12.5px var(--font-body)',
                  color: 'var(--t-80)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,.03)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                  <Avatar initials={u.initials} gold={u.avatar_gold} size={34} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ font: '600 12.5px var(--font-body)', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {u.name}
                      {u.id === user.id && (
                        <span style={{ color: 'var(--agl-yellow)', font: '500 10px var(--font-body)', marginLeft: 6 }}>you</span>
                      )}
                    </div>
                    <div style={{ font: '400 11px var(--font-body)', color: 'var(--t-45)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {u.email}
                    </div>
                  </div>
                </div>
                <span style={{ color: 'var(--t-65)' }}>{u.role_label}</span>
                <span style={{ color: u.can_create ? 'var(--agl-yellow)' : 'var(--t-40)' }}>
                  {u.can_create ? '✓' : '—'}
                </span>
                <span style={{ color: 'var(--t-70)' }}>{reachLabel(u.effective_internal)}</span>
                <span style={{ color: 'var(--t-70)' }}>{reachLabel(u.effective_external)}</span>
                <span style={{ color: u.is_effective_manager ? 'var(--agl-yellow)' : 'var(--t-40)' }}>
                  {u.is_effective_manager ? '✓' : '—'}
                </span>
              </div>
            ))}
            <div style={{ padding: '14px 22px', font: '400 11.5px var(--font-body)', color: 'var(--t-40)' }}>
              New users can sign in immediately from the login screen's identity switcher — useful for testing routing.
            </div>
          </div>
        ) : tab === 'profiles' ? (
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
                        }}
                      >
                        {flagOf[c] ?? ''} {c}
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
        ) : (
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
                gridTemplateColumns: '1fr 2fr 1.4fr 1.4fr .8fr',
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
              <span>Code</span>
              <span>Name</span>
              <span>Country</span>
              <span>Coordinates</span>
              <span>Alerts</span>
            </div>
            {places.map((p) => (
              <div
                key={p.code}
                onClick={() => setEditPlace({ form: { code: p.code, name: p.name, country: p.country, lat: p.lat, lng: p.lng, aliases: p.aliases.join(', ') }, isNew: false, usage: p.usage })}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 2fr 1.4fr 1.4fr .8fr',
                  gap: 12,
                  padding: '13px 22px',
                  borderBottom: '1px solid rgba(255,255,255,.055)',
                  alignItems: 'center',
                  cursor: 'pointer',
                  font: '400 12.5px var(--font-body)',
                  color: 'var(--t-80)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,.03)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ font: '600 11.5px var(--font-display)', color: 'var(--agl-yellow)' }}>{p.code}</span>
                <span style={{ color: '#fff' }}>{p.name}</span>
                <span style={{ color: 'var(--t-65)' }}>{p.flag} {p.country_name}</span>
                <span style={{ color: 'var(--t-55)', font: '400 11.5px var(--font-body)' }}>{p.lat.toFixed(2)}, {p.lng.toFixed(2)}</span>
                <span style={{ color: p.usage ? 'var(--t-70)' : 'var(--t-40)' }}>{p.usage || '—'}</span>
              </div>
            ))}
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
          editingSelf={editUser.id === user.id}
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

      {editPlace && (
        <PlaceEditor
          initial={editPlace.form}
          isNew={editPlace.isNew}
          countries={countries}
          usage={editPlace.usage}
          onClose={() => setEditPlace(null)}
          onSaved={(form) => savePlace(form, editPlace.isNew)}
          onDeleted={!editPlace.isNew ? () => deletePlace(editPlace.form.code) : undefined}
        />
      )}
    </div>
  )
}
