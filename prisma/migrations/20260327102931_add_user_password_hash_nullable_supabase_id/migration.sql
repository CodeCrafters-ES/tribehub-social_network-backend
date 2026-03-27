-- AlterTable
ALTER TABLE "users" ADD COLUMN     "passwordHash" TEXT,
ALTER COLUMN "supabaseId" DROP NOT NULL;
