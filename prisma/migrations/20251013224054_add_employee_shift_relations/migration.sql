/*
  Warnings:

  - Added the required column `admissionDate` to the `employees` table without a default value. This is not possible if the table is not empty.
  - Added the required column `department` to the `employees` table without a default value. This is not possible if the table is not empty.
  - Added the required column `document` to the `employees` table without a default value. This is not possible if the table is not empty.
  - Added the required column `email` to the `employees` table without a default value. This is not possible if the table is not empty.
  - Added the required column `position` to the `employees` table without a default value. This is not possible if the table is not empty.
  - Added the required column `code` to the `shifts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `endTime` to the `shifts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lunchEndTime` to the `shifts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lunchStartTime` to the `shifts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startTime` to the `shifts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workDays` to the `shifts` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "time_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "time_records_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "occurrences" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "occurrences_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_employees" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sheetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "document" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "admissionDate" DATETIME NOT NULL,
    "dismissalDate" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "shiftId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "employees_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_employees" ("createdAt", "id", "name", "sheetId", "updatedAt") SELECT "createdAt", "id", "name", "sheetId", "updatedAt" FROM "employees";
DROP TABLE "employees";
ALTER TABLE "new_employees" RENAME TO "employees";
CREATE UNIQUE INDEX "employees_sheetId_key" ON "employees"("sheetId");
CREATE UNIQUE INDEX "employees_email_key" ON "employees"("email");
CREATE UNIQUE INDEX "employees_document_key" ON "employees"("document");
CREATE INDEX "employees_shiftId_idx" ON "employees"("shiftId");
CREATE INDEX "employees_isActive_idx" ON "employees"("isActive");
CREATE INDEX "employees_document_idx" ON "employees"("document");
CREATE TABLE "new_shifts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "lunchStartTime" TEXT NOT NULL,
    "lunchEndTime" TEXT NOT NULL,
    "workDays" TEXT NOT NULL,
    "toleranceMinutes" INTEGER NOT NULL DEFAULT 10,
    "overtimeAllowed" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_shifts" ("createdAt", "id", "name", "updatedAt") SELECT "createdAt", "id", "name", "updatedAt" FROM "shifts";
DROP TABLE "shifts";
ALTER TABLE "new_shifts" RENAME TO "shifts";
CREATE UNIQUE INDEX "shifts_name_key" ON "shifts"("name");
CREATE UNIQUE INDEX "shifts_code_key" ON "shifts"("code");
CREATE INDEX "shifts_isActive_idx" ON "shifts"("isActive");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
