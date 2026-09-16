-- ============================================================
-- Migration: Add product tags
-- ============================================================

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';

-- Keep the product view in sync with the products table. CREATE OR REPLACE
-- VIEW is idempotent and preserves existing dependencies on the view.
CREATE OR REPLACE VIEW view_products AS
SELECT
    p.productsid,
    p.productname,
    p.baseprice,
    p.description,
    p.status,
    c.categoryname,
    pi.imageurl AS thumbnail,
    COALESCE(SUM(s.quantity), 0) AS totalstock,
    p.createdat,
    p.tags
FROM products p
JOIN category c ON p.categoriesid = c.categoriesid
LEFT JOIN productimages pi
    ON p.productsid = pi.productsid
   AND pi.isthumbnail = TRUE
LEFT JOIN stock s ON p.productsid = s.productsid
GROUP BY
    p.productsid,
    p.productname,
    p.baseprice,
    p.description,
    p.status,
    c.categoryname,
    pi.imageurl,
    p.createdat,
    p.tags;
