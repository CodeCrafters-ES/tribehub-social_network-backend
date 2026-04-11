-- CreateTable
CREATE TABLE "delete_account_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delete_account_requests_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "delete_account_requests" ADD CONSTRAINT "delete_account_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
