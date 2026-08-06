-- =====================================================================
--  SWAN — seed the editable taxonomy (categories + industries)
--  Empty tables = nothing to classify an alert with = no alert can be
--  created. Safe to re-run: existing rows are left exactly as they are,
--  so operator renames survive.
-- =====================================================================

INSERT INTO categories (name, sub_categories, position, created_at) VALUES
  ('Weather', '["Cyclone", "Flood", "Storm", "Heat", "Swell"]'::json, 0, (now() AT TIME ZONE 'utc')),
  ('Strike', '["Port workers", "Road transport", "Customs", "General"]'::json, 1, (now() AT TIME ZONE 'utc')),
  ('Congestion', '["Port congestion", "Anchorage queue", "Border queue"]'::json, 2, (now() AT TIME ZONE 'utc')),
  ('Security', '["Civil unrest", "Piracy", "Theft", "Conflict"]'::json, 3, (now() AT TIME ZONE 'utc')),
  ('Regulatory', '["Customs", "Transit bond", "Tariff", "Sanctions"]'::json, 4, (now() AT TIME ZONE 'utc')),
  ('Health', '["Epidemic", "Port health measure", "Border health check"]'::json, 5, (now() AT TIME ZONE 'utc')),
  ('Infrastructure', '["Rail works", "Road closure", "Port equipment", "Power"]'::json, 6, (now() AT TIME ZONE 'utc')),
  ('Accident', '["Vessel", "Derailment", "Road accident", "Fire"]'::json, 7, (now() AT TIME ZONE 'utc'))
ON CONFLICT (name) DO NOTHING;

INSERT INTO industries (name, position, created_at) VALUES
  ('All industries', 0, (now() AT TIME ZONE 'utc')),
  ('Agriculture', 1, (now() AT TIME ZONE 'utc')),
  ('Mining & Metals', 2, (now() AT TIME ZONE 'utc')),
  ('Oil & Gas', 3, (now() AT TIME ZONE 'utc')),
  ('Retail & FMCG', 4, (now() AT TIME ZONE 'utc')),
  ('Automotive', 5, (now() AT TIME ZONE 'utc')),
  ('Project Cargo', 6, (now() AT TIME ZONE 'utc'))
ON CONFLICT (name) DO NOTHING;

-- Verify: expect at least 8 categories and 7 industries
SELECT (SELECT count(*) FROM categories) AS categories,
       (SELECT count(*) FROM industries) AS industries;
