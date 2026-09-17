-- ============================================================
-- Migration: Add createdat column to discounts table
-- Run: psql -U postgres -d aliee_shop -f server/migrations/add_discounts_createdat.sql
--
-- getAllDiscounts() (productModel.js) selects and orders by d.createdat, but no
-- migration ever created the column, so GET /api/products/discounts failed on
-- any database built from these migrations.
-- ============================================================

ALTER TABLE discounts
    ADD COLUMN IF NOT EXISTS createdat TIMESTAMP;

-- Backfill existing rows: a discount cannot have been created after it starts
UPDATE discounts
SET createdat = startdate
WHERE createdat IS NULL AND startdate IS NOT NULL;

-- Default for rows inserted without an explicit timestamp
ALTER TABLE discounts
    ALTER COLUMN createdat SET DEFAULT NOW();
