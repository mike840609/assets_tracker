CREATE TABLE "DemoWorkspace" (
  "userId" TEXT NOT NULL,
  "visitorHash" TEXT NOT NULL,
  "creatorHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "mutationCount" INTEGER NOT NULL DEFAULT 0,
  "mutationWindowStartedAt" TIMESTAMPTZ(3),
  "mutationWindowCount" INTEGER NOT NULL DEFAULT 0,
  "resetCount" INTEGER NOT NULL DEFAULT 0,
  "refreshWindowStartedAt" TIMESTAMPTZ(3),
  "refreshCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DemoWorkspace_pkey" PRIMARY KEY ("userId"),
  CONSTRAINT "DemoWorkspace_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "DemoWorkspace_visitorHash_key" ON "DemoWorkspace"("visitorHash");
CREATE INDEX "DemoWorkspace_expiresAt_idx" ON "DemoWorkspace"("expiresAt");
CREATE INDEX "DemoWorkspace_creatorHash_expiresAt_idx"
  ON "DemoWorkspace"("creatorHash", "expiresAt");
