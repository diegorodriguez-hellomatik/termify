-- Add is_favorite column to terminals table
ALTER TABLE "terminals" ADD COLUMN "is_favorite" BOOLEAN NOT NULL DEFAULT false;
