-- Active: 1789533750135@@127.0.0.1@5432@allie-shop
-- ============================================================
-- Migration: Create refresh_tokens table
-- Run: psql -U postgres -d allie-shop -f server/migrations/add_refresh_tokens.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS refresh_tokens (
    refresh_token_id SERIAL       PRIMARY KEY,
    usersid          INTEGER      NOT NULL REFERENCES users(usersid) ON DELETE CASCADE,
    -- Only the SHA-256 hash of the token is stored, never the raw value
    tokenhash        VARCHAR(64)  NOT NULL UNIQUE,
    -- Whether the session was created with "Remember me" (longer expiry)
    rememberme       BOOLEAN      NOT NULL DEFAULT FALSE,
    expiresat        TIMESTAMP    NOT NULL,
    createdat        TIMESTAMP    NOT NULL DEFAULT NOW(),
    -- Set on rotation or logout; revoked rows can never be reused
    revokedat        TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_usersid ON refresh_tokens(usersid);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expiresat ON refresh_tokens(expiresat);
