-- AlterEnum: add INACTIVE value to InterestStatus (idempotent)
ALTER TYPE "InterestStatus" ADD VALUE IF NOT EXISTS 'INACTIVE';
