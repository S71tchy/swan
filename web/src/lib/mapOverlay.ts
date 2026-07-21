import type maplibregl from 'maplibre-gl'

// Natural Earth detail overlay: admin-1 provinces (boundaries + labels) and
// populated places (city dots + labels), filtered to Africa and simplified.
// Public-domain data bundled at /geo/*.geojson — no tiles token. Labels/dots
// fade in as you zoom, and MapLibre's collision detection thins city labels so
// only the major ones show when zoomed out. Degrades gracefully offline (the
// geojson simply doesn't load; the base map still renders).
export function addDetailOverlay(map: maplibregl.Map): void {
  if (map.getSource('ne-provinces')) return // idempotent

  map.addSource('ne-provinces', { type: 'geojson', data: '/geo/africa_provinces.geojson' })
  map.addSource('ne-cities', { type: 'geojson', data: '/geo/africa_cities.geojson' })

  map.addLayer({
    id: 'ne-province-line',
    type: 'line',
    source: 'ne-provinces',
    paint: {
      'line-color': '#3A5C89',
      'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.3, 6, 1, 9, 1.4],
      'line-opacity': ['interpolate', ['linear'], ['zoom'], 3, 0, 4.2, 0.4, 6, 0.62],
    },
  })

  map.addLayer({
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
  })

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
}
