-- Step 1 of 2: Add VALIDATED and PENDING to InterestStatus enum.
-- Must be a separate migration from the UPDATE that uses these values,
-- because PostgreSQL requires ADD VALUE to be committed before the new
-- values can be referenced in DML statements.
-- ALTER TYPE ADD VALUE cannot run inside a transaction.

-- no transaction

ALTER TYPE "InterestStatus" ADD VALUE IF NOT EXISTS 'VALIDATED';
ALTER TYPE "InterestStatus" ADD VALUE IF NOT EXISTS 'PENDING';
