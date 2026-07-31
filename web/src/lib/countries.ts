/** Country geography for nationwide ("whole country") alert scope.
 *
 * Two lookups, both keyed on the ISO2 code the rest of the app already uses
 * (`LocationBlock.country`, the rights perimeters, `reference.py`):
 *
 *  - `ISO3` — because the map's country polygons are keyed on ISO3, not ISO2.
 *  - `CENTROID` — a representative point, because `LocationBlock.lat/lng` are
 *    required and the marker clustering, `flyTo` and map search all rely on
 *    every location having coordinates.
 */

/** ISO2 → ISO3.
 *
 * The dashboard's base map already draws country polygons from MapLibre's
 * demotiles (`source-layer: 'countries'`, see lib/mapStyle.ts), and that layer
 * identifies countries by `ADM0_A3` — Natural Earth's code, which equals ISO3
 * for every sovereign African state. See `nationwideFilter` in lib/mapOverlay.ts
 * for the one known caveat (Somaliland).
 */
export const ISO3: Record<string, string> = {
  DZ: 'DZA', AO: 'AGO', BJ: 'BEN', BW: 'BWA', BF: 'BFA', BI: 'BDI', CV: 'CPV',
  CM: 'CMR', CF: 'CAF', TD: 'TCD', KM: 'COM', CG: 'COG', CD: 'COD', CI: 'CIV',
  DJ: 'DJI', EG: 'EGY', GQ: 'GNQ', ER: 'ERI', SZ: 'SWZ', ET: 'ETH', GA: 'GAB',
  GM: 'GMB', GH: 'GHA', GN: 'GIN', GW: 'GNB', KE: 'KEN', LS: 'LSO', LR: 'LBR',
  LY: 'LBY', MG: 'MDG', MW: 'MWI', ML: 'MLI', MR: 'MRT', MU: 'MUS', MA: 'MAR',
  MZ: 'MOZ', NA: 'NAM', NE: 'NER', NG: 'NGA', RW: 'RWA', ST: 'STP', SN: 'SEN',
  SC: 'SYC', SL: 'SLE', SO: 'SOM', ZA: 'ZAF', SS: 'SSD', SD: 'SDN', TZ: 'TZA',
  TG: 'TGO', TN: 'TUN', UG: 'UGA', ZM: 'ZMB', ZW: 'ZWE',
}

/** ISO2 → [lng, lat] land centroid.
 *
 * Deliberately a static table rather than derived from the `places` gazetteer:
 * that table is ports and coastal cities, so averaging it drags every centroid
 * out to sea (Nigeria's would land in the Bight of Benin). These are interior
 * points — they only have to place a marker sensibly inside the country, not be
 * survey-accurate.
 */
export const CENTROID: Record<string, [number, number]> = {
  DZ: [2.6, 28.0], AO: [17.9, -11.2], BJ: [2.3, 9.6], BW: [24.7, -22.3],
  BF: [-1.6, 12.3], BI: [29.9, -3.4], CV: [-23.6, 15.9], CM: [12.4, 5.7],
  CF: [20.9, 6.6], TD: [18.7, 15.5], KM: [43.9, -11.7], CG: [15.3, -0.7],
  CD: [23.6, -3.4], CI: [-5.5, 7.6], DJ: [42.6, 11.8], EG: [29.9, 26.8],
  GQ: [10.5, 1.6], ER: [39.0, 15.2], SZ: [31.5, -26.5], ET: [39.8, 9.1],
  GA: [11.8, -0.8], GM: [-15.4, 13.4], GH: [-1.0, 7.9], GN: [-10.9, 10.4],
  GW: [-15.0, 12.0], KE: [37.9, 0.2], LS: [28.2, -29.6], LR: [-9.4, 6.4],
  LY: [17.2, 26.3], MG: [46.9, -18.8], MW: [34.3, -13.3], ML: [-4.0, 17.6],
  MR: [-10.9, 20.3], MU: [57.6, -20.3], MA: [-7.1, 31.8], MZ: [35.5, -18.7],
  NA: [17.1, -22.6], NE: [8.1, 17.6], NG: [8.7, 9.1], RW: [29.9, -1.9],
  ST: [6.6, 0.2], SN: [-14.5, 14.5], SC: [55.5, -4.7], SL: [-11.8, 8.5],
  SO: [46.2, 5.2], ZA: [24.7, -29.0], SS: [30.2, 7.9], SD: [30.2, 15.6],
  TZ: [34.9, -6.4], TG: [0.8, 8.6], TN: [9.5, 33.9], UG: [32.3, 1.4],
  ZM: [27.8, -13.1], ZW: [29.2, -19.0],
}

/** The synthetic place code a nationwide block carries.
 *
 * Marker clustering keys on `location.code` (see `buildClusters`), so every
 * nationwide block for a country must share one code to collapse into a single
 * marker — and it must not collide with a real LOCODE from the gazetteer.
 */
export function nationwideCode(country: string): string {
  return `${country.toUpperCase()}-NATIONWIDE`
}
