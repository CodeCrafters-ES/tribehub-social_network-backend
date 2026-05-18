/*
  Warnings:

  - Made the column `expiresAt` on table `delete_account_requests` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "delete_account_requests" ALTER COLUMN "expiresAt" SET NOT NULL;

-- CreateIndex
CREATE INDEX "delete_account_requests_userId_idx" ON "delete_account_requests"("userId");
