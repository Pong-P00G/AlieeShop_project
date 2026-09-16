-- ============================================================
-- Migration: Add dashboard notifications and audit log tables
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
    notificationid INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    userid         INTEGER REFERENCES users(usersid) ON DELETE CASCADE,
    type           VARCHAR(50) NOT NULL DEFAULT 'system'
                   CHECK (type IN ('order', 'user', 'stock', 'system', 'product')),
    message        TEXT NOT NULL,
    link           VARCHAR(500),
    isread         BOOLEAN DEFAULT FALSE,
    createdat      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_read
    ON notifications(isread, createdat DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user
    ON notifications(userid, createdat DESC);

CREATE TABLE IF NOT EXISTS audit_log (
    auditid       INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    action        VARCHAR(50) NOT NULL,
    entity_type   VARCHAR(50) NOT NULL,
    entity_id     INTEGER,
    entity_name   VARCHAR(255),
    performed_by  VARCHAR(100),
    details       TEXT,
    createdat     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created
    ON audit_log(createdat DESC);
