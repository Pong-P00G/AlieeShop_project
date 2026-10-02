-- ============================================================
-- Migration: User profile picture
-- ============================================================
-- Stores the public CDN URL of the user's avatar (uploaded to the
-- same S3-compatible bucket as product images, under the profile/
-- prefix). NULL means "no picture" — the UI falls back to initials.

ALTER TABLE users ADD COLUMN IF NOT EXISTS profilepictureurl TEXT;
