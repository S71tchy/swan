import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { MapBackdrop } from '../components/MapBackdrop'
import { Button, ModalBackdrop, ModalCard } from '../components/ui'
import { PublishDialogs } from '../components/PublishDialogs'
import { LocationPinPicker } from '../components/LocationPinPicker'
import { PictureField } from '../components/PictureField'
import { CountryFlag } from '../components/CountryFlag'
import { SEVERITY_COLOR, MODE_GLYPH, MODE_LABEL, externalUrl } from '../lib/format'
import type { CountryRef, ExternalVariant, Flow, LocationBlock, Place, RoutingInfo, Severity, TransportMode, Taxonomy } from '../types'

function slugCode(country: string, name: string): string {
  const base = name.replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase() || 'LOC'
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase()
  return `${country}${base}${rand}`
}

const MODES: TransportMode[] = ['sea', 'road', 'air', 'rail', 'warehouse']
const FLOWS: { value: Flow; label: string }[] = [
  { value: 'import', label: 'Import' },
  { value: 'export', label: 'Export' },
  { value: 'both', label: 'Both' },
]
const SEVERITIES: Severity[] = ['info', 'watch', 'warning', 'critical']

const req = <span style={{ color: 'var(--agl-orange)' }}> *</span>

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ font: '600 11px var(--font-body)', color: 'var(--t-55)', marginBottom: 6 }}>
      {children}
    </div>
  )
}

const fieldStyle: React.CSSProperties = {
  height: 44,
  borderRadius: 12,
  background: 'rgba(255,255,255,.05)',
  border: '1px solid var(--border-strong)',
  padding: '0 14px',
  color: '#fff',
  font: '500 13px var(--font-body)',
  width: '100%',
  outline: 'none',
}

type DraftLocation = Partial<LocationBlock> & { modes: TransportMode[]; flow: Flow }

function emptyLocation(): DraftLocation {
  return { modes: [], flow: 'both' }
}

function CustomPlaceForm({
  query,
  countries,
  canPromote,
  onAdd,
  onCancel,
}: {
  query: string
  countries: CountryRef[]
  canPromote: boolean
  onAdd: (p: Place) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(query)
  const [country, setCountry] = useState('')
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [promote, setPromote] = useState(false)
  const [busy, setBusy] = useState(false)
  const [focus, setFocus] = useState<{ lat: number; lng: number; zoom: number } | null>(null)

  // Choosing a country moves the map to it, so dropping a pin doesn't start
  // from a whole-world view. The gazetteer is the only geography we have — the
  // mean of its places in that country is a good enough centre, and countries
  // with no places just leave the map where it is.
  useEffect(() => {
    if (!country) return setFocus(null)
    let cancelled = false
    void api
      .places(country)
      .then((places) => {
        const inCountry = places.filter((p) => p.country === country)
        if (cancelled || inCountry.length === 0) return
        setFocus({
          lat: inCountry.reduce((s, p) => s + p.lat, 0) / inCountry.length,
          lng: inCountry.reduce((s, p) => s + p.lng, 0) / inCountry.length,
          zoom: 4.6,
        })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [country])

  const ready = name.trim() && country && lat != null && lng != null

  async function add() {
    if (!ready) return
    setBusy(true)
    const cc = countries.find((c) => c.code === country)
    const code = slugCode(country, name)
    const place: Place = {
      name: name.trim(),
      code,
      country,
      country_name: cc?.name ?? country,
      flag: cc?.flag ?? '',
      lat: lat as number,
      lng: lng as number,
      label: `${name.trim()} (${code})`,
    }
    if (promote && canPromote) {
      try {
        await api.adminCreatePlace({ code, name: place.name, country, lat: place.lat, lng: place.lng })
      } catch {
        /* already in master or not permitted — still use it on the alert */
      }
    }
    onAdd(place)
    setBusy(false)
  }

  return (
    <ModalBackdrop onClose={onCancel}>
      <ModalCard width={720} style={{ padding: 0 }}>
        <div style={{ padding: '20px 24px 14px', flex: 'none' }}>
          <div style={{ font: '600 16px var(--font-display)', color: '#fff' }}>
            Add a place not in the master
          </div>
          <div style={{ font: '400 12px var(--font-body)', color: 'var(--t-50)', marginTop: 3 }}>
            Name it, pick its country, then click the map to drop the pin.
          </div>
        </div>

        {/* Body scrolls if the viewport is short; the footer below never does. */}
        <div
          className="scroll-y"
          style={{ flex: 1, minHeight: 0, padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <Label>Place name{req}</Label>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Walvis Bay dry port"
                style={{ ...fieldStyle, height: 42 }}
              />
            </div>
            <div>
              <Label>Country{req}</Label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                style={{ ...fieldStyle, height: 42 }}
              >
                <option value="">Select country…</option>
                {countries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <Label>Position{req}</Label>
            <LocationPinPicker
              lat={lat}
              lng={lng}
              onChange={(la, ln) => {
                setLat(la)
                setLng(ln)
              }}
              height={300}
              focus={focus}
            />
          </div>

          {canPromote && (
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                font: '400 11.5px var(--font-body)',
                color: 'var(--t-65)',
              }}
            >
              <input type="checkbox" checked={promote} onChange={(e) => setPromote(e.target.checked)} />
              Also save to the location master (reusable by everyone)
            </label>
          )}
        </div>

        <div
          style={{
            flex: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '14px 24px 20px',
            marginTop: 4,
            borderTop: '1px solid var(--border-soft)',
          }}
        >
          <div style={{ flex: 1, font: '400 11.5px var(--font-body)', color: 'var(--t-45)' }}>
            {!name.trim()
              ? 'Give the place a name to continue.'
              : !country
                ? 'Select a country to continue.'
                : lat == null
                  ? 'Click the map to drop the pin.'
                  : `Pinned at ${(lat as number).toFixed(3)}, ${(lng as number).toFixed(3)}`}
          </div>
          <Button variant="ghost" onClick={onCancel} style={{ height: 36 }}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!ready || busy} onClick={add} style={{ height: 36 }}>
            Use this location
          </Button>
        </div>
      </ModalCard>
    </ModalBackdrop>
  )
}

function LocationPicker({
  value,
  onPick,
  countries,
  canPromote,
}: {
  value: DraftLocation
  onPick: (p: Place) => void
  countries: CountryRef[]
  canPromote: boolean
}) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Place[]>([])
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    if (!open || adding) return
    void api.places(q).then(setResults).catch(() => setResults([]))
  }, [q, open, adding])

  function pick(p: Place) {
    onPick(p)
    setOpen(false)
    setAdding(false)
    setQ('')
  }

  return (
    <div style={{ position: 'relative' }}>
      <div
        onClick={() => setOpen((o) => !o)}
        style={{ ...fieldStyle, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
      >
        📍{' '}
        {value.name ? (
          <span>{value.name}</span>
        ) : (
          <span style={{ color: 'var(--t-40)' }}>Search a place…</span>
        )}
      </div>
      {/* The add-a-place form is a centred modal, not part of this dropdown.
          It's ~400px tall, and anchoring it under a field that sits low in a
          scrolling form pushed its own Save button below the fold. Rendered
          outside the dropdown so its fixed positioning isn't trapped in the
          dropdown's stacking context. */}
      {adding && (
        <CustomPlaceForm
          query={q}
          countries={countries}
          canPromote={canPromote}
          onAdd={pick}
          onCancel={() => setAdding(false)}
        />
      )}
      {open && !adding && (
        <div
          style={{
            position: 'absolute',
            top: 48,
            left: 0,
            right: 0,
            zIndex: 30,
            borderRadius: 12,
            background: 'var(--glass-97)',
            border: '1px solid var(--border-strong)',
            boxShadow: 'var(--shadow-panel)',
            overflow: 'hidden',
            width: 380,
          }}
        >
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Type a port, city or border…"
            style={{ ...fieldStyle, height: 40, borderRadius: 0, border: 'none', borderBottom: '1px solid var(--border-soft)' }}
          />
          <div className="scroll-y" style={{ maxHeight: 200 }}>
            {results.map((p) => (
              <div
                key={p.code}
                onClick={() => pick(p)}
                style={{
                  padding: '10px 14px',
                  cursor: 'pointer',
                  font: '500 12.5px var(--font-body)',
                  color: 'var(--t-80)',
                  borderBottom: '1px solid rgba(255,255,255,.05)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,.05)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <CountryFlag code={p.country} size={14} style={{ marginRight: 6 }} />
                {p.label} · {p.country_name}
              </div>
            ))}
            {results.length === 0 && (
              <div style={{ padding: '10px 14px', color: 'var(--t-40)', font: '400 12px var(--font-body)' }}>
                No matches in the master
              </div>
            )}
          </div>
          <div
            onClick={() => setAdding(true)}
            style={{
              padding: '11px 14px',
              cursor: 'pointer',
              borderTop: '1px solid var(--border-soft)',
              font: '600 12px var(--font-body)',
              color: 'var(--agl-yellow)',
            }}
          >
            + Add a place not listed…
          </div>
        </div>
      )}
    </div>
  )
}

function LocationBlockEditor({
  block,
  onChange,
  index,
  onRemove,
  canRemove,
  countries,
  canPromote,
}: {
  block: DraftLocation
  onChange: (b: DraftLocation) => void
  index: number
  onRemove: () => void
  canRemove: boolean
  countries: CountryRef[]
  canPromote: boolean
}) {
  function toggleMode(m: TransportMode) {
    const has = block.modes.includes(m)
    onChange({ ...block, modes: has ? block.modes.filter((x) => x !== m) : [...block.modes, m] })
  }
  return (
    <div
      style={{
        borderRadius: 14,
        border: '1px solid var(--border-mid)',
        background: 'rgba(255,255,255,.03)',
        padding: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ font: '600 11px var(--font-display)', color: 'var(--t-60)', textTransform: 'uppercase', letterSpacing: '1.2px' }}>
          Location {index + 1}
        </div>
        {canRemove && (
          <span onClick={onRemove} style={{ font: '500 11px var(--font-body)', color: 'var(--t-45)', cursor: 'pointer' }}>
            Remove
          </span>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.6fr 1fr', gap: 14, alignItems: 'end' }}>
        <div>
          <Label>Location{req}</Label>
          <LocationPicker
            value={block}
            countries={countries}
            canPromote={canPromote}
            onPick={(p) =>
              onChange({
                ...block,
                name: p.label,
                code: p.code,
                country: p.country,
                country_name: p.country_name,
                flag: p.flag,
                lat: p.lat,
                lng: p.lng,
              })
            }
          />
        </div>
        <div>
          <Label>Transport modes{req}</Label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {MODES.map((m) => {
              const on = block.modes.includes(m)
              return (
                <span
                  key={m}
                  onClick={() => toggleMode(m)}
                  style={{
                    padding: '9px 12px',
                    borderRadius: 11,
                    cursor: 'pointer',
                    background: on ? 'var(--yellow-tint)' : 'transparent',
                    border: `1px solid ${on ? 'var(--yellow-border-strong)' : 'var(--border-strong)'}`,
                    font: '500 12px var(--font-body)',
                    color: on ? 'var(--agl-yellow)' : 'var(--t-50)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {MODE_GLYPH[m]} {MODE_LABEL[m]}
                </span>
              )
            })}
          </div>
        </div>
        <div>
          <Label>Flow{req}</Label>
          <div style={{ display: 'flex', height: 44, borderRadius: 12, border: '1px solid var(--border-strong)', overflow: 'hidden' }}>
            {FLOWS.map((f, i) => {
              const on = block.flow === f.value
              return (
                <span
                  key={f.value}
                  onClick={() => onChange({ ...block, flow: f.value })}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    borderLeft: i ? '1px solid var(--border-strong)' : 'none',
                    background: on ? 'var(--agl-yellow)' : 'transparent',
                    color: on ? 'var(--agl-navy)' : 'var(--t-50)',
                    font: `${on ? 600 : 500} 12px var(--font-body)`,
                  }}
                >
                  {f.label}
                </span>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CreateAlert() {
  const navigate = useNavigate()
  const { id: editId } = useParams()
  const { user } = useAuth()
  const [taxonomy, setTaxonomy] = useState<Taxonomy | null>(null)
  const [countries, setCountries] = useState<CountryRef[]>([])
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [subCategory, setSubCategory] = useState('')
  const [industry, setIndustry] = useState('')
  const [severity, setSeverity] = useState<Severity>('warning')
  const [validFrom, setValidFrom] = useState(() => new Date().toISOString().slice(0, 10))
  const [validTo, setValidTo] = useState('')
  const [locations, setLocations] = useState<DraftLocation[]>([emptyLocation()])
  const [impacts, setImpacts] = useState('')
  const [actionPlan, setActionPlan] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [pictureUrl, setPictureUrl] = useState<string | null>(null)
  const [routing, setRouting] = useState<RoutingInfo | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showPublish, setShowPublish] = useState(false)
  const debounce = useRef<number>()

  const canPromote = !!user?.rights.is_rights_manager

  useEffect(() => {
    void api.taxonomy().then(setTaxonomy)
    void api.countries().then(setCountries).catch(() => setCountries([]))
  }, [])

  // Continue editing an existing draft/rejected alert (route /create/:id).
  useEffect(() => {
    if (!editId) return
    void api
      .alert(editId)
      .then((a) => {
        setTitle(a.title)
        setCategory(a.category)
        setSubCategory(a.sub_category)
        setIndustry(a.industry ?? '')
        setSeverity(a.severity)
        setValidFrom(a.valid_from)
        setValidTo(a.valid_to ?? '')
        setImpacts(a.impacts)
        setActionPlan(a.action_plan)
        setSourceUrl(a.urls[0] ?? '')
        setPictureUrl(a.picture_url)
        setLocations(a.locations.length ? (a.locations as DraftLocation[]) : [emptyLocation()])
      })
      .catch(() => setError('Could not load this alert for editing.'))
  }, [editId])

  const completedLocations = useMemo(
    () => locations.filter((l) => l.country && l.modes.length > 0),
    [locations],
  )

  // Rights routing preview — recomputed (debounced) as locations change.
  useEffect(() => {
    if (completedLocations.length === 0) {
      setRouting(null)
      return
    }
    window.clearTimeout(debounce.current)
    debounce.current = window.setTimeout(() => {
      void api
        .routing({
          title: title || 'draft',
          category: category || 'Weather',
          valid_from: validFrom,
          locations: completedLocations as LocationBlock[],
        } as never)
        .then(setRouting)
        .catch(() => setRouting(null))
    }, 250)
  }, [completedLocations, title, category, validFrom])

  const subCategories = category && taxonomy ? taxonomy.categories[category] ?? [] : []

  const mandatoryOk =
    title && category && subCategory && impacts && actionPlan && completedLocations.length > 0

  function buildPayload() {
    return {
      title,
      picture_url: pictureUrl,
      category,
      sub_category: subCategory,
      industry: industry || null,
      severity,
      valid_from: validFrom,
      valid_to: validTo || null,
      impacts,
      action_plan: actionPlan,
      locations: completedLocations,
      // Store a canonical http(s) URL — authors type bare hosts, which are
      // useless as an href on the reading side.
      urls: sourceUrl.trim() ? [externalUrl(sourceUrl) ?? sourceUrl.trim()] : [],
      clients: [],
    }
  }

  async function persistDraft(): Promise<string> {
    // Editing an existing draft/rejected alert updates in place (no duplicate);
    // otherwise create a new draft.
    if (editId) {
      await api.updateAlert(editId, buildPayload())
      return editId
    }
    const created = await api.createAlert(buildPayload())
    return created.id
  }

  async function handleSaveDraft() {
    setBusy(true)
    setError('')
    try {
      await persistDraft()
      navigate('/feed')
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  async function handlePrimary() {
    if (!mandatoryOk) {
      setError('Fill all required (*) fields and add at least one location with a mode.')
      return
    }
    if (routing?.action === 'publish') {
      setShowPublish(true) // opens content-confirm → external dialogs
      return
    }
    // Submit for approval
    setBusy(true)
    setError('')
    try {
      const id = await persistDraft()
      await api.submit(id)
      navigate('/feed')
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  async function handleConfirmPublish(external: ExternalVariant) {
    setBusy(true)
    setError('')
    try {
      const id = await persistDraft()
      await api.publish(id, external)
      navigate('/')
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
      setShowPublish(false)
    }
  }

  const primaryLabel = routing?.action === 'publish' ? 'Publish' : 'Submit for approval →'

  // Creation is a rights dimension of its own. Without it the server refuses at
  // POST /alerts — so say so up front rather than after the form is filled in.
  if (user && !user.rights.can_create) {
    return (
      <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: 'var(--bg-deep)' }}>
        <MapBackdrop opacity={0.35} blur={3} overlay="rgba(8,14,26,.55)" />
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
              Creation rights required
            </div>
            <div style={{ font: '400 12.5px/1.6 var(--font-body)', color: 'var(--t-60)', marginBottom: 18 }}>
              Your account can view and search alerts but not raise them. Ask a Rights Manager to grant
              the Creation right if you need to report disruptions.
            </div>
            <Button variant="outline" onClick={() => navigate('/feed')}>
              Back to the feed
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: 'var(--bg-deep)' }}>
      <MapBackdrop opacity={0.35} blur={3} overlay="rgba(8,14,26,.55)" />

      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%,-50%)',
          width: 920,
          maxWidth: 'calc(100vw - 48px)',
          maxHeight: 'calc(100vh - 48px)',
          borderRadius: 20,
          background: 'var(--glass-97)',
          border: '1px solid var(--border-strong)',
          boxShadow: 'var(--shadow-modal)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'swanScaleIn .2s ease-out',
        }}
      >
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '20px 28px', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 11,
              background: 'var(--yellow-tint)',
              border: '1px solid var(--yellow-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--agl-yellow)',
              font: "600 18px var(--font-display)",
            }}
          >
            +
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ font: '600 17px var(--font-display)', color: '#fff' }}>
              {editId ? 'Edit alert' : 'Create alert'}
            </div>
            <div style={{ font: '400 11.5px var(--font-body)', color: 'var(--t-45)' }}>
              {editId ? (
                'Continue your draft — save, submit or publish when ready'
              ) : (
                <>Template: <span style={{ color: 'var(--agl-yellow)' }}>Seasonal port congestion — draft</span> · or start blank</>
              )}
            </div>
          </div>
          <div onClick={() => navigate(-1)} style={{ font: '400 20px sans-serif', color: 'var(--t-40)', cursor: 'pointer' }}>
            ✕
          </div>
        </div>

        {/* body */}
        <div className="scroll-y" style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <Label>Title{req}</Label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Short, specific headline"
              style={{ ...fieldStyle, height: 46 }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
            <div>
              <Label>Category{req}</Label>
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value)
                  setSubCategory('')
                }}
                style={{ ...fieldStyle }}
              >
                <option value="">Select…</option>
                {taxonomy &&
                  Object.keys(taxonomy.categories).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <Label>Sub-category{req}</Label>
              <select value={subCategory} onChange={(e) => setSubCategory(e.target.value)} disabled={!category} style={{ ...fieldStyle, opacity: category ? 1 : 0.5 }}>
                <option value="">Select…</option>
                {subCategories.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Industry</Label>
              <select value={industry} onChange={(e) => setIndustry(e.target.value)} style={{ ...fieldStyle }}>
                {taxonomy?.industries.map((i) => (
                  <option key={i} value={i === 'All industries' ? '' : i}>
                    {i}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <Label>Visible on map from{req}</Label>
              <input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} style={{ ...fieldStyle }} />
            </div>
            <div>
              <Label>
                Until{' '}
                <span style={{ font: '400 10.5px var(--font-body)', color: 'var(--t-35)' }}>
                  — leave blank for “until further notice”
                </span>
              </Label>
              <input type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} style={{ ...fieldStyle }} />
            </div>
          </div>

          {/* Severity — needed for map/severity coding (spec §8.4 bands). */}
          <div>
            <Label>Severity{req}</Label>
            <div style={{ display: 'flex', gap: 8 }}>
              {SEVERITIES.map((s) => {
                const on = severity === s
                return (
                  <span
                    key={s}
                    onClick={() => setSeverity(s)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 7,
                      padding: '8px 14px',
                      borderRadius: 11,
                      cursor: 'pointer',
                      background: on ? 'var(--yellow-tint)' : 'transparent',
                      border: `1px solid ${on ? 'var(--yellow-border-strong)' : 'var(--border-strong)'}`,
                      font: '500 12px var(--font-body)',
                      color: on ? 'var(--agl-yellow)' : 'var(--t-55)',
                      textTransform: 'capitalize',
                    }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: SEVERITY_COLOR[s] }} />
                    {s}
                  </span>
                )
              })}
            </div>
          </div>

          {/* Locations */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {locations.map((block, i) => (
              <LocationBlockEditor
                key={i}
                index={i}
                block={block}
                countries={countries}
                canPromote={canPromote}
                canRemove={locations.length > 1}
                onChange={(b) => setLocations((ls) => ls.map((x, j) => (j === i ? b : x)))}
                onRemove={() => setLocations((ls) => ls.filter((_, j) => j !== i))}
              />
            ))}
            <span
              onClick={() => setLocations((ls) => [...ls, emptyLocation()])}
              style={{ font: '500 12px var(--font-body)', color: 'var(--agl-yellow)', cursor: 'pointer', alignSelf: 'flex-start' }}
            >
              + Add location
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <Label>Business impact{req}</Label>
              <textarea
                value={impacts}
                onChange={(e) => setImpacts(e.target.value)}
                placeholder="What this means operationally…"
                style={{ ...fieldStyle, height: 84, padding: '12px 14px', resize: 'none', lineHeight: 1.55 }}
              />
            </div>
            <div>
              <Label>Global reactive action plan{req}</Label>
              <textarea
                value={actionPlan}
                onChange={(e) => setActionPlan(e.target.value)}
                placeholder="What the network should do…"
                style={{ ...fieldStyle, height: 84, padding: '12px 14px', resize: 'none', lineHeight: 1.55 }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <PictureField value={pictureUrl} onChange={setPictureUrl} />
            <input
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="🔗 Add source URL"
              style={{ ...fieldStyle, width: 240, height: 52, background: 'rgba(255,255,255,.04)', border: '1px solid var(--border-mid)' }}
            />
          </div>
        </div>

        {/* footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '18px 28px',
            borderTop: '1px solid rgba(255,255,255,.08)',
            background: 'rgba(10,18,32,.5)',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ font: '400 11.5px var(--font-body)', color: 'var(--t-40)', flex: 1, minWidth: 220 }}>
            {error ? (
              <span style={{ color: 'var(--sev-critical-text)' }}>{error}</span>
            ) : routing && routing.uncovered.length > 0 ? (
              <>
                You don't hold publication rights for{' '}
                <b style={{ color: 'var(--t-75)' }}>{routing.uncovered.join(', ')}</b> — this alert
                will be routed for approval.
              </>
            ) : routing?.can_publish ? (
              <>You hold publication rights for all selected locations — you can publish directly.</>
            ) : (
              <>Add a location with a transport mode to see the publication route.</>
            )}
          </span>
          <Button variant="ghost" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button variant="outline" onClick={handleSaveDraft} disabled={busy || !title}>
            Save draft
          </Button>
          <Button variant="primary" onClick={handlePrimary} disabled={busy || !mandatoryOk} style={{ padding: '0 24px' }}>
            {primaryLabel}
          </Button>
        </div>
      </div>

      {showPublish && (
        <PublishDialogs
          title={title}
          onCancel={() => setShowPublish(false)}
          onConfirm={handleConfirmPublish}
          busy={busy}
          canExternal={routing?.can_publish_external ?? false}
          externalUncovered={routing?.external_uncovered ?? []}
        />
      )}
    </div>
  )
}
