-- CreateEnum
CREATE TYPE "InterestStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterTable
ALTER TABLE "interests" ADD COLUMN     "category" TEXT,
ADD COLUMN     "status" "InterestStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateIndex
CREATE INDEX "interests_status_idx" ON "interests"("status");
