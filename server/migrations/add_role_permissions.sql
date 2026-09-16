-- ============================================================
-- Migration: Add role permissions tables
-- ============================================================

ALTER TABLE roles
    ADD COLUMN IF NOT EXISTS level INTEGER NOT NULL DEFAULT 3;

CREATE TABLE IF NOT EXISTS permissions (
    permission_id   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    permission_key  VARCHAR(100) NOT NULL UNIQUE,
    permission_name VARCHAR(150) NOT NULL,
    module          VARCHAR(100) NOT NULL,
    description     TEXT,
    type            VARCHAR(20) NOT NULL DEFAULT 'backend'
                    CHECK (type IN ('frontend', 'backend'))
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id       INTEGER NOT NULL REFERENCES roles(rolesid) ON DELETE CASCADE,
    permission_id INTEGER NOT NULL REFERENCES permissions(permission_id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_permission
    ON role_permissions(permission_id);
