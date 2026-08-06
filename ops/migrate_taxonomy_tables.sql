-- =====================================================================
--  SWAN — create the editable-taxonomy tables (categories + industries)
--
--  This is the hand-runnable equivalent of Alembic migration c1a7f2e40b18,
--  for running in the Neon SQL Editor when you'd rather not point Alembic at
--  production. It does exactly what the migration does, and then moves the
--  Alembic pointer forward so the two do NOT drift — if you skip that last
--  part, a later `alembic upgrade head` will try to create these tables again
--  and fail with "relation already exists".
--
--  Safe to re-run. Run ops/seed_taxonomy.sql afterwards to fill the tables.
-- =====================================================================

BEGIN;

-- Column types and nullability mirror what SQLAlchemy emits for these models
-- (verified against CreateTable(...).compile(dialect=postgresql.dialect())), so
-- a database built this way is identical to one built by Alembic.
CREATE TABLE IF NOT EXISTS categories (
    name           VARCHAR   NOT NULL,
    sub_categories JSON      NOT NULL,
    position       INTEGER   NOT NULL,
    created_at     TIMESTAMP NOT NULL,
    PRIMARY KEY (name)
);

CREATE TABLE IF NOT EXISTS industries (
    name       VARCHAR   NOT NULL,
    position   INTEGER   NOT NULL,
    created_at TIMESTAMP NOT NULL,
    PRIMARY KEY (name)
);

-- ---------------------------------------------------------------------
-- Keep Alembic honest.
--
-- Only touches `alembic_version` if that table exists (it won't if this
-- database was created by seed.py's create_all rather than by Alembic) and
-- only moves the pointer when it is sitting exactly on the baseline, so
-- re-running this is a no-op.
-- ---------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'alembic_version') THEN
        UPDATE alembic_version
           SET version_num = 'c1a7f2e40b18'
         WHERE version_num = 'b3ad85791899';
    END IF;
END
$$;

COMMIT;

-- ---------------------------------------------------------------------
-- Verify: both tables present (0 rows each until seed_taxonomy.sql runs).
-- ---------------------------------------------------------------------
SELECT (SELECT count(*) FROM categories)  AS categories,
       (SELECT count(*) FROM industries)  AS industries;
