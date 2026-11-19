-- Run this after the table schema in Neon SQL Editor.
-- These are scrypt password hashes used by the application.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "passwordHash" TEXT,
  ADD COLUMN IF NOT EXISTS "phone" TEXT,
  ADD COLUMN IF NOT EXISTS "department" TEXT,
  ADD COLUMN IF NOT EXISTS "semester" TEXT;

ALTER TABLE "Registration"
  ADD COLUMN IF NOT EXISTS "fullName" TEXT,
  ADD COLUMN IF NOT EXISTS "phone" TEXT,
  ADD COLUMN IF NOT EXISTS "department" TEXT,
  ADD COLUMN IF NOT EXISTS "semester" TEXT,
  ADD COLUMN IF NOT EXISTS "notes" TEXT,
  ADD COLUMN IF NOT EXISTS "paymentProof" TEXT;

ALTER TABLE "Event"
  ADD COLUMN IF NOT EXISTS "requiresPayment" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "paymentAmount" NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS "bannerImage" TEXT;
ON CONFLICT ("email") DO UPDATE SET
  "name" = EXCLUDED."name",
  "passwordHash" = EXCLUDED."passwordHash",
  "role" = EXCLUDED."role";
