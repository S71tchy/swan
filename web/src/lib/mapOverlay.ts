import type maplibregl from 'maplibre-gl'
import type { ExpressionSpecification } from 'maplibre-gl'
import { ISO3 } from './countries'

// Natural Earth detail overlay: admin-1 provinces (boundaries + labels) and
// populated places (city dots + labels), worldwide. Public-domain data bundled
// at /geo/*.geojson, rebuilt by `python ops/build_geo.py` — no tiles token.
// Labels/dots fade in as you zoom, and MapLibre's collision detection thins city
// labels so only the major ones show when zoomed out. Degrades gracefully
// offline (the geojson simply doesn't load; the base map still renders).
// --------------------------------------------------------------------------- #
// Nationwide highlight
//
// Alerts scoped to a whole country paint that country's polygon. The polygons
// are *already* in the map — lib/mapStyle.ts draws `land` and `coast` from the
// demotiles `countries` source-layer — so this is two more layers on a source
// that's already loaded: no extra data, no fetch, no token, no PostGIS.
//
// That layer identifies countries by `ADM0_A3` — Natural Earth's own code,
// which is *not* always the ISO 3166-1 alpha-3 code (South Sudan: ISO `SSD`,
// tiles `SDS`). The ISO3 table is generated straight from that field, see
// lib/countries.ts. Its tiles stop at z6, but MapLibre overzooms them, so the
// fill still renders across the dashboard's 1.5–8 range with z6 border
// precision — invisible at country scale.
//
// Two caveats worth knowing. Natural Earth splits Somaliland out of Somalia in
// some builds, so a SO highlight may not cover the north-west. And nine
// microstates and territories (Vatican City, Nauru, Tuvalu, Gibraltar, Macau,
// Anguilla, Saint Barthélemy, Pitcairn, US Minor Outlying Islands) have no
// polygon at all in the world tile — they are sub-pixel at that scale, so a
// nationwide highlight there paints nothing. Point-scope locations are fine.
// --------------------------------------------------------------------------- #

const FILL_LAYER = 'nationwide-fill'
const LINE_LAYER = 'nationwide-line'

/** Build the paint expression: each highlighted country gets its severity
 *  colour, everything else stays fully transparent. */
function colourByCountry(colours: Record<string, string>): ExpressionSpecification | string {
  const entries = Object.entries(colours)
  if (entries.length === 0) return 'rgba(0,0,0,0)'
  // Built by spreading, which TS can't reconcile with the tuple shape the
  // expression spec declares — the runtime form is exactly what MapLibre wants.
  return [
    'match',
    ['get', 'ADM0_A3'],
    ...entries.flatMap(([iso2, colour]) => [ISO3[iso2] ?? iso2, colour]),
    'rgba(0,0,0,0)',
  ] as unknown as ExpressionSpecification
}

/** Paint (or repaint) the nationwide country highlights.
 *
 * `colours` maps ISO2 → colour, already reduced to one colour per country by
 * the caller (two alerts on one country must not stack two washes).
 *
 * The layers are inserted *below* the province lines and city labels so the
 * wash never buries the map's own detail, and the fill is kept translucent so
 * point markers sitting on top of a highlighted country stay readable.
 */
const ZONE_SOURCE = 'alert-zones'
const ZONE_FILL = 'alert-zone-fill'
const ZONE_LINE = 'alert-zone-line'

/** One drawn area, already reduced to a single colour by the caller. */
export interface ZoneShape {
  code: string
  name: string
  colour: string
  geometry: { type: 'Polygon'; coordinates: number[][][] }
}

/**
 * Paint the custom zones carried by the current alert set.
 *
 * A GeoJSON source rather than the demotiles trick the nationwide washes use:
 * we own this geometry, so there is nothing to key on and no ADM0_A3-vs-ISO
 * mismatch to fall foul of. Each alert carries its own copy of the shape, which
 * is what lets an alert keep drawing the way it was filed after someone edits
 * the master zone.
 *
 * Overlapping zones reduce to one fill at the worst severity before they get
 * here, mirroring `buildClusters` and the country washes: two translucent fills
 * stacked read as a third colour that means nothing.
 */
export function setZoneShapes(map: maplibregl.Map, shapes: ZoneShape[]): void {
  if (!map.getStyle()) return
  const data: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: shapes.map((z) => ({
      type: 'Feature',
      properties: { code: z.code, name: z.name, colour: z.colour },
      geometry: z.geometry,
    })),
  }

  const existing = map.getSource(ZONE_SOURCE) as maplibregl.GeoJSONSource | undefined
  if (existing) {
    existing.setData(data)
    return
  }

  map.addSource(ZONE_SOURCE, { type: 'geojson', data })
  // Same insertion rule as the country washes: below the province lines and
  // city labels so the fill never buries the map detail, falling back to the
  // city dots because the province layers load lazily.
  const before = ['ne-province-line', 'ne-city-point'].find((id) => map.getLayer(id))
  map.addLayer(
    {
      id: ZONE_FILL,
      type: 'fill',
      source: ZONE_SOURCE,
      paint: { 'fill-color': ['get', 'colour'], 'fill-opacity': 0.22 },
    },
    before,
  )
  map.addLayer(
    {
      id: ZONE_LINE,
      type: 'line',
      source: ZONE_SOURCE,
      paint: {
        'line-color': ['get', 'colour'],
        'line-width': ['interpolate', ['linear'], ['zoom'], 2, 1.2, 5, 2.2, 8, 3],
        'line-opacity': 0.9,
      },
    },
    before,
  )
}


export function setNationwideHighlights(
  map: maplibregl.Map,
  colours: Record<string, string>,
): void {
  if (!map.getStyle()) return

  if (!map.getLayer(FILL_LAYER)) {
    // Insert beneath the detail overlay when it's already present, so the wash
    // sits between the base land fill and the province/city detail. The province
    // layers load lazily (see addDetailOverlay), so fall back to the city dots —
    // otherwise the wash is added on top and buries every city label until the
    // user happens to zoom in far enough to trigger the province fetch.
    const before = ['ne-province-line', 'ne-city-point'].find((id) => map.getLayer(id))
    map.addLayer(
      {
        id: FILL_LAYER,
        type: 'fill',
        source: 'demotiles',
        'source-layer': 'countries',
        paint: { 'fill-color': colourByCountry(colours), 'fill-opacity': 0.22 },
      },
      before,
    )
    map.addLayer(
      {
        id: LINE_LAYER,
        type: 'line',
        source: 'demotiles',
        'source-layer': 'countries',
        paint: {
          'line-color': colourByCountry(colours),
          'line-width': ['interpolate', ['linear'], ['zoom'], 2, 1.2, 5, 2.2, 8, 3],
          'line-opacity': 0.9,
        },
      },
      before,
    )
    return
  }

  map.setPaintProperty(FILL_LAYER, 'fill-color', colourByCountry(colours))
  map.setPaintProperty(LINE_LAYER, 'line-color', colourByCountry(colours))
  warnOnUnmatchedCountries(map, colours)
}

/** Dev-only: shout if a highlighted country matched no polygon.
 *
 * `ADM0_A3` is Natural Earth's code rather than a guaranteed ISO3, so a wrong
 * entry in the ISO3 table fails *silently* — the country simply never paints,
 * which is indistinguishable from "no alert there". This turns that into a
 * console warning naming the country. Only meaningful once tiles are loaded,
 * and only checks countries currently in view, so it never fires in production.
 */
function warnOnUnmatchedCountries(map: maplibregl.Map, colours: Record<string, string>): void {
  if (!import.meta.env.DEV || !map.isSourceLoaded('demotiles')) return
  const present = new Set(
    map
      .querySourceFeatures('demotiles', { sourceLayer: 'countries' })
      .map((f) => f.properties?.ADM0_A3),
  )
  if (present.size === 0) return // no tiles decoded yet — nothing to conclude
  const missing = Object.keys(colours).filter((iso2) => !present.has(ISO3[iso2] ?? iso2))
  if (missing.length > 0) {
    console.warn(
      '[SWAN] Nationwide highlight matched no polygon for:',
      missing.map((cc) => `${cc}→${ISO3[cc] ?? '?'}`).join(', '),
      '— check the ISO3 table in lib/countries.ts against the tileset ADM0_A3 values.',
    )
  }
}

/** Zoom at which the province boundaries first become visible.
 *
 * Must stay in step with the `line-opacity` ramp below, which is fully
 * transparent until z3. Nothing is gained by fetching the file before this. */
const PROVINCE_MIN_ZOOM = 3

export function addDetailOverlay(map: maplibregl.Map): void {
  if (map.getSource('ne-cities')) return // idempotent

  map.addSource('ne-cities', { type: 'geojson', data: '/geo/world_cities.geojson' })

  map.addLayer({
    id: 'ne-city-point',
    type: 'circle',
    source: 'ne-cities',
    minzoom: 3.5,
    paint: {
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        3.5, ['case', ['==', ['get', 'cap'], 1], 2, 1.1],
        6, ['case', ['==', ['get', 'cap'], 1], 3.4, 2.2],
        9, ['case', ['==', ['get', 'cap'], 1], 4.4, 3.2],
      ],
      'circle-color': ['case', ['==', ['get', 'cap'], 1], '#EED58E', '#D6E0EC'],
      'circle-opacity': ['interpolate', ['linear'], ['zoom'], 3.5, 0, 4.5, 0.7],
      'circle-stroke-color': '#0B1729',
      'circle-stroke-width': 0.6,
      'circle-stroke-opacity': ['interpolate', ['linear'], ['zoom'], 3.5, 0, 4.5, 0.7],
    },
  })

  map.addLayer({
    id: 'ne-city-label',
    type: 'symbol',
    source: 'ne-cities',
    minzoom: 4,
    layout: {
      'text-field': ['coalesce', ['get', 'name'], ''],
      'text-font': ['Noto Sans Regular'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 4, 9.5, 8, 12.5],
      'text-offset': [0, 0.9],
      'text-anchor': 'top',
      'text-max-width': 8,
      // Lower scalerank = more important city; place those first so the majors
      // survive collision when zoomed out.
      'symbol-sort-key': ['to-number', ['get', 'rank']],
    },
    paint: {
      'text-color': '#C9D5E3',
      'text-halo-color': '#0B1729',
      'text-halo-width': 1.3,
      'text-opacity': ['interpolate', ['linear'], ['zoom'], 4, 0, 4.6, 1],
    },
  })

  // Provinces are fetched on demand, cities are not. Worldwide admin-1 is 6.7 MB
  // against the cities' 1.3 MB, and the dashboard opens at z2.4 where the
  // boundaries are fully transparent — so eager-loading it would spend the
  // biggest asset in the app on something nobody can see. Most sessions never
  // zoom past a continent and never pay for it at all.
  if (map.getZoom() >= PROVINCE_MIN_ZOOM) {
    addProvinces(map)
    return
  }
  const onZoom = () => {
    if (map.getZoom() < PROVINCE_MIN_ZOOM) return
    map.off('zoom', onZoom)
    addProvinces(map)
  }
  map.on('zoom', onZoom)
}

/** Add the province boundary + label layers, beneath the city dots.
 *
 * `beforeId` matters: these arrive after the city layers rather than before
 * them, so without it MapLibre stacks province labels on top of city labels and
 * the two collide for space with the wrong one winning.
 */
function addProvinces(map: maplibregl.Map): void {
  if (map.getSource('ne-provinces') || !map.getStyle()) return

  map.addSource('ne-provinces', { type: 'geojson', data: '/geo/world_provinces.geojson' })
  const before = map.getLayer('ne-city-point') ? 'ne-city-point' : undefined

  map.addLayer(
    {
      id: 'ne-province-line',
      type: 'line',
      source: 'ne-provinces',
      paint: {
        'line-color': '#3A5C89',
        'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.3, 6, 1, 9, 1.4],
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 3, 0, 4.2, 0.4, 6, 0.62],
      },
    },
    before,
  )

  map.addLayer(
    {
      id: 'ne-province-label',
      type: 'symbol',
      source: 'ne-provinces',
      minzoom: 4.3,
      layout: {
        'text-field': ['coalesce', ['get', 'name'], ''],
        'text-font': ['Open Sans Semibold'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 4.5, 9, 7, 12],
        'text-transform': 'uppercase',
        'text-letter-spacing': 0.08,
        'text-max-width': 7,
        'text-padding': 6,
      },
      paint: {
        'text-color': '#8AA0BE',
        'text-halo-color': '#0B1729',
        'text-halo-width': 1.2,
        'text-opacity': ['interpolate', ['linear'], ['zoom'], 4.3, 0, 5, 0.85],
      },
    },
    before,
  )
}
