-- CreateEnum
CREATE TYPE "InterestStatus" AS ENUM ('VALIDATED', 'PENDING');

-- AlterTable
ALTER TABLE "interests"
  ADD COLUMN "category" TEXT,
  ADD COLUMN "status" "InterestStatus" NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "interests_status_idx" ON "interests"("status");
