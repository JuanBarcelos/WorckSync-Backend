/*
  Warnings:

  - Added the required column `date` to the `occurrences` table without a default value. This is not possible if the table is not empty.
  - Added the required column `minutes` to the `occurrences` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `occurrences` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `occurrences` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_occurrences" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "timeRecordId" TEXT,
    "date" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "minutes" INTEGER NOT NULL,
    "description" TEXT,
    "justification" TEXT,
    "approvedBy" TEXT,
    "approvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "occurrences_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "occurrences_timeRecordId_fkey" FOREIGN KEY ("timeRecordId") REFERENCES "time_records" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "occurrences_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_occurrences" ("createdAt", "employeeId", "id") SELECT "createdAt", "employeeId", "id" FROM "occurrences";
DROP TABLE "occurrences";
ALTER TABLE "new_occurrences" RENAME TO "occurrences";
CREATE INDEX "occurrences_employeeId_idx" ON "occurrences"("employeeId");
CREATE INDEX "occurrences_date_idx" ON "occurrences"("date");
CREATE INDEX "occurrences_type_idx" ON "occurrences"("type");
CREATE INDEX "occurrences_status_idx" ON "occurrences"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
