-- ============================================================
-- Migration: Review helpful votes
-- ============================================================
-- One row per (review, user) pair marking a review as helpful.
-- The unique constraint makes a vote idempotent and lets the API
-- toggle it safely with ON CONFLICT DO NOTHING.

CREATE TABLE IF NOT EXISTS review_helpful (
    helpfulid  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reviewsid  INTEGER NOT NULL REFERENCES reviews(reviewsid) ON DELETE CASCADE,
    usersid    INTEGER NOT NULL REFERENCES users(usersid) ON DELETE CASCADE,
    createdat  TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT review_helpful_unique UNIQUE (reviewsid, usersid)
);

CREATE INDEX IF NOT EXISTS idx_review_helpful_review ON review_helpful(reviewsid);
CREATE INDEX IF NOT EXISTS idx_review_helpful_user ON review_helpful(usersid);
