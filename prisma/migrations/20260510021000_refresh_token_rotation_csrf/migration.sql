ALTER TABLE "refresh_tokens"
  ADD COLUMN "replacedByTokenId" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "ipAddress" TEXT,
  ADD COLUMN "userAgent" TEXT;

CREATE INDEX "refresh_tokens_replacedByTokenId_idx" ON "refresh_tokens"("replacedByTokenId");

ALTER TABLE "refresh_tokens"
  ADD CONSTRAINT "refresh_tokens_replacedByTokenId_fkey"
  FOREIGN KEY ("replacedByTokenId") REFERENCES "refresh_tokens"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
