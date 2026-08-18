-- =====================================================================
--  SWAN — seed the blocked email domains (registration policy)
--  An empty table is not a neutral default: it means any consumer
--  address may register. Safe to re-run; existing rows are untouched,
--  so a rule an operator paused stays paused.
-- =====================================================================

INSERT INTO email_domain_rules (pattern, note, active, created_at) VALUES
  ('gmail.com', 'Consumer webmail.', true, (now() AT TIME ZONE 'utc')),
  ('googlemail.com', 'Consumer webmail (Gmail alias domain).', true, (now() AT TIME ZONE 'utc')),
  ('yahoo.com', 'Consumer webmail.', true, (now() AT TIME ZONE 'utc')),
  ('hotmail.com', 'Consumer webmail.', true, (now() AT TIME ZONE 'utc')),
  ('outlook.com', 'Consumer webmail.', true, (now() AT TIME ZONE 'utc')),
  ('live.com', 'Consumer webmail.', true, (now() AT TIME ZONE 'utc')),
  ('msn.com', 'Consumer webmail.', true, (now() AT TIME ZONE 'utc')),
  ('aol.com', 'Consumer webmail.', true, (now() AT TIME ZONE 'utc')),
  ('icloud.com', 'Consumer webmail.', true, (now() AT TIME ZONE 'utc')),
  ('me.com', 'Consumer webmail (iCloud alias domain).', true, (now() AT TIME ZONE 'utc')),
  ('protonmail.com', 'Consumer webmail.', true, (now() AT TIME ZONE 'utc')),
  ('proton.me', 'Consumer webmail.', true, (now() AT TIME ZONE 'utc')),
  ('gmx.com', 'Consumer webmail.', true, (now() AT TIME ZONE 'utc')),
  ('mail.com', 'Consumer webmail.', true, (now() AT TIME ZONE 'utc')),
  ('yandex.com', 'Consumer webmail.', true, (now() AT TIME ZONE 'utc')),
  ('qq.com', 'Consumer webmail.', true, (now() AT TIME ZONE 'utc')),
  ('163.com', 'Consumer webmail.', true, (now() AT TIME ZONE 'utc')),
  ('mailinator.com', 'Disposable address service.', true, (now() AT TIME ZONE 'utc')),
  ('yopmail.com', 'Disposable address service.', true, (now() AT TIME ZONE 'utc')),
  ('guerrillamail.com', 'Disposable address service.', true, (now() AT TIME ZONE 'utc'))
ON CONFLICT (pattern) DO NOTHING;

-- Verify: expect at least 20
SELECT count(*) AS blocked_domains FROM email_domain_rules;
