-- =====================================================================
--  SWAN — grant full administrator rights to two self-registered users
--  Generated from app/reference.py · 238 countries
--  Safe to re-run (idempotent). Run in the Neon SQL Editor.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Pre-flight: confirm both ids exist BEFORE granting anything.
--    An UPDATE against a wrong id succeeds silently on 0 rows, so check
--    this returns exactly 2 rows first.
-- ---------------------------------------------------------------------
SELECT id, email, name, status, role_label FROM users WHERE id IN (
  '8f0407fc-7d82-4279-84f8-702dbdf0eed3',
  '9b15cf10-beb5-4cfd-9c1c-baa71f8bf8a9'
);

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Standard rights profiles.
--    `seed.py` normally creates these; if it never ran, the profiles table
--    is empty and the WORLD profile below wouldn't resolve to anything.
-- ---------------------------------------------------------------------
INSERT INTO profiles (name, countries, embeds_rights_manager) VALUES
  ('WORLD', '["AF", "AL", "DZ", "AS", "AD", "AO", "AI", "AG", "AR", "AM", "AW", "AU", "AT", "AZ", "BH", "BD", "BB", "BY", "BE", "BZ", "BJ", "BM", "BT", "BO", "BA", "BW", "BR", "IO", "VG", "BN", "BG", "BF", "BI", "CV", "KH", "CM", "CA", "KY", "CF", "TD", "CL", "CO", "KM", "CG", "CK", "CR", "HR", "CU", "CW", "CY", "CZ", "CI", "CD", "DK", "DJ", "DM", "DO", "TL", "EC", "EG", "SV", "GQ", "ER", "EE", "SZ", "ET", "FK", "FO", "FM", "FJ", "FI", "FR", "PF", "TF", "GA", "GM", "GE", "DE", "GH", "GI", "GR", "GL", "GD", "GU", "GT", "GG", "GN", "GW", "GY", "HT", "HM", "HN", "HK", "HU", "IS", "IN", "ID", "IR", "IQ", "IE", "IM", "IL", "IT", "JM", "JP", "JE", "JO", "KZ", "KE", "KI", "XK", "KW", "KG", "LA", "LV", "LB", "LS", "LR", "LY", "LI", "LT", "LU", "MO", "MG", "MW", "MY", "MV", "ML", "MT", "MH", "MR", "MU", "MX", "MD", "MC", "MN", "ME", "MS", "MA", "MZ", "MM", "NA", "NR", "NP", "NL", "NC", "NZ", "NI", "NE", "NG", "NU", "NF", "KP", "MK", "MP", "NO", "OM", "PK", "PW", "PS", "PA", "PG", "PY", "CN", "PE", "PH", "PN", "PL", "PT", "PR", "QA", "RO", "RU", "RW", "BL", "SH", "KN", "LC", "MF", "PM", "VC", "WS", "SM", "SA", "SN", "RS", "SC", "SL", "SG", "SX", "SK", "SI", "SB", "SO", "ZA", "GS", "KR", "SS", "ES", "LK", "SD", "SR", "SE", "CH", "SY", "ST", "TW", "TJ", "TZ", "TH", "BS", "TG", "TO", "TT", "TN", "TR", "TM", "TC", "TV", "UG", "UA", "AE", "GB", "US", "UM", "VI", "UY", "UZ", "VU", "VA", "VE", "VN", "WF", "EH", "YE", "ZM", "ZW", "AX"]'::json, true),
  ('WEST-AFRICA', '["CI", "NG", "GH", "SN", "CM"]'::json, false),
  ('SOUTHERN-AFRICA', '["ZA", "MZ", "ZM"]'::json, false),
  ('EAST-AFRICA', '["KE", "TZ"]'::json, false)
ON CONFLICT (name) DO UPDATE SET
  countries             = EXCLUDED.countries,
  embeds_rights_manager = EXCLUDED.embeds_rights_manager;

-- ---------------------------------------------------------------------
-- 2. Promote the two accounts to full administrators.
--
--    status='active'        lifts the 'pending' flag self-registration sets
--    can_create             the Create-alert dimension
--    is_rights_manager      admin sections + orphaned-alert escalation
--    profiles=['WORLD']     nice perimeter label, and grants internal reach
--    the three country lists are ALSO set explicitly, so the accounts keep
--    full rights even if someone later narrows the WORLD profile.
--    (external publication ignores profiles by design — rights.py:29 — so
--     the explicit external list is the only thing that grants it.)
-- ---------------------------------------------------------------------
UPDATE users SET
  status                 = 'active',
  role_label             = 'Rights Manager',
  can_create             = true,
  is_rights_manager      = true,
  internal_pub_countries = '["AF", "AL", "DZ", "AS", "AD", "AO", "AI", "AG", "AR", "AM", "AW", "AU", "AT", "AZ", "BH", "BD", "BB", "BY", "BE", "BZ", "BJ", "BM", "BT", "BO", "BA", "BW", "BR", "IO", "VG", "BN", "BG", "BF", "BI", "CV", "KH", "CM", "CA", "KY", "CF", "TD", "CL", "CO", "KM", "CG", "CK", "CR", "HR", "CU", "CW", "CY", "CZ", "CI", "CD", "DK", "DJ", "DM", "DO", "TL", "EC", "EG", "SV", "GQ", "ER", "EE", "SZ", "ET", "FK", "FO", "FM", "FJ", "FI", "FR", "PF", "TF", "GA", "GM", "GE", "DE", "GH", "GI", "GR", "GL", "GD", "GU", "GT", "GG", "GN", "GW", "GY", "HT", "HM", "HN", "HK", "HU", "IS", "IN", "ID", "IR", "IQ", "IE", "IM", "IL", "IT", "JM", "JP", "JE", "JO", "KZ", "KE", "KI", "XK", "KW", "KG", "LA", "LV", "LB", "LS", "LR", "LY", "LI", "LT", "LU", "MO", "MG", "MW", "MY", "MV", "ML", "MT", "MH", "MR", "MU", "MX", "MD", "MC", "MN", "ME", "MS", "MA", "MZ", "MM", "NA", "NR", "NP", "NL", "NC", "NZ", "NI", "NE", "NG", "NU", "NF", "KP", "MK", "MP", "NO", "OM", "PK", "PW", "PS", "PA", "PG", "PY", "CN", "PE", "PH", "PN", "PL", "PT", "PR", "QA", "RO", "RU", "RW", "BL", "SH", "KN", "LC", "MF", "PM", "VC", "WS", "SM", "SA", "SN", "RS", "SC", "SL", "SG", "SX", "SK", "SI", "SB", "SO", "ZA", "GS", "KR", "SS", "ES", "LK", "SD", "SR", "SE", "CH", "SY", "ST", "TW", "TJ", "TZ", "TH", "BS", "TG", "TO", "TT", "TN", "TR", "TM", "TC", "TV", "UG", "UA", "AE", "GB", "US", "UM", "VI", "UY", "UZ", "VU", "VA", "VE", "VN", "WF", "EH", "YE", "ZM", "ZW", "AX"]'::json,
  external_pub_countries = '["AF", "AL", "DZ", "AS", "AD", "AO", "AI", "AG", "AR", "AM", "AW", "AU", "AT", "AZ", "BH", "BD", "BB", "BY", "BE", "BZ", "BJ", "BM", "BT", "BO", "BA", "BW", "BR", "IO", "VG", "BN", "BG", "BF", "BI", "CV", "KH", "CM", "CA", "KY", "CF", "TD", "CL", "CO", "KM", "CG", "CK", "CR", "HR", "CU", "CW", "CY", "CZ", "CI", "CD", "DK", "DJ", "DM", "DO", "TL", "EC", "EG", "SV", "GQ", "ER", "EE", "SZ", "ET", "FK", "FO", "FM", "FJ", "FI", "FR", "PF", "TF", "GA", "GM", "GE", "DE", "GH", "GI", "GR", "GL", "GD", "GU", "GT", "GG", "GN", "GW", "GY", "HT", "HM", "HN", "HK", "HU", "IS", "IN", "ID", "IR", "IQ", "IE", "IM", "IL", "IT", "JM", "JP", "JE", "JO", "KZ", "KE", "KI", "XK", "KW", "KG", "LA", "LV", "LB", "LS", "LR", "LY", "LI", "LT", "LU", "MO", "MG", "MW", "MY", "MV", "ML", "MT", "MH", "MR", "MU", "MX", "MD", "MC", "MN", "ME", "MS", "MA", "MZ", "MM", "NA", "NR", "NP", "NL", "NC", "NZ", "NI", "NE", "NG", "NU", "NF", "KP", "MK", "MP", "NO", "OM", "PK", "PW", "PS", "PA", "PG", "PY", "CN", "PE", "PH", "PN", "PL", "PT", "PR", "QA", "RO", "RU", "RW", "BL", "SH", "KN", "LC", "MF", "PM", "VC", "WS", "SM", "SA", "SN", "RS", "SC", "SL", "SG", "SX", "SK", "SI", "SB", "SO", "ZA", "GS", "KR", "SS", "ES", "LK", "SD", "SR", "SE", "CH", "SY", "ST", "TW", "TJ", "TZ", "TH", "BS", "TG", "TO", "TT", "TN", "TR", "TM", "TC", "TV", "UG", "UA", "AE", "GB", "US", "UM", "VI", "UY", "UZ", "VU", "VA", "VE", "VN", "WF", "EH", "YE", "ZM", "ZW", "AX"]'::json,
  client_scope           = '["AF", "AL", "DZ", "AS", "AD", "AO", "AI", "AG", "AR", "AM", "AW", "AU", "AT", "AZ", "BH", "BD", "BB", "BY", "BE", "BZ", "BJ", "BM", "BT", "BO", "BA", "BW", "BR", "IO", "VG", "BN", "BG", "BF", "BI", "CV", "KH", "CM", "CA", "KY", "CF", "TD", "CL", "CO", "KM", "CG", "CK", "CR", "HR", "CU", "CW", "CY", "CZ", "CI", "CD", "DK", "DJ", "DM", "DO", "TL", "EC", "EG", "SV", "GQ", "ER", "EE", "SZ", "ET", "FK", "FO", "FM", "FJ", "FI", "FR", "PF", "TF", "GA", "GM", "GE", "DE", "GH", "GI", "GR", "GL", "GD", "GU", "GT", "GG", "GN", "GW", "GY", "HT", "HM", "HN", "HK", "HU", "IS", "IN", "ID", "IR", "IQ", "IE", "IM", "IL", "IT", "JM", "JP", "JE", "JO", "KZ", "KE", "KI", "XK", "KW", "KG", "LA", "LV", "LB", "LS", "LR", "LY", "LI", "LT", "LU", "MO", "MG", "MW", "MY", "MV", "ML", "MT", "MH", "MR", "MU", "MX", "MD", "MC", "MN", "ME", "MS", "MA", "MZ", "MM", "NA", "NR", "NP", "NL", "NC", "NZ", "NI", "NE", "NG", "NU", "NF", "KP", "MK", "MP", "NO", "OM", "PK", "PW", "PS", "PA", "PG", "PY", "CN", "PE", "PH", "PN", "PL", "PT", "PR", "QA", "RO", "RU", "RW", "BL", "SH", "KN", "LC", "MF", "PM", "VC", "WS", "SM", "SA", "SN", "RS", "SC", "SL", "SG", "SX", "SK", "SI", "SB", "SO", "ZA", "GS", "KR", "SS", "ES", "LK", "SD", "SR", "SE", "CH", "SY", "ST", "TW", "TJ", "TZ", "TH", "BS", "TG", "TO", "TT", "TN", "TR", "TM", "TC", "TV", "UG", "UA", "AE", "GB", "US", "UM", "VI", "UY", "UZ", "VU", "VA", "VE", "VN", "WF", "EH", "YE", "ZM", "ZW", "AX"]'::json,
  profiles               = '["WORLD"]'::json
WHERE id IN (
  '8f0407fc-7d82-4279-84f8-702dbdf0eed3',
  '9b15cf10-beb5-4cfd-9c1c-baa71f8bf8a9'
);

COMMIT;

-- ---------------------------------------------------------------------
-- 3. Verify (should return 2 rows, both 238 / 238 / 238 / t / t / active).
-- ---------------------------------------------------------------------
SELECT
  email, name, status, role_label, can_create, is_rights_manager,
  json_array_length(internal_pub_countries) AS internal_n,
  json_array_length(external_pub_countries) AS external_n,
  json_array_length(client_scope)           AS clients_n,
  profiles
FROM users
WHERE id IN (
  '8f0407fc-7d82-4279-84f8-702dbdf0eed3',
  '9b15cf10-beb5-4cfd-9c1c-baa71f8bf8a9'
);
