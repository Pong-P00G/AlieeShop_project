-- ============================================================
-- Migration: Create product reviews table
-- ============================================================

CREATE TABLE IF NOT EXISTS reviews (
    reviewsid      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    productsid     INTEGER NOT NULL REFERENCES products(productsid) ON DELETE CASCADE,
    usersid        INTEGER NOT NULL REFERENCES users(usersid) ON DELETE CASCADE,
    rating         INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title          VARCHAR(200),
    comment        TEXT,
    status         VARCHAR(50) NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'approved', 'rejected')),
    moderationnote TEXT,
    createdat      TIMESTAMPTZ DEFAULT NOW(),
    updatedat      TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT reviews_product_user_unique UNIQUE (productsid, usersid)
);

CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(productsid);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status);
