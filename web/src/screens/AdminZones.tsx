import { useEffect, useState } from 'react'
import { api, ApiError } from '../api'
import { useAuth } from '../auth'
import { Button } from '../components/ui'
import { PlusIcon } from '../components/icons'
import { CountryFlag } from '../components/CountryFlag'
import { ZoneDrawMap, circleRing, type LngLat } from '../components/ZoneDrawMap'
import {
  AdminGate,
  AdminScreen,
  Chip,
  CountryPicker,
  Drawer,
  Field,
  FormError,
  inputStyle,
  listPanelStyle,
} from '../components/adminUi'
import type { CountryRef, ZoneRow } from '../types'

// --------------------------------------------------------------------------- //
// Settings → Zones
//
// The third kind of geography, after the gazetteer's points and whole countries:
// straits, anchorages, corridors — the places an alert is about that are neither
// a pin nor a nation.
//
// Zones are master data, defined once and reused, for the same reason ports are:
// otherwise the Strait of Hormuz gets redrawn slightly differently on every
// alert and none of it is comparable or auditable.
//
// The country list is the zone's **rights perimeter** and is declared here by a
// human. The map suggests it from the shape, but it is never applied silently —
// rights say who holds authority, and deriving them from geometry would mean
// dragging a vertex changes who can approve an alert. A zone may legitimately
// declare no country at all (international waters); alerts on it are then
// orphaned and escalate to Rights Managers, which is the existing escape hatch.
// --------------------------------------------------------------------------- //

type Draft = {
  code: string
  name: string
  kind: 'polygon' | 'radius'
  countries: string[]
  points: LngLat[]
  center: LngLat | null
  radiusKm: number
  aliases: string
  notes: string
}

function emptyDraft(): Draft {
  return {
    code: '',
    name: '',
    kind: 'polygon',
    countries: [],
    points: [],
    center: null,
    radiusKm: 50,
    aliases: '',
    notes: '',
  }
}

function rowToDraft(z: ZoneRow): Draft {
  const ring = (z.geometry?.coordinates?.[0] ?? []) as LngLat[]
  return {
    code: z.code,
    name: z.name,
    kind: z.kind as 'polygon' | 'radius',
    countries: [...z.countries],
    // The stored ring is closed; the editor works with open rings so the last
    // vertex isn't a duplicate you can drag away from its twin.
    points: z.kind === 'polygon' ? ring.slice(0, Math.max(0, ring.length - 1)) : [],
    center: z.kind === 'radius' ? [z.lng, z.lat] : null,
    radiusKm: z.radius_m ? Math.round(z.radius_m / 100) / 10 : 50,
    aliases: z.aliases.join(', '),
    notes: z.notes,
  }
}

function ZoneEditor({
  initial,
  isNew,
  countries,
  usage,
  onClose,
  onSaved,
  onDeleted,
}: {
  initial: Draft
  isNew: boolean
  countries: CountryRef[]
  usage: number
  onClose: () => void
  onSaved: (d: Draft) => Promise<void>
  onDeleted?: () => Promise<void>
}) {
  const [d, setD] = useState<Draft>(initial)
  const [suggested, setSuggested] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }))

  const shapeReady = d.kind === 'radius' ? d.center !== null : d.points.length >= 3
  const ready = d.code.trim() && d.name.trim() && shapeReady
  const missing = suggested.filter((c) => !d.countries.includes(c))

  async function save() {
    setError(null)
    if (!ready) {
      setError(
        d.kind === 'radius'
          ? 'Code, name and a centre point on the map are required.'
          : 'Code, name and at least three points on the map are required.',
      )
      return
    }
    setBusy(true)
    try {
      await onSaved(d)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Drawer onClose={onClose}>
      <div style={{ padding: '26px 26px 30px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <div style={{ font: '600 17px var(--font-display)', color: '#fff' }}>
            {isNew ? 'New zone' : d.name || d.code}
          </div>
          <div style={{ font: '400 11.5px/1.6 var(--font-body)', color: 'var(--t-45)' }}>
            {isNew
              ? 'Draw an area an alert can be filed against — a strait, an anchorage, a corridor.'
              : `Referenced by ${usage} alert${usage === 1 ? '' : 's'}. They keep their own copy of the shape.`}
          </div>
        </div>

        {error && <FormError>{error}</FormError>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Code">
            <input
              style={{ ...inputStyle, textTransform: 'uppercase', opacity: isNew ? 1 : 0.6 }}
              value={d.code}
              disabled={!isNew}
              placeholder="HORMUZ"
              onChange={(e) => set('code', e.target.value.toUpperCase())}
            />
          </Field>
          <Field label="Name">
            <input
              style={inputStyle}
              value={d.name}
              placeholder="Strait of Hormuz"
              onChange={(e) => set('name', e.target.value)}
            />
          </Field>
        </div>

        {/* shape */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ font: '500 11px var(--font-body)', color: 'var(--t-55)' }}>Shape</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['polygon', 'radius'] as const).map((k) => (
                <Chip key={k} label={k === 'polygon' ? 'Polygon' : 'Radius'} on={d.kind === k} onClick={() => set('kind', k)} />
              ))}
            </div>
            <span style={{ flex: 1 }} />
            {d.kind === 'polygon' && d.points.length > 0 && (
              <>
                <button
                  onClick={() => set('points', d.points.slice(0, -1))}
                  style={smallBtn}
                  title="Remove the last point"
                >
                  Undo point
                </button>
                <button onClick={() => set('points', [])} style={smallBtn}>
                  Clear
                </button>
              </>
            )}
          </div>

          <div style={{ font: '400 10.5px/1.5 var(--font-body)', color: 'var(--t-40)', marginBottom: 7 }}>
            {d.kind === 'polygon'
              ? 'Click the map to add points — the shape closes itself. Drag a solid handle to move a point, or a hollow one to add a point between two others.'
              : 'Click the map to place the centre, then drag the handle to size it — or type a radius below.'}
          </div>

          <ZoneDrawMap
            kind={d.kind}
            points={d.points}
            center={d.center}
            radiusM={d.radiusKm * 1000}
            onPoints={(p) => set('points', p)}
            onCenter={(c) => set('center', c)}
            onRadius={(m) => set('radiusKm', Math.round(m / 100) / 10)}
            onCountriesDetected={setSuggested}
          />

          {d.kind === 'radius' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
              <span style={{ font: '500 11px var(--font-body)', color: 'var(--t-55)' }}>Radius</span>
              <input
                type="number"
                min={0.1}
                step={1}
                value={d.radiusKm}
                onChange={(e) => set('radiusKm', Math.max(0.1, Number(e.target.value) || 0))}
                style={{ ...inputStyle, width: 110, height: 32 }}
              />
              <span style={{ font: '400 11.5px var(--font-body)', color: 'var(--t-50)' }}>km</span>
              {d.center && (
                <span style={{ font: '400 11px var(--font-body)', color: 'var(--t-40)' }}>
                  centre {d.center[1].toFixed(3)}, {d.center[0].toFixed(3)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* rights perimeter */}
        <div>
          <div style={{ font: '500 11px var(--font-body)', color: 'var(--t-55)', marginBottom: 4 }}>
            Rights perimeter
          </div>
          <div style={{ font: '400 10.5px/1.55 var(--font-body)', color: 'var(--t-40)', marginBottom: 8 }}>
            The countries whose publication rights govern alerts on this zone. Leave empty for
            international waters — those alerts escalate to Rights Managers.
          </div>

          {missing.length > 0 && (
            <div
              style={{
                borderRadius: 10,
                border: '1px solid var(--yellow-border-strong)',
                background: 'var(--yellow-tint)',
                padding: '9px 11px',
                marginBottom: 9,
                font: '400 11px/1.5 var(--font-body)',
                color: 'var(--t-65)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <span style={{ flex: 1 }}>
                The shape covers{' '}
                <b style={{ color: 'var(--agl-yellow)' }}>{missing.join(', ')}</b>, not selected below.
              </span>
              <button
                style={smallBtn}
                onClick={() => set('countries', [...d.countries, ...missing].sort())}
              >
                Add
              </button>
            </div>
          )}

          <CountryPicker
            countries={countries}
            selected={d.countries}
            onToggle={(c) =>
              set('countries', d.countries.includes(c) ? d.countries.filter((x) => x !== c) : [...d.countries, c])
            }
          />
        </div>

        <Field label="Aliases (comma-separated, for search)">
          <input style={inputStyle} value={d.aliases} onChange={(e) => set('aliases', e.target.value)} />
        </Field>
        <Field label="Note (optional)">
          <input style={inputStyle} value={d.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 4 }}>
          <Button variant="primary" disabled={busy} onClick={save}>
            {isNew ? 'Create zone' : 'Save changes'}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          {!isNew && onDeleted && (
            <Button
              variant="danger"
              disabled={busy}
              style={{ marginLeft: 'auto' }}
              onClick={async () => {
                setError(null)
                setBusy(true)
                try {
                  await onDeleted()
                } catch (e) {
                  setError(e instanceof ApiError ? e.message : 'Could not delete.')
                  setBusy(false)
                }
              }}
            >
              Delete
            </Button>
          )}
        </div>
      </div>
    </Drawer>
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

const COLUMNS = '1.2fr 1.8fr .8fr 1.6fr .7fr'

export default function AdminZones() {
  const { user } = useAuth()
  const [zones, setZones] = useState<ZoneRow[]>([])
  const [countries, setCountries] = useState<CountryRef[]>([])
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<{ draft: Draft; isNew: boolean; usage: number } | null>(null)

  const isManager = user?.rights.is_rights_manager

  async function reload() {
    setZones(await api.adminZones())
  }

  useEffect(() => {
    if (!isManager) return
    void reload()
    void api.adminCountries().then(setCountries).catch(() => setCountries([]))
  }, [isManager])

  if (!user) return null
  if (!isManager) return <AdminGate breadcrumb="Settings · Zones" />

  async function save(d: Draft, isNew: boolean) {
    const aliases = d.aliases.split(',').map((a) => a.trim()).filter(Boolean)
    const body =
      d.kind === 'radius'
        ? {
            name: d.name.trim(),
            kind: 'radius' as const,
            countries: d.countries,
            lat: d.center![1],
            lng: d.center![0],
            radius_m: Math.round(d.radiusKm * 1000),
            aliases,
            notes: d.notes.trim(),
          }
        : {
            name: d.name.trim(),
            kind: 'polygon' as const,
            countries: d.countries,
            // Closed here so what the server validates is what the map drew.
            geometry: { type: 'Polygon' as const, coordinates: [[...d.points, d.points[0]]] },
            aliases,
            notes: d.notes.trim(),
          }
    if (isNew) await api.adminCreateZone({ code: d.code.trim().toUpperCase(), ...body })
    else await api.adminUpdateZone(d.code, body)
    setEditing(null)
    await reload()
  }

  const q = query.trim().toLowerCase()
  const shown = q
    ? zones.filter(
        (z) =>
          z.name.toLowerCase().includes(q) ||
          z.code.toLowerCase().includes(q) ||
          z.aliases.some((a) => a.toLowerCase().includes(q)) ||
          z.country_names.some((c) => c.toLowerCase().includes(q)),
      )
    : zones

  return (
    <AdminScreen
      title="Zones"
      description="Custom areas — straits, anchorages, corridors — that an alert can be filed against."
      actions={
        <>
          <input
            placeholder="Search zones…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ ...inputStyle, width: 220 }}
          />
          <Button variant="primary" onClick={() => setEditing({ draft: emptyDraft(), isNew: true, usage: 0 })}>
            <PlusIcon size={13} stroke="var(--agl-navy)" />
            New zone
          </Button>
        </>
      }
    >
      <div className="scroll-y" style={listPanelStyle}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: COLUMNS,
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
          <span>Shape</span>
          <span>Rights perimeter</span>
          <span>Alerts</span>
        </div>

        {shown.map((z) => (
          <div
            key={z.code}
            onClick={() => setEditing({ draft: rowToDraft(z), isNew: false, usage: z.usage })}
            style={{
              display: 'grid',
              gridTemplateColumns: COLUMNS,
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
            <span style={{ font: '600 11.5px var(--font-display)', color: 'var(--agl-yellow)' }}>{z.code}</span>
            <span style={{ color: '#fff' }}>{z.name}</span>
            <span style={{ color: 'var(--t-55)', font: '400 11.5px var(--font-body)' }}>
              {z.kind === 'radius'
                ? `${Math.round((z.radius_m ?? 0) / 100) / 10} km radius`
                : `${Math.max(0, (z.geometry?.coordinates?.[0]?.length ?? 1) - 1)}-point polygon`}
            </span>
            <span style={{ display: 'inline-flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
              {z.countries.length === 0 ? (
                <span style={{ color: 'var(--agl-yellow)', font: '400 11.5px var(--font-body)' }}>
                  None — escalates
                </span>
              ) : (
                z.countries.map((c) => (
                  <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <CountryFlag code={c} size={13} />
                    {c}
                  </span>
                ))
              )}
            </span>
            <span style={{ color: z.usage ? 'var(--t-70)' : 'var(--t-40)' }}>{z.usage || '—'}</span>
          </div>
        ))}

        {shown.length === 0 && (
          <div style={{ padding: '16px 22px', font: '400 11.5px var(--font-body)', color: 'var(--t-40)' }}>
            {q ? 'No zones match your search.' : 'No zones yet — draw one to file alerts against an area.'}
          </div>
        )}
      </div>

      {editing && (
        <ZoneEditor
          initial={editing.draft}
          isNew={editing.isNew}
          countries={countries}
          usage={editing.usage}
          onClose={() => setEditing(null)}
          onSaved={(d) => save(d, editing.isNew)}
          onDeleted={
            editing.isNew
              ? undefined
              : async () => {
                  await api.adminDeleteZone(editing.draft.code)
                  setEditing(null)
                  await reload()
                }
          }
        />
      )}
    </AdminScreen>
  )
}

// Re-exported for the create-alert preview, which draws the same ring shape.
export { circleRing }
