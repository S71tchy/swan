-- =====================================================================
--  SWAN — seed the `places` gazetteer (location master data)
--  The create-alert location picker types ahead against this table.
--  Empty table = no location can ever be chosen = no alert can be made.
--  Safe to re-run (idempotent).
-- =====================================================================

INSERT INTO places (code, name, country, lat, lng, aliases, created_at) VALUES
  ('MZBEW', 'Beira', 'MZ', -19.83, 34.84, '[]'::json, (now() AT TIME ZONE 'utc')),
  ('MZMPM', 'Maputo', 'MZ', -25.97, 32.57, '[]'::json, (now() AT TIME ZONE 'utc')),
  ('MZMNC', 'Nacala', 'MZ', -14.54, 40.67, '[]'::json, (now() AT TIME ZONE 'utc')),
  ('CIABJ', 'Abidjan', 'CI', 5.32, -4.02, '[]'::json, (now() AT TIME ZONE 'utc')),
  ('CISPY', 'San-Pédro', 'CI', 4.75, -6.64, '["san pedro"]'::json, (now() AT TIME ZONE 'utc')),
  ('NGAPP', 'Lagos — Apapa', 'NG', 6.45, 3.36, '["apapa"]'::json, (now() AT TIME ZONE 'utc')),
  ('NGTIN', 'Tin Can Island', 'NG', 6.44, 3.34, '[]'::json, (now() AT TIME ZONE 'utc')),
  ('NGONN', 'Onne', 'NG', 4.7, 7.15, '[]'::json, (now() AT TIME ZONE 'utc')),
  ('GHTEM', 'Tema', 'GH', 5.67, 0.02, '[]'::json, (now() AT TIME ZONE 'utc')),
  ('GHTKD', 'Takoradi', 'GH', 4.88, -1.75, '[]'::json, (now() AT TIME ZONE 'utc')),
  ('ZADUR', 'Durban', 'ZA', -29.87, 31.03, '[]'::json, (now() AT TIME ZONE 'utc')),
  ('ZACPT', 'Cape Town', 'ZA', -33.9, 18.43, '[]'::json, (now() AT TIME ZONE 'utc')),
  ('ZAPLZ', 'Port Elizabeth', 'ZA', -33.96, 25.63, '["gqeberha"]'::json, (now() AT TIME ZONE 'utc')),
  ('KEMBA', 'Mombasa', 'KE', -4.04, 39.67, '[]'::json, (now() AT TIME ZONE 'utc')),
  ('KENBO', 'Nairobi ICD', 'KE', -1.32, 36.85, '["nairobi"]'::json, (now() AT TIME ZONE 'utc')),
  ('TZDAR', 'Dar es Salaam', 'TZ', -6.82, 39.28, '[]'::json, (now() AT TIME ZONE 'utc')),
  ('EGSUZ', 'Suez Canal', 'EG', 30.03, 32.55, '["suez"]'::json, (now() AT TIME ZONE 'utc')),
  ('EGALY', 'Alexandria', 'EG', 31.2, 29.92, '[]'::json, (now() AT TIME ZONE 'utc')),
  ('CDKAS', 'Kasumbalesa border', 'CD', -12.25, 27.8, '["kasumbalesa"]'::json, (now() AT TIME ZONE 'utc')),
  ('CDMAT', 'Matadi', 'CD', -5.82, 13.46, '[]'::json, (now() AT TIME ZONE 'utc')),
  ('SNDKR', 'Dakar', 'SN', 14.68, -17.42, '[]'::json, (now() AT TIME ZONE 'utc')),
  ('CMDLA', 'Douala', 'CM', 4.05, 9.7, '[]'::json, (now() AT TIME ZONE 'utc')),
  ('AOLAD', 'Luanda', 'AO', -8.78, 13.24, '[]'::json, (now() AT TIME ZONE 'utc')),
  ('AOLOB', 'Lobito', 'AO', -12.35, 13.55, '[]'::json, (now() AT TIME ZONE 'utc')),
  ('NAWVB', 'Walvis Bay', 'NA', -22.96, 14.51, '[]'::json, (now() AT TIME ZONE 'utc')),
  ('TGLFW', 'Lomé', 'TG', 6.13, 1.29, '["lome"]'::json, (now() AT TIME ZONE 'utc')),
  ('BJCOO', 'Cotonou', 'BJ', 6.35, 2.42, '[]'::json, (now() AT TIME ZONE 'utc')),
  ('MAPTM', 'Tanger Med', 'MA', 35.88, -5.52, '["tangier", "tanger"]'::json, (now() AT TIME ZONE 'utc')),
  ('MACAS', 'Casablanca', 'MA', 33.6, -7.62, '[]'::json, (now() AT TIME ZONE 'utc')),
  ('DJJIB', 'Port of Djibouti', 'DJ', 11.6, 43.14, '["djibouti"]'::json, (now() AT TIME ZONE 'utc'))
ON CONFLICT (code) DO UPDATE SET
  name    = EXCLUDED.name,
  country = EXCLUDED.country,
  lat     = EXCLUDED.lat,
  lng     = EXCLUDED.lng,
  aliases = EXCLUDED.aliases;

-- Verify: expect 30
SELECT count(*) AS places FROM places;
