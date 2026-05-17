-- CreateEnum
CREATE TYPE "AllocationScope" AS ENUM ('ASSET_TYPE', 'ACCOUNT_CATEGORY');

-- CreateTable
CREATE TABLE "AllocationTarget" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scope" "AllocationScope" NOT NULL,
    "key" TEXT NOT NULL,
    "targetPercent" DECIMAL(5,2) NOT NULL,
    "driftThreshold" DECIMAL(5,2) NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AllocationTarget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AllocationTarget_userId_idx" ON "AllocationTarget"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AllocationTarget_userId_scope_key_key" ON "AllocationTarget"("userId", "scope", "key");

-- AddForeignKey
ALTER TABLE "AllocationTarget" ADD CONSTRAINT "AllocationTarget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
