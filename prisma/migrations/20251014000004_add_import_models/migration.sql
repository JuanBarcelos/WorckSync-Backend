/*
  Warnings:

  - Added the required column `fileName` to the `imports` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fileSize` to the `imports` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mimeType` to the `imports` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `imports` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dayOfWeek` to the `time_records` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `time_records` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "import_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importId" TEXT NOT NULL,
    "row" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "import_logs_importId_fkey" FOREIGN KEY ("importId") REFERENCES "imports" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_imports" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "totalRecords" INTEGER NOT NULL DEFAULT 0,
    "processedRecords" INTEGER NOT NULL DEFAULT 0,
    "failedRecords" INTEGER NOT NULL DEFAULT 0,
    "errors" TEXT,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "processedAt" DATETIME,
    "completedAt" DATETIME,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "imports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_imports" ("createdAt", "id", "userId") SELECT "createdAt", "id", "userId" FROM "imports";
DROP TABLE "imports";
ALTER TABLE "new_imports" RENAME TO "imports";
CREATE INDEX "imports_status_idx" ON "imports"("status");
CREATE INDEX "imports_userId_idx" ON "imports"("userId");
CREATE TABLE "new_time_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "importId" TEXT,
    "date" DATETIME NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "clockIn1" TEXT,
    "clockOut1" TEXT,
    "clockIn2" TEXT,
    "clockOut2" TEXT,
    "clockIn3" TEXT,
    "clockOut3" TEXT,
    "totalWorkedMinutes" INTEGER NOT NULL DEFAULT 0,
    "regularMinutes" INTEGER NOT NULL DEFAULT 0,
    "overtimeMinutes" INTEGER NOT NULL DEFAULT 0,
    "nightShiftMinutes" INTEGER NOT NULL DEFAULT 0,
    "lateMinutes" INTEGER NOT NULL DEFAULT 0,
    "earlyLeaveMinutes" INTEGER NOT NULL DEFAULT 0,
    "absentMinutes" INTEGER NOT NULL DEFAULT 0,
    "isHoliday" BOOLEAN NOT NULL DEFAULT false,
    "isWeekend" BOOLEAN NOT NULL DEFAULT false,
    "hasIssues" BOOLEAN NOT NULL DEFAULT false,
    "isManualEntry" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "time_records_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "time_records_importId_fkey" FOREIGN KEY ("importId") REFERENCES "imports" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_time_records" ("createdAt", "date", "employeeId", "id") SELECT "createdAt", "date", "employeeId", "id" FROM "time_records";
DROP TABLE "time_records";
ALTER TABLE "new_time_records" RENAME TO "time_records";
CREATE INDEX "time_records_employeeId_idx" ON "time_records"("employeeId");
CREATE INDEX "time_records_date_idx" ON "time_records"("date");
CREATE INDEX "time_records_importId_idx" ON "time_records"("importId");
CREATE UNIQUE INDEX "time_records_employeeId_date_key" ON "time_records"("employeeId", "date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "import_logs_importId_idx" ON "import_logs"("importId");
