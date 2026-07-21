import type { StyleSpecification } from 'maplibre-gl'

// Muted dark-blue map style matching the mock (sea #0B1729, land #1E3556,
// coast #2C4A76). Uses MapLibre's free demo vector tiles — no API token. If the
// tiles fail to load (e.g. offline), the navy background still renders and
// lat/lng markers remain correctly projected, so the app degrades gracefully.
export const swanMapStyle: StyleSpecification = {
  version: 8,
  name: 'SWAN Ops Deck',
  // Fonts for label layers (province/city names in the detail overlay). Served
  // by the same token-free demotiles host we already use for tiles; only fetched
  // once you zoom in far enough for labels to appear.
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {
    demotiles: {
      type: 'vector',
      url: 'https://demotiles.maplibre.org/tiles/tiles.json',
    },
  },
  layers: [
    { id: 'sea', type: 'background', paint: { 'background-color': '#0B1729' } },
    {
      id: 'land',
      type: 'fill',
      source: 'demotiles',
      'source-layer': 'countries',
      paint: { 'fill-color': '#1E3556' },
    },
    {
      id: 'coast',
      type: 'line',
      source: 'demotiles',
      'source-layer': 'countries',
      paint: { 'line-color': '#2C4A76', 'line-width': 1 },
    },
  ],
}
