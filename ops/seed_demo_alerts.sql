-- =====================================================================
--  SWAN — demo seed: a worldwide network of alerts
--  PostgreSQL / Neon. Paste into the Neon SQL Editor and run.
--
--  Inserts 159 alerts across five continents: every severity, every
--  category, every lifecycle state, and 19 whole-country fills
--  alongside the point locations — enough that the map, the live feed, the approval queue
--  and "My alerts" all have something to show without clicking through
--  and creating it first.
--
--  Safe to re-run. Every row is id-prefixed `demo-`, and the script
--  deletes those before inserting, so re-running refreshes the data
--  (and re-anchors every date to today) without touching real alerts.
--  To remove the demo data entirely, see the last line of this file.
--
--  PREREQUISITES
--    1. `places` must be seeded — run ops/seed_places.sql first.
--       Alerts whose location code is missing are silently DROPPED by
--       the join, so check the verification query at the bottom.
--    2. At least one row in `users`. Authors are matched by email
--       (the seeded cast: a.kouassi@, c.diallo@, m.nunes@, y.traore@,
--       e.mensah@, s.naidoo@, j.otieno@, h.farouk@, k.mwansa@ …
--       @aglgroup.com). Any email not present falls back to the oldest
--       user, so the script never fails on a database with a different
--       cast — it just attributes those alerts to that one person.
--
--  NOTES ON THE DATA
--    * Dates are relative to CURRENT_DATE at run time, so the alert
--      set is always "live today" whenever you run it. The prose
--      deliberately says "within 72 hours" / "next month" rather than
--      naming a date, so nothing can contradict the validity window.
--    * `valid_from`/`valid_to` control MAP VISIBILITY, not event
--      timing. NULL valid_to = "until further notice". A handful of
--      alerts are deliberately future-dated or already expired: those
--      appear in the feed but not on the map, which is why the
--      dashboard's "active" count is lower than the feed count.
--    * Submitted alerts are authored by people who lack publication
--      rights for that country, which is what routes them to the
--      approval queue. Who sees them depends on your rights setup.
--    * Location JSON is built FROM the `places` table rather than
--      written out by hand, so the coordinates and names can never
--      drift from the gazetteer the picker uses. Flag emoji are
--      derived from the ISO2 code (chr(0x1F1E6 + offset)), which also
--      keeps this file free of emoji literals.
--    * No pictures: `picture_url` inlines the image as a data URI, so
--      90 illustrated alerts would put megabytes into every map
--      response. Add one from the create form during the demo.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 0. Pre-flight. Run these two on their own FIRST.
--    Expect: places = 150, and at least one user.
-- ---------------------------------------------------------------------
SELECT (SELECT count(*) FROM places) AS places,
       (SELECT count(*) FROM users)  AS users,
       (SELECT count(*) FROM alerts) AS alerts_before;

SELECT email, name, role_label FROM users ORDER BY created_at;


BEGIN;

-- ---------------------------------------------------------------------
-- 1. Clear any previous run of this script (and nothing else).
-- ---------------------------------------------------------------------
DELETE FROM alerts WHERE id LIKE 'demo-%';


-- ---------------------------------------------------------------------
-- 1b. One category this data needs that the code list does not carry.
--
--     The Nigeria election alert is filed under `Political`, which is
--     not in `enums.CATEGORIES`. The taxonomy is operator-owned at
--     runtime (/admin/categories), so the demo adds the category rather
--     than mislabelling an election as something else — otherwise the
--     alert renders fine but the category cannot be picked again in the
--     create form, and the Categories screen would not list it.
--
--     Guarded on the table existing, because the taxonomy tables are an
--     Alembic migration on PostgreSQL (c1a7f2e40b18 — see
--     ops/migrate_taxonomy_tables.sql). Without the guard, an
--     unmigrated database would abort this whole transaction and you
--     would get no alerts at all.
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.categories') IS NOT NULL THEN
    INSERT INTO categories (name, sub_categories, position, created_at)
    VALUES ('Political',
            '["Election", "Policy change", "Sanctions", "Civil unrest"]'::json,
            8, (now() AT TIME ZONE 'utc'))
    ON CONFLICT (name) DO NOTHING;
  END IF;
END $$;


-- ---------------------------------------------------------------------
-- 1c. Regional authors.
--
--     A worldwide alert set needs worldwide authors. `app/seed.py`
--     seeds nine identities, all African branches — without these nine,
--     roughly 100 of the alerts below would fall back to the oldest
--     user, so one person would appear to have written most of the
--     network and "My alerts" would be unusable.
--
--     Rights are explicit country lists rather than profiles, because
--     the only profiles that exist are WORLD / WEST-AFRICA /
--     SOUTHERN-AFRICA / EAST-AFRICA — assigning a profile name that is
--     not in `profiles` grants nothing at all.
--
--     J. Petit is deliberately given NO publication rights: he is the
--     European field contributor, so what he files routes to L. van
--     Dijk's approval queue. That is what fills the Europe queue below.
--
--     Password for all of them is `swan1234` (the same PBKDF2 hash the
--     seed script uses), so they work with both the dev identity
--     switcher and the email/password form.
--
--     ON CONFLICT DO NOTHING: if you already have these emails, your
--     rows win and nothing here is overwritten.
-- ---------------------------------------------------------------------
INSERT INTO users (
  id, email, name, initials, job_title, branch, role_label,
  home_country, home_country_name, phone, locale, timezone, avatar_gold,
  password_hash, status, can_create, is_rights_manager,
  internal_pub_countries, external_pub_countries, client_scope, profiles,
  created_at
) VALUES
  ('demo-user-vandijk', 'l.vandijk@aglgroup.com', 'L. van Dijk', 'LD',
   'Regional Operations Manager', 'Rotterdam hub', 'Country/Region Publisher',
   'NL', 'Netherlands', '', 'en', 'Europe/Amsterdam', false,
   'pbkdf2_sha256$200000$da347416233d98ae659a986d82b32b80$12136004652d6aa6e644812ba3d3714dad993577de9c1c11a1c25f41982fa105',
   'active', true, false,
   '["NL","BE","DE","FR","ES","IT","GR","GB","IE","PT","PL","SE","DK","NO","FI","UA","LT","LV","HR","SI","MT","RU"]'::json,
   '["NL","BE","DE"]'::json, '[]'::json, '[]'::json, (now() AT TIME ZONE 'utc')),

  ('demo-user-petit', 'j.petit@aglgroup.com', 'J. Petit', 'JP',
   'Terminal Supervisor', 'Le Havre terminal', 'Field Contributor',
   'FR', 'France', '', 'fr', 'Europe/Paris', false,
   'pbkdf2_sha256$200000$da347416233d98ae659a986d82b32b80$12136004652d6aa6e644812ba3d3714dad993577de9c1c11a1c25f41982fa105',
   'active', true, false,
   '[]'::json, '[]'::json, '[]'::json, '[]'::json, (now() AT TIME ZONE 'utc')),

  ('demo-user-haddad', 'a.haddad@aglgroup.com', 'A. Haddad', 'AH',
   'Gulf Operations Manager', 'Dubai office', 'Country/Region Publisher',
   'AE', 'United Arab Emirates', '', 'en', 'Asia/Dubai', false,
   'pbkdf2_sha256$200000$da347416233d98ae659a986d82b32b80$12136004652d6aa6e644812ba3d3714dad993577de9c1c11a1c25f41982fa105',
   'active', true, false,
   '["AE","SA","OM","QA","KW","IQ","IR","TR"]'::json,
   '["AE"]'::json, '[]'::json, '[]'::json, (now() AT TIME ZONE 'utc')),

  ('demo-user-raghavan', 'p.raghavan@aglgroup.com', 'P. Raghavan', 'PR',
   'Subcontinent Operations', 'Mumbai office', 'Country/Region Publisher',
   'IN', 'India', '', 'en', 'Asia/Kolkata', false,
   'pbkdf2_sha256$200000$da347416233d98ae659a986d82b32b80$12136004652d6aa6e644812ba3d3714dad993577de9c1c11a1c25f41982fa105',
   'active', true, false,
   '["IN","LK","BD","PK"]'::json, '[]'::json, '[]'::json, '[]'::json,
   (now() AT TIME ZONE 'utc')),

  ('demo-user-chen', 'w.chen@aglgroup.com', 'W. Chen', 'WC',
   'Regional Operations Manager', 'Singapore hub', 'Country/Region Publisher',
   'SG', 'Singapore', '', 'en', 'Asia/Singapore', false,
   'pbkdf2_sha256$200000$da347416233d98ae659a986d82b32b80$12136004652d6aa6e644812ba3d3714dad993577de9c1c11a1c25f41982fa105',
   'active', true, false,
   '["SG","MY","TH","VN","ID","PH"]'::json,
   '["SG"]'::json, '[]'::json, '[]'::json, (now() AT TIME ZONE 'utc')),

  ('demo-user-tanaka', 'h.tanaka@aglgroup.com', 'H. Tanaka', 'HT',
   'North Asia Operations', 'Tokyo office', 'Country/Region Publisher',
   'JP', 'Japan', '', 'en', 'Asia/Tokyo', false,
   'pbkdf2_sha256$200000$da347416233d98ae659a986d82b32b80$12136004652d6aa6e644812ba3d3714dad993577de9c1c11a1c25f41982fa105',
   'active', true, false,
   '["JP","CN","HK","TW","KR"]'::json, '[]'::json, '[]'::json, '[]'::json,
   (now() AT TIME ZONE 'utc')),

  ('demo-user-whitfield', 'd.whitfield@aglgroup.com', 'D. Whitfield', 'DW',
   'North America Operations', 'Newark office', 'Country/Region Publisher',
   'US', 'United States', '', 'en', 'America/New_York', false,
   'pbkdf2_sha256$200000$da347416233d98ae659a986d82b32b80$12136004652d6aa6e644812ba3d3714dad993577de9c1c11a1c25f41982fa105',
   'active', true, false,
   '["US","CA","MX","PA","JM","DO","BS"]'::json,
   '["US"]'::json, '[]'::json, '[]'::json, (now() AT TIME ZONE 'utc')),

  ('demo-user-ferreira', 'c.ferreira@aglgroup.com', 'C. Ferreira', 'CF',
   'South America Operations', 'Santos office', 'Country/Region Publisher',
   'BR', 'Brazil', '', 'pt', 'America/Sao_Paulo', false,
   'pbkdf2_sha256$200000$da347416233d98ae659a986d82b32b80$12136004652d6aa6e644812ba3d3714dad993577de9c1c11a1c25f41982fa105',
   'active', true, false,
   '["BR","AR","CL","PE","CO","EC","UY"]'::json, '[]'::json, '[]'::json, '[]'::json,
   (now() AT TIME ZONE 'utc')),

  ('demo-user-hollis', 'b.hollis@aglgroup.com', 'B. Hollis', 'BH',
   'Oceania Operations', 'Sydney office', 'Country/Region Publisher',
   'AU', 'Australia', '', 'en', 'Australia/Sydney', false,
   'pbkdf2_sha256$200000$da347416233d98ae659a986d82b32b80$12136004652d6aa6e644812ba3d3714dad993577de9c1c11a1c25f41982fa105',
   'active', true, false,
   '["AU","NZ"]'::json, '[]'::json, '[]'::json, '[]'::json,
   (now() AT TIME ZONE 'utc'))
ON CONFLICT (email) DO NOTHING;


-- ---------------------------------------------------------------------
-- 2. Insert.
--
--    ctry  — ISO2 -> display name + interior point. The interior point
--            is only used by nationwide blocks; it is deliberately NOT
--            derived from `places`, which is ports only, so an averaged
--            centroid would land offshore.
--    node  — one lookup table covering both real gazetteer places
--            (keyed by LOCODE) and nationwide pseudo-places (keyed
--            '!XX'), so a location spec is a single join either way.
--    a     — the alert data. `loc_spec` is a comma-separated list of
--            KEY:modes:flow, modes space-separated. e.g.
--            'MZBEW:sea road:both' or '!NG:road rail air:both'.
--    spec  — loc_spec expanded to one row per location block.
--    locs  — those rows rebuilt as the JSON the app stores.
-- ---------------------------------------------------------------------
WITH ctry(code, name, lat, lng) AS (VALUES
  ('MZ', 'Mozambique', -13.94, 37.84),
  ('CI', 'Côte d''Ivoire', 7.49, -5.57),
  ('NG', 'Nigeria', 9.44, 7.50),
  ('GH', 'Ghana', 7.72, -1.04),
  ('ZA', 'South Africa', -29.71, 23.67),
  ('KE', 'Kenya', 0.55, 37.91),
  ('TZ', 'Tanzania', -6.05, 34.96),
  ('EG', 'Egypt', 26.19, 29.45),
  ('CD', 'DR Congo', -1.86, 23.46),
  ('SN', 'Senegal', 15.14, -14.78),
  ('CM', 'Cameroon', 4.59, 12.47),
  ('AO', 'Angola', -12.18, 17.98),
  ('NA', 'Namibia', -20.58, 17.11),
  ('TG', 'Togo', 8.81, 1.06),
  ('BJ', 'Benin', 10.32, 2.35),
  ('MA', 'Morocco', 31.65, -7.19),
  ('DJ', 'Djibouti', 11.98, 42.50),
  ('CN', 'People''s Republic of China', 32.50, 106.34),
  ('HK', 'Hong Kong', 22.45, 114.10),
  ('SG', 'Singapore', 1.37, 103.82),
  ('KR', 'South Korea', 36.38, 128.13),
  ('JP', 'Japan', 36.14, 138.44),
  ('TW', 'Taiwan', 23.65, 120.87),
  ('MY', 'Malaysia', 2.53, 113.84),
  ('TH', 'Thailand', 15.46, 101.07),
  ('VN', 'Vietnam', 21.72, 105.39),
  ('ID', 'Indonesia', -0.95, 101.89),
  ('PH', 'Philippines', 11.20, 122.47),
  ('IN', 'India', 22.69, 79.36),
  ('LK', 'Sri Lanka', 7.58, 80.70),
  ('BD', 'Bangladesh', 24.21, 89.68),
  ('PK', 'Pakistan', 29.33, 68.55),
  ('AE', 'United Arab Emirates', 23.47, 54.55),
  ('SA', 'Saudi Arabia', 23.81, 44.70),
  ('OM', 'Oman', 22.12, 57.34),
  ('QA', 'Qatar', 25.24, 51.14),
  ('KW', 'Kuwait', 29.41, 47.31),
  ('IQ', 'Iraq', 33.09, 43.26),
  ('IR', 'Iran', 32.17, 54.93),
  ('TR', 'Turkey', 39.35, 34.51),
  ('NL', 'Netherlands', 52.42, 5.61),
  ('BE', 'Belgium', 50.79, 4.80),
  ('DE', 'Germany', 50.96, 9.68),
  ('FR', 'France', 46.70, 2.55),
  ('ES', 'Spain', 40.09, -3.46),
  ('IT', 'Italy', 44.73, 11.08),
  ('GR', 'Greece', 39.49, 21.73),
  ('GB', 'United Kingdom', 54.40, -2.12),
  ('IE', 'Ireland', 53.08, -7.80),
  ('PT', 'Portugal', 39.61, -8.27),
  ('PL', 'Poland', 51.99, 19.49),
  ('SE', 'Sweden', 65.86, 19.02),
  ('DK', 'Denmark', 55.97, 9.02),
  ('NO', 'Norway', 61.36, 9.68),
  ('FI', 'Finland', 63.25, 27.28),
  ('RU', 'Russia', 58.25, 44.69),
  ('UA', 'Ukraine', 49.72, 32.14),
  ('LT', 'Lithuania', 55.10, 24.09),
  ('LV', 'Latvia', 57.07, 25.46),
  ('HR', 'Croatia', 45.81, 16.37),
  ('SI', 'Slovenia', 46.06, 14.92),
  ('MT', 'Malta', 35.89, 14.43),
  ('US', 'United States', 39.54, -97.48),
  ('CA', 'Canada', 60.32, -101.91),
  ('MX', 'Mexico', 23.92, -102.29),
  ('PA', 'Panama', 8.72, -80.35),
  ('BR', 'Brazil', -12.10, -49.56),
  ('AR', 'Argentina', -33.50, -64.17),
  ('CL', 'Chile', -38.15, -72.32),
  ('PE', 'Peru', -12.98, -72.90),
  ('CO', 'Colombia', 3.37, -73.17),
  ('EC', 'Ecuador', -1.26, -78.19),
  ('UY', 'Uruguay', -32.96, -55.97),
  ('JM', 'Jamaica', 18.14, -77.32),
  ('DO', 'Dominican Republic', 19.10, -70.65),
  ('BS', 'The Bahamas', 26.40, -77.15),
  ('AU', 'Australia', -24.13, 134.05),
  ('NZ', 'New Zealand', -39.76, 172.79)
),

node(key, name, code, country, lat, lng, scope) AS (
  SELECT p.code, p.name || ' (' || p.code || ')', p.code,
         p.country, p.lat::float8, p.lng::float8, 'point'
  FROM places p
  UNION ALL
  SELECT '!' || c.code, c.name, c.code || '-NATIONWIDE',
         c.code, c.lat::float8, c.lng::float8, 'country'
  FROM ctry c
),

-- =====================================================================
--  The alerts.
--
--  from_days / to_days are day offsets from today (to_days NULL =
--  "until further notice"). age_hours is how long ago it was published
--  or submitted — it drives created_at, which is what the feed sorts
--  by, so it also controls the order cards appear in.
-- =====================================================================
a(id, title, description, category, sub_category, industry, severity, status,
  from_days, to_days, age_hours, impacts, action_plan, loc_spec, urls,
  external_variant, rejection_comment, author_email) AS (VALUES

-- ------------------------------- AFRICA ------------------------------
  ('demo-af-beira-cyclone',
   'Cyclone Fenella — Port of Beira closure expected within 72h',
   'Category 3 system tracking toward the Sofala coast. Landfall near Beira is forecast within 72 hours, with sustained winds above 165 km/h and a 4–6 m storm surge.',
   'Weather', 'Cyclone', 'All industries', 'critical', 'published',
   0, 9, 6,
   'Berthing suspended once the port closes. Six scheduled calls affected; reefer capacity at the terminal is limited to 48h autonomy on generator power. The Beira–Machipanda corridor is at risk of washouts at three known low points.',
   'Divert transhipment to Durban and Dar es Salaam. Pre-position generator fuel at the Beira warehouse today. Hold export trucking out of Harare until the corridor is reassessed.',
   'MZBEW:sea road:both',
   '["https://gdacs.org/", "https://www.nhc.noaa.gov/"]',
   NULL::text, NULL::text,
   'm.nunes@aglgroup.com'),

  ('demo-af-durban-tos-outage',
   'Terminal operating system outage — Durban container terminals',
   'The terminal operating system has been offline across Pier 1 and Pier 2 since late last night. Manual gate processing is in place and no cause has been announced.',
   'Infrastructure', 'Port equipment', 'All industries', 'critical', 'published',
   -1, 4, 11,
   'Container handling is running at roughly 20% of plan. Truck turn times are past four hours and the pre-gate staging area is full. Vessel working is suspended on three berths.',
   'Stop sending trucks until the gate reopens — advise clients tonight, not tomorrow. Rebook time-critical reefer volumes via Cape Town. Take an hourly status from the terminal duty manager.',
   'ZADUR:sea road:both', '[]', NULL, NULL,
   's.naidoo@aglgroup.com'),

  ('demo-af-nigeria-election',
   'Presidential election — nationwide movement restrictions, Nigeria',
   'Federal elections are scheduled for the end of the month. Movement restrictions have been announced for polling day and the night before, with a heightened security posture through the results period.',
   'Political', 'Election', 'All industries', 'warning', 'published',
   0, 24, 7,
   'Inter-state road haulage suspended over the polling weekend nationwide. Apapa and Tin Can gate operations reduced; customs at limited staffing through the results period. Domestic air freight schedules thinned.',
   'Bring inland deliveries forward by a week. Hold outbound trucking over the polling weekend. Confirm bonded storage cover in Lagos and Kano. Daily security review until results are declared.',
   '!NG:road rail air:both',
   '["https://www.inecnigeria.org/"]', NULL, NULL,
   'c.diallo@aglgroup.com'),

  ('demo-af-abidjan-queue',
   'Anchorage queue at 19 vessels — Abidjan terminal',
   'Average berth wait is 4.2 days and rising after last weekend''s swell. Reefer plug availability is tight through next week.',
   'Congestion', 'Anchorage queue', 'All industries', 'warning', 'published',
   0, 8, 8,
   'Vessel bunching has pushed three services off schedule. Reefer plugs are at 91% of capacity and import dwell is up two days on the month.',
   'Prioritise reefer discharge. Advise import clients of a 3–4 day delay. Hold a nightly berth planning call until the queue clears.',
   'CIABJ:sea:import', '[]', NULL, NULL,
   'y.traore@aglgroup.com'),

  ('demo-af-kasumbalesa',
   'Customs go-slow at the Kasumbalesa border crossing',
   'Clearance staff are working to rule over an unpaid allowance dispute. Truck queues exceed 12 km on the Zambian side and clearance times have roughly tripled.',
   'Strike', 'Customs', 'Mining & Metals', 'warning', 'published',
   -1, NULL, 26,
   'Copperbelt export lanes delayed two to three days. Bonded warehouse space in Lubumbashi is filling, and three customers are already at their storage ceiling.',
   'Stagger truck dispatch across the day rather than the morning peak. Use Kazungula where the routing allows. Daily liaison with customs management.',
   'CDKAS:road:both', '[]', NULL, NULL,
   'k.mwansa@aglgroup.com'),

  ('demo-af-durban-swell',
   'Heavy swell advisory — Durban anchorage',
   'A 3–4 m south-easterly swell is forecast through the week. Pilotage may be suspended inside the peak windows.',
   'Weather', 'Swell', NULL, 'watch', 'published',
   -1, 3, 29,
   'Intermittent pilotage suspension is likely for the next three days, with knock-on berth slippage of up to 24 hours.',
   'Build schedule buffer. Confirm pilot windows each tide. Hold reefer gate-in if berthing slips past the nominated window.',
   'ZADUR:sea:both', '[]', NULL, NULL,
   's.naidoo@aglgroup.com'),

  ('demo-af-capetown-wind',
   'Crane stoppages in high wind — Cape Town Container Terminal',
   'A persistent south-easter is running above the 72 km/h crane operating limit. Ship-to-shore work has stopped in six separate windows over the last four days.',
   'Weather', 'Storm', 'Agriculture', 'warning', 'published',
   -2, 5, 40,
   'Roughly 14 working hours lost this week. Deciduous fruit export bookings are rolling to the next sailing and reefer stack occupancy is at 88%.',
   'Book contingency reefer plugs at the fruit terminal. Advise exporters that cut-offs may move at short notice. Reconfirm vessel ETAs each morning.',
   'ZACPT:sea:both', '[]', NULL, NULL,
   's.naidoo@aglgroup.com'),

  ('demo-af-mombasa-sgr',
   'Planned maintenance — Mombasa SGR freight window reduced',
   'Night freight paths are cut by 30% during track renewal between Mariakani and Miasenyi.',
   'Infrastructure', 'Rail works', NULL, 'watch', 'published',
   0, 6, 72,
   'Reduced SGR slots for the next week. Evacuation to the Nairobi ICD slows, and yard dwell at Mombasa is expected to rise by one to two days.',
   'Pre-clear priority boxes before the works window. Add a road shuttle for time-critical cargo. Advise inland clients of the slot reduction now.',
   'KEMBA:rail:both', '[]', NULL, NULL,
   'j.otieno@aglgroup.com'),

  ('demo-af-nairobi-icd',
   'Container dwell rising at the Nairobi Inland Container Depot',
   'Average dwell is at 6.8 days against a 4-day norm, following the reduced rail evacuation from Mombasa.',
   'Congestion', 'Port congestion', 'Retail & FMCG', 'watch', 'published',
   -3, 7, 54,
   'Empty return slots are constrained, and some clients are being charged detention they cannot avoid. Yard utilisation is at 94%.',
   'Book collection appointments before rail arrival, not after. Escalate detention waivers with the lines this week.',
   'KENBO:rail road:import', '[]', NULL, NULL,
   'j.otieno@aglgroup.com'),

  ('demo-af-suez-tariff',
   'Suez Canal transit fee revision effective next month',
   'The Canal Authority has published an average 7% uplift on container transits, effective from the first of next month. Carrier surcharge guidance is to follow.',
   'Regulatory', 'Tariff', 'All industries', 'info', 'published',
   18, NULL, 96,
   'Transit cost uplift on every Asia–Europe string AGL forwards on. A margin review is needed before the rate cards go out.',
   'Update rate cards ahead of the effective date. Notify affected clients. Model the Cape routing break-even at the new rate.',
   'EGSUZ:sea:both', '[]',
   '{"mode": "identical"}', NULL,
   'h.farouk@aglgroup.com'),

  ('demo-af-suez-convoy',
   'Convoy scheduling change — southbound Suez transits',
   'Southbound convoy assembly has moved forward by two hours. The northbound window is unchanged.',
   'Regulatory', 'Customs', NULL, 'info', 'published',
   -4, 20, 100,
   'Vessels arriving on the old assembly time will miss the convoy and wait 24 hours at Port Said.',
   'Reconfirm assembly times with agents for every transit this month.',
   'EGSUZ:sea:both', '[]', NULL, NULL,
   'h.farouk@aglgroup.com'),

  ('demo-af-alexandria',
   'Berth congestion after crane downtime — Alexandria',
   'Two ship-to-shore cranes have been out of service since the weekend. The terminal is working three berths at reduced capacity.',
   'Congestion', 'Port congestion', NULL, 'watch', 'published',
   -2, 6, 45,
   'Median berth wait is up to 2.6 days and import discharge is running roughly a day behind schedule.',
   'Advise import clients of the delay. Where the routing allows, consider Port Said transhipment for time-critical boxes.',
   'EGALY:sea:import', '[]', NULL, NULL,
   'h.farouk@aglgroup.com'),

  ('demo-af-morocco-licensing',
   'New import licensing regime — Morocco',
   'Pre-import declarations become mandatory for a widened list of consumer goods next week. Registration on the ministry portal is a prerequisite.',
   'Regulatory', 'Customs', 'Retail & FMCG', 'watch', 'published',
   -2, NULL, 64,
   'Shipments arriving without a validated licence will be held at the port of entry. Roughly 40 of our accounts import goods now inside scope.',
   'Register every affected client on the portal before the switch. Brief the forwarding desk on the new document set. Flag in-transit cargo that will land after the effective date.',
   '!MA:sea road air:import', '[]', NULL, NULL,
   'rights.manager@aglgroup.com'),

  ('demo-af-tangermed',
   'Tanger Med — transhipment yard at peak occupancy',
   'Transhipment volumes diverted from the Red Sea are keeping the yard above 90% occupancy through the month.',
   'Congestion', 'Port congestion', NULL, 'watch', 'published',
   -1, 9, 33,
   'Connection windows are tightening. Boxes are missing their nominated onward vessel and waiting a full rotation.',
   'Nominate onward vessels at booking, not on arrival. Track connection performance weekly and escalate misses to the line.',
   'MAPTM:sea:both', '[]', NULL, NULL,
   'rights.manager@aglgroup.com'),

  ('demo-af-casablanca-gates',
   'Casablanca gate hours extended to 22:00',
   'The terminal has added an evening shift on weekdays to work down the import backlog.',
   'Infrastructure', 'Port equipment', NULL, 'info', 'published',
   -5, 25, 110,
   'Additional daily collection capacity, and a genuine opportunity to pull dwell down for clients who can move trucks in the evening.',
   'Offer evening collection slots to clients with their own fleet. Reschedule drayage where driver hours allow.',
   'MACAS:sea road:both', '[]', NULL, NULL,
   'rights.manager@aglgroup.com'),

  ('demo-af-dakar-fuel',
   'Fuel shortage affecting drayage — Dakar',
   'Diesel supply at three of the main depots serving port drayage has been intermittent for a week.',
   'Infrastructure', 'Power', NULL, 'watch', 'published',
   -2, 8, 48,
   'Trucking capacity is down roughly a quarter. Collection appointments are being missed and re-booked at 48 hours notice.',
   'Consolidate loads. Prioritise cargo with demurrage exposure. Keep clients ahead of the re-booking rather than behind it.',
   'SNDKR:road:both', '[]', NULL, NULL,
   'c.diallo@aglgroup.com'),

  ('demo-af-douala-yard',
   'Yard congestion building — Douala terminal',
   'Yard occupancy is above 95% after a run of high-volume calls and slow import collection.',
   'Congestion', 'Port congestion', 'All industries', 'warning', 'published',
   -3, 10, 70,
   'Discharge is being slowed to protect yard space. Import dwell is at 9 days and empties cannot be returned to the nominated depot.',
   'Push clients to collect against the free-time clock. Arrange an off-dock overflow depot for empties this week.',
   'CMDLA:sea:import', '[]', NULL, NULL,
   'c.diallo@aglgroup.com'),

  ('demo-af-lome-relay',
   'Transhipment surge at Lomé — connection windows tightening',
   'Hub volumes are up sharply as services reshuffle around West African port congestion.',
   'Congestion', 'Port congestion', NULL, 'watch', 'published',
   -1, 12, 36,
   'Boxes are missing connections and waiting for the next rotation, adding four to seven days on Gulf of Guinea relays.',
   'Nominate the onward vessel at booking. Review the relay performance of each service weekly.',
   'TGLFW:sea:both', '[]', NULL, NULL,
   'rights.manager@aglgroup.com'),

  ('demo-af-cotonou-gates',
   'Extended gate hours — Cotonou container terminal',
   'The terminal now gates trucks until 20:00 on weekdays and runs a Saturday morning shift.',
   'Infrastructure', 'Port equipment', NULL, 'info', 'published',
   -6, 30, 130,
   'More collection capacity for Niger and Burkina transit cargo, which had been constrained by the gate rather than the corridor.',
   'Rebook transit collections into the evening window where escort timing allows.',
   'BJCOO:sea road:both', '[]', NULL, NULL,
   'rights.manager@aglgroup.com'),

  ('demo-af-sanpedro-cocoa',
   'Cocoa export peak — berth waiting at San-Pédro',
   'Mid-crop export peak, with two conventional berths occupied by breakbulk and container vessels waiting at anchor.',
   'Congestion', 'Anchorage queue', 'Agriculture', 'watch', 'published',
   -2, 14, 50,
   'Berth wait of two to three days for container tonnage. Export cut-offs are being missed on the weekly West Africa service.',
   'Move cut-offs forward 24 hours for cocoa bookings. Confirm warehouse release timing with shippers before the vessel arrives.',
   'CISPY:sea:export', '[]', NULL, NULL,
   'y.traore@aglgroup.com'),

  ('demo-af-onne-escort',
   'Security escort requirement reinstated — Onne to Port Harcourt road',
   'Convoy escort is mandatory again for cargo movements between Onne Port and Port Harcourt, after two incidents in the last fortnight.',
   'Security', 'Conflict', 'Oil & Gas', 'warning', 'published',
   -1, NULL, 30,
   'Movements are restricted to daylight escorted convoys twice daily. Project cargo and high-value oilfield equipment are effectively on a fixed timetable.',
   'Book escorts 48 hours ahead. Consolidate to fill convoy slots. Review insurance cover on high-value moves with the client before dispatch.',
   'NGONN:road:both', '[]', NULL, NULL,
   'c.diallo@aglgroup.com'),

  ('demo-af-maputo-gates',
   'Reduced gate hours — Maputo container terminal',
   'The terminal has cut weekday gate hours by two while it works through a labour shortfall.',
   'Congestion', 'Port congestion', NULL, 'watch', 'published',
   -2, 10, 52,
   'Collection appointments are compressed into a shorter day, and truck queues are forming at the pre-gate through the afternoon.',
   'Book morning slots where possible. Warn clients that afternoon arrivals are likely to roll to the next day.',
   'MZMPM:sea:both', '[]', NULL, NULL,
   'm.nunes@aglgroup.com'),

  ('demo-af-maputo-health',
   'Sanitary inspection tightened on food imports — Maputo',
   'Health authorities are sampling a higher share of food consignments at the port of entry.',
   'Health', 'Port health measure', 'Retail & FMCG', 'info', 'published',
   -6, 24, 140,
   'An extra two to three days on affected imports, plus a sampling fee that had not been budgeted.',
   'Warn food importers at booking. Ensure health certificates travel with the documents, not behind them.',
   'MZMPM:sea:import', '[]', NULL, NULL,
   'm.nunes@aglgroup.com'),

  ('demo-af-nacala-rail',
   'Nacala corridor — rail works between Cuamba and Entre Lagos',
   'Single-line working on the Nacala corridor for ballast renewal, starting in two days.',
   'Infrastructure', 'Rail works', 'Mining & Metals', 'info', 'published',
   2, 16, 60,
   'Roughly a third fewer paths for coal and general freight during the works.',
   'Advance loading where the stockpile allows. Confirm revised slot allocations with the concessionaire.',
   'MZMNC:rail:export', '[]', NULL, NULL,
   'm.nunes@aglgroup.com'),

  ('demo-af-dar-dredging',
   'Berth dredging notice — Dar es Salaam',
   'Maintenance dredging at berths 8–11, with one berth out of service on a rolling basis.',
   'Infrastructure', 'Port equipment', NULL, 'info', 'published',
   -4, 18, 115,
   'Marginal berth capacity reduction, with occasional 12-hour waits at peak.',
   'Monitor the berth roster. No client action required unless the vessel is nominated to an affected berth.',
   'TZDAR:sea:both', '[]', NULL, NULL,
   'j.otieno@aglgroup.com'),

  ('demo-af-abidjan-curfew',
   'Weekend curfew eased on Abidjan port access roads',
   'The overnight restriction on the Vridi and Boulevard de Marseille approaches has been lifted.',
   'Security', 'Civil unrest', NULL, 'info', 'published',
   -5, 20, 125,
   'Night drayage is available again, which restores roughly 30% of daily truck capacity.',
   'Restore overnight collection bookings. Advise clients that the pre-curfew premium no longer applies.',
   'CIABJ:road:both', '[]', NULL, NULL,
   'y.traore@aglgroup.com'),

  ('demo-af-walvisbay-project',
   'Project cargo berth window — Walvis Bay',
   'A heavy-lift window has been allocated at the new container terminal quay later this week.',
   'Infrastructure', 'Port equipment', 'Project Cargo', 'info', 'published',
   3, 21, 88,
   'A rare opportunity to land oversize mining equipment without a Durban relay.',
   'Consolidate pending project shipments into the window. Confirm crane capacity and route survey with the client.',
   'NAWVB:sea:import', '[]', NULL, NULL,
   'rights.manager@aglgroup.com'),

  ('demo-af-luanda-valuation',
   'Customs valuation reference update — Luanda',
   'Revised reference values apply to a range of imported goods from tomorrow, raising the assessed duty base.',
   'Regulatory', 'Customs', 'Retail & FMCG', 'watch', 'published',
   1, NULL, 42,
   'Duty payable rises on affected lines. Clients budgeting against the old table will be short at clearance.',
   'Recalculate landed cost estimates this week. Warn importers before their cargo arrives, not at the invoice.',
   'AOLAD:sea:import', '[]', NULL, NULL,
   'rights.manager@aglgroup.com'),

  ('demo-af-matadi-draft',
   'River draft restriction — Matadi',
   'Low water on the Congo river has cut the permissible draft on the approach channel by 0.8 m.',
   'Infrastructure', 'Port equipment', NULL, 'watch', 'published',
   -2, 12, 58,
   'Vessels are lightening at Pointe-Noire or sailing part-loaded, cutting effective capacity on the service.',
   'Split heavy consignments across two sailings. Advise clients of a probable capacity surcharge.',
   'CDMAT:sea:import', '[]', NULL, NULL,
   'k.mwansa@aglgroup.com'),

  ('demo-af-redsea-cape',
   'Red Sea routing held — Cape of Good Hope diversions continue',
   'Major carriers have confirmed they will keep Asia–Europe strings on the Cape routing through the rest of the quarter. Djibouti feeder connectivity remains reduced.',
   'Security', 'Conflict', 'All industries', 'warning', 'published',
   -8, NULL, 150,
   'Ten to fourteen days of extra transit on affected trades, with schedule reliability well below normal. East Africa feeder relays via Djibouti are running thin.',
   'Plan inventory to the Cape transit, not the Suez one. Reprice affected contracts at renewal. Offer air-sea via Dubai for genuinely time-critical cargo.',
   'EGSUZ:sea:both,DJJIB:sea:both,ZACPT:sea:both', '[]',
   '{"mode": "modified", "title": "Red Sea routing — extended transit times continue", "description": "Carriers are continuing to route Asia–Europe services via the Cape of Good Hope. Please plan for 10–14 days of additional transit time on affected trades until further notice."}',
   NULL,
   'rights.manager@aglgroup.com'),

-- ------------------------------- EUROPE ------------------------------
  ('demo-eu-rotterdam-barge',
   'Barge waiting times up to 62 hours — Rotterdam deep-sea terminals',
   'Inland barge handling at the Maasvlakte terminals is running well behind schedule after a run of high-volume calls and low Rhine water.',
   'Congestion', 'Port congestion', 'All industries', 'warning', 'published',
   -2, 9, 20,
   'Hinterland barge rotations are taking three days longer than planned. Rail and road are absorbing volume they were not booked for, and inland terminal slots are scarce.',
   'Shift time-critical hinterland moves to rail this week. Warn clients with fixed production slots in Duisburg and Basel. Review the barge fixture list daily.',
   'NLRTM:sea road:both', '[]', NULL, NULL,
   'l.vandijk@aglgroup.com'),

  ('demo-eu-antwerp-lock',
   'Kieldrecht lock maintenance — Antwerp left bank',
   'The Kieldrecht lock closes for planned maintenance tomorrow, with all traffic routed through the Kallo lock.',
   'Infrastructure', 'Port equipment', NULL, 'watch', 'published',
   1, 15, 34,
   'Longer lock waits on the left bank, particularly at the tidal peaks. Expect six to ten hours added to barge rotations calling both banks.',
   'Sequence left-bank calls outside the tidal peak. Rebook barge slots for the works period now, while capacity is still available.',
   'BEANR:sea:both', '[]', NULL, NULL,
   'l.vandijk@aglgroup.com'),

  ('demo-eu-hamburg-strike',
   '48-hour warning strike called at Hamburg terminals',
   'The union has called a 48-hour warning strike across the Hamburg container terminals from 06:00 in two days, after the fifth round of collective bargaining ended without agreement.',
   'Strike', 'Port workers', 'All industries', 'warning', 'published',
   2, 6, 16,
   'No vessel or gate operations for the duration. Four services will shift their Hamburg call, and rail departures to the hinterland are cancelled for the period.',
   'Gate export boxes in before the stoppage begins. Rebook the affected rail departures via Bremerhaven. Notify clients with cut-offs in the window today.',
   'DEHAM:sea rail:both', '[]', NULL, NULL,
   'l.vandijk@aglgroup.com'),

  ('demo-eu-bremerhaven-cars',
   'Vehicle storage at capacity — Bremerhaven car terminal',
   'Finished-vehicle storage is full, following slower onward rail evacuation and strong import arrivals.',
   'Congestion', 'Port congestion', 'Automotive', 'watch', 'published',
   -4, 11, 62,
   'Discharge is being metered to available yard space. Vessels are waiting and onward rail bookings are being deferred.',
   'Prioritise units with confirmed dealer allocation. Consider inland compound storage for stock without a delivery date.',
   'DEBRV:sea rail:import', '[]', NULL, NULL,
   'l.vandijk@aglgroup.com'),

  ('demo-eu-france-strike',
   'Inter-union day of action — nationwide port and transport strike, France',
   'An inter-union day of action is called for later this week. The dockers federation has confirmed participation at all major ports, and a 24-hour stoppage is called on the rail network.',
   'Strike', 'General', 'All industries', 'warning', 'published',
   0, 6, 12,
   'No cargo operations at Le Havre, Marseille-Fos, Dunkirk or Montoir for 24 hours. Rail freight cancelled nationwide, and motorway blockades are likely at refinery approaches.',
   'Move cut-offs to the day before. Hold road departures on the day. Warn clients that the following day will run at reduced throughput as the backlog clears.',
   '!FR:sea road rail air:both', '[]', NULL, NULL,
   'l.vandijk@aglgroup.com'),

  ('demo-eu-fos-heat',
   'Heat restrictions on rail freight — Marseille-Fos corridor',
   'Speed restrictions are in force on the Rhône corridor during afternoon heat, with track temperatures above the operating threshold.',
   'Weather', 'Heat', NULL, 'watch', 'published',
   -1, 5, 27,
   'Rail transit times to Lyon and Dijon are extended by four to six hours. Some paths are cancelled outright at peak temperature.',
   'Book morning departures. Advise clients on rail-dependent lanes of a probable one-day slip.',
   'FRMRS:rail:both', '[]', NULL, NULL,
   'l.vandijk@aglgroup.com'),

  ('demo-eu-lehavre-reefer',
   'Le Havre — reduced reefer plug availability',
   'Electrical works at the reefer stack have taken roughly 60 plugs out of service.',
   'Infrastructure', 'Port equipment', 'Agriculture', 'info', 'published',
   -3, 10, 76,
   'Reefer pre-gating windows are tighter, and boxes gated early may be refused.',
   'Gate reefers inside the nominated window only. Confirm plug availability before dispatching.',
   'FRLEH:sea:both', '[]', NULL, NULL,
   'l.vandijk@aglgroup.com'),

  ('demo-eu-algeciras',
   'Transhipment congestion — Algeciras',
   'The hub is absorbing volume rerouted around Suez, and yard density is affecting crane productivity.',
   'Congestion', 'Port congestion', NULL, 'watch', 'published',
   -2, 12, 44,
   'Connection reliability is down. Relay boxes are waiting a full rotation for the onward vessel.',
   'Nominate onward vessels at booking. Track relay performance and escalate misses weekly.',
   'ESALG:sea:both', '[]', NULL, NULL,
   'l.vandijk@aglgroup.com'),

  ('demo-eu-valencia-gate',
   'Valencia — new pre-gate appointment system live',
   'Truck appointments are now mandatory at all Valencia terminal gates. Arrivals without a booking are turned away.',
   'Infrastructure', 'Port equipment', NULL, 'info', 'published',
   -7, 21, 160,
   'Smoother gate flow once hauliers adopt it, and hard rejections while they do not.',
   'Confirm every haulier has portal access this week. Build the appointment reference into the collection instruction.',
   'ESVLC:sea road:both', '[]', NULL, NULL,
   'l.vandijk@aglgroup.com'),

  ('demo-eu-barcelona-rail',
   'Barcelona — new rail shuttle to Zaragoza',
   'A daily rail shuttle to the Zaragoza dry port has started, adding capacity on a lane that had been road-only.',
   'Infrastructure', 'Rail works', 'Retail & FMCG', 'info', 'published',
   -3, 30, 90,
   'An alternative to road haulage on a corridor where driver availability has been the constraint.',
   'Offer the rail option to inland clients. Compare landed cost before the next contract round.',
   'ESBCN:rail:both', '[]', NULL, NULL,
   'l.vandijk@aglgroup.com'),

  ('demo-eu-genoa-swell',
   'Genoa — swell closes the Voltri breakwater entrance',
   'A Libeccio swell is forecast to close the western entrance for two tidal windows.',
   'Weather', 'Swell', NULL, 'watch', 'published',
   0, 3, 18,
   'Berthing delays of 12 to 24 hours at Voltri. The Sampierdarena berths are unaffected.',
   'Reconfirm berth nomination before arrival. Expect knock-on delays to the Tyrrhenian feeders.',
   'ITGOA:sea:both', '[]', NULL, NULL,
   'l.vandijk@aglgroup.com'),

  ('demo-eu-gioiatauro-crane',
   'Gioia Tauro — gantry crane out of service',
   'One ship-to-shore crane is out for a gearbox replacement, with a two-week lead time on the part.',
   'Infrastructure', 'Port equipment', NULL, 'info', 'published',
   -2, 8, 50,
   'Marginal productivity loss on the transhipment hub. No material schedule impact is expected.',
   'Monitor. No client action required.',
   'ITGIT:sea:both', '[]', NULL, NULL,
   'l.vandijk@aglgroup.com'),

  ('demo-eu-greece-seafarers',
   '24-hour seafarers strike — Greek ports',
   'The seafarers federation has called a 24-hour national stoppage later this week, covering ferries and coastal shipping.',
   'Strike', 'General', NULL, 'watch', 'published',
   0, 4, 30,
   'Domestic feeder and ferry connections stop for the day. Piraeus deep-sea terminal operations are expected to continue.',
   'Rebook island and coastal moves around the date. No action needed for deep-sea bookings.',
   '!GR:sea:both', '[]', NULL, NULL,
   'l.vandijk@aglgroup.com'),

  ('demo-eu-felixstowe-haulage',
   'Landside haulage shortage — Felixstowe',
   'Driver availability has tightened sharply, and the terminal is holding import boxes past their free time.',
   'Congestion', 'Port congestion', 'Retail & FMCG', 'watch', 'published',
   -4, 9, 68,
   'Import collection is running two to three days late. Detention charges are accruing on cargo clients cannot physically collect.',
   'Pre-book haulage at booking stage, not on arrival. Negotiate free-time extensions with the lines for affected clients.',
   'GBFXT:sea road:import', '[]', NULL, NULL,
   'l.vandijk@aglgroup.com'),

  ('demo-eu-southampton-rail',
   'Southampton — reduced rail paths during signalling works',
   'Signalling renewal on the Southampton to Basingstoke line cuts freight paths from next week.',
   'Infrastructure', 'Rail works', NULL, 'info', 'published',
   5, 12, 80,
   'Roughly a quarter fewer rail departures during the works.',
   'Book rail early for the works period. Shift the balance to road where cost allows.',
   'GBSOU:rail:both', '[]', NULL, NULL,
   'l.vandijk@aglgroup.com'),

  ('demo-eu-baltic-sanctions',
   'Sanctions screening tightened on Baltic transits',
   'Customs authorities in Lithuania and Latvia have widened documentary checks on goods with a possible onward destination in Russia or Belarus, following the latest sanctions package.',
   'Regulatory', 'Sanctions', 'All industries', 'warning', 'published',
   -2, NULL, 56,
   'Clearance times are up sharply on transit cargo. Consignments with incomplete end-user documentation are being held pending investigation.',
   'Obtain end-user statements before booking, not at the border. Screen every transit consignment against the updated list this week.',
   'LTKLJ:sea road:both,LVRIX:sea road:both', '[]', NULL, NULL,
   'l.vandijk@aglgroup.com'),

  ('demo-eu-odesa-security',
   'Grain corridor — drone activity near Odesa port infrastructure',
   'Overnight strikes on port infrastructure in the Odesa region. One grain terminal is reported damaged and operations at the wider port complex are intermittent.',
   'Security', 'Conflict', 'Agriculture', 'critical', 'published',
   -1, NULL, 14,
   'Loading windows are unpredictable. Vessel owners are reassessing the risk premium and two nominated vessels have withdrawn.',
   'Do not commit new tonnage until the daily security assessment is in. Advise grain clients that laycans will move. Reconfirm war-risk cover before every fixture.',
   'UAODS:sea:both', '[]', NULL, NULL,
   'l.vandijk@aglgroup.com'),

  ('demo-eu-novorossiysk',
   'Novorossiysk — payment channel restrictions on freight settlement',
   'Two further correspondent banks have withdrawn from freight settlement on Russian trades.',
   'Regulatory', 'Sanctions', NULL, 'watch', 'published',
   -5, NULL, 120,
   'Settlement delays on existing bookings, and some clients cannot pay at all through their normal channel.',
   'Confirm a working settlement route before accepting a booking. Escalate stranded receivables to finance.',
   'RUNVS:sea:both', '[]', NULL, NULL,
   'l.vandijk@aglgroup.com'),

  ('demo-eu-gdansk-rail',
   'Gdansk — DCT rail slot reallocation',
   'The terminal has reallocated rail slots toward the Baltic hinterland services after a timetable revision.',
   'Infrastructure', 'Rail works', NULL, 'info', 'published',
   -3, 14, 84,
   'Slot times have moved for several inland destinations. Total capacity is unchanged.',
   'Reconfirm departure times with the rail operator for the next four weeks.',
   'PLGDN:rail:both', '[]', NULL, NULL,
   'l.vandijk@aglgroup.com'),

  ('demo-eu-klaipeda-border',
   'Border queue at Medininkai — Klaipeda hinterland',
   'Truck queues at the Belarus border crossing have lengthened again after a reduction in processing lanes.',
   'Congestion', 'Border queue', NULL, 'watch', 'published',
   -1, 10, 38,
   'Waits of 30 to 50 hours are being reported. Drivers are running out of hours in the queue, which compounds the delay.',
   'Route via Latvia where the destination allows. Build the queue time into the transit quote rather than absorbing it.',
   'LTKLJ:road:both', '[]', NULL, NULL,
   'l.vandijk@aglgroup.com'),

  ('demo-eu-koper-reefer',
   'Koper — reefer connection capacity increased',
   'An additional 180 reefer plugs are in service at the container terminal, with rail connections to Austria and Hungary.',
   'Infrastructure', 'Port equipment', 'Agriculture', 'info', 'published',
   -6, 25, 145,
   'More capacity on a corridor that had been the constraint for Central European reefer imports.',
   'Offer the Koper routing to Central European reefer clients at the next review.',
   'SIKOP:sea rail:both', '[]', NULL, NULL,
   'l.vandijk@aglgroup.com'),

-- ---------------------------- MIDDLE EAST ----------------------------
  ('demo-me-jebelali-outage',
   'Terminal operating system outage — Jebel Ali Terminal 2',
   'The terminal operator has reported a systems incident affecting gate and yard planning at Terminal 2. Deep-sea vessel operations continue on manual planning.',
   'Infrastructure', 'Port equipment', 'All industries', 'warning', 'published',
   0, 3, 9,
   'Gate throughput is roughly halved. Appointment bookings made before the incident are not being recognised at the gate.',
   'Hold non-urgent collections until the system is restored. Re-book affected appointments once the operator confirms. Keep clients updated twice daily.',
   'AEJEA:sea road:both', '[]', NULL, NULL,
   'a.haddad@aglgroup.com'),

  ('demo-me-abudhabi-declaration',
   'Pre-arrival declaration mandatory — Abu Dhabi',
   'Customs will require the pre-arrival declaration to be lodged before vessel arrival rather than before discharge, from next week.',
   'Regulatory', 'Customs', NULL, 'info', 'published',
   8, NULL, 95,
   'Late lodgement will hold the consignment at the terminal and start storage running.',
   'Move the declaration step ahead of ETA in the operating procedure. Brief the clearance desk this week.',
   'AEAUH:sea:import', '[]', NULL, NULL,
   'a.haddad@aglgroup.com'),

  ('demo-me-jeddah-congestion',
   'Jeddah — berth congestion from rerouted Asia–Europe volume',
   'Transhipment volumes displaced by the Red Sea situation have pushed yard occupancy past 90%.',
   'Congestion', 'Port congestion', 'All industries', 'warning', 'published',
   -3, 12, 58,
   'Berth waits of two to four days. Connection reliability on Red Sea feeders is poor and worsening.',
   'Route transhipment via Salalah or Jebel Ali where the service allows. Warn clients of relay delays now.',
   'SAJED:sea:both', '[]', NULL, NULL,
   'a.haddad@aglgroup.com'),

  ('demo-me-dammam-heat',
   'Heat-related working restrictions — Dammam',
   'The midday outdoor work ban is in force through the summer period, and ambient temperatures are above the equipment operating range at peak.',
   'Weather', 'Heat', 'Oil & Gas', 'watch', 'published',
   -6, 20, 132,
   'Roughly three working hours are lost each day. Lashing and inspection work is concentrated into the early morning.',
   'Plan gate and inspection activity before 11:00. Build the reduced working day into transit estimates.',
   'SADMM:sea road:both', '[]', NULL, NULL,
   'a.haddad@aglgroup.com'),

  ('demo-me-salalah-relay',
   'Salalah — transhipment volumes at record levels',
   'Relay volumes are running well above plan as services reconfigure around the Red Sea.',
   'Congestion', 'Port congestion', NULL, 'watch', 'published',
   -4, 15, 100,
   'Yard density is affecting productivity and relay dwell is up by roughly two days.',
   'Nominate the onward vessel at booking. Review the relay lead time used in quotes.',
   'OMSLL:sea:both', '[]', NULL, NULL,
   'a.haddad@aglgroup.com'),

  ('demo-me-sohar-berth',
   'Sohar — new bulk berth commissioning',
   'A new bulk berth enters service in ten days, adding capacity for mineral exports.',
   'Infrastructure', 'Port equipment', 'Mining & Metals', 'info', 'published',
   10, 40, 105,
   'Additional loading capacity on a berth that had been the bottleneck at peak.',
   'Review bulk export nominations against the new capacity at the next planning cycle.',
   'OMSOH:sea:both', '[]', NULL, NULL,
   'a.haddad@aglgroup.com'),

  ('demo-me-ummqasr-escort',
   'Umm Qasr — escort requirement for road movements north',
   'Security advice has been raised for the Basra to Baghdad road corridor following incidents on the route.',
   'Security', 'Conflict', 'Project Cargo', 'warning', 'published',
   -2, NULL, 52,
   'Movements are limited to escorted daylight convoys, which cuts effective road capacity by roughly half.',
   'Book escorts well ahead. Consolidate loads to fill convoy slots. Reassess the insured value on project moves.',
   'IQUQR:road:both', '[]', NULL, NULL,
   'a.haddad@aglgroup.com'),

  ('demo-me-bosphorus-fog',
   'Bosphorus transit suspended in fog — Istanbul',
   'Transit suspensions in reduced visibility are running most mornings this week.',
   'Weather', 'Storm', NULL, 'watch', 'published',
   0, 2, 15,
   'Waiting time at the northern and southern approaches of 12 to 30 hours.',
   'Advise clients of probable ETA slippage on Black Sea services. No action is available beyond schedule buffer.',
   'TRAMR:sea:both', '[]', NULL, NULL,
   'a.haddad@aglgroup.com'),

  ('demo-me-mersin-inspection',
   'Mersin — customs inspection rates raised on textile imports',
   'Physical inspection rates on textile and footwear consignments have been raised following an anti-dumping review.',
   'Regulatory', 'Customs', 'Retail & FMCG', 'info', 'published',
   -4, 18, 98,
   'Two to four days added on affected imports, plus inspection costs.',
   'Warn textile importers at booking. Ensure the origin documentation is complete before arrival.',
   'TRMER:sea:import', '[]', NULL, NULL,
   'a.haddad@aglgroup.com'),

-- -------------------------------- ASIA -------------------------------
  ('demo-as-typhoon-marikit',
   'Typhoon Marikit — Kaohsiung and Xiamen port closures',
   'A category 4 typhoon is tracking toward the Taiwan Strait. Both port authorities have issued closure notices ahead of landfall, with sustained winds forecast above 180 km/h.',
   'Weather', 'Cyclone', 'All industries', 'critical', 'published',
   0, 5, 4,
   'Port operations suspend from midday today at Kaohsiung and tomorrow at Xiamen. All berthing and gate activity stops; nine services will omit or delay their call. Air freight out of Kaohsiung is cancelled for 48 hours.',
   'Gate in export boxes today or not at all. Expect a three-to-five day recovery backlog after reopening. Advise clients now that cut-offs for the next two sailings will move.',
   'TWKHH:sea air:both,CNXAM:sea:both',
   '["https://www.jma.go.jp/", "https://www.cwa.gov.tw/"]', NULL, NULL,
   'h.tanaka@aglgroup.com'),

  ('demo-as-shanghai-fog',
   'Shanghai — berth closures in heavy fog at Yangshan',
   'Visibility below the pilotage minimum has closed the Yangshan approach in three separate windows over the last 36 hours.',
   'Weather', 'Storm', 'Retail & FMCG', 'warning', 'published',
   -1, 4, 22,
   'Berth waits of 24 to 48 hours and rising. The yard is dense enough that recovery will lag the reopening by a further day.',
   'Reconfirm cut-offs daily. Warn clients on Asia–Europe strings of a probable one-week schedule slip.',
   'CNSGH:sea:both', '[]', NULL, NULL,
   'h.tanaka@aglgroup.com'),

  ('demo-as-ningbo-yard',
   'Ningbo-Zhoushan — yard density affecting productivity',
   'Yard occupancy is above 88% following the fog-related bunching further north.',
   'Congestion', 'Port congestion', NULL, 'watch', 'published',
   -3, 10, 64,
   'Gate turn times are extended and export pre-gating windows are being enforced strictly.',
   'Gate inside the nominated window. Expect roll-overs on the busiest strings.',
   'CNNBO:sea:both', '[]', NULL, NULL,
   'h.tanaka@aglgroup.com'),

  ('demo-as-yantian-gates',
   'Yantian — extended gate hours during peak season',
   'The terminal has added weekend gate capacity ahead of the pre-holiday export peak.',
   'Infrastructure', 'Port equipment', NULL, 'info', 'published',
   -5, 28, 118,
   'More collection and delivery capacity through the peak.',
   'Rebook drayage into the weekend window where the shipper can load.',
   'CNSNZ:sea road:both', '[]', NULL, NULL,
   'h.tanaka@aglgroup.com'),

  ('demo-as-qingdao-inspection',
   'Qingdao — new customs inspection facility in service',
   'An expanded inspection facility has opened, and clearance times on selected consignments have improved.',
   'Regulatory', 'Customs', NULL, 'info', 'published',
   -8, 22, 170,
   'Faster clearance on inspected cargo, though the selection rate itself is unchanged.',
   'No action required. Reflect the shorter inspection dwell in transit estimates.',
   'CNQIN:sea:import', '[]', NULL, NULL,
   'h.tanaka@aglgroup.com'),

  ('demo-as-tianjin-roro',
   'Tianjin — ro-ro berth maintenance',
   'The ro-ro berth is out of service for fender replacement from the day after tomorrow.',
   'Infrastructure', 'Port equipment', 'Automotive', 'info', 'published',
   2, 16, 86,
   'Vehicle imports will be handled at an alternative berth with lower throughput.',
   'Expect a day of additional discharge time on vehicle calls during the works.',
   'CNTNJ:sea:both', '[]', NULL, NULL,
   'h.tanaka@aglgroup.com'),

  ('demo-as-hongkong-barge',
   'Hong Kong — barge feeder delays to the Pearl River Delta',
   'River trade barge rotations are running behind after weather disruption earlier in the week.',
   'Congestion', 'Port congestion', NULL, 'watch', 'published',
   -2, 8, 46,
   'Feeder connections from delta factories are 24 to 36 hours late, putting deep-sea cut-offs at risk.',
   'Move barge bookings forward a day. Confirm the deep-sea cut-off against the actual barge ETA.',
   'HKHKG:sea:both', '[]', NULL, NULL,
   'h.tanaka@aglgroup.com'),

  ('demo-as-singapore-bunker',
   'Bunker delivery delays at the Singapore anchorage',
   'Barge availability is short against demand, and waiting times for bunker delivery at the eastern anchorages are up sharply.',
   'Congestion', 'Anchorage queue', 'Oil & Gas', 'warning', 'published',
   -1, 7, 25,
   'Vessels are waiting 18 to 30 hours for bunkers, which cascades into berth window misses at the next port.',
   'Nominate bunkers earlier in the rotation. Where possible, take bunkers at the previous port call instead.',
   'SGSIN:sea:both', '[]', NULL, NULL,
   'w.chen@aglgroup.com'),

  ('demo-as-portklang-yard',
   'Port Klang — Westport yard congestion',
   'Yard occupancy is at 92%, with transhipment relays taking longer than nominated.',
   'Congestion', 'Port congestion', NULL, 'watch', 'published',
   -3, 11, 60,
   'Relay boxes are missing the onward vessel and waiting a full rotation.',
   'Nominate the onward vessel at booking and track connection performance weekly.',
   'MYPKG:sea:both', '[]', NULL, NULL,
   'w.chen@aglgroup.com'),

  ('demo-as-tanjungpelepas-service',
   'Tanjung Pelepas — new Europe service call added',
   'A weekly direct call to North Europe has been added to the hub rotation.',
   'Infrastructure', 'Port equipment', NULL, 'info', 'published',
   -4, 30, 102,
   'A direct routing option on a lane that had required a relay.',
   'Offer the direct service to clients currently routed via a hub relay.',
   'MYTPP:sea:both', '[]', NULL, NULL,
   'w.chen@aglgroup.com'),

  ('demo-as-thailand-flood',
   'Monsoon flooding on the Bangkok–Laem Chabang road corridor',
   'Heavy monsoon rain has flooded sections of Highway 7 and the industrial estate approaches east of Bangkok.',
   'Weather', 'Flood', 'Automotive', 'warning', 'published',
   -1, 6, 19,
   'Drayage between the industrial estates and Laem Chabang is running four to eight hours late, with some routes impassable to low-clearance equipment. Export cut-offs are at risk on two services.',
   'Route via Highway 344 where the destination allows. Move cut-offs forward 24 hours. Confirm each collection the evening before rather than assuming the schedule holds.',
   'THLCH:road:both,THBKK:road:both', '[]', NULL, NULL,
   'w.chen@aglgroup.com'),

  ('demo-as-hcmc-catlai',
   'Ho Chi Minh City — Cat Lai terminal congestion',
   'Export volumes ahead of the peak season have pushed the yard past its working density, and gate queues are forming outside the terminal.',
   'Congestion', 'Port congestion', 'Retail & FMCG', 'warning', 'published',
   -2, 10, 42,
   'Truck turn times are over five hours. Export boxes are gating in late and missing nominated cut-offs.',
   'Gate export cargo 48 hours before cut-off, not 24. Consider the Cai Mep terminals for deep-sea bookings where the service calls there.',
   'VNSGN:sea road:export', '[]', NULL, NULL,
   'w.chen@aglgroup.com'),

  ('demo-as-vietnam-valuation',
   'New customs valuation decree — Vietnam',
   'A decree revising the customs valuation method for related-party imports takes effect in under two weeks.',
   'Regulatory', 'Customs', 'Retail & FMCG', 'watch', 'published',
   -1, NULL, 90,
   'Importers with intercompany pricing will need supporting documentation at clearance, and duty assessed may rise.',
   'Identify affected accounts this week. Brief clients on the documentation set before the effective date.',
   '!VN:sea air road:import', '[]', NULL, NULL,
   'w.chen@aglgroup.com'),

  ('demo-as-haiphong-depression',
   'Haiphong — berth closures ahead of tropical depression',
   'A tropical depression in the Gulf of Tonkin is expected to close the approach channel for 24 to 36 hours.',
   'Weather', 'Storm', NULL, 'watch', 'published',
   1, 4, 28,
   'Berthing suspended for the duration, and northern Vietnam export cut-offs will move.',
   'Advance gate-in where the shipper can load early. Reconfirm the cut-off once the channel reopens.',
   'VNHPH:sea:both', '[]', NULL, NULL,
   'w.chen@aglgroup.com'),

  ('demo-as-priok-dwell',
   'Tanjung Priok — import dwell rising',
   'Import dwell has risen to 7.4 days as clearance and collection lag arrival volumes.',
   'Congestion', 'Port congestion', 'Retail & FMCG', 'warning', 'published',
   -4, 12, 74,
   'Yard occupancy is high enough to slow discharge, and demurrage exposure is building across the import book.',
   'Pre-lodge clearance before arrival. Chase collection against the free-time clock, client by client.',
   'IDTPP:sea:import', '[]', NULL, NULL,
   'w.chen@aglgroup.com'),

  ('demo-as-surabaya-dredging',
   'Surabaya — channel dredging notice',
   'Maintenance dredging of the Western Access Channel starts in three days, with one-way traffic during working hours.',
   'Infrastructure', 'Port equipment', NULL, 'info', 'published',
   3, 24, 92,
   'Marginal transit delays on arrival and departure. No draft restriction is expected.',
   'Monitor. No client action required.',
   'IDSUB:sea:both', '[]', NULL, NULL,
   'w.chen@aglgroup.com'),

  ('demo-as-manila-typhoon',
   'Typhoon approach — Manila port operations suspended',
   'Signal number 3 has been raised over Metro Manila. The port authority has suspended cargo operations and the coast guard has grounded small craft.',
   'Weather', 'Cyclone', NULL, 'warning', 'published',
   0, 4, 13,
   'No vessel or gate operations for at least 48 hours. Domestic feeder connections to the Visayas are cancelled.',
   'Hold trucking until the signal is lowered. Expect a two-to-three day backlog once operations resume.',
   'PHMNL:sea road:both', '[]', NULL, NULL,
   'w.chen@aglgroup.com'),

  ('demo-as-nhavasheva-rail',
   'Nhava Sheva — rail evacuation slower after DFC timetable change',
   'The revised Dedicated Freight Corridor timetable has cut the number of paths to the northern ICDs during daytime hours.',
   'Congestion', 'Port congestion', NULL, 'watch', 'published',
   -3, 12, 66,
   'Import boxes are waiting longer for rail evacuation, and ICD Tughlakabad transit is a day and a half longer than planned.',
   'Book rail at the time of discharge, not after clearance. Offer road for time-critical northern deliveries.',
   'INNSA:rail sea:import', '[]', NULL, NULL,
   'p.raghavan@aglgroup.com'),

  ('demo-as-mundra-reefer',
   'Mundra — additional reefer capacity in service',
   'An additional reefer yard with 400 plugs has entered service at the container terminal.',
   'Infrastructure', 'Port equipment', 'Agriculture', 'info', 'published',
   -5, 25, 112,
   'Reefer capacity is no longer the constraint on west coast exports.',
   'Review reefer export routings that had been diverted to Nhava Sheva for capacity reasons.',
   'INMUN:sea:both', '[]', NULL, NULL,
   'p.raghavan@aglgroup.com'),

  ('demo-as-chennai-rain',
   'Chennai — heavy rain warning and yard flooding risk',
   'The meteorological department has issued a heavy rainfall warning for the coastal districts.',
   'Weather', 'Flood', NULL, 'watch', 'published',
   1, 5, 36,
   'Yard flooding is likely at the low sections of the terminal, and drayage on the approach roads will slow.',
   'Move ground-level cargo to higher stacks. Reschedule non-urgent collections out of the warning window.',
   'INMAA:sea road:both', '[]', NULL, NULL,
   'p.raghavan@aglgroup.com'),

  ('demo-as-colombo-relay',
   'Colombo — transhipment surge from Indian feeder reshuffle',
   'Relay volumes are running well above plan as feeder services reconfigure around Indian east coast congestion.',
   'Congestion', 'Port congestion', NULL, 'warning', 'published',
   -2, 14, 48,
   'Yard density is slowing crane productivity, and relay dwell is up to five days on some connections.',
   'Nominate onward vessels at booking. Consider direct calls where the service supports it.',
   'LKCMB:sea:both', '[]', NULL, NULL,
   'p.raghavan@aglgroup.com'),

  ('demo-as-chittagong-flood',
   'Monsoon flooding disrupts Chittagong port access',
   'Sustained monsoon rainfall has flooded the port access roads and parts of the container yard. The Dhaka to Chittagong highway is impassable at two points.',
   'Weather', 'Flood', 'Retail & FMCG', 'critical', 'published',
   -2, 6, 31,
   'Gate operations are effectively stopped and inland trucking has halted. Garment export cut-offs are being missed across the board, with roughly 12,000 TEU of export cargo unable to reach the port.',
   'Advise apparel clients today that this week cut-offs will not be met. Assess air charter for the highest-value orders. Reconfirm the highway status each morning before dispatching trucks.',
   'BDCGP:sea road:both', '[]', NULL, NULL,
   'p.raghavan@aglgroup.com'),

  ('demo-as-bangladesh-hartal',
   'Political unrest and general strike — Bangladesh',
   'A nationwide general strike has been called for the next two days, with road blockades expected on the main highways.',
   'Security', 'Civil unrest', 'Retail & FMCG', 'warning', 'published',
   0, 5, 44,
   'Factory-to-port trucking will stop for the duration. Port operations continue but cargo cannot reach the gate.',
   'Move cargo to the port before the strike begins. Hold driver movements on the strike days. Expect a three-day recovery backlog.',
   '!BD:road rail sea:both', '[]', NULL, NULL,
   'p.raghavan@aglgroup.com'),

  ('demo-as-karachi-rain',
   'Karachi — port congestion after record rainfall',
   'Drainage failures after record rainfall have left parts of the terminal yard unusable and slowed the gate.',
   'Congestion', 'Port congestion', NULL, 'warning', 'published',
   -3, 9, 70,
   'Import dwell is up to nine days, and truck queues at the gate are backing onto the approach road.',
   'Delay collection appointments until the yard reopens fully. Pursue free-time extensions with the lines.',
   'PKKHI:sea road:import', '[]', NULL, NULL,
   'p.raghavan@aglgroup.com'),

  ('demo-as-busan-typhoon',
   'Busan — typhoon watch and berth contingency',
   'The typhoon tracking toward the Taiwan Strait may recurve toward the Korea Strait later in the week.',
   'Weather', 'Cyclone', NULL, 'watch', 'published',
   1, 5, 26,
   'Possible berth closures with roughly 24 hours notice. No confirmed disruption yet.',
   'Keep export gate-in ahead of schedule. Reassess daily against the forecast track.',
   'KRPUS:sea:both', '[]', NULL, NULL,
   'h.tanaka@aglgroup.com'),

  ('demo-as-incheon-hours',
   'Incheon — new customs clearance hours',
   'Customs has extended clearance desk hours to 20:00 on weekdays.',
   'Regulatory', 'Customs', NULL, 'info', 'published',
   -6, 20, 136,
   'Later clearance lodgement is possible, which pulls a day out of the import cycle for late-arriving documentation.',
   'Update the clearance cut-off used in the operating procedure.',
   'KRINC:sea air:import', '[]', NULL, NULL,
   'h.tanaka@aglgroup.com'),

  ('demo-as-tokyobay-typhoon',
   'Tokyo Bay — berth closures expected as typhoon recurves',
   'The forecast track brings the system across the Kanto region in the middle of the week. Both port authorities have issued preliminary closure advisories.',
   'Weather', 'Cyclone', 'Automotive', 'warning', 'published',
   2, 6, 21,
   'Expect 36 to 48 hours without vessel or gate operations at Tokyo and Yokohama, and a further two days of backlog.',
   'Gate export boxes before the closure. Warn automotive clients that parts shipments will slip a full week.',
   'JPTYO:sea:both,JPYOK:sea:both', '[]', NULL, NULL,
   'h.tanaka@aglgroup.com'),

  ('demo-as-kobe-reefer',
   'Kobe — reefer plug maintenance',
   'Rolling reefer plug maintenance at the container terminal starts later this week.',
   'Infrastructure', 'Port equipment', NULL, 'info', 'published',
   4, 18, 94,
   'Roughly 80 plugs are unavailable at any one time during the works.',
   'Confirm plug availability before nominating reefer cargo to Kobe.',
   'JPUKB:sea:both', '[]', NULL, NULL,
   'h.tanaka@aglgroup.com'),

  ('demo-as-nagoya-gates',
   'Nagoya — extended gate hours for the export peak',
   'The terminal has added an evening gate shift through the automotive export peak.',
   'Infrastructure', 'Port equipment', 'Automotive', 'info', 'published',
   -4, 26, 106,
   'Additional export gate-in capacity on a lane that had been constrained.',
   'Rebook export drayage into the evening window where the plant can release.',
   'JPGTK:sea road:export', '[]', NULL, NULL,
   'h.tanaka@aglgroup.com'),

-- ------------------------------ AMERICAS -----------------------------
  ('demo-am-panama-draft',
   'Panama Canal draft restriction cut to 12.8 m — transit slots reduced',
   'The Canal Authority has cut the maximum authorised draft to 12.8 m and reduced daily booking slots by roughly a third, following a prolonged dry season and low levels at Gatún Lake.',
   'Infrastructure', 'Port equipment', 'All industries', 'critical', 'published',
   -2, NULL, 17,
   'Neopanamax vessels are sailing part-loaded or omitting the transit entirely. Slot auction prices have tripled. Asia to US East Coast transits are running seven to ten days longer via the alternative routings.',
   'Rebook affected strings via Suez or the US West Coast land bridge. Reprice the affected contracts now rather than at renewal. Warn clients that the slot premium will appear as a surcharge.',
   'PABLB:sea:both,PACTB:sea:both',
   '["https://pancanal.com/"]', NULL, NULL,
   'd.whitfield@aglgroup.com'),

  ('demo-am-hurricane-odalys',
   'Hurricane Odalys — South Florida ports on alert',
   'A category 3 hurricane is forecast to pass close to the south-east Florida coast within 48 hours. Port Miami has moved to condition Whiskey and Freeport has issued a closure notice.',
   'Weather', 'Cyclone', 'All industries', 'critical', 'published',
   0, 6, 8,
   'Port closure is expected from tomorrow through the weekend. Caribbean feeder services are being cancelled rather than delayed, and air freight out of Miami will stop for at least 24 hours.',
   'Move cargo out of the storm surge zone today. Cancel rather than reschedule the feeder connections. Expect a four-day recovery once the port reopens.',
   'USMIA:sea air:both,BSFPO:sea:both',
   '["https://www.nhc.noaa.gov/"]', NULL, NULL,
   'd.whitfield@aglgroup.com'),

  ('demo-am-sanpedro-chassis',
   'Chassis shortage and yard congestion — Los Angeles / Long Beach',
   'Chassis availability in the San Pedro Bay pool has tightened sharply during the pre-holiday import peak, with street dwell on chassis at a record high.',
   'Congestion', 'Port congestion', 'Retail & FMCG', 'warning', 'published',
   -4, 12, 35,
   'Import boxes are sitting on-dock past their free time because no chassis is available to move them. Rail-bound volume is affected worst; on-dock rail dwell is over nine days.',
   'Book chassis at the time of vessel discharge. Prioritise clients with detention exposure. Push the lines for free-time relief where the delay is pool-driven.',
   'USLAX:sea road:both,USLGB:sea road:both', '[]', NULL, NULL,
   'd.whitfield@aglgroup.com'),

  ('demo-am-houston-fog',
   'Ship channel closed in fog — Houston',
   'The Houston Ship Channel has been closed to inbound and outbound traffic in three separate fog windows over the past two days.',
   'Weather', 'Storm', 'Oil & Gas', 'warning', 'published',
   -1, 3, 23,
   'Roughly 40 vessels are waiting. Chemical and petroleum loading schedules are slipping two to three days, and the backlog will take a week to clear.',
   'Reconfirm loading windows daily. Advise clients on liquid bulk contracts that laycans will move.',
   'USHOU:sea:both', '[]', NULL, NULL,
   'd.whitfield@aglgroup.com'),

  ('demo-am-mississippi-lowwater',
   'Low water on the lower Mississippi — barge draft restrictions',
   'Draft and tow-size restrictions are in force on the lower Mississippi after a dry summer upriver.',
   'Infrastructure', 'Port equipment', 'Agriculture', 'warning', 'published',
   -5, NULL, 88,
   'Grain barges are loading light and freight rates on the river have roughly doubled. Export elevator throughput at the Gulf is down.',
   'Book grain export tonnage further ahead than usual. Model the rail alternative to the Pacific Northwest for the coming quarter.',
   'USMSY:sea:both', '[]', NULL, NULL,
   'd.whitfield@aglgroup.com'),

  ('demo-am-savannah-rail',
   'Savannah — import rail dwell above seven days',
   'Rail evacuation from the terminal is running behind arrival volume, and the intermodal yard is dense.',
   'Congestion', 'Port congestion', NULL, 'watch', 'published',
   -3, 10, 57,
   'Inland delivery to the Midwest is a week later than the transit standard.',
   'Consider transloading to road for time-critical inland volume. Advise clients on the affected lanes.',
   'USTSA:sea rail:import', '[]', NULL, NULL,
   'd.whitfield@aglgroup.com'),

  ('demo-am-charleston-berth',
   'Charleston — new berth in service at the Leatherman terminal',
   'An additional berth and three ship-to-shore cranes have entered service.',
   'Infrastructure', 'Port equipment', NULL, 'info', 'published',
   -6, 28, 142,
   'More berth capacity on the US South Atlantic at a time when Savannah is congested.',
   'Review South Atlantic routings — Charleston is currently the faster option for import discharge.',
   'USCHS:sea:both', '[]', NULL, NULL,
   'd.whitfield@aglgroup.com'),

  ('demo-am-norfolk-appointments',
   'Norfolk — gate appointment system upgrade',
   'The terminal appointment platform is being upgraded over the coming weekend, with a read-only period on the Saturday.',
   'Infrastructure', 'Port equipment', NULL, 'info', 'published',
   2, 12, 98,
   'Appointments for the following week must be booked before the freeze.',
   'Book the week drayage appointments before the freeze begins.',
   'USORF:sea road:both', '[]', NULL, NULL,
   'd.whitfield@aglgroup.com'),

  ('demo-am-pnw-gates',
   'Seattle and Tacoma — reduced weekend gate hours',
   'Both terminals have cut Saturday gate hours in response to lower volumes on the Pacific Northwest.',
   'Congestion', 'Port congestion', NULL, 'info', 'published',
   -4, 16, 104,
   'Less weekend collection capacity. The weekday gate is unaffected.',
   'Move weekend collections to Friday or Monday.',
   'USSEA:sea road:both,USTIW:sea road:both', '[]', NULL, NULL,
   'd.whitfield@aglgroup.com'),

  ('demo-am-nynj-chassis',
   'New York / New Jersey — chassis repositioning delays',
   'Chassis are pooling at inland depots rather than returning to the port complex.',
   'Congestion', 'Port congestion', NULL, 'watch', 'published',
   -2, 9, 41,
   'Drayage capacity is constrained at the terminal even where trucks are available.',
   'Book chassis with the collection appointment. Escalate persistent shortfalls to the pool operator.',
   'USNYC:sea road:import', '[]', NULL, NULL,
   'd.whitfield@aglgroup.com'),

  ('demo-am-baltimore-roro',
   'Baltimore — ro-ro berth congestion',
   'Vehicle import volumes are above plan and the storage compound is nearly full.',
   'Congestion', 'Port congestion', 'Automotive', 'info', 'published',
   -3, 12, 82,
   'Discharge is being metered, with vessel waiting time of up to 24 hours.',
   'Prioritise units with confirmed onward transport. Consider inland compound storage.',
   'USBAL:sea:import', '[]', NULL, NULL,
   'd.whitfield@aglgroup.com'),

  ('demo-am-vancouver-embargo',
   'Wildfire smoke and rail embargo — Vancouver corridor',
   'Wildfire activity in the interior has led to a rolling embargo on intermodal traffic through the Fraser Canyon, with sections of the mainline closed intermittently.',
   'Infrastructure', 'Rail works', 'Mining & Metals', 'warning', 'published',
   -2, 8, 54,
   'Rail evacuation from the port is running at roughly 60% of plan. Container dwell at the terminal is up to eight days and empties cannot be repositioned inland.',
   'Hold inland bookings until the embargo lifts. Advise clients on the Prairie lanes of a one-week delay. Consider the Prince Rupert routing for new bookings.',
   'CAVAN:rail sea:both', '[]', NULL, NULL,
   'd.whitfield@aglgroup.com'),

  ('demo-am-montreal-labour',
   'Montreal — longshore collective agreement expiring',
   'The longshore collective agreement expires at the end of the month with no settlement in sight. Both parties have confirmed talks are continuing.',
   'Strike', 'Port workers', NULL, 'watch', 'published',
   0, 30, 76,
   'No disruption yet. A strike would stop container operations at the port entirely, with Halifax the only realistic alternative.',
   'Build a contingency routing via Halifax for the affected clients now, while capacity is still bookable.',
   'CAMTR:sea:both', '[]', NULL, NULL,
   'd.whitfield@aglgroup.com'),

  ('demo-am-halifax-rail',
   'Halifax — additional rail service to central Canada',
   'An additional daily intermodal departure to Toronto and Montreal has been added.',
   'Infrastructure', 'Rail works', NULL, 'info', 'published',
   -5, 25, 120,
   'Extra inland capacity, which matters given the Montreal labour situation.',
   'Factor the added capacity into any Montreal contingency plan.',
   'CAHAL:rail:both', '[]', NULL, NULL,
   'd.whitfield@aglgroup.com'),

  ('demo-am-manzanillo-yard',
   'Manzanillo — yard congestion and extended clearance times',
   'Import volumes are above plan and customs inspection rates have been raised at the same time.',
   'Congestion', 'Port congestion', 'Retail & FMCG', 'warning', 'published',
   -3, 11, 63,
   'Import dwell is at 11 days, and rail evacuation to the Bajío is booked out two weeks ahead.',
   'Pre-lodge clearance before arrival. Book rail at discharge. Warn clients on Asia to Mexico lanes of the extended cycle.',
   'MXZLO:sea road:import', '[]', NULL, NULL,
   'd.whitfield@aglgroup.com'),

  ('demo-am-lazaro-theft',
   'Cargo theft on the Lázaro Cárdenas to Mexico City corridor',
   'Reported cargo theft incidents on the corridor are running well above the seasonal norm, concentrated on the Michoacán stretch.',
   'Security', 'Theft', 'Retail & FMCG', 'warning', 'published',
   -4, NULL, 86,
   'Insurers are asking for escorted movement on high-value cargo, which adds cost and constrains the departure timetable.',
   'Use escorted convoys for consumer electronics and pharmaceuticals. Avoid overnight stops on the corridor. Review declared values with the client.',
   'MXLZC:road rail:both', '[]', NULL, NULL,
   'd.whitfield@aglgroup.com'),

  ('demo-am-veracruz-vehicles',
   'Veracruz — vehicle import processing delays',
   'Vehicle inspection and registration processing at the port is running behind arrivals.',
   'Congestion', 'Port congestion', 'Automotive', 'info', 'published',
   -2, 14, 72,
   'Two to four days added before units can be released to the dealer network.',
   'Advise automotive clients of the extended release cycle.',
   'MXVER:sea:import', '[]', NULL, NULL,
   'd.whitfield@aglgroup.com'),

  ('demo-am-santos-queue',
   'Santos — berth waiting at the sugar and grain export peak',
   'The simultaneous sugar and soybean export peak has the anchorage at more than 60 vessels, with rain stoppages compounding the queue.',
   'Congestion', 'Anchorage queue', 'Agriculture', 'warning', 'published',
   -3, 18, 39,
   'Berth waiting of 12 to 20 days on bulk tonnage and three to five days on container services. Demurrage exposure is significant on the bulk book.',
   'Fix laycans with realistic waiting assumptions. Consider Paranaguá for marginal bulk volume. Review demurrage clauses with clients before fixing.',
   'BRSSZ:sea:export', '[]', NULL, NULL,
   'c.ferreira@aglgroup.com'),

  ('demo-am-paranagua-rain',
   'Paranaguá — rain stoppages on bulk loading',
   'Persistent rain has stopped grain loading in multiple windows this week.',
   'Weather', 'Storm', 'Agriculture', 'watch', 'published',
   -1, 7, 47,
   'Loading rates are well below the charter party terms and the queue is lengthening.',
   'Reassess laycans. Advise shippers that demurrage is likely on current fixtures.',
   'BRPNG:sea:export', '[]', NULL, NULL,
   'c.ferreira@aglgroup.com'),

  ('demo-am-rio-inspection',
   'Rio de Janeiro — new customs inspection regime for imports',
   'A revised risk-based inspection regime applies to imports at the port from later this week.',
   'Regulatory', 'Customs', NULL, 'info', 'published',
   4, NULL, 108,
   'Selection rates should fall for compliant importers and rise for the rest.',
   'Review the compliance record of the affected accounts before the switch.',
   'BRRIO:sea:import', '[]', NULL, NULL,
   'c.ferreira@aglgroup.com'),

  ('demo-am-itajai-draft',
   'Itajaí — channel dredging and draft restriction',
   'Silting after heavy rain has cut the available draft on the access channel pending dredging.',
   'Infrastructure', 'Port equipment', NULL, 'watch', 'published',
   -2, 20, 78,
   'Vessels are sailing part-loaded from the terminal, and some services are omitting the call.',
   'Confirm the call is still scheduled before booking. Route via Navegantes or Santos as a fallback.',
   'BRITJ:sea:both', '[]', NULL, NULL,
   'c.ferreira@aglgroup.com'),

  ('demo-am-buenosaires-customs',
   'Customs officers work-to-rule — Buenos Aires',
   'Customs staff are working to rule over a pay dispute, processing only a fraction of normal declarations per day.',
   'Strike', 'Customs', NULL, 'warning', 'published',
   -1, 6, 32,
   'Clearance times have tripled. Import cargo is accumulating in the terminal and storage charges are running.',
   'Lodge declarations as early as the documentation allows. Warn importers that storage will be charged and cannot be avoided.',
   'ARBUE:sea road:import', '[]', NULL, NULL,
   'c.ferreira@aglgroup.com'),

  ('demo-am-chile-customs-strike',
   'Customs and revenue strike — nationwide, Chile',
   'The customs workers association has called a national stoppage from tomorrow, with minimum service only at the main ports and border crossings.',
   'Strike', 'Customs', 'Mining & Metals', 'warning', 'published',
   0, 4, 37,
   'Import and export clearance effectively stops for the duration. Copper export documentation will not be processed, so mining shipments will miss their nominated vessels.',
   'Complete clearance on pending consignments today. Advise mining clients that shipments will roll to the following sailing. Plan for a three-day backlog after the stoppage.',
   '!CL:sea road air:both', '[]', NULL, NULL,
   'c.ferreira@aglgroup.com'),

  ('demo-am-chile-swell',
   'Swell closes the ports of San Antonio and Valparaíso',
   'A long-period north-westerly swell has closed both ports to berthing. This is the normal pattern for the system but is forecast to persist longer than usual.',
   'Weather', 'Swell', 'Agriculture', 'warning', 'published',
   0, 4, 24,
   'No berthing for 48 to 72 hours at either port. Fruit export bookings will roll to the next sailing, and reefer stack capacity is limited.',
   'Hold reefer gate-in until the ports reopen. Advise fruit exporters that this week cut-offs will not be met. Reconfirm plug availability before releasing trucks.',
   'CLSAI:sea:both,CLVAP:sea:both', '[]', NULL, NULL,
   'c.ferreira@aglgroup.com'),

  ('demo-am-callao-blockade',
   'Road blockade at the Callao mining corridor',
   'Community protests have blockaded the mining corridor south of Lima, stopping concentrate movements to the port.',
   'Security', 'Civil unrest', 'Mining & Metals', 'warning', 'published',
   -2, NULL, 51,
   'Concentrate deliveries to the port terminal have stopped. Two nominated vessels are waiting with no cargo available to load.',
   'Advise mining clients that laycans will move. Assess the northern routing for the highest-priority tonnage. Daily contact with the mine community relations team.',
   'PECLL:road sea:export', '[]', NULL, NULL,
   'c.ferreira@aglgroup.com'),

  ('demo-am-ecuador-emergency',
   'State of emergency extended — Ecuador',
   'The state of emergency has been extended for a further 60 days, with a night curfew in the coastal provinces including Guayas.',
   'Security', 'Civil unrest', 'Agriculture', 'warning', 'published',
   -1, 20, 59,
   'Night road movement is prohibited, which removes the overnight drayage window banana exporters rely on. Port operations continue but the cargo cannot always reach the gate.',
   'Move collections into daylight hours. Advise banana and shrimp exporters of the tighter loading window. Review security cover on the Guayaquil corridor.',
   '!EC:road sea air:both', '[]', NULL, NULL,
   'c.ferreira@aglgroup.com'),

  ('demo-am-guayaquil-inspection',
   'Guayaquil — container inspection rates raised on export cargo',
   'Anti-narcotics inspection of export containers has been intensified following several contamination cases.',
   'Security', 'Theft', 'Agriculture', 'watch', 'published',
   -4, 16, 96,
   'Two to three days added on export cargo, and reefer boxes are being opened at ambient temperature.',
   'Build the inspection time into the cut-off. Use approved sealing procedures and photograph seals at stuffing.',
   'ECGYE:sea:export', '[]', NULL, NULL,
   'c.ferreira@aglgroup.com'),

  ('demo-am-cartagena-yard',
   'Cartagena — transhipment yard at high occupancy',
   'Relay volumes displaced from the Panama Canal restrictions have raised yard occupancy to 89%.',
   'Congestion', 'Port congestion', NULL, 'watch', 'published',
   -2, 12, 68,
   'Connection windows are tightening on the Caribbean relays.',
   'Nominate onward vessels at booking. Monitor relay performance weekly.',
   'COCTG:sea:both', '[]', NULL, NULL,
   'c.ferreira@aglgroup.com'),

  ('demo-am-buenaventura-roadworks',
   'Buenaventura — access road works',
   'Roadworks on the port access route begin in three days, with single-lane working during the day.',
   'Infrastructure', 'Road closure', NULL, 'info', 'published',
   3, 17, 114,
   'Drayage delays of two to four hours during working hours.',
   'Shift collections to the overnight window where security allows.',
   'COBUN:road:both', '[]', NULL, NULL,
   'c.ferreira@aglgroup.com'),

  ('demo-am-montevideo-reefer',
   'Montevideo — new reefer capacity at the container terminal',
   'Additional reefer plugs have entered service ahead of the citrus export season.',
   'Infrastructure', 'Port equipment', 'Agriculture', 'info', 'published',
   -5, 26, 126,
   'More reefer capacity on a lane that had been constrained at peak.',
   'Review citrus export routings against the added capacity.',
   'UYMVD:sea:both', '[]', NULL, NULL,
   'c.ferreira@aglgroup.com'),

  ('demo-am-kingston-hurricane',
   'Kingston — hurricane season berth contingency',
   'The transhipment hub has activated its seasonal contingency plan as the Atlantic season reaches its peak.',
   'Weather', 'Cyclone', NULL, 'watch', 'published',
   0, 10, 91,
   'Relay schedules may be adjusted at short notice. There is no current disruption.',
   'Expect short-notice changes to relay connections through the season.',
   'JMKIN:sea:both', '[]', NULL, NULL,
   'd.whitfield@aglgroup.com'),

  ('demo-am-caucedo-call',
   'Caucedo — additional weekly call added',
   'A second weekly call on the North Europe service has been added at the hub.',
   'Infrastructure', 'Port equipment', NULL, 'info', 'published',
   -4, 24, 118,
   'Improved connectivity for Caribbean relays on the Europe trade.',
   'Review Caribbean routings at the next service review.',
   'DOCAU:sea:both', '[]', NULL, NULL,
   'd.whitfield@aglgroup.com'),

-- ------------------------------- OCEANIA -----------------------------
  ('demo-oc-australia-action',
   'Protected industrial action at Sydney and Melbourne terminals',
   'The maritime union has served notice of protected industrial action from tomorrow: rolling four-hour stoppages and bans on overtime at the container terminals in both ports.',
   'Strike', 'Port workers', 'All industries', 'warning', 'published',
   1, 8, 43,
   'Vessel productivity will drop by roughly 40% for the duration, and berth windows will slip progressively through the week. Landside gate slots are being cut to match.',
   'Move export cut-offs forward by 48 hours. Rebook time-critical import collection now. Expect a two-week recovery once the action ends.',
   'AUSYD:sea:both,AUMEL:sea:both', '[]', NULL, NULL,
   'b.hollis@aglgroup.com'),

  ('demo-oc-brisbane-flood',
   'Brisbane — flood watch on the port access motorway',
   'Heavy rainfall is forecast for south-east Queensland, with flooding possible on the Port Drive approach.',
   'Weather', 'Flood', NULL, 'watch', 'published',
   1, 5, 55,
   'Drayage delays are likely if the approach floods. The terminal itself is above the flood line.',
   'Monitor the forecast and reschedule non-urgent collections out of the peak rainfall window.',
   'AUBNE:road:both', '[]', NULL, NULL,
   'b.hollis@aglgroup.com'),

  ('demo-oc-fremantle-rail',
   'Fremantle — reduced rail shuttle capacity',
   'Track maintenance has cut the North Quay rail shuttle to two rotations a day.',
   'Infrastructure', 'Rail works', NULL, 'info', 'published',
   -3, 14, 99,
   'More container volume is moving by road, with a corresponding rise in gate queueing.',
   'Book road drayage further ahead than usual during the works.',
   'AUFRE:rail:both', '[]', NULL, NULL,
   'b.hollis@aglgroup.com'),

  ('demo-oc-auckland-dwell',
   'Auckland — import dwell rising after a run of late arrivals',
   'Vessel bunching after weather delays in the Tasman has pushed yard occupancy up sharply.',
   'Congestion', 'Port congestion', NULL, 'watch', 'published',
   -2, 10, 61,
   'Import dwell is at 6 days and rising. Collection appointments are scarce for the rest of the week.',
   'Book collection appointments as soon as the vessel berths. Advise clients of the extended cycle.',
   'NZAKL:sea:import', '[]', NULL, NULL,
   'b.hollis@aglgroup.com'),

  ('demo-oc-tauranga-gates',
   'Tauranga — additional weekend gate shift',
   'The terminal has added a Sunday gate shift through the kiwifruit export season.',
   'Infrastructure', 'Port equipment', 'Agriculture', 'info', 'published',
   -5, 22, 124,
   'Additional export gate-in capacity at the seasonal peak.',
   'Offer weekend gate-in to horticultural exporters.',
   'NZTRG:sea road:both', '[]', NULL, NULL,
   'b.hollis@aglgroup.com'),

-- =============== NATIONWIDE (whole-country map fills) ================
-- Location key '!XX' instead of a LOCODE — the block is the country
-- itself, so the dashboard paints the polygon rather than dropping a
-- pin. Eight more are inline in the regional sections above (Nigeria,
-- Morocco, France, Greece, Vietnam, Bangladesh, Chile, Ecuador); grep
-- for "'!" to find every one of them.
--
-- These are all live TODAY on purpose. Whole-country events are
-- normally *announced* ahead ("strike called for next week"), and it is
-- tempting to give them a future valid_from — but valid_from controls
-- map visibility, so that hides the country fill on the very screen the
-- feature exists for. The event stays in the future in the prose; the
-- alert is visible now.
  ('demo-nw-za-loadshedding',
   'Stage 6 load-shedding — nationwide power cuts, South Africa',
   'The utility has escalated to stage 6 rotational load-shedding after further generation unit failures. Ports, terminals and inland depots are all inside the shedding schedule.',
   'Infrastructure', 'Power', 'All industries', 'critical', 'published',
   -2, 12, 18,
   'Terminal cranes and reefer stacks fall back to generator power for up to six hours a day. Refrigerated cargo at inland depots is at risk where backup power is thin, and customs offices are offline during shedding blocks.',
   'Confirm generator autonomy at every reefer point this week. Move customs lodgement outside the shedding window. Warn clients that inland collection appointments will slip.',
   '!ZA:sea road rail warehouse:both', '[]', NULL, NULL,
   's.naidoo@aglgroup.com'),

  ('demo-nw-us-rail',
   'Freight rail labour dispute — national bargaining round, United States',
   'The national bargaining round has reached the cooling-off stage without agreement. A nationwide freight rail stoppage becomes legally possible once the cooling-off period expires.',
   'Strike', 'General', 'All industries', 'warning', 'published',
   -1, 21, 33,
   'Intermodal bookings beyond the cooling-off date are at risk across every US lane. Carriers have begun embargoing hazardous and perishable traffic ahead of the deadline.',
   'Pull forward intermodal moves that can travel early. Quote road for anything that must arrive after the deadline. Brief clients on the embargo sequence now, not when it starts.',
   '!US:rail road:both', '[]', NULL, NULL,
   'd.whitfield@aglgroup.com'),

  ('demo-nw-br-truckers',
   'Truckers protest over diesel pricing — nationwide, Brazil',
   'Independent haulier associations have begun rolling blockades on federal highways over diesel pricing, with the main soybean and sugar corridors affected first.',
   'Strike', 'Road transport', 'Agriculture', 'warning', 'published',
   0, 7, 20,
   'Highway blockades are stopping cargo reaching Santos and Paranaguá. Export loading rates are falling and the anchorage queue is lengthening at both ports.',
   'Hold dispatch on affected corridors rather than stranding drivers in a blockade. Reassess laycans daily. Advise agricultural exporters that loading will slip.',
   '!BR:road:export', '[]', NULL, NULL,
   'c.ferreira@aglgroup.com'),

  ('demo-nw-ar-fx',
   'Import payment authorisation delays — nationwide, Argentina',
   'The central bank has extended the deferral period for access to foreign currency on import payments, and the authorisation queue has lengthened further.',
   'Regulatory', 'Customs', 'Retail & FMCG', 'warning', 'published',
   -4, NULL, 66,
   'Importers cannot pay suppliers within contracted terms, so shipments are being held at origin. Cargo already landed is accumulating in bonded storage while authorisation is pending.',
   'Confirm payment authorisation before shipping, not after. Warn clients that bonded storage will be charged. Review credit exposure on Argentine accounts this week.',
   '!AR:sea air road:import', '[]', NULL, NULL,
   'c.ferreira@aglgroup.com'),

  ('demo-nw-co-blockades',
   'Roadblocks on the main freight corridors — nationwide, Colombia',
   'Protest roadblocks are in place on several national highways, including the Bogotá to Buenaventura and Medellín to Cartagena corridors.',
   'Security', 'Civil unrest', 'All industries', 'warning', 'published',
   -1, 9, 29,
   'Inland movement to and from both coasts is intermittent. Trucks are being held for 12 to 30 hours at blockade points and export cut-offs are being missed.',
   'Route via the alternative corridors where the blockade map allows. Do not dispatch into an active blockade. Confirm corridor status each morning before releasing trucks.',
   '!CO:road:both', '[]', NULL, NULL,
   'c.ferreira@aglgroup.com'),

  ('demo-nw-in-customs',
   'Electronic bill of entry amendments mandatory — nationwide, India',
   'Customs has moved amendment of the bill of entry entirely onto the electronic platform, withdrawing the manual counter process at all ports and ICDs.',
   'Regulatory', 'Customs', 'All industries', 'watch', 'published',
   -3, NULL, 74,
   'Amendments that used to be settled at the counter now queue on the platform, adding a day or more wherever classification or valuation is corrected after filing.',
   'Get classification right at first filing — the correction path is now slower everywhere. Brief the clearance desk and client documentation teams this week.',
   '!IN:sea air road rail:import', '[]', NULL, NULL,
   'p.raghavan@aglgroup.com'),

  ('demo-nw-id-licensing',
   'Import licensing regime widened — nationwide, Indonesia',
   'The trade ministry has widened the list of goods requiring an import licence and a pre-shipment surveyor report.',
   'Regulatory', 'Customs', 'Retail & FMCG', 'watch', 'published',
   -2, NULL, 82,
   'Cargo shipped without the pre-shipment surveyor report will not clear on arrival. Several accounts import goods that have just come into scope.',
   'Screen the product lists of every Indonesian importer this week. Arrange surveyor inspection at origin before booking.',
   '!ID:sea air:import', '[]', NULL, NULL,
   'w.chen@aglgroup.com'),

  ('demo-nw-au-biosecurity',
   'Seasonal biosecurity measures in force — nationwide, Australia',
   'The seasonal stink bug measures are in force for goods shipped from target risk countries, requiring offshore treatment and certification.',
   'Health', 'Border health check', 'Automotive', 'watch', 'published',
   -5, 40, 108,
   'Untreated cargo from target countries is directed for onshore treatment or re-export, adding two to three weeks and significant cost. Vehicles and machinery are the most exposed.',
   'Confirm offshore treatment certification before every affected shipment sails. Warn automotive and machinery clients of the seasonal window.',
   '!AU:sea:import', '[]', NULL, NULL,
   'b.hollis@aglgroup.com'),

  ('demo-nw-ke-protests',
   'Protests over the fuel levy — nationwide, Kenya',
   'Demonstrations have been called in Nairobi, Mombasa and several county capitals over the revised fuel levy, with a heavier police presence expected on the main routes.',
   'Security', 'Civil unrest', 'All industries', 'watch', 'published',
   0, 6, 25,
   'Drayage on the Mombasa to Nairobi highway is likely to be interrupted on protest days, and the Nairobi ICD may operate at reduced staffing.',
   'Move collections away from the announced protest days. Avoid city-centre routes. Confirm driver safety arrangements before dispatch.',
   '!KE:road rail:both', '[]', NULL, NULL,
   'j.otieno@aglgroup.com'),

  ('demo-nw-eg-fx',
   'Foreign currency restrictions on import letters of credit — nationwide, Egypt',
   'Banks are rationing foreign currency for import letters of credit, and the release queue for non-essential goods has lengthened.',
   'Regulatory', 'Customs', 'Retail & FMCG', 'warning', 'published',
   -7, NULL, 155,
   'Import cargo is landing without a funded letter of credit and accumulating at Alexandria and Port Said. Storage and demurrage are building on cargo that cannot be released.',
   'Confirm the letter of credit is funded before the vessel sails. Advise clients that release timing is outside our control. Escalate long-standing cases with the bank weekly.',
   '!EG:sea:import', '[]', NULL, NULL,
   'h.farouk@aglgroup.com'),

  ('demo-nw-mx-customs',
   'Customs platform migration — nationwide, Mexico',
   'Customs is migrating declarations to the new electronic platform, with both systems running in parallel during the transition.',
   'Regulatory', 'Customs', 'All industries', 'info', 'published',
   -6, 20, 128,
   'Declarations lodged on the retiring system are being reprocessed, which adds a day at some ports and none at others.',
   'Move the clearance desk to the new platform ahead of the cut-over rather than at it.',
   '!MX:sea road air:both', '[]', NULL, NULL,
   'd.whitfield@aglgroup.com'),

-- ============ Feed-only: future-dated and already expired =============
-- These sit outside today validity window on purpose. They appear in
-- the feed (which shows every published alert) but NOT on the map
-- (which shows only what is live right now) — which is exactly why the
-- dashboard active count is lower than the feed count.
  ('demo-x-goldenweek',
   'Golden Week factory closures — China',
   'Factory and office closures over the national holiday, with a pre-holiday booking surge in the two weeks beforehand.',
   'Regulatory', 'Customs', 'Retail & FMCG', 'info', 'published',
   40, 52, 30,
   'Expect a rate spike and space shortage before the closure, then two weeks of very thin volume.',
   'Book pre-holiday space six weeks ahead. Warn clients that post-holiday recovery takes a fortnight.',
   'CNSGH:sea:both,CNNBO:sea:both', '[]', NULL, NULL,
   'h.tanaka@aglgroup.com'),

  ('demo-x-network-reshuffle',
   'Carrier network reshuffle effective next quarter',
   'The alliance has published its next-quarter network, dropping one North Europe call and adding a direct Mediterranean string.',
   'Regulatory', 'Tariff', NULL, 'info', 'published',
   30, NULL, 50,
   'Transit times change on several lanes. Two clients lose their direct call and will need a relay.',
   'Model the new transit times before the contract round. Brief affected clients in advance of the switch.',
   'NLRTM:sea:both,BEANR:sea:both', '[]',
   '{"mode": "identical"}', NULL,
   'l.vandijk@aglgroup.com'),

  ('demo-x-takoradi-crane',
   'Port equipment upgrade completed — Takoradi',
   'The mobile harbour crane replacement programme has completed, restoring full berth productivity.',
   'Infrastructure', 'Port equipment', NULL, 'info', 'published',
   -30, -3, 740,
   'Productivity restored to the pre-works level.',
   'No further action. The temporary routing to Tema can be withdrawn.',
   'GHTKD:sea:both', '[]', NULL, NULL,
   'c.diallo@aglgroup.com'),

  ('demo-x-capetown-season',
   'Winter swell season advisory — Cape Town',
   'Seasonal advisory for the winter swell period, now past.',
   'Weather', 'Swell', NULL, 'info', 'published',
   -40, -6, 980,
   'Intermittent pilotage suspensions through the season, as expected.',
   'Superseded by the current wind advisory.',
   'ZACPT:sea:both', '[]', NULL, NULL,
   's.naidoo@aglgroup.com'),

-- ==================== Approval queue: submitted =======================
-- Authored by people who lack internal publication rights for the
-- country in question, which is what routes them to Submit rather than
-- Publish. Between them they fill the queue for the West Africa,
-- Europe, Middle East, Asia and Americas perimeters.
  ('demo-sub-apapa-strike',
   'Truckers strike announced — Apapa port access, Lagos',
   'The Lagos truckers union has called an indefinite strike over the new e-call-up fees, effective tomorrow. Access roads to Apapa and Tin Can Island are expected to be blocked from 05:00. Port authority negotiations are scheduled for today.',
   'Strike', 'Road transport', 'All industries', 'warning', 'submitted',
   0, NULL, 2,
   'Gate-in and gate-out trucking suspended from tomorrow. Expect a three-to-five day dwell increase on imports, and export cut-offs at risk for four sailings.',
   'Reroute urgent deliveries via the Tin Can Island rail shuttle. Advance client pickups today. Daily status call at 08:00 WAT.',
   'NGAPP:sea road:both', '[]', NULL, NULL,
   'a.kouassi@aglgroup.com'),

  ('demo-sub-tema-berth',
   'Berth waiting time rising — Tema, Ghana',
   'Median berth wait is up to 3.1 days after crane downtime at the container terminal. Vessel bunching is expected midweek.',
   'Congestion', 'Port congestion', NULL, 'info', 'submitted',
   0, 9, 5,
   'Import dwell is rising and two services have already been rescheduled. Reefer monitoring has been stepped up as a precaution.',
   'Prioritise reefer and time-critical discharge. Advise clients of the midweek delay.',
   'GHTEM:sea:import', '[]', NULL, NULL,
   'e.mensah@aglgroup.com'),

  ('demo-sub-abidjan-bond',
   'New transit bond requirement — Abidjan northbound corridor',
   'A revised transit bond guarantee will be required for northbound corridor cargo from next week.',
   'Regulatory', 'Transit bond', NULL, 'watch', 'submitted',
   6, NULL, 27,
   'Additional guarantee cost and paperwork on the Mali and Burkina Faso transit lanes. Clearance will be slower while brokers adapt.',
   'Brief the forwarding desk. Pre-arrange bonds with the broker. Notify corridor clients this week.',
   'CIABJ:road:export', '[]', NULL, NULL,
   'e.mensah@aglgroup.com'),

  ('demo-sub-terneuzen-lock',
   'Lock failure at Terneuzen — Ghent canal traffic suspended',
   'A gate failure at the new Terneuzen lock has suspended canal traffic to Ghent. Repair time is estimated at three to four days.',
   'Infrastructure', 'Port equipment', NULL, 'warning', 'submitted',
   0, 5, 3,
   'Barge rotations between Antwerp, Rotterdam and Ghent are stopped. Roughly 40 barges are waiting on either side of the lock.',
   'Switch hinterland moves to rail for the repair period. Advise clients with Ghent-bound cargo of a four-day delay.',
   'BEANR:sea:both,NLRTM:sea:both', '[]', NULL, NULL,
   'j.petit@aglgroup.com'),

  ('demo-sub-greece-rail',
   '24-hour national rail strike — Greek network',
   'The rail union has called a 24-hour stoppage next week, affecting the Piraeus to Thessaloniki freight corridor.',
   'Strike', 'General', NULL, 'watch', 'submitted',
   5, 7, 8,
   'Rail departures from the port are cancelled for the day, and the Balkan corridor loses one rotation.',
   'Move rail bookings either side of the strike day. Road is available at a premium.',
   'GRPIR:rail:both', '[]', NULL, NULL,
   'j.petit@aglgroup.com'),

  ('demo-sub-singapore-bunker',
   'Bunker barge shortage worsening — Singapore',
   'Barge availability has deteriorated further this week, with waiting times at the eastern anchorages now beyond 36 hours.',
   'Congestion', 'Anchorage queue', 'Oil & Gas', 'warning', 'submitted',
   0, 8, 6,
   'Vessels are missing their next berth window because of the bunker wait, which is starting to show up as schedule slippage across the Asia–Europe strings.',
   'Nominate bunkers at the previous port call where the rotation allows. Escalate persistent delays with the supplier.',
   'SGSIN:sea:both', '[]', NULL, NULL,
   'h.tanaka@aglgroup.com'),

  ('demo-sub-jebelali-customs',
   'Customs system outage — Jebel Ali clearance halted',
   'The customs declaration platform has been unavailable since this morning. No estimated restoration time has been given.',
   'Infrastructure', 'Port equipment', NULL, 'warning', 'submitted',
   0, 2, 4,
   'No import clearance is being processed. Cargo is accumulating at the terminal and storage will start running on the affected consignments.',
   'Hold collection appointments. Prepare declarations offline for bulk lodgement once the platform returns.',
   'AEJEA:sea:import', '[]', NULL, NULL,
   'p.raghavan@aglgroup.com'),

  ('demo-sub-manzanillo-embargo',
   'Rail embargo extended — Manzanillo to Guadalajara',
   'The rail operator has extended its embargo on new intermodal bookings from the port to the Bajío while it works down the backlog.',
   'Infrastructure', 'Rail works', 'Automotive', 'warning', 'submitted',
   0, 10, 9,
   'No new rail bookings are being accepted for at least a week. Road capacity on the corridor is already fully committed.',
   'Hold non-urgent inland moves. Quote road only where the client accepts the premium.',
   'MXZLO:rail:both', '[]', NULL, NULL,
   'c.ferreira@aglgroup.com'),

  ('demo-sub-callao-gate',
   'Blockade at the Callao port access — concentrate movements halted',
   'Protesters have blockaded the port access road at Callao, extending the existing corridor blockade to the terminal gate itself.',
   'Security', 'Civil unrest', 'Mining & Metals', 'warning', 'submitted',
   0, NULL, 11,
   'No concentrate is reaching the terminal. Three vessels are waiting and the stockpile at the mine is approaching capacity.',
   'Advise mining clients that laycans will move again. Escalate to the client community relations lead. Reassess daily.',
   'PECLL:road:export', '[]', NULL, NULL,
   'd.whitfield@aglgroup.com'),

  ('demo-sub-wafrica-surcharge',
   'Congestion surcharge announced — West Africa services',
   'Two carriers have announced a congestion surcharge on West African discharge ports effective next week, citing extended berth waiting times.',
   'Regulatory', 'Tariff', 'All industries', 'watch', 'submitted',
   7, NULL, 30,
   'An unbudgeted cost on every affected import. Clients on fixed-rate contracts will query whether it is contractually chargeable.',
   'Check each contract for surcharge exposure before the effective date. Notify affected clients this week with the contractual position stated clearly.',
   'GHTEM:sea:both,NGAPP:sea:both,CIABJ:sea:both', '[]', NULL, NULL,
   'e.mensah@aglgroup.com'),

-- ============ Drafts and rejections (the default sign-in) =============
-- The default identity is the first user created, normally Awa Kouassi.
-- "My alerts" needs content, including a rejected alert — the one
-- lifecycle branch that is otherwise invisible until someone rejects
-- something live in the demo.
  ('demo-dr-seasonal-template',
   'Seasonal port congestion — draft',
   'Reusable template for the recurring seasonal congestion at Abidjan.',
   'Congestion', 'Port congestion', NULL, 'watch', 'draft',
   0, NULL, 48,
   'Template — fill in the per-season impact.',
   'Template — fill in the per-season action plan.',
   'CIABJ:sea:import', '[]', NULL, NULL,
   'a.kouassi@aglgroup.com'),

  ('demo-dr-vridi-dredging',
   'Vridi channel maintenance — dates to confirm',
   'The port authority has indicated maintenance dredging of the Vridi canal next month. Dates are not yet published, so this is held as a draft until the notice is issued.',
   'Infrastructure', 'Port equipment', NULL, 'info', 'draft',
   5, 25, 20,
   'Draft awaiting the official notice. Expect a draft restriction during the works.',
   'Confirm the dates with the harbour master before publishing.',
   'CIABJ:sea:both', '[]', NULL, NULL,
   'a.kouassi@aglgroup.com'),

  ('demo-dr-fuel-passthrough',
   'Fuel price adjustment — Ivorian domestic haulage',
   'A domestic diesel price revision has been announced, and hauliers are expected to pass it through from next month.',
   'Regulatory', 'Tariff', NULL, 'info', 'draft',
   2, NULL, 6,
   'Drayage rates on the Abidjan corridor will rise. The exact pass-through is not yet confirmed.',
   'Await haulier notifications before publishing, so the figure quoted is the real one.',
   'CIABJ:road:both', '[]', NULL, NULL,
   'a.kouassi@aglgroup.com'),

  ('demo-rj-abidjan-gate',
   'Minor gate delay at Abidjan terminal',
   'Gate processing was slower than usual this morning, with queues of around 40 minutes reported at the main gate.',
   'Congestion', 'Port congestion', NULL, 'info', 'rejected',
   0, 3, 34,
   'Modest delay to collections. No material impact on cut-offs.',
   'Monitor and advise clients if it persists past today.',
   'CIABJ:sea road:both', '[]', NULL,
   'Duplicate of the anchorage queue alert already published for Abidjan, and the impact described is within normal daily variation. Please fold anything new into the existing alert rather than raising a second one for the same terminal.',
   'a.kouassi@aglgroup.com'),

  ('demo-rj-sanpedro-plugs',
   'Reefer plug shortage reported at San-Pédro',
   'Reports from two clients that reefer plugs were unavailable on arrival at the terminal.',
   'Infrastructure', 'Port equipment', NULL, 'watch', 'rejected',
   0, 7, 80,
   'If confirmed, reefer exports would need to divert to Abidjan.',
   'Confirm plug availability with the terminal before dispatching reefer cargo.',
   'CISPY:sea:both', '[]', NULL,
   'Checked with the terminal — plug availability is normal for the cocoa peak and there is no shortage to report. Please reconfirm with the terminal duty manager before resubmitting.',
   'e.mensah@aglgroup.com'),

-- ============================== Closed ================================
-- Published, ran their course, closed by the author. In the feed, not
-- on the map.
  ('demo-cl-nacala-cyclone',
   'Cyclone Ilonga — Nacala port closure',
   'A category 2 system made landfall north of Nacala and the port was closed for four days.',
   'Weather', 'Cyclone', NULL, 'critical', 'closed',
   -26, -14, 380,
   'The port was closed four days, with a further six days of backlog. Two services omitted the call entirely.',
   'Backlog cleared. Closing this alert; the corridor damage assessment is being tracked separately.',
   'MZMNC:sea:both', '[]', NULL, NULL,
   'm.nunes@aglgroup.com'),

  ('demo-cl-tema-power',
   'Power outage at the Tema container terminal',
   'A substation fault took reefer power and terminal systems offline for 19 hours.',
   'Infrastructure', 'Power', NULL, 'warning', 'closed',
   -20, -11, 300,
   'Reefer cargo was moved to generator power within two hours and no cargo loss was reported. Gate operations were suspended for the day.',
   'The terminal has completed the substation repair and confirmed the redundancy test. Closing.',
   'GHTEM:sea:both', '[]', NULL, NULL,
   'c.diallo@aglgroup.com'),

  ('demo-cl-beitbridge',
   'Border closure at Beitbridge — Zimbabwe crossing',
   'The crossing was closed for three days during a protest, with all northbound traffic held at Musina.',
   'Security', 'Civil unrest', 'Mining & Metals', 'warning', 'closed',
   -18, -8, 260,
   'Roughly 900 trucks were held, and the queue took a week to clear after reopening.',
   'The crossing has been operating normally for a week. Closing.',
   'ZADUR:road:export', '[]', NULL, NULL,
   's.naidoo@aglgroup.com')
),

-- One row per location block, from the comma-separated loc_spec.
spec AS (
  SELECT a.id AS alert_id,
         t.ord,
         split_part(t.item, ':', 1) AS key,
         split_part(t.item, ':', 2) AS modes,
         split_part(t.item, ':', 3) AS flow
  FROM a, LATERAL unnest(string_to_array(a.loc_spec, ',')) WITH ORDINALITY AS t(item, ord)
),

-- ...rebuilt as the JSON the app stores on the alert. The flag emoji is
-- derived from the ISO2 code: 0x1F1E6 is REGIONAL INDICATOR SYMBOL A.
locs AS (
  SELECT s.alert_id,
         json_agg(
           json_build_object(
             'name',         n.name,
             'code',         n.code,
             'country',      n.country,
             'country_name', c.name,
             'flag',         chr(127462 + ascii(substr(n.country, 1, 1)) - 65)
                          || chr(127462 + ascii(substr(n.country, 2, 1)) - 65),
             'lat',          n.lat,
             'lng',          n.lng,
             'modes',        string_to_array(s.modes, ' '),
             'flow',         s.flow,
             'scope',        n.scope
           )
           ORDER BY s.ord
         ) AS locations
  FROM spec s
  JOIN node n ON n.key = s.key
  JOIN ctry c ON c.code = n.country
  GROUP BY s.alert_id
),

-- Author fallback: the oldest user, used for any email not in `users`.
fallback AS (SELECT id FROM users ORDER BY created_at LIMIT 1)

INSERT INTO alerts (
  id, title, description, picture_url, category, sub_category, industry,
  severity, status, origin, visibility, valid_from, valid_to, impacts,
  action_plan, locations, urls, attachments, clients, external_variant,
  rejection_comment, author_id, created_at, updated_at, submitted_at,
  published_at, closed_at
)
SELECT
  a.id,
  a.title,
  a.description,
  NULL,
  a.category,
  a.sub_category,
  a.industry,
  a.severity,
  a.status,
  'human',
  CASE WHEN a.external_variant IS NULL THEN 'internal' ELSE 'internal_external' END,
  CURRENT_DATE + a.from_days,
  CASE WHEN a.to_days IS NULL THEN NULL ELSE CURRENT_DATE + a.to_days END,
  a.impacts,
  a.action_plan,
  l.locations,
  a.urls::json,
  '[]'::json,
  '[]'::json,
  a.external_variant::json,
  a.rejection_comment,
  COALESCE(u.id, f.id),
  -- created_at drives feed ordering, so it is derived rather than now().
  x.t0 - CASE
           WHEN a.status IN ('published', 'closed')   THEN interval '3 hours'
           WHEN a.status IN ('submitted', 'rejected') THEN interval '2 hours'
           ELSE interval '0'
         END,
  x.t0,
  CASE WHEN a.status IN ('published', 'closed')   THEN x.t0 - interval '1 hour'
       WHEN a.status IN ('submitted', 'rejected') THEN x.t0 END,
  CASE WHEN a.status IN ('published', 'closed')   THEN x.t0 END,
  CASE WHEN a.status = 'closed' THEN x.t0 + make_interval(hours => a.age_hours / 2) END
FROM a
JOIN locs l ON l.alert_id = a.id
CROSS JOIN LATERAL (
  SELECT (now() AT TIME ZONE 'utc') - make_interval(hours => a.age_hours) AS t0
) x
LEFT JOIN users u ON u.email = a.author_email
-- LEFT, not CROSS: on an empty `users` table a CROSS JOIN would match no
-- rows and insert nothing at all, silently. This way author_id comes out
-- NULL and the NOT NULL constraint tells you what is actually wrong.
LEFT JOIN fallback f ON true;

COMMIT;


-- ---------------------------------------------------------------------
-- 3. Verify. Expect 159 demo alerts in total, 19 of them nationwide.
--
--    If the total is short, `places` is missing codes this script
--    references and those alerts were dropped by the join — run
--    ops/seed_places.sql and then re-run this file.
-- ---------------------------------------------------------------------
SELECT count(*) AS demo_alerts FROM alerts WHERE id LIKE 'demo-%';

SELECT status,
       count(*)                                              AS alerts,
       count(*) FILTER (WHERE severity = 'critical')         AS critical,
       count(*) FILTER (WHERE severity = 'warning')          AS warning,
       count(*) FILTER (WHERE severity = 'watch')            AS watch,
       count(*) FILTER (WHERE severity = 'info')             AS info
FROM alerts WHERE id LIKE 'demo-%'
GROUP BY status ORDER BY status;

-- What the map will actually show (published AND live today), by country.
SELECT loc ->> 'country' AS country, count(*) AS live_alerts
FROM alerts, LATERAL json_array_elements(locations) AS loc
WHERE id LIKE 'demo-%'
  AND status = 'published'
  AND valid_from <= CURRENT_DATE
  AND (valid_to IS NULL OR valid_to >= CURRENT_DATE)
GROUP BY 1 ORDER BY 2 DESC, 1;

-- Any alert attributed to the fallback author because its email is not
-- in `users` — expect 0 rows on a fully seeded database.
SELECT a.id, a.title
FROM alerts a
WHERE a.id LIKE 'demo-%'
  AND a.author_id = (SELECT id FROM users ORDER BY created_at LIMIT 1)
ORDER BY a.id;


-- ---------------------------------------------------------------------
-- 4. To remove the demo data again:
--        DELETE FROM alerts WHERE id LIKE 'demo-%';
-- ---------------------------------------------------------------------
