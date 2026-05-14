-- Step 2 of 2: Migrate legacy ACTIVE rows to VALIDATED and fix column default.
-- Runs after 20260514204051 has committed the new enum values.

UPDATE "interests"
SET "status" = 'VALIDATED'::"InterestStatus"
WHERE "status"::text = 'ACTIVE';

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
