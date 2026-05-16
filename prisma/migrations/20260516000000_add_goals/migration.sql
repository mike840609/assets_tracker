-- Create GoalScope enum and Goal model for F1 — net-worth goals & milestones

CREATE TYPE "GoalScope" AS ENUM ('NET_WORTH', 'ASSETS_ONLY', 'CATEGORY', 'ACCOUNT');

CREATE TABLE "Goal" (
    "id"             TEXT NOT NULL,
    "userId"         TEXT NOT NULL,
    "name"           TEXT NOT NULL,
    "targetAmount"   DECIMAL(18,8) NOT NULL,
    "targetCurrency" TEXT NOT NULL DEFAULT 'USD',
    "targetDate"     DATE,
    "scope"          "GoalScope" NOT NULL,
    "scopeRefId"     TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Goal_userId_createdAt_idx" ON "Goal" ("userId", "createdAt" DESC);

ALTER TABLE "Goal" ADD CONSTRAINT "Goal_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
