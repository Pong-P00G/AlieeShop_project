-- ============================================================
-- Migration: Remove legacy password-hashing triggers on users
--
-- Two BEFORE triggers on `users` (trg_before_insert_user /
-- trg_before_update_user) re-hashed `passwordhash` with
-- pgcrypto's crypt(gen_salt('bf')) on every write. The app
-- layer (userService.js) already bcrypt-hashes passwords
-- (cost 12) before insert/update, so the trigger hashed the
-- bcrypt hash a second time — a hash-of-a-hash that
-- bcrypt.compare can never verify at login.
--
-- Fix: drop both triggers. `updatedat` bookkeeping, which the
-- update trigger also did, moves to a dedicated trigger so
-- behavior is preserved without the double hashing.
--
-- Note: users created while the triggers were active have
-- double-hashed passwords that no code path can verify —
-- reset those accounts (e.g. via "forgot password").
-- ============================================================

DROP TRIGGER IF EXISTS trg_before_insert_user ON users;
DROP TRIGGER IF EXISTS trg_before_update_user ON users;

-- The trigger functions are now unreferenced; keep the update
-- function's timestamp behavior as a dedicated trigger.
DROP FUNCTION IF EXISTS before_insert_user();

CREATE OR REPLACE FUNCTION touch_updated_at_user() RETURNS trigger AS $$
BEGIN
    NEW.updatedat := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_updated_at_user ON users;

CREATE TRIGGER trg_touch_updated_at_user
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION touch_updated_at_user();
