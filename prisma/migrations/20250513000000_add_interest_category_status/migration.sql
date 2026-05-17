-- CreateEnum (idempotent)
DO $$ BEGIN
  CREATE TYPE "InterestStatus" AS ENUM ('VALIDATED', 'PENDING');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable (idempotent — skips entirely if the interests table does not exist yet)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'interests'
  ) THEN
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
      ALTER TABLE "interests" ADD COLUMN "status" "InterestStatus" NOT NULL DEFAULT 'PENDING';
    END IF;
  END IF;
END $$;

-- CreateIndex (idempotent — skips if table does not exist yet)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'interests'
  ) THEN
    CREATE INDEX IF NOT EXISTS "interests_status_idx" ON "interests"("status");
  END IF;
END $$;
