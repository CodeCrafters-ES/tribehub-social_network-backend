-- Fix InterestStatus enum: add VALIDATED and PENDING values if they don't exist.
--
-- Context: the initial migration (20260514093006_init) created the enum with
-- only ACTIVE and INACTIVE. Later migrations that added VALIDATED/PENDING used
-- a CREATE TYPE guard (EXCEPTION WHEN duplicate_object THEN NULL) that silently
-- skipped adding those values to the already-existing enum.
-- As a result, staging DBs provisioned in that order lack VALIDATED/PENDING,
-- causing Prisma queries with status = 'VALIDATED' to fail with a 500.
--
-- ALTER TYPE ... ADD VALUE cannot run inside a transaction in PostgreSQL.
-- Prisma's "-- no transaction" pragma disables the implicit transaction wrapper
-- so that the ADD VALUE statements can execute at top level.

-- no transaction

-- Step 1: Add VALIDATED and PENDING to the enum if they are missing.
-- ALTER TYPE ADD VALUE is idempotent via IF NOT EXISTS.
ALTER TYPE "InterestStatus" ADD VALUE IF NOT EXISTS 'VALIDATED';
ALTER TYPE "InterestStatus" ADD VALUE IF NOT EXISTS 'PENDING';

-- Step 2: Migrate any rows that still use the legacy ACTIVE value to VALIDATED.
-- Cast through text so this succeeds regardless of which enum values are present.
UPDATE "interests"
SET "status" = 'VALIDATED'::"InterestStatus"
WHERE "status"::text = 'ACTIVE';

-- Step 3: Change the column default from ACTIVE to PENDING (canonical schema default).
-- Uses pg_attrdef to inspect the raw default expression — more reliable than
-- information_schema.columns.column_default for enum types.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_attrdef d
    JOIN pg_class c ON c.oid = d.adrelid
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = d.adnum
    WHERE c.relname = 'interests'
      AND a.attname = 'status'
      AND pg_get_expr(d.adbin, d.adrelid) LIKE '%ACTIVE%'
  ) THEN
    ALTER TABLE "interests" ALTER COLUMN "status" SET DEFAULT 'PENDING';
  END IF;
END $$;
