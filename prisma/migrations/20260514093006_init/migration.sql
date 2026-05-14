-- CreateEnum (idempotent)
DO $$ BEGIN
  CREATE TYPE "InterestStatus" AS ENUM ('ACTIVE', 'INACTIVE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Ensure ACTIVE value exists (in case enum was created with different values)
ALTER TYPE "InterestStatus" ADD VALUE IF NOT EXISTS 'ACTIVE';

-- AlterTable (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'interests' AND column_name = 'category'
  ) THEN
    ALTER TABLE "interests" ADD COLUMN "category" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'interests' AND column_name = 'status'
  ) THEN
    ALTER TABLE "interests" ADD COLUMN "status" "InterestStatus" NOT NULL DEFAULT 'ACTIVE';
  END IF;
END $$;

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "interests_status_idx" ON "interests"("status");
