import { useEffect, useState } from 'react'
import { api, ApiError } from '../api'
import { useAuth } from '../auth'
import { Button } from '../components/ui'
import { PlusIcon } from '../components/icons'
import { LocationPinPicker } from '../components/LocationPinPicker'
import { CountryFlag } from '../components/CountryFlag'
import { AdminGate, AdminScreen, Drawer, DuplicateWarning, Field, FormError, inputStyle, listPanelStyle } from '../components/adminUi'
import type { CountryRef, DuplicateMatch, PlaceRow } from '../types'

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
  onSaved: (payload: PlaceForm, confirmDuplicate: boolean) => Promise<void>
  onDeleted?: () => Promise<void>
}) {
  const [form, setForm] = useState<PlaceForm>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Suspected duplicates, and whether the operator has already seen them. The
  // second press of the same button is the confirmation -- no extra dialog, and
  // no way to confirm something you were never shown.
  const [dups, setDups] = useState<DuplicateMatch[]>([])

  const ready = form.code.trim() && form.name.trim() && form.country && form.lat != null && form.lng != null

  async function save() {
    setError(null)
    if (!ready) {
      setError('Code, name, country and a map pin are all required.')
      return
    }
    setBusy(true)
    try {
      // Already warned about these exact matches -> this press is the confirm.
      const confirming = dups.length > 0
      if (!confirming) {
        const report = await api.adminCheckPlaceDuplicate({
          name: form.name,
          country: form.country,
          lat: form.lat,
          lng: form.lng,
          exclude_code: isNew ? undefined : form.code,
        })
        if (report.matches.length > 0) {
          setDups(report.matches)
          setBusy(false)
          return
        }
      }
      await onSaved(form, confirming)
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
          {/* Editing the identity clears a previous warning: the matches were
              about the old values, so confirming them would confirm nothing. */}
          <input
            style={inputStyle}
            value={form.name}
            onChange={(e) => {
              setDups([])
              setForm((f) => ({ ...f, name: e.target.value }))
            }}
          />
        </Field>
        <Field label="Aliases (comma-separated, for search)">
          <input style={inputStyle} value={form.aliases} onChange={(e) => setForm((f) => ({ ...f, aliases: e.target.value }))} />
        </Field>
        <div>
          <div style={{ font: '500 11px var(--font-body)', color: 'var(--t-55)', marginBottom: 6 }}>Coordinates</div>
          <LocationPinPicker lat={form.lat} lng={form.lng} onChange={(la, ln) => setForm((f) => ({ ...f, lat: la, lng: ln }))} height={210} />
        </div>

        {error && <FormError>{error}</FormError>}
        <DuplicateWarning matches={dups} />

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 4 }}>
          <Button variant="primary" disabled={busy} onClick={save}>
            {dups.length > 0
              ? isNew
                ? 'Create anyway'
                : 'Save anyway'
              : isNew
                ? 'Create location'
                : 'Save changes'}
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
export default function MasterData() {
  const { user } = useAuth()
  const [countries, setCountries] = useState<CountryRef[]>([])
  const [places, setPlaces] = useState<PlaceRow[]>([])
  const [query, setQuery] = useState('')
  const [editPlace, setEditPlace] = useState<{ form: PlaceForm; isNew: boolean; usage: number } | null>(null)

  const isManager = user?.rights.is_rights_manager

  async function reload() {
    setPlaces(await api.adminPlaces())
  }

  useEffect(() => {
    if (!isManager) return
    void api.adminCountries().then(setCountries).catch(() => setCountries([]))
    void reload()
  }, [isManager])

  if (!user) return null
  if (!isManager) return <AdminGate breadcrumb="Settings · Locations" />

  async function savePlace(form: PlaceForm, isNew: boolean, confirmDuplicate = false) {
    const aliases = form.aliases.split(',').map((a) => a.trim()).filter(Boolean)
    if (isNew) {
      await api.adminCreatePlace({ code: form.code, name: form.name, country: form.country, lat: form.lat as number, lng: form.lng as number, aliases, confirm_duplicate: confirmDuplicate })
    } else {
      await api.adminUpdatePlace(form.code, { name: form.name, country: form.country, lat: form.lat as number, lng: form.lng as number, aliases, confirm_duplicate: confirmDuplicate })
    }
    setEditPlace(null)
    await reload()
  }
  async function deletePlace(code: string) {
    await api.adminDeletePlace(code)
    setEditPlace(null)
    await reload()
  }

  const q = query.trim().toLowerCase()
  const shown = q
    ? places.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          p.country_name.toLowerCase().includes(q) ||
          p.aliases.some((a) => a.toLowerCase().includes(q)),
      )
    : places

  return (
    <AdminScreen
      title="Locations"
      description="The gazetteer that powers alert-location search. Every change is audited."
      actions={
        <>
          <input
            placeholder="Search locations…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ ...inputStyle, width: 220 }}
          />
          <Button
            variant="primary"
            onClick={() => setEditPlace({ form: { code: '', name: '', country: '', lat: null, lng: null, aliases: '' }, isNew: true, usage: 0 })}
          >
            <PlusIcon size={13} stroke="var(--agl-navy)" />
            New location
          </Button>
        </>
      }
    >
        <div className="scroll-y" style={listPanelStyle}>
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
          {shown.map((p) => (
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
              <span style={{ color: 'var(--t-65)', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                <CountryFlag code={p.country} size={14} />
                {p.country_name}
              </span>
              <span style={{ color: 'var(--t-55)', font: '400 11.5px var(--font-body)' }}>{p.lat.toFixed(2)}, {p.lng.toFixed(2)}</span>
              <span style={{ color: p.usage ? 'var(--t-70)' : 'var(--t-40)' }}>{p.usage || '—'}</span>
            </div>
          ))}
          {shown.length === 0 && (
            <div style={{ padding: '16px 22px', font: '400 11.5px var(--font-body)', color: 'var(--t-40)' }}>
              {q ? 'No locations match your search.' : 'No locations yet.'}
            </div>
          )}
        </div>

      {editPlace && (
        <PlaceEditor
          initial={editPlace.form}
          isNew={editPlace.isNew}
          countries={countries}
          usage={editPlace.usage}
          onClose={() => setEditPlace(null)}
          onSaved={(form, confirm) => savePlace(form, editPlace.isNew, confirm)}
          onDeleted={!editPlace.isNew ? () => deletePlace(editPlace.form.code) : undefined}
        />
      )}
    </AdminScreen>
  )
}
