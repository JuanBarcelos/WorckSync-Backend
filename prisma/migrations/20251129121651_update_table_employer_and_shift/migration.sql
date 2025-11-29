/*
  Warnings:

  - You are about to drop the column `admissionDate` on the `employees` table. All the data in the column will be lost.
  - You are about to drop the column `dismissalDate` on the `employees` table. All the data in the column will be lost.
  - You are about to drop the column `document` on the `employees` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `employees` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `employees` table. All the data in the column will be lost.
  - You are about to drop the column `code` on the `shifts` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `shifts` table. All the data in the column will be lost.
  - You are about to drop the column `workDays` on the `shifts` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_employees" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sheetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "shiftId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "employees_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_employees" ("createdAt", "department", "id", "isActive", "name", "position", "sheetId", "shiftId", "updatedAt") SELECT "createdAt", "department", "id", "isActive", "name", "position", "sheetId", "shiftId", "updatedAt" FROM "employees";
DROP TABLE "employees";
ALTER TABLE "new_employees" RENAME TO "employees";
CREATE UNIQUE INDEX "employees_sheetId_key" ON "employees"("sheetId");
CREATE INDEX "employees_shiftId_idx" ON "employees"("shiftId");
CREATE INDEX "employees_isActive_idx" ON "employees"("isActive");
CREATE TABLE "new_shifts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "lunchStartTime" TEXT NOT NULL,
    "lunchEndTime" TEXT NOT NULL,
    "toleranceMinutes" INTEGER NOT NULL DEFAULT 10,
    "overtimeAllowed" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_shifts" ("createdAt", "endTime", "id", "isActive", "lunchEndTime", "lunchStartTime", "name", "overtimeAllowed", "startTime", "toleranceMinutes", "updatedAt") SELECT "createdAt", "endTime", "id", "isActive", "lunchEndTime", "lunchStartTime", "name", "overtimeAllowed", "startTime", "toleranceMinutes", "updatedAt" FROM "shifts";
DROP TABLE "shifts";
ALTER TABLE "new_shifts" RENAME TO "shifts";
CREATE UNIQUE INDEX "shifts_name_key" ON "shifts"("name");
CREATE INDEX "shifts_isActive_idx" ON "shifts"("isActive");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
