CREATE TYPE "CalendarEntryCategory" AS ENUM (
  'EARNINGS',
  'ECONOMIC_INDICATOR',
  'DIVIDEND',
  'FILING',
  'REMINDER',
  'OTHER'
);

CREATE TABLE "CalendarEntry" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" VARCHAR(120) NOT NULL,
  "eventDate" DATE NOT NULL,
  "startTimeMinutes" INTEGER,
  "timeZone" VARCHAR(64),
  "category" "CalendarEntryCategory" NOT NULL,
  "description" TEXT,
  "sourceUrl" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "CalendarEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CalendarEntry_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "CalendarEntry_userId_eventDate_startTimeMinutes_idx"
ON "CalendarEntry"("userId", "eventDate", "startTimeMinutes");
