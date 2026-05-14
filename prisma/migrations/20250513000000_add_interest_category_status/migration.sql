-- CreateEnum (idempotent: skip if type already exists)
DO $$ BEGIN
  CREATE TYPE "InterestStatus" AS ENUM ('VALIDATED', 'PENDING');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable
ALTER TABLE "interests"
  ADD COLUMN "category" TEXT,
  ADD COLUMN "status" "InterestStatus" NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "interests_status_idx" ON "interests"("status");
