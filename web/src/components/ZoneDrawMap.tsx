import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import { swanMapStyle } from '../lib/mapStyle'
import { addDetailOverlay } from '../lib/mapOverlay'
import { ISO2_FROM_ISO3 } from '../lib/countries'

// --------------------------------------------------------------------------- //
// Zone drawing map — hand-rolled, because MapLibre ships no draw control.
//
// Two modes, one map:
//   polygon — click to add a vertex, drag a vertex to move it, drag a midpoint
//             to insert one. The ring closes itself; there is no "finish" click
//             to discover, which is the part people always get wrong.
//   radius  — click to place the centre, drag the handle to size it.
//
// Everything lives in three GeoJSON sources rather than DOM markers: markers
// are absolutely-positioned elements that MapLibre re-projects every frame, and
// a 40-vertex ring would mean 80 of them fighting the map for pointer events.
// A source updates in one setData call.
//
// The country suggestion reads the *rendered* country polygons out of the same
// demotiles vector source the basemap already draws (`queryRenderedFeatures` on
// source-layer "countries"), so no country geometry is shipped or stored
// server-side. It is a suggestion only: rights are declared by a human, because
// deriving them would mean dragging a vertex silently changes who may approve an
// alert. Note the tiles key on ADM0_A3, which is Natural Earth's own code and
// not reliably ISO3 — hence the reverse lookup table rather than a slice.
// --------------------------------------------------------------------------- //

export type LngLat = [number, number]

const SRC_SHAPE = 'zone-shape'
const SRC_VERTS = 'zone-vertices'
const SRC_MIDS = 'zone-midpoints'

const FILL = 'rgba(238,213,142,.18)'
const LINE = '#eed58e'

function ringOf(points: LngLat[]): GeoJSON.Feature {
  const ring = points.length >= 3 ? [...points, points[0]] : points
  return {
    type: 'Feature',
    properties: {},
    geometry:
      points.length >= 3
        ? { type: 'Polygon', coordinates: [ring] }
        : { type: 'LineString', coordinates: ring.length ? ring : [] },
  }
}

/** Great-circle circle, mirroring `app/geo.circle_polygon` so the preview and
 *  what the server stores are the same shape rather than two approximations. */
export function circleRing(lat: number, lng: number, radiusM: number, steps = 72): LngLat[] {
  const R = 6371008.8
  const d = radiusM / R
  const latR = (lat * Math.PI) / 180
  const lngR = (lng * Math.PI) / 180
  const out: LngLat[] = []
  for (let i = 0; i <= steps; i++) {
    const brng = (2 * Math.PI * i) / steps
    const lat2 = Math.asin(Math.sin(latR) * Math.cos(d) + Math.cos(latR) * Math.sin(d) * Math.cos(brng))
    const lng2 =
      lngR +
      Math.atan2(
        Math.sin(brng) * Math.sin(d) * Math.cos(latR),
        Math.cos(d) - Math.sin(latR) * Math.sin(lat2),
      )
    out.push([
      +(((((lng2 * 180) / Math.PI + 180) % 360) + 360) % 360 - 180).toFixed(6),
      +((lat2 * 180) / Math.PI).toFixed(6),
    ])
  }
  return out
}

/** Metres between two lng/lat pairs (haversine) — used to size the radius from
 *  the drag handle. */
export function metresBetween(a: LngLat, b: LngLat): number {
  const R = 6371008.8
  const toRad = (v: number) => (v * Math.PI) / 180
  const dLat = toRad(b[1] - a[1])
  const dLng = toRad(b[0] - a[0])
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

function midpoints(points: LngLat[]): LngLat[] {
  if (points.length < 2) return []
  const out: LngLat[] = []
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    out.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2])
  }
  return out
}

export function ZoneDrawMap({
  kind,
  points,
  center,
  radiusM,
  onPoints,
  onCenter,
  onRadius,
  onCountriesDetected,
  height = 380,
}: {
  kind: 'polygon' | 'radius'
  points: LngLat[]
  center: LngLat | null
  radiusM: number
  onPoints: (p: LngLat[]) => void
  onCenter: (c: LngLat) => void
  onRadius: (m: number) => void
  /** Countries under the current shape — a suggestion for the operator. */
  onCountriesDetected: (codes: string[]) => void
  height?: number
}) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const ready = useRef(false)
  const drag = useRef<{ kind: 'vertex' | 'mid' | 'handle'; index: number } | null>(null)

  // Latest props for the map's event handlers, which are bound once.
  const state = useRef({ kind, points, center, radiusM, onPoints, onCenter, onRadius, onCountriesDetected })
  state.current = { kind, points, center, radiusM, onPoints, onCenter, onRadius, onCountriesDetected }

  useEffect(() => {
    if (!container.current || mapRef.current) return
    const map = new maplibregl.Map({
      container: container.current,
      style: swanMapStyle,
      center: [12, 4],
      zoom: 1.6,
      attributionControl: false,
      maxZoom: 12,
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')

    map.on('load', () => {
      addDetailOverlay(map)
      const empty: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }
      map.addSource(SRC_SHAPE, { type: 'geojson', data: empty })
      map.addSource(SRC_VERTS, { type: 'geojson', data: empty })
      map.addSource(SRC_MIDS, { type: 'geojson', data: empty })

      map.addLayer({ id: 'zone-fill', type: 'fill', source: SRC_SHAPE, paint: { 'fill-color': FILL } })
      map.addLayer({
        id: 'zone-line',
        type: 'line',
        source: SRC_SHAPE,
        paint: { 'line-color': LINE, 'line-width': 2 },
      })
      map.addLayer({
        id: 'zone-mid',
        type: 'circle',
        source: SRC_MIDS,
        paint: {
          'circle-radius': 4,
          'circle-color': 'rgba(13,27,48,.9)',
          'circle-stroke-color': LINE,
          'circle-stroke-width': 1.5,
          'circle-opacity': 0.9,
        },
      })
      map.addLayer({
        id: 'zone-vert',
        type: 'circle',
        source: SRC_VERTS,
        paint: {
          // ≥8px targets: a 4px handle is unhittable on a trackpad.
          'circle-radius': 6,
          'circle-color': LINE,
          'circle-stroke-color': '#0d1b30',
          'circle-stroke-width': 2,
        },
      })
      ready.current = true
      redraw(map)
    })

    // --- pointer handling ---------------------------------------------------
    const grabbable = ['zone-vert', 'zone-mid']
    map.on('mousedown', (e) => {
      const hits = map.queryRenderedFeatures(e.point, { layers: grabbable.filter((l) => map.getLayer(l)) })
      if (!hits.length) return
      const f = hits[0]
      const idx = (f.properties?.index as number) ?? 0
      drag.current = { kind: f.layer.id === 'zone-vert' ? (state.current.kind === 'radius' ? 'handle' : 'vertex') : 'mid', index: idx }
      map.dragPan.disable()
      e.preventDefault()
    })

    map.on('mousemove', (e) => {
      const d = drag.current
      if (!d) {
        const hits = map.queryRenderedFeatures(e.point, { layers: grabbable.filter((l) => map.getLayer(l)) })
        map.getCanvas().style.cursor = hits.length ? 'grab' : ''
        return
      }
      const at: LngLat = [+e.lngLat.lng.toFixed(6), +e.lngLat.lat.toFixed(6)]
      const s = state.current
      if (d.kind === 'handle' && s.center) {
        s.onRadius(Math.max(100, Math.round(metresBetween(s.center, at))))
      } else if (d.kind === 'vertex') {
        const next = [...s.points]
        next[d.index] = at
        s.onPoints(next)
      } else if (d.kind === 'mid') {
        // Dragging a midpoint inserts a vertex there and immediately becomes a
        // vertex drag, which is how every map editor people have used behaves.
        const next = [...s.points]
        next.splice(d.index + 1, 0, at)
        s.onPoints(next)
        drag.current = { kind: 'vertex', index: d.index + 1 }
      }
    })

    const endDrag = () => {
      if (!drag.current) return
      drag.current = null
      map.dragPan.enable()
      map.getCanvas().style.cursor = ''
      detectCountries(map)
    }
    map.on('mouseup', endDrag)
    map.on('mouseout', endDrag)

    map.on('click', (e) => {
      if (drag.current) return
      const s = state.current
      const at: LngLat = [+e.lngLat.lng.toFixed(6), +e.lngLat.lat.toFixed(6)]
      // A click on an existing handle is a grab, not a new point.
      const hits = map.queryRenderedFeatures(e.point, {
        layers: ['zone-vert', 'zone-mid'].filter((l) => map.getLayer(l)),
      })
      if (hits.length) return
      if (s.kind === 'radius') s.onCenter(at)
      else s.onPoints([...s.points, at])
      window.setTimeout(() => detectCountries(map), 50)
    })

    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      ready.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Countries under the drawn shape, read from the basemap's own tiles. */
  function detectCountries(map: maplibregl.Map) {
    const s = state.current
    const ring = s.kind === 'radius' ? (s.center ? circleRing(s.center[1], s.center[0], s.radiusM) : []) : s.points
    if (ring.length < 3) {
      s.onCountriesDetected([])
      return
    }
    // Screen-space bbox of the shape. queryRenderedFeatures only sees what is
    // currently drawn, which is fine here: the operator is looking at the shape
    // they just drew. Anything off-screen is simply not suggested.
    const pts = ring.map((c) => map.project(c as maplibregl.LngLatLike))
    const xs = pts.map((p) => p.x)
    const ys = pts.map((p) => p.y)
    const box: [maplibregl.PointLike, maplibregl.PointLike] = [
      [Math.min(...xs), Math.min(...ys)],
      [Math.max(...xs), Math.max(...ys)],
    ]
    let feats: maplibregl.MapGeoJSONFeature[] = []
    try {
      feats = map.queryRenderedFeatures(box, { layers: ['land'] })
    } catch {
      feats = []
    }
    const codes = new Set<string>()
    for (const f of feats) {
      const a3 = (f.properties?.ADM0_A3 as string) || ''
      const iso2 = ISO2_FROM_ISO3[a3]
      if (iso2) codes.add(iso2)
    }
    s.onCountriesDetected([...codes].sort())
  }

  // --- redraw on every state change ----------------------------------------
  function redraw(map: maplibregl.Map) {
    const s = state.current
    const shape = map.getSource(SRC_SHAPE) as maplibregl.GeoJSONSource | undefined
    const verts = map.getSource(SRC_VERTS) as maplibregl.GeoJSONSource | undefined
    const mids = map.getSource(SRC_MIDS) as maplibregl.GeoJSONSource | undefined
    if (!shape || !verts || !mids) return

    if (s.kind === 'radius') {
      const ring = s.center ? circleRing(s.center[1], s.center[0], s.radiusM) : []
      shape.setData(
        ring.length
          ? { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } }
          : { type: 'FeatureCollection', features: [] },
      )
      // One handle, due east of the centre: the thing you drag to resize.
      const handle = s.center ? ring[Math.floor(ring.length / 4)] : null
      verts.setData({
        type: 'FeatureCollection',
        features: handle
          ? [{ type: 'Feature', properties: { index: 0 }, geometry: { type: 'Point', coordinates: handle } }]
          : [],
      })
      mids.setData({ type: 'FeatureCollection', features: [] })
      return
    }

    shape.setData(ringOf(s.points) as GeoJSON.Feature)
    verts.setData({
      type: 'FeatureCollection',
      features: s.points.map((p, i) => ({
        type: 'Feature',
        properties: { index: i },
        geometry: { type: 'Point', coordinates: p },
      })),
    })
    mids.setData({
      type: 'FeatureCollection',
      features:
        s.points.length >= 3
          ? midpoints(s.points).map((p, i) => ({
              type: 'Feature',
              properties: { index: i },
              geometry: { type: 'Point', coordinates: p },
            }))
          : [],
    })
  }

  useEffect(() => {
    const map = mapRef.current
    if (map && ready.current) redraw(map)
  })

  /** Frame an existing shape when the editor opens on a saved zone. */
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const ring = kind === 'radius' ? (center ? circleRing(center[1], center[0], radiusM) : []) : points
    if (ring.length < 2) return
    const xs = ring.map((c) => c[0])
    const ys = ring.map((c) => c[1])
    map.once('load', () =>
      map.fitBounds(
        [
          [Math.min(...xs), Math.min(...ys)],
          [Math.max(...xs), Math.max(...ys)],
        ],
        { padding: 60, duration: 0, maxZoom: 8 },
      ),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      ref={container}
      style={{
        height,
        borderRadius: 12,
        overflow: 'hidden',
        border: '1px solid var(--border-strong)',
        background: 'var(--bg-deep)',
      }}
    />
  )
}
