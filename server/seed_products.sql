-- ============================================================
-- Sample Product Seed for Testing
-- PostgreSQL | Aliee Shop
--
-- Run with:
--   npm run seed            (from the server/ directory)
--   npm run seed -- --force-seed   to seed a non-empty catalog
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Categories
-- ============================================================
INSERT INTO category (categoryname, parentId)
VALUES
    ('Electronics',        NULL),
    ('Smartphones',        (SELECT categoriesid FROM category WHERE categoryname = 'Electronics')),
    ('Audio',              (SELECT categoriesid FROM category WHERE categoryname = 'Electronics')),
    ('Fashion',            NULL),
    ('Men''s Clothing',    (SELECT categoriesid FROM category WHERE categoryname = 'Fashion')),
    ('Footwear',           (SELECT categoriesid FROM category WHERE categoryname = 'Fashion')),
    ('Food & Beverages',   NULL),
    ('Wearables',          (SELECT categoriesid FROM category WHERE categoryname = 'Electronics')),
    ('Laptops',            (SELECT categoriesid FROM category WHERE categoryname = 'Electronics'))
ON CONFLICT (categoryname) DO NOTHING;

-- ============================================================
-- 2. Variant Attributes and Values
-- ============================================================
INSERT INTO variantAttribute (attributeName)
VALUES ('Color'), ('Size'), ('Storage')
ON CONFLICT (attributeName) DO NOTHING;

INSERT INTO variantAttributeValue (attributeId, value)
SELECT a.attributeId, v.value
FROM variantAttribute a
CROSS JOIN LATERAL (VALUES
    ('Color',   'Black'),
    ('Color',   'White'),
    ('Color',   'Blue'),
    ('Color',   'Titanium'),
    ('Size',    'S'),
    ('Size',    'M'),
    ('Size',    'L'),
    ('Size',    'XL'),
    ('Size',    '32'),
    ('Size',    '34'),
    ('Size',    'US 9'),
    ('Size',    'US 10'),
    ('Size',    'US 11'),
    ('Storage', '128GB'),
    ('Storage', '256GB'),
    ('Storage', '512GB'),
    ('Storage', '1TB'),
    ('Color',   'Natural Titanium'),
    ('Color',   'Desert Titanium'),
    ('Color',   'White Titanium'),
    ('Color',   'Black Titanium'),
    ('Color',   'Red'),
    ('Color',   'Silver'),
    ('Color',   'Green')
) AS v(attr, value)
WHERE a.attributeName = v.attr
ON CONFLICT (attributeId, value) DO NOTHING;

-- ============================================================
-- 3. Helper function to get valueId
-- ============================================================
CREATE OR REPLACE FUNCTION get_value_id(attr_name TEXT, val TEXT)
RETURNS INTEGER AS $$
    SELECT vav.valueId
    FROM variantAttributeValue vav
    JOIN variantAttribute va ON vav.attributeId = va.attributeId
    WHERE va.attributeName = attr_name AND vav.value = val;
$$ LANGUAGE sql STABLE;

-- ============================================================
-- 4. Seed Products
-- ============================================================
DO $$
DECLARE
    cat_smartphones_id INTEGER := (SELECT categoriesid FROM category WHERE categoryname = 'Smartphones');
    cat_audio_id       INTEGER := (SELECT categoriesid FROM category WHERE categoryname = 'Audio');
    cat_mens_id        INTEGER := (SELECT categoriesid FROM category WHERE categoryname = 'Men''s Clothing');
    cat_footwear_id    INTEGER := (SELECT categoriesid FROM category WHERE categoryname = 'Footwear');
    cat_food_id        INTEGER := (SELECT categoriesid FROM category WHERE categoryname = 'Food & Beverages');

    prod1_id INTEGER;
    prod2_id INTEGER;
    prod3_id INTEGER;
    prod4_id INTEGER;
    prod5_id INTEGER;
    prod6_id INTEGER;

    var_id INTEGER;
BEGIN
    -- --------------------------------------------------------
    -- Product 1: iPhone 15 Pro
    -- --------------------------------------------------------
    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'iPhone 15 Pro') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_smartphones_id, 'iPhone 15 Pro', 999.00,
                'Apple iPhone 15 Pro with titanium design, A17 Pro chip, and pro camera system.',
                'active', ARRAY['best_seller', 'premium'])
        RETURNING productsId INTO prod1_id;
    END IF;

    IF prod1_id IS NULL THEN
        SELECT productsId INTO prod1_id FROM products WHERE productname = 'iPhone 15 Pro';
    END IF;

    -- Only seed images for a product that has none yet.
    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = prod1_id) THEN
    INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
    VALUES
        (prod1_id, '/cdn/images/products/iphone-15-pro-1.jpg', 'iPhone 15 Pro',            TRUE,  1),
        (prod1_id, '/cdn/images/products/iphone-15-pro-2.jpg', 'iPhone 15 Pro front view', FALSE, 2),
        (prod1_id, '/cdn/images/products/iphone-15-pro-3.jpg', 'iPhone 15 Pro in hand',    FALSE, 3)
    ON CONFLICT DO NOTHING;
    END IF;

    -- Only seed variants for a product that has none yet.
    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = prod1_id) THEN

    -- Variants: color + storage
    INSERT INTO variants (productsId, sku) VALUES (prod1_id, 'IPP-BLK-128') RETURNING variantId INTO var_id;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (var_id, get_value_id('Color',   'Black')),
        (var_id, get_value_id('Storage', '128GB'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (prod1_id, var_id, 25, 5);

    INSERT INTO variants (productsId, sku) VALUES (prod1_id, 'IPP-BLK-256') RETURNING variantId INTO var_id;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (var_id, get_value_id('Color',   'Black')),
        (var_id, get_value_id('Storage', '256GB'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (prod1_id, var_id, 18, 5);

    INSERT INTO variants (productsId, sku) VALUES (prod1_id, 'IPP-WHT-128') RETURNING variantId INTO var_id;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (var_id, get_value_id('Color',   'White')),
        (var_id, get_value_id('Storage', '128GB'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (prod1_id, var_id, 12, 5);

    INSERT INTO variants (productsId, sku) VALUES (prod1_id, 'IPP-TIT-512') RETURNING variantId INTO var_id;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (var_id, get_value_id('Color',   'Titanium')),
        (var_id, get_value_id('Storage', '512GB'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (prod1_id, var_id, 8, 5);

    -- Discount example
    INSERT INTO discounts (productsId, amounts, startDate, endDate)
    VALUES (prod1_id, 50.00, NOW() - INTERVAL '1 day', NOW() + INTERVAL '7 days');

    END IF;

    -- --------------------------------------------------------
    -- Product 2: Nike Air Max
    -- --------------------------------------------------------
    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Nike Air Max') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_footwear_id, 'Nike Air Max', 129.99,
                'Classic Nike Air Max sneakers with visible Air cushioning.',
                'active', ARRAY['best_seller'])
        RETURNING productsId INTO prod2_id;
    END IF;

    IF prod2_id IS NULL THEN
        SELECT productsId INTO prod2_id FROM products WHERE productname = 'Nike Air Max';
    END IF;

    -- Only seed images for a product that has none yet.
    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = prod2_id) THEN
    INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
    VALUES
        (prod2_id, '/cdn/images/products/nike-air-max-1.jpg', 'Nike Air Max 180',  TRUE,  1),
        (prod2_id, '/cdn/images/products/nike-air-max-2.jpg', 'Nike Air Max Plus', FALSE, 2)
    ON CONFLICT DO NOTHING;
    END IF;

    -- Only seed variants for a product that has none yet.
    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = prod2_id) THEN

    INSERT INTO variants (productsId, sku) VALUES (prod2_id, 'NAM-BLK-9') RETURNING variantId INTO var_id;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (var_id, get_value_id('Color', 'Black')),
        (var_id, get_value_id('Size',  'US 9'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (prod2_id, var_id, 30, 10);

    INSERT INTO variants (productsId, sku) VALUES (prod2_id, 'NAM-WHT-10') RETURNING variantId INTO var_id;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (var_id, get_value_id('Color', 'White')),
        (var_id, get_value_id('Size',  'US 10'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (prod2_id, var_id, 22, 10);

    END IF;

    -- --------------------------------------------------------
    -- Product 3: Levi's 501 Jeans
    -- --------------------------------------------------------
    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Levi''s 501 Original Jeans') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_mens_id, 'Levi''s 501 Original Jeans', 79.50,
                'Iconic straight fit jeans with button fly.',
                'active', ARRAY['best_seller'])
        RETURNING productsId INTO prod3_id;
    END IF;

    IF prod3_id IS NULL THEN
        SELECT productsId INTO prod3_id FROM products WHERE productname = 'Levi''s 501 Original Jeans';
    END IF;

    -- Only seed images for a product that has none yet.
    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = prod3_id) THEN
    INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
    VALUES
        (prod3_id, '/cdn/images/products/levis-501-1.jpg', 'Levi''s 501 Red Tab',        TRUE,  1),
        (prod3_id, '/cdn/images/products/levis-501-2.jpg', 'Levi''s 501 Red Tab detail', FALSE, 2)
    ON CONFLICT DO NOTHING;
    END IF;

    -- Only seed variants for a product that has none yet.
    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = prod3_id) THEN

    INSERT INTO variants (productsId, sku) VALUES (prod3_id, 'LEV501-BLU-32') RETURNING variantId INTO var_id;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (var_id, get_value_id('Color', 'Blue')),
        (var_id, get_value_id('Size',  '32'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (prod3_id, var_id, 40, 10);

    INSERT INTO variants (productsId, sku) VALUES (prod3_id, 'LEV501-BLK-34') RETURNING variantId INTO var_id;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (var_id, get_value_id('Color', 'Black')),
        (var_id, get_value_id('Size',  '34'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (prod3_id, var_id, 15, 10);

    END IF;

    -- --------------------------------------------------------
    -- Product 4: Sony WH-1000XM5
    -- --------------------------------------------------------
    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Sony WH-1000XM5') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_audio_id, 'Sony WH-1000XM5', 348.00,
                'Industry-leading noise canceling wireless headphones.',
                'active', ARRAY['premium'])
        RETURNING productsId INTO prod4_id;
    END IF;

    IF prod4_id IS NULL THEN
        SELECT productsId INTO prod4_id FROM products WHERE productname = 'Sony WH-1000XM5';
    END IF;

    -- Only seed images for a product that has none yet.
    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = prod4_id) THEN
    INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
    VALUES
        (prod4_id, '/cdn/images/products/sony-headphones-1.jpg', 'Sony headphones',       TRUE,  1),
        (prod4_id, '/cdn/images/products/sony-headphones-2.jpg', 'Sony headphones boxed', FALSE, 2)
    ON CONFLICT DO NOTHING;
    END IF;

    -- Only seed variants for a product that has none yet.
    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = prod4_id) THEN

    INSERT INTO variants (productsId, sku) VALUES (prod4_id, 'SONY-XM5-BLK') RETURNING variantId INTO var_id;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES (var_id, get_value_id('Color', 'Black'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (prod4_id, var_id, 20, 5);

    INSERT INTO variants (productsId, sku) VALUES (prod4_id, 'SONY-XM5-SLV') RETURNING variantId INTO var_id;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES (var_id, get_value_id('Color', 'White'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (prod4_id, var_id, 14, 5);

    END IF;

    -- --------------------------------------------------------
    -- Product 5: Organic Green Tea (no variants)
    -- --------------------------------------------------------
    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Organic Green Tea - 20 Bags') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_food_id, 'Organic Green Tea - 20 Bags', 12.99,
                'Premium organic green tea, 20 tea bags per box.',
                'active', ARRAY['new_arrival'])
        RETURNING productsId INTO prod5_id;
    END IF;

    IF prod5_id IS NULL THEN
        SELECT productsId INTO prod5_id FROM products WHERE productname = 'Organic Green Tea - 20 Bags';
    END IF;

    -- Only seed images for a product that has none yet.
    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = prod5_id) THEN
    INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
    VALUES
        (prod5_id, '/cdn/images/products/green-tea-1.jpg', 'Brewed organic green tea', TRUE, 1)
    ON CONFLICT DO NOTHING;
    END IF;

    -- Only seed stock for a product that has none yet.
    IF NOT EXISTS (SELECT 1 FROM stock WHERE productsid = prod5_id AND variantid IS NULL) THEN
    -- Product-level stock (variantId = NULL)
    INSERT INTO stock (productsId, variantId, quantity, minStock)
    VALUES (prod5_id, NULL, 100, 20)
    ON CONFLICT (productsId, variantId) DO UPDATE SET quantity = EXCLUDED.quantity;

    END IF;

    -- --------------------------------------------------------
    -- Product 6: iPhone 16 Pro Max
    -- --------------------------------------------------------
    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'iPhone 16 Pro Max') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_smartphones_id, 'iPhone 16 Pro Max', 1199.00,
                'Apple iPhone 16 Pro Max with A18 Pro chip, 48MP Fusion camera system, and all-day battery life.',
                'active',
                ARRAY['new_arrival', 'best_seller', 'premium'])
        RETURNING productsId INTO prod6_id;
    END IF;

    IF prod6_id IS NULL THEN
        SELECT productsId INTO prod6_id FROM products WHERE productname = 'iPhone 16 Pro Max';
    END IF;

    -- Only seed images for a product that has none yet.
    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = prod6_id) THEN
    INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
    VALUES
        (prod6_id, '/cdn/images/products/iphone-16-pro-max-1.jpg', 'iPhone 16 Pro Max Natural Titanium',  TRUE,  1),
        (prod6_id, '/cdn/images/products/iphone-16-pro-max-2.jpg', 'iPhone 16 Pro Max White Titanium',    FALSE, 2),
        (prod6_id, '/cdn/images/products/iphone-16-pro-max-3.jpg', 'iPhone 16 Pro Max with clear case',   FALSE, 3)
    ON CONFLICT DO NOTHING;
    END IF;

    -- Only seed variants for a product that has none yet.
    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = prod6_id) THEN

    -- Variant: Natural Titanium / 256GB
    INSERT INTO variants (productsId, sku) VALUES (prod6_id, 'IP16PM-NT-256') RETURNING variantId INTO var_id;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (var_id, get_value_id('Color',   'Natural Titanium')),
        (var_id, get_value_id('Storage', '256GB'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (prod6_id, var_id, 30, 5);

    -- Variant: Natural Titanium / 512GB
    INSERT INTO variants (productsId, sku) VALUES (prod6_id, 'IP16PM-NT-512') RETURNING variantId INTO var_id;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (var_id, get_value_id('Color',   'Natural Titanium')),
        (var_id, get_value_id('Storage', '512GB'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (prod6_id, var_id, 20, 5);

    -- Variant: Natural Titanium / 1TB
    INSERT INTO variants (productsId, sku) VALUES (prod6_id, 'IP16PM-NT-1T') RETURNING variantId INTO var_id;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (var_id, get_value_id('Color',   'Natural Titanium')),
        (var_id, get_value_id('Storage', '1TB'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (prod6_id, var_id, 10, 3);

    -- Variant: Desert Titanium / 256GB
    INSERT INTO variants (productsId, sku) VALUES (prod6_id, 'IP16PM-DT-256') RETURNING variantId INTO var_id;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (var_id, get_value_id('Color',   'Desert Titanium')),
        (var_id, get_value_id('Storage', '256GB'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (prod6_id, var_id, 25, 5);

    -- Variant: Desert Titanium / 512GB
    INSERT INTO variants (productsId, sku) VALUES (prod6_id, 'IP16PM-DT-512') RETURNING variantId INTO var_id;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (var_id, get_value_id('Color',   'Desert Titanium')),
        (var_id, get_value_id('Storage', '512GB'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (prod6_id, var_id, 15, 5);

    -- Variant: Desert Titanium / 1TB
    INSERT INTO variants (productsId, sku) VALUES (prod6_id, 'IP16PM-DT-1T') RETURNING variantId INTO var_id;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (var_id, get_value_id('Color',   'Desert Titanium')),
        (var_id, get_value_id('Storage', '1TB'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (prod6_id, var_id, 8, 3);

    -- Variant: White Titanium / 256GB
    INSERT INTO variants (productsId, sku) VALUES (prod6_id, 'IP16PM-WT-256') RETURNING variantId INTO var_id;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (var_id, get_value_id('Color',   'White Titanium')),
        (var_id, get_value_id('Storage', '256GB'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (prod6_id, var_id, 18, 5);

    -- Variant: Black Titanium / 512GB
    INSERT INTO variants (productsId, sku) VALUES (prod6_id, 'IP16PM-BT-512') RETURNING variantId INTO var_id;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (var_id, get_value_id('Color',   'Black Titanium')),
        (var_id, get_value_id('Storage', '512GB'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (prod6_id, var_id, 12, 5);

    -- Discount example
    INSERT INTO discounts (productsId, amounts, startDate, endDate)
    VALUES (prod6_id, 100.00, NOW() - INTERVAL '1 day', NOW() + INTERVAL '14 days');

    END IF;
END $$;

-- ============================================================
-- 4b. Additional Seed Products (expands the catalog to 40 items)
-- ============================================================
DO $$
DECLARE
    cat_smartphones_id INTEGER := (SELECT categoriesid FROM category WHERE categoryname = 'Smartphones');
    cat_audio_id       INTEGER := (SELECT categoriesid FROM category WHERE categoryname = 'Audio');
    cat_mens_id        INTEGER := (SELECT categoriesid FROM category WHERE categoryname = 'Men''s Clothing');
    cat_footwear_id    INTEGER := (SELECT categoriesid FROM category WHERE categoryname = 'Footwear');
    cat_food_id        INTEGER := (SELECT categoriesid FROM category WHERE categoryname = 'Food & Beverages');
    cat_wearables_id   INTEGER := (SELECT categoriesid FROM category WHERE categoryname = 'Wearables');
    cat_laptops_id     INTEGER := (SELECT categoriesid FROM category WHERE categoryname = 'Laptops');

    pid INTEGER;
    vid INTEGER;
BEGIN
    -- --------------------------------------------------------
    -- Product 7: Samsung Galaxy S24 Ultra
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Samsung Galaxy S24 Ultra') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_smartphones_id, 'Samsung Galaxy S24 Ultra', 1299.00,
                'Samsung flagship with Galaxy AI, a 200MP camera and built-in S Pen.',
                'active', ARRAY['best_seller', 'premium'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Samsung Galaxy S24 Ultra';
    END IF;

    -- Only seed the image for a product that has none yet.
    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/galaxy-s24-ultra-1.png', 'Samsung Galaxy S24 Ultra', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    -- Only seed variants for a product that has none yet.
    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = pid) THEN

    INSERT INTO variants (productsId, sku) VALUES (pid, 'S24U-BLK-256') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'Black')),
        (vid, get_value_id('Storage', '256GB'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 30, 5);

    INSERT INTO variants (productsId, sku) VALUES (pid, 'S24U-TIT-512') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'Titanium')),
        (vid, get_value_id('Storage', '512GB'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 15, 5);

    END IF;

    -- --------------------------------------------------------
    -- Product 8: Google Pixel 9
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Google Pixel 9') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_smartphones_id, 'Google Pixel 9', 799.00,
                'Google Pixel 9 with Tensor G4 chip and advanced AI-powered camera features.',
                'active', ARRAY['new_arrival'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Google Pixel 9';
    END IF;

    -- Only seed the image for a product that has none yet.
    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/pixel-9-1.png', 'Google Pixel 9', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    -- Only seed variants for a product that has none yet.
    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = pid) THEN

    INSERT INTO variants (productsId, sku) VALUES (pid, 'PIX9-BLK-128') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'Black')),
        (vid, get_value_id('Storage', '128GB'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 22, 5);

    INSERT INTO variants (productsId, sku) VALUES (pid, 'PIX9-WHT-256') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'White')),
        (vid, get_value_id('Storage', '256GB'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 18, 5);

    END IF;

    -- --------------------------------------------------------
    -- Product 9: Apple AirPods Pro (2nd Gen)
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Apple AirPods Pro (2nd Gen)') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_audio_id, 'Apple AirPods Pro (2nd Gen)', 249.00,
                'Active noise cancellation, adaptive transparency and USB-C charging case.',
                'active', ARRAY['best_seller'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Apple AirPods Pro (2nd Gen)';
    END IF;

    -- Only seed the image for a product that has none yet.
    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/airpods-pro-2-1.jpg', 'Apple AirPods Pro with charging case', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    -- Only seed variants for a product that has none yet.
    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = pid) THEN

    INSERT INTO variants (productsId, sku) VALUES (pid, 'APP-WHT') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES (vid, get_value_id('Color', 'White'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 45, 10);

    END IF;

    -- --------------------------------------------------------
    -- Product 10: Bose QuietComfort Ultra Earbuds
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Bose QuietComfort Ultra Earbuds') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_audio_id, 'Bose QuietComfort Ultra Earbuds', 299.00,
                'Immersive spatial audio with world-class noise cancellation.',
                'active', ARRAY['premium'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Bose QuietComfort Ultra Earbuds';
    END IF;

    -- Only seed the image for a product that has none yet.
    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/bose-qc-ultra-1.jpg', 'Bose QuietComfort Ultra Earbuds', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    -- Only seed variants for a product that has none yet.
    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = pid) THEN

    INSERT INTO variants (productsId, sku) VALUES (pid, 'BOSE-QCU-BLK') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES (vid, get_value_id('Color', 'Black'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 20, 5);

    INSERT INTO variants (productsId, sku) VALUES (pid, 'BOSE-QCU-WHT') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES (vid, get_value_id('Color', 'White'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 16, 5);

    END IF;

    -- --------------------------------------------------------
    -- Product 11: JBL Flip 6 Portable Speaker
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'JBL Flip 6 Portable Speaker') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_audio_id, 'JBL Flip 6 Portable Speaker', 129.95,
                'Bold JBL Pro Sound with a 12-hour battery and IP67 waterproof design.',
                'active', ARRAY['new_arrival'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'JBL Flip 6 Portable Speaker';
    END IF;

    -- Only seed the image for a product that has none yet.
    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/jbl-flip-6-1.jpg', 'JBL Flip 6 portable speaker', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    -- Only seed variants for a product that has none yet.
    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = pid) THEN

    INSERT INTO variants (productsId, sku) VALUES (pid, 'JBL-F6-BLK') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES (vid, get_value_id('Color', 'Black'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 25, 5);

    INSERT INTO variants (productsId, sku) VALUES (pid, 'JBL-F6-BLU') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES (vid, get_value_id('Color', 'Blue'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 20, 5);

    END IF;

    -- --------------------------------------------------------
    -- Product 12: Samsung Galaxy Buds3 Pro
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Samsung Galaxy Buds3 Pro') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_audio_id, 'Samsung Galaxy Buds3 Pro', 219.00,
                'Hi-Fi audio with blade-lighting design and intelligent ANC.',
                'active', ARRAY['new_arrival', 'best_seller'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Samsung Galaxy Buds3 Pro';
    END IF;

    -- Only seed the image for a product that has none yet.
    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/galaxy-buds3-pro-1.jpg', 'Samsung Galaxy Buds3 Pro', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    -- Only seed variants for a product that has none yet.
    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = pid) THEN

    INSERT INTO variants (productsId, sku) VALUES (pid, 'GB3P-WHT') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES (vid, get_value_id('Color', 'White'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 30, 5);

    INSERT INTO variants (productsId, sku) VALUES (pid, 'GB3P-SLV') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES (vid, get_value_id('Color', 'Silver'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 18, 5);

    END IF;

    -- --------------------------------------------------------
    -- Product 13: Levi's Trucker Denim Jacket
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Levi''s Trucker Denim Jacket') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_mens_id, 'Levi''s Trucker Denim Jacket', 89.50,
                'The original trucker jacket in a timeless mid-wash denim.',
                'active', ARRAY['best_seller'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Levi''s Trucker Denim Jacket';
    END IF;

    -- Only seed the image for a product that has none yet.
    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/levis-trucker-1.jpg', 'Levi''s trucker denim jacket', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    -- Only seed variants for a product that has none yet.
    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = pid) THEN

    INSERT INTO variants (productsId, sku) VALUES (pid, 'LEVTK-BLU-M') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color', 'Blue')),
        (vid, get_value_id('Size',  'M'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 25, 5);

    INSERT INTO variants (productsId, sku) VALUES (pid, 'LEVTK-BLU-L') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color', 'Blue')),
        (vid, get_value_id('Size',  'L'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 20, 5);

    END IF;

    -- --------------------------------------------------------
    -- Product 14: Nike Dri-FIT Training Tee
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Nike Dri-FIT Training Tee') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_mens_id, 'Nike Dri-FIT Training Tee', 34.99,
                'Sweat-wicking Dri-FIT fabric keeps you dry through every workout.',
                'active', ARRAY['new_arrival'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Nike Dri-FIT Training Tee';
    END IF;

    -- Only seed the image for a product that has none yet.
    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/nike-drifit-tee-1.jpg', 'Nike Dri-FIT training tee', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    -- Only seed variants for a product that has none yet.
    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = pid) THEN

    INSERT INTO variants (productsId, sku) VALUES (pid, 'NDF-BLK-M') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color', 'Black')),
        (vid, get_value_id('Size',  'M'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 50, 10);

    INSERT INTO variants (productsId, sku) VALUES (pid, 'NDF-WHT-L') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color', 'White')),
        (vid, get_value_id('Size',  'L'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 40, 10);

    END IF;

    -- --------------------------------------------------------
    -- Product 15: Adidas Ultraboost Light
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Adidas Ultraboost Light') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_footwear_id, 'Adidas Ultraboost Light', 189.99,
                'Light BOOST midsole delivers incredible energy return for daily runs.',
                'active', ARRAY['best_seller', 'premium'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Adidas Ultraboost Light';
    END IF;

    -- Only seed the image for a product that has none yet.
    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/ultraboost-light-1.jpg', 'Adidas Ultraboost Light', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    -- Only seed variants for a product that has none yet.
    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = pid) THEN

    INSERT INTO variants (productsId, sku) VALUES (pid, 'UBL-BLK-9') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color', 'Black')),
        (vid, get_value_id('Size',  'US 9'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 18, 5);

    INSERT INTO variants (productsId, sku) VALUES (pid, 'UBL-WHT-10') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color', 'White')),
        (vid, get_value_id('Size',  'US 10'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 14, 5);

    END IF;

    -- --------------------------------------------------------
    -- Product 16: Puma RS-X Reinvention
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Puma RS-X Reinvention') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_footwear_id, 'Puma RS-X Reinvention', 109.99,
                'Retro-inspired chunky sneaker with bold colour blocking.',
                'active', ARRAY['new_arrival'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Puma RS-X Reinvention';
    END IF;

    -- Only seed the image for a product that has none yet.
    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/puma-rsx-1.jpg', 'Puma RS-X Reinvention', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    -- Only seed variants for a product that has none yet.
    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = pid) THEN

    INSERT INTO variants (productsId, sku) VALUES (pid, 'RSX-BLU-10') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color', 'Blue')),
        (vid, get_value_id('Size',  'US 10'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 16, 5);

    INSERT INTO variants (productsId, sku) VALUES (pid, 'RSX-RED-11') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color', 'Red')),
        (vid, get_value_id('Size',  'US 11'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 12, 5);

    END IF;

    -- --------------------------------------------------------
    -- Product 17: Colombian Roast Coffee Beans 1kg (no variants)
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Colombian Roast Coffee Beans 1kg') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_food_id, 'Colombian Roast Coffee Beans 1kg', 24.50,
                'Medium roast single-origin Arabica beans, freshly roasted.',
                'active', ARRAY['best_seller'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Colombian Roast Coffee Beans 1kg';
    END IF;

    -- Only seed the image for a product that has none yet.
    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/colombian-coffee-1.jpg', 'Colombian roast coffee beans', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    -- Only seed stock for a product that has none yet.
    IF NOT EXISTS (SELECT 1 FROM stock WHERE productsid = pid AND variantid IS NULL) THEN

    INSERT INTO stock (productsId, variantId, quantity, minStock)
    VALUES (pid, NULL, 60, 15)
    ON CONFLICT (productsId, variantId) DO UPDATE SET quantity = EXCLUDED.quantity;

    END IF;

    -- --------------------------------------------------------
    -- Product 18: Raw Organic Honey 500g (no variants)
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Raw Organic Honey 500g') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_food_id, 'Raw Organic Honey 500g', 18.99,
                'Unfiltered, unpasteurised organic honey in a glass jar.',
                'active', ARRAY['new_arrival'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Raw Organic Honey 500g';
    END IF;

    -- Only seed the image for a product that has none yet.
    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/organic-honey-1.jpg', 'Raw organic honey jar', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    -- Only seed stock for a product that has none yet.
    IF NOT EXISTS (SELECT 1 FROM stock WHERE productsid = pid AND variantid IS NULL) THEN

    INSERT INTO stock (productsId, variantId, quantity, minStock)
    VALUES (pid, NULL, 80, 20)
    ON CONFLICT (productsId, variantId) DO UPDATE SET quantity = EXCLUDED.quantity;

    END IF;

    -- --------------------------------------------------------
    -- Product 19: Google Pixel Watch 3
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Google Pixel Watch 3') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_wearables_id, 'Google Pixel Watch 3', 349.00,
                'Bright Actua display, advanced fitness tracking and Fitbit integration.',
                'active', ARRAY['new_arrival'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Google Pixel Watch 3';
    END IF;

    -- Only seed the image for a product that has none yet.
    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/pixel-watch-3-1.jpg', 'Google Pixel Watch 3', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    -- Only seed variants for a product that has none yet.
    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = pid) THEN

    INSERT INTO variants (productsId, sku) VALUES (pid, 'PW3-BLK') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES (vid, get_value_id('Color', 'Black'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 20, 5);

    INSERT INTO variants (productsId, sku) VALUES (pid, 'PW3-SLV') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES (vid, get_value_id('Color', 'Silver'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 15, 5);

    END IF;

    -- --------------------------------------------------------
    -- Product 20: MacBook Air 13-inch M3
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'MacBook Air 13-inch M3') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_laptops_id, 'MacBook Air 13-inch M3', 1099.00,
                'Superlight laptop with the Apple M3 chip and up to 18 hours of battery life.',
                'active', ARRAY['premium', 'best_seller'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'MacBook Air 13-inch M3';
    END IF;

    -- Only seed the image for a product that has none yet.
    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/macbook-air-m3-1.jpg', 'MacBook Air 13-inch M3', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    -- Only seed variants for a product that has none yet.
    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = pid) THEN

    INSERT INTO variants (productsId, sku) VALUES (pid, 'MBA-M3-BLK-256') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'Black')),
        (vid, get_value_id('Storage', '256GB'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 12, 3);

    INSERT INTO variants (productsId, sku) VALUES (pid, 'MBA-M3-WHT-512') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'White')),
        (vid, get_value_id('Storage', '512GB'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 9, 3);
    END IF;

    -- --------------------------------------------------------
    -- Product 21: Apple iPhone 14
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Apple iPhone 14') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_smartphones_id, 'Apple iPhone 14', 699.00,
                '6.1-inch Super Retina XDR display, A15 Bionic chip and a dual 12MP camera system.',
                'active', ARRAY['best_seller'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Apple iPhone 14';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/iphone-14-1.jpg', 'Apple iPhone 14', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = pid) THEN
    INSERT INTO variants (productsId, sku) VALUES (pid, 'IP14-BLK-128') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color', 'Black')),
        (vid, get_value_id('Storage', '128GB'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 24, 5);

    INSERT INTO variants (productsId, sku) VALUES (pid, 'IP14-BLU-256') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color', 'Blue')),
        (vid, get_value_id('Storage', '256GB'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 16, 5);
    END IF;

    -- --------------------------------------------------------
    -- Product 22: OnePlus 12
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'OnePlus 12') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_smartphones_id, 'OnePlus 12', 799.00,
                'Snapdragon 8 Gen 3 flagship with a 120Hz LTPO display and 100W fast charging.',
                'active', ARRAY['new_arrival'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'OnePlus 12';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/oneplus-12-1.jpg', 'OnePlus 12', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = pid) THEN
    INSERT INTO variants (productsId, sku) VALUES (pid, 'OP12-BLK-256') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color', 'Black')),
        (vid, get_value_id('Storage', '256GB'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 20, 5);

    INSERT INTO variants (productsId, sku) VALUES (pid, 'OP12-GRN-512') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color', 'Green')),
        (vid, get_value_id('Storage', '512GB'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 12, 5);
    END IF;

    -- --------------------------------------------------------
    -- Product 23: Samsung Galaxy S23
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Samsung Galaxy S23') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_smartphones_id, 'Samsung Galaxy S23', 699.00,
                'Compact Galaxy flagship with a 50MP camera and all-day battery.',
                'active', ARRAY['best_seller'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Samsung Galaxy S23';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/galaxy-s23-1.png', 'Samsung Galaxy S23', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = pid) THEN
    INSERT INTO variants (productsId, sku) VALUES (pid, 'S23-BLK-128') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color', 'Black')),
        (vid, get_value_id('Storage', '128GB'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 26, 5);

    INSERT INTO variants (productsId, sku) VALUES (pid, 'S23-GRN-256') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color', 'Green')),
        (vid, get_value_id('Storage', '256GB'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 14, 5);
    END IF;

    -- --------------------------------------------------------
    -- Product 24: Sony WH-1000XM4
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Sony WH-1000XM4') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_audio_id, 'Sony WH-1000XM4', 279.00,
                'Wireless noise-cancelling over-ear headphones with 30-hour battery life.',
                'active', ARRAY['premium'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Sony WH-1000XM4';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/sony-wh1000xm4-1.jpg', 'Sony WH-1000XM4 headphones', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = pid) THEN
    INSERT INTO variants (productsId, sku) VALUES (pid, 'XM4-BLK') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES (vid, get_value_id('Color', 'Black'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 30, 8);

    INSERT INTO variants (productsId, sku) VALUES (pid, 'XM4-SLV') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES (vid, get_value_id('Color', 'Silver'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 18, 8);
    END IF;

    -- --------------------------------------------------------
    -- Product 25: Apple HomePod mini
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Apple HomePod mini') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_audio_id, 'Apple HomePod mini', 99.00,
                'Compact smart speaker with room-filling 360-degree audio and Siri.',
                'active', ARRAY['best_seller'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Apple HomePod mini';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/homepod-mini-1.jpg', 'Apple HomePod mini', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = pid) THEN
    INSERT INTO variants (productsId, sku) VALUES (pid, 'HPMINI-WHT') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES (vid, get_value_id('Color', 'White'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 40, 10);

    INSERT INTO variants (productsId, sku) VALUES (pid, 'HPMINI-BLK') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES (vid, get_value_id('Color', 'Black'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 25, 10);
    END IF;

    -- --------------------------------------------------------
    -- Product 26: Sonos Era 100
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Sonos Era 100') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_audio_id, 'Sonos Era 100', 249.00,
                'Stereo smart speaker with room-tuning, Wi-Fi streaming and Bluetooth.',
                'active', ARRAY['premium'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Sonos Era 100';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/sonos-era-100-1.jpg', 'Sonos Era 100 speaker', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = pid) THEN
    INSERT INTO variants (productsId, sku) VALUES (pid, 'SONOS-ERA100-BLK') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES (vid, get_value_id('Color', 'Black'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 16, 4);

    INSERT INTO variants (productsId, sku) VALUES (pid, 'SONOS-ERA100-WHT') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES (vid, get_value_id('Color', 'White'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 10, 4);
    END IF;

    -- --------------------------------------------------------
    -- Product 27: JBL Charge 5
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'JBL Charge 5') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_audio_id, 'JBL Charge 5', 179.95,
                'Portable Bluetooth speaker with 20 hours of playtime and a built-in power bank.',
                'active', ARRAY['new_arrival'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'JBL Charge 5';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/jbl-charge-5-1.jpg', 'JBL Charge 5 speaker', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = pid) THEN
    INSERT INTO variants (productsId, sku) VALUES (pid, 'JBL-C5-BLK') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES (vid, get_value_id('Color', 'Black'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 28, 6);

    INSERT INTO variants (productsId, sku) VALUES (pid, 'JBL-C5-BLU') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES (vid, get_value_id('Color', 'Blue'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 19, 6);
    END IF;

    -- --------------------------------------------------------
    -- Product 28: Dell XPS 13
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Dell XPS 13') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_laptops_id, 'Dell XPS 13', 1099.00,
                'Compact ultrabook with an InfinityEdge display and all-day battery life.',
                'active', ARRAY['premium'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Dell XPS 13';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/dell-xps-13-1.png', 'Dell XPS 13 laptop', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = pid) THEN
    INSERT INTO variants (productsId, sku) VALUES (pid, 'XPS13-SLV-512') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color', 'Silver')),
        (vid, get_value_id('Storage', '512GB'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 12, 3);

    INSERT INTO variants (productsId, sku) VALUES (pid, 'XPS13-SLV-1T') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color', 'Silver')),
        (vid, get_value_id('Storage', '1TB'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 8, 3);
    END IF;

    -- --------------------------------------------------------
    -- Product 29: Lenovo ThinkPad X1 Carbon
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Lenovo ThinkPad X1 Carbon') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_laptops_id, 'Lenovo ThinkPad X1 Carbon', 1499.00,
                'Business ultrabook with a carbon-fibre chassis, legendary keyboard and vPro.',
                'active', ARRAY['premium'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Lenovo ThinkPad X1 Carbon';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/thinkpad-x1-carbon-1.jpg', 'Lenovo ThinkPad X1 Carbon', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = pid) THEN
    INSERT INTO variants (productsId, sku) VALUES (pid, 'X1C-BLK-512') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color', 'Black')),
        (vid, get_value_id('Storage', '512GB'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 10, 2);

    INSERT INTO variants (productsId, sku) VALUES (pid, 'X1C-BLK-1T') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color', 'Black')),
        (vid, get_value_id('Storage', '1TB'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 6, 2);
    END IF;

    -- --------------------------------------------------------
    -- Product 30: ASUS ROG Zephyrus G14
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'ASUS ROG Zephyrus G14') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_laptops_id, 'ASUS ROG Zephyrus G14', 1599.00,
                '14-inch gaming laptop with a high-refresh OLED display and RTX graphics.',
                'active', ARRAY['premium'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'ASUS ROG Zephyrus G14';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/rog-zephyrus-g14-1.jpg', 'ASUS ROG Zephyrus G14', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = pid) THEN
    INSERT INTO variants (productsId, sku) VALUES (pid, 'G14-WHT-1T') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color', 'White')),
        (vid, get_value_id('Storage', '1TB'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 7, 2);

    INSERT INTO variants (productsId, sku) VALUES (pid, 'G14-BLK-1T') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color', 'Black')),
        (vid, get_value_id('Storage', '1TB'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 9, 2);
    END IF;

    -- --------------------------------------------------------
    -- Product 31: Apple Watch Series 9
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Apple Watch Series 9') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_wearables_id, 'Apple Watch Series 9', 399.00,
                'Advanced health sensors, always-on display and the new S9 SiP.',
                'active', ARRAY['best_seller'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Apple Watch Series 9';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/apple-watch-series-9-1.jpg', 'Apple Watch Series 9', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = pid) THEN
    INSERT INTO variants (productsId, sku) VALUES (pid, 'AW9-BLK') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES (vid, get_value_id('Color', 'Black'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 22, 5);

    INSERT INTO variants (productsId, sku) VALUES (pid, 'AW9-SLV') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES (vid, get_value_id('Color', 'Silver'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 15, 5);
    END IF;

    -- --------------------------------------------------------
    -- Product 32: Garmin Forerunner 265
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Garmin Forerunner 265') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_wearables_id, 'Garmin Forerunner 265', 449.00,
                'AMOLED running watch with training readiness and multi-band GPS.',
                'active', ARRAY['new_arrival'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Garmin Forerunner 265';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/garmin-forerunner-265-1.jpg', 'Garmin Forerunner 265', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = pid) THEN
    INSERT INTO variants (productsId, sku) VALUES (pid, 'FR265-BLK') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES (vid, get_value_id('Color', 'Black'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 14, 4);

    INSERT INTO variants (productsId, sku) VALUES (pid, 'FR265-WHT') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES (vid, get_value_id('Color', 'White'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 9, 4);
    END IF;

    -- --------------------------------------------------------
    -- Product 33: Fitbit Charge 6
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Fitbit Charge 6') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_wearables_id, 'Fitbit Charge 6', 159.95,
                'Fitness tracker with heart-rate zones, built-in GPS and Google integration.',
                'active', ARRAY['best_seller'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Fitbit Charge 6';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/fitbit-charge-6-1.jpg', 'Fitbit Charge 6', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = pid) THEN
    INSERT INTO variants (productsId, sku) VALUES (pid, 'FC6-BLK') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES (vid, get_value_id('Color', 'Black'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 32, 8);

    INSERT INTO variants (productsId, sku) VALUES (pid, 'FC6-SLV') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES (vid, get_value_id('Color', 'Silver'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 20, 8);
    END IF;

    -- --------------------------------------------------------
    -- Product 34: Levi's 511 Slim Jeans
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Levi''s 511 Slim Jeans') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_mens_id, 'Levi''s 511 Slim Jeans', 69.50,
                'Modern slim fit with a streamlined leg and classic five-pocket styling.',
                'active', ARRAY['best_seller'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Levi''s 511 Slim Jeans';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/levis-511-1.jpg', 'Levi''s 511 Slim Jeans', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = pid) THEN
    INSERT INTO variants (productsId, sku) VALUES (pid, 'LEV511-BLU-32') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color', 'Blue')),
        (vid, get_value_id('Size', '32'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 30, 8);

    INSERT INTO variants (productsId, sku) VALUES (pid, 'LEV511-BLK-34') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color', 'Black')),
        (vid, get_value_id('Size', '34'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 18, 8);
    END IF;

    -- --------------------------------------------------------
    -- Product 35: Patagonia Better Sweater
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Patagonia Better Sweater') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_mens_id, 'Patagonia Better Sweater', 139.00,
                'Recycled polyester fleece pullover with a sweater-knit face.',
                'active', ARRAY['premium'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Patagonia Better Sweater';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/patagonia-better-sweater-1.jpg', 'Patagonia Better Sweater', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = pid) THEN
    INSERT INTO variants (productsId, sku) VALUES (pid, 'PATA-BSW-BLK-M') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color', 'Black')),
        (vid, get_value_id('Size', 'M'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 16, 4);

    INSERT INTO variants (productsId, sku) VALUES (pid, 'PATA-BSW-BLU-L') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color', 'Blue')),
        (vid, get_value_id('Size', 'L'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 11, 4);
    END IF;

    -- --------------------------------------------------------
    -- Product 36: Uniqlo Oxford Shirt
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Uniqlo Oxford Shirt') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_mens_id, 'Uniqlo Oxford Shirt', 39.90,
                'Long-sleeve cotton oxford shirt with a button-down collar.',
                'active', ARRAY['new_arrival'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Uniqlo Oxford Shirt';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/uniqlo-oxford-shirt-1.jpg', 'Uniqlo Oxford Shirt', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = pid) THEN
    INSERT INTO variants (productsId, sku) VALUES (pid, 'UNI-OS-WHT-M') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color', 'White')),
        (vid, get_value_id('Size', 'M'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 40, 10);

    INSERT INTO variants (productsId, sku) VALUES (pid, 'UNI-OS-BLU-L') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color', 'Blue')),
        (vid, get_value_id('Size', 'L'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 28, 10);
    END IF;

    -- --------------------------------------------------------
    -- Product 37: Nike Air Force 1
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Nike Air Force 1') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_footwear_id, 'Nike Air Force 1', 115.00,
                'The original basketball shoe, still a streetwear staple in crisp leather.',
                'active', ARRAY['best_seller'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Nike Air Force 1';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/nike-air-force-1-1.jpg', 'Nike Air Force 1', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = pid) THEN
    INSERT INTO variants (productsId, sku) VALUES (pid, 'AF1-WHT-9') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color', 'White')),
        (vid, get_value_id('Size', 'US 9'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 24, 6);

    INSERT INTO variants (productsId, sku) VALUES (pid, 'AF1-BLK-10') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color', 'Black')),
        (vid, get_value_id('Size', 'US 10'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 17, 6);
    END IF;

    -- --------------------------------------------------------
    -- Product 38: Adidas Stan Smith
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Adidas Stan Smith') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_footwear_id, 'Adidas Stan Smith', 100.00,
                'Timeless leather tennis shoe with a clean, minimal profile.',
                'active', ARRAY['best_seller'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Adidas Stan Smith';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/adidas-stan-smith-1.jpg', 'Adidas Stan Smith', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = pid) THEN
    INSERT INTO variants (productsId, sku) VALUES (pid, 'STAN-WHT-9') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color', 'White')),
        (vid, get_value_id('Size', 'US 9'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 26, 6);

    INSERT INTO variants (productsId, sku) VALUES (pid, 'STAN-GRN-10') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color', 'Green')),
        (vid, get_value_id('Size', 'US 10'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 15, 6);
    END IF;

    -- --------------------------------------------------------
    -- Product 39: New Balance 574
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'New Balance 574') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_footwear_id, 'New Balance 574', 89.99,
                'Iconic retro running silhouette in suede and mesh.',
                'active', ARRAY['new_arrival'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'New Balance 574';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/new-balance-574-1.jpg', 'New Balance 574', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = pid) THEN
    INSERT INTO variants (productsId, sku) VALUES (pid, 'NB574-BLK-9') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color', 'Black')),
        (vid, get_value_id('Size', 'US 9'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 21, 5);

    INSERT INTO variants (productsId, sku) VALUES (pid, 'NB574-BLU-10') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color', 'Blue')),
        (vid, get_value_id('Size', 'US 10'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 14, 5);
    END IF;

    -- --------------------------------------------------------
    -- Product 40: Lindt Excellence 70% Dark Chocolate 100g (no variants)
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Lindt Excellence 70% Dark Chocolate 100g') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_food_id, 'Lindt Excellence 70% Dark Chocolate 100g', 4.99,
                'Intense dark chocolate bar with notes of dried fruit and liquorice.',
                'active', ARRAY['new_arrival'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Lindt Excellence 70% Dark Chocolate 100g';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/lindt-dark-chocolate-1.jpg', 'Lindt Excellence 70% dark chocolate', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM stock WHERE productsid = pid AND variantid IS NULL) THEN
    INSERT INTO stock (productsId, variantId, quantity, minStock)
    VALUES (pid, NULL, 120, 30)
    ON CONFLICT (productsId, variantId) DO UPDATE SET quantity = EXCLUDED.quantity;
    END IF;

    -- --------------------------------------------------------
    -- Product 41: Google Pixel 8 Pro
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Google Pixel 8 Pro') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_smartphones_id, 'Google Pixel 8 Pro', 999.00,
                'Tensor G3 flagship with a 50MP triple camera and seven years of updates.',
                'active', ARRAY['new_arrival', 'premium'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Google Pixel 8 Pro';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/pixel-8-pro-1.jpg', 'Google Pixel 8 Pro', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = pid) THEN
    INSERT INTO variants (productsId, sku) VALUES (pid, 'PX8P-BLK-128') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'Black')),
        (vid, get_value_id('Storage', '128GB'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 18, 4);

    INSERT INTO variants (productsId, sku) VALUES (pid, 'PX8P-BLU-256') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'Blue')),
        (vid, get_value_id('Storage', '256GB'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 11, 4);
    END IF;

    -- --------------------------------------------------------
    -- Product 42: Apple iPhone 13 Pro
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Apple iPhone 13 Pro') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_smartphones_id, 'Apple iPhone 13 Pro', 899.00,
                'ProMotion display, A15 Bionic chip and a triple camera with macro mode.',
                'active', ARRAY['best_seller', 'premium'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Apple iPhone 13 Pro';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/iphone-13-pro-1.jpg', 'Apple iPhone 13 Pro', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = pid) THEN
    INSERT INTO variants (productsId, sku) VALUES (pid, 'IP13P-BLK-128') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'Black')),
        (vid, get_value_id('Storage', '128GB'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 20, 5);

    INSERT INTO variants (productsId, sku) VALUES (pid, 'IP13P-SLV-256') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'Silver')),
        (vid, get_value_id('Storage', '256GB'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 12, 5);
    END IF;

    -- --------------------------------------------------------
    -- Product 43: Samsung Galaxy S22
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Samsung Galaxy S22') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_smartphones_id, 'Samsung Galaxy S22', 599.00,
                'Compact Galaxy flagship with Dynamic AMOLED display and Nightography camera.',
                'active', ARRAY['best_seller'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Samsung Galaxy S22';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/galaxy-s22-1.jpg', 'Samsung Galaxy S22', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = pid) THEN
    INSERT INTO variants (productsId, sku) VALUES (pid, 'S22-BLK-128') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'Black')),
        (vid, get_value_id('Storage', '128GB'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 24, 6);

    INSERT INTO variants (productsId, sku) VALUES (pid, 'S22-WHT-256') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'White')),
        (vid, get_value_id('Storage', '256GB'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 14, 6);
    END IF;

    -- --------------------------------------------------------
    -- Product 44: Xiaomi 13
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Xiaomi 13') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_smartphones_id, 'Xiaomi 13', 749.00,
                'Leica-tuned camera system with Snapdragon 8 Gen 2 performance.',
                'active', ARRAY['new_arrival'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Xiaomi 13';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/xiaomi-13-1.jpg', 'Xiaomi 13', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = pid) THEN
    INSERT INTO variants (productsId, sku) VALUES (pid, 'MI13-BLK-256') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'Black')),
        (vid, get_value_id('Storage', '256GB'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 16, 4);

    INSERT INTO variants (productsId, sku) VALUES (pid, 'MI13-GRN-512') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'Green')),
        (vid, get_value_id('Storage', '512GB'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 9, 4);
    END IF;

    -- --------------------------------------------------------
    -- Product 45: Samsung Galaxy Note 20
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Samsung Galaxy Note 20') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_smartphones_id, 'Samsung Galaxy Note 20', 499.00,
                'Large AMOLED canvas with the S Pen and pro-grade video recording.',
                'active', ARRAY['premium'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Samsung Galaxy Note 20';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/galaxy-note-20-1.png', 'Samsung Galaxy Note 20', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = pid) THEN
    INSERT INTO variants (productsId, sku) VALUES (pid, 'N20-BLK-256') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'Black')),
        (vid, get_value_id('Storage', '256GB'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 13, 4);

    INSERT INTO variants (productsId, sku) VALUES (pid, 'N20-SLV-256') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'Silver')),
        (vid, get_value_id('Storage', '256GB'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 8, 4);
    END IF;

    -- --------------------------------------------------------
    -- Product 46: Sony WF-1000XM4
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Sony WF-1000XM4') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_audio_id, 'Sony WF-1000XM4', 229.00,
                'True wireless earbuds with industry-leading noise cancellation.',
                'active', ARRAY['best_seller'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Sony WF-1000XM4';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/sony-wf1000xm4-1.jpg', 'Sony WF-1000XM4', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = pid) THEN
    INSERT INTO variants (productsId, sku) VALUES (pid, 'WF4-BLK') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'Black'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 30, 8);

    INSERT INTO variants (productsId, sku) VALUES (pid, 'WF4-SLV') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'Silver'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 17, 8);
    END IF;

    -- --------------------------------------------------------
    -- Product 47: Bose QuietComfort 35 II
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Bose QuietComfort 35 II') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_audio_id, 'Bose QuietComfort 35 II', 249.00,
                'Wireless noise-cancelling headphones with Alexa and Google Assistant built in.',
                'active', ARRAY['premium'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Bose QuietComfort 35 II';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/bose-qc35-ii-1.jpg', 'Bose QuietComfort 35 II', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = pid) THEN
    INSERT INTO variants (productsId, sku) VALUES (pid, 'QC35-BLK') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'Black'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 22, 6);

    INSERT INTO variants (productsId, sku) VALUES (pid, 'QC35-SLV') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'Silver'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 12, 6);
    END IF;

    -- --------------------------------------------------------
    -- Product 48: Sennheiser HD 600
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Sennheiser HD 600') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_audio_id, 'Sennheiser HD 600', 299.00,
                'Open-back reference headphones favoured by studios and audiophiles.',
                'active', ARRAY['premium'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Sennheiser HD 600';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/sennheiser-hd600-1.jpg', 'Sennheiser HD 600', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = pid) THEN
    INSERT INTO variants (productsId, sku) VALUES (pid, 'HD600-BLK') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'Black'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 14, 4);
    END IF;

    -- --------------------------------------------------------
    -- Product 49: Sonos PLAY:5
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Sonos PLAY:5') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_audio_id, 'Sonos PLAY:5', 499.00,
                'High-fidelity smart speaker with six drivers and room-filling sound.',
                'active', ARRAY['premium'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Sonos PLAY:5';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/sonos-play5-1.jpg', 'Sonos PLAY:5', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = pid) THEN
    INSERT INTO variants (productsId, sku) VALUES (pid, 'PLAY5-WHT') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'White'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 10, 3);

    INSERT INTO variants (productsId, sku) VALUES (pid, 'PLAY5-BLK') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'Black'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 7, 3);
    END IF;

    -- --------------------------------------------------------
    -- Product 50: JBL Go 2
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'JBL Go 2') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_audio_id, 'JBL Go 2', 39.95,
                'Pocket-sized waterproof Bluetooth speaker with a built-in speakerphone.',
                'active', ARRAY['new_arrival'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'JBL Go 2';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/jbl-go-2-1.jpg', 'JBL Go 2', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = pid) THEN
    INSERT INTO variants (productsId, sku) VALUES (pid, 'JBLGO2-BLK') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'Black'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 45, 10);

    INSERT INTO variants (productsId, sku) VALUES (pid, 'JBLGO2-BLU') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'Blue'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 28, 10);
    END IF;

    -- --------------------------------------------------------
    -- Product 51: Apple MacBook Pro 14-inch M3
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Apple MacBook Pro 14-inch M3') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_laptops_id, 'Apple MacBook Pro 14-inch M3', 1599.00,
                'Liquid Retina XDR display with the M3 chip and all-day battery life.',
                'active', ARRAY['premium', 'best_seller'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Apple MacBook Pro 14-inch M3';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/macbook-pro-14-m3-1.jpg', 'Apple MacBook Pro 14-inch M3', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = pid) THEN
    INSERT INTO variants (productsId, sku) VALUES (pid, 'MBP14-BLK-512') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'Black')),
        (vid, get_value_id('Storage', '512GB'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 9, 2);

    INSERT INTO variants (productsId, sku) VALUES (pid, 'MBP14-SLV-1T') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'Silver')),
        (vid, get_value_id('Storage', '1TB'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 6, 2);
    END IF;

    -- --------------------------------------------------------
    -- Product 52: Microsoft Surface Laptop Studio
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Microsoft Surface Laptop Studio') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_laptops_id, 'Microsoft Surface Laptop Studio', 1599.00,
                'Versatile hinge laptop that converts into a studio canvas or stage.',
                'active', ARRAY['premium'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Microsoft Surface Laptop Studio';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/surface-laptop-studio-1.jpg', 'Microsoft Surface Laptop Studio', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = pid) THEN
    INSERT INTO variants (productsId, sku) VALUES (pid, 'SLS-SLV-512') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'Silver')),
        (vid, get_value_id('Storage', '512GB'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 8, 2);

    INSERT INTO variants (productsId, sku) VALUES (pid, 'SLS-SLV-1T') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'Silver')),
        (vid, get_value_id('Storage', '1TB'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 5, 2);
    END IF;

    -- --------------------------------------------------------
    -- Product 53: HP Spectre x360
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'HP Spectre x360') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_laptops_id, 'HP Spectre x360', 1299.00,
                'Convertible ultrabook with a gem-cut chassis and OLED touch display.',
                'active', ARRAY['premium'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'HP Spectre x360';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/hp-spectre-x360-1.jpg', 'HP Spectre x360', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = pid) THEN
    INSERT INTO variants (productsId, sku) VALUES (pid, 'SPX360-SLV-512') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'Silver')),
        (vid, get_value_id('Storage', '512GB'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 10, 3);

    INSERT INTO variants (productsId, sku) VALUES (pid, 'SPX360-SLV-1T') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'Silver')),
        (vid, get_value_id('Storage', '1TB'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 6, 3);
    END IF;

    -- --------------------------------------------------------
    -- Product 54: Razer Blade Pro 17
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Razer Blade Pro 17') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_laptops_id, 'Razer Blade Pro 17', 2499.00,
                'Desktop-class gaming laptop with a 17-inch high-refresh display.',
                'active', ARRAY['premium'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Razer Blade Pro 17';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/razer-blade-pro-1.jpg', 'Razer Blade Pro 17', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = pid) THEN
    INSERT INTO variants (productsId, sku) VALUES (pid, 'RBP17-BLK-1T') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'Black')),
        (vid, get_value_id('Storage', '1TB'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 5, 2);
    END IF;

    -- --------------------------------------------------------
    -- Product 55: Acer Aspire V3
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Acer Aspire V3') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_laptops_id, 'Acer Aspire V3', 649.00,
                'Everyday 17-inch laptop with room for a numeric keypad and dedicated graphics.',
                'active', ARRAY['best_seller'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Acer Aspire V3';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/acer-aspire-v3-1.jpg', 'Acer Aspire V3', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = pid) THEN
    INSERT INTO variants (productsId, sku) VALUES (pid, 'AV3-BLK-512') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'Black')),
        (vid, get_value_id('Storage', '512GB'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 12, 3);

    INSERT INTO variants (productsId, sku) VALUES (pid, 'AV3-BLK-1T') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'Black')),
        (vid, get_value_id('Storage', '1TB'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 7, 3);
    END IF;

    -- --------------------------------------------------------
    -- Product 56: Framework Laptop 13
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Framework Laptop 13') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_laptops_id, 'Framework Laptop 13', 1049.00,
                'Modular, repairable 13-inch laptop with swappable ports and mainboards.',
                'active', ARRAY['new_arrival'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Framework Laptop 13';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/framework-laptop-13-1.jpg', 'Framework Laptop 13', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = pid) THEN
    INSERT INTO variants (productsId, sku) VALUES (pid, 'FW13-SLV-512') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'Silver')),
        (vid, get_value_id('Storage', '512GB'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 11, 3);

    INSERT INTO variants (productsId, sku) VALUES (pid, 'FW13-SLV-1T') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'Silver')),
        (vid, get_value_id('Storage', '1TB'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 7, 3);
    END IF;

    -- --------------------------------------------------------
    -- Product 57: Apple Watch Ultra 2
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Apple Watch Ultra 2') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_wearables_id, 'Apple Watch Ultra 2', 799.00,
                'Rugged titanium smartwatch with the brightest Apple display and 36-hour battery.',
                'active', ARRAY['premium', 'new_arrival'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Apple Watch Ultra 2';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/apple-watch-ultra-2-1.jpg', 'Apple Watch Ultra 2', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = pid) THEN
    INSERT INTO variants (productsId, sku) VALUES (pid, 'AWU2-TIT-M') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'Titanium')),
        (vid, get_value_id('Size',   'M'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 10, 3);

    INSERT INTO variants (productsId, sku) VALUES (pid, 'AWU2-TIT-L') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'Titanium')),
        (vid, get_value_id('Size',   'L'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 6, 3);
    END IF;

    -- --------------------------------------------------------
    -- Product 58: Samsung Galaxy Watch 6
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Samsung Galaxy Watch 6') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_wearables_id, 'Samsung Galaxy Watch 6', 299.00,
                'Slim smartwatch with advanced sleep coaching and body composition tracking.',
                'active', ARRAY['best_seller'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Samsung Galaxy Watch 6';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/galaxy-watch-6-1.jpg', 'Samsung Galaxy Watch 6', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = pid) THEN
    INSERT INTO variants (productsId, sku) VALUES (pid, 'GW6-BLK') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'Black'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 20, 5);

    INSERT INTO variants (productsId, sku) VALUES (pid, 'GW6-SLV') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'Silver'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 13, 5);
    END IF;

    -- --------------------------------------------------------
    -- Product 59: Garmin Fenix 6X Pro Solar
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Garmin Fenix 6X Pro Solar') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_wearables_id, 'Garmin Fenix 6X Pro Solar', 649.00,
                'Solar-charging multisport GPS watch built for expeditions.',
                'active', ARRAY['premium'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Garmin Fenix 6X Pro Solar';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/garmin-fenix-6x-1.jpg', 'Garmin Fenix 6X Pro Solar', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = pid) THEN
    INSERT INTO variants (productsId, sku) VALUES (pid, 'FENIX6X-BLK') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'Black'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 8, 2);
    END IF;

    -- --------------------------------------------------------
    -- Product 60: Fitbit Versa
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Fitbit Versa') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_wearables_id, 'Fitbit Versa', 199.00,
                'Everyday smartwatch with heart-rate tracking and 4+ day battery life.',
                'active', ARRAY['best_seller'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Fitbit Versa';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/fitbit-versa-1.jpg', 'Fitbit Versa', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = pid) THEN
    INSERT INTO variants (productsId, sku) VALUES (pid, 'FVERSA-BLK') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'Black'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 24, 6);

    INSERT INTO variants (productsId, sku) VALUES (pid, 'FVERSA-WHT') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'White'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 15, 6);
    END IF;

    -- --------------------------------------------------------
    -- Product 61: Xiaomi Mi Band 4
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Xiaomi Mi Band 4') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_wearables_id, 'Xiaomi Mi Band 4', 49.99,
                'Colour AMOLED fitness band with 20-day battery life and swim tracking.',
                'active', ARRAY['new_arrival'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Xiaomi Mi Band 4';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/xiaomi-mi-band-4-1.jpg', 'Xiaomi Mi Band 4', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = pid) THEN
    INSERT INTO variants (productsId, sku) VALUES (pid, 'MIB4-BLK') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'Black'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 60, 15);

    INSERT INTO variants (productsId, sku) VALUES (pid, 'MIB4-BLU') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'Blue'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 35, 15);
    END IF;

    -- --------------------------------------------------------
    -- Product 62: Withings ScanWatch 2
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Withings ScanWatch 2') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_wearables_id, 'Withings ScanWatch 2', 349.00,
                'Hybrid smartwatch with medical-grade sensors and a 30-day battery.',
                'active', ARRAY['premium'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Withings ScanWatch 2';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/withings-scanwatch-2-1.jpg', 'Withings ScanWatch 2', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = pid) THEN
    INSERT INTO variants (productsId, sku) VALUES (pid, 'SCANW2-BLK') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'Black'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 12, 4);

    INSERT INTO variants (productsId, sku) VALUES (pid, 'SCANW2-WHT') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'White'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 8, 4);
    END IF;

    -- --------------------------------------------------------
    -- Product 63: Patagonia Nano Puff Jacket
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Patagonia Nano Puff Jacket') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_mens_id, 'Patagonia Nano Puff Jacket', 239.00,
                'Lightweight recycled-insulation jacket that packs into its own pocket.',
                'active', ARRAY['premium'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Patagonia Nano Puff Jacket';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/patagonia-nano-puff-1.jpg', 'Patagonia Nano Puff Jacket', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = pid) THEN
    INSERT INTO variants (productsId, sku) VALUES (pid, 'PATA-NP-BLK-M') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'Black')),
        (vid, get_value_id('Size',   'M'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 14, 4);

    INSERT INTO variants (productsId, sku) VALUES (pid, 'PATA-NP-BLU-L') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'Blue')),
        (vid, get_value_id('Size',   'L'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 9, 4);
    END IF;

    -- --------------------------------------------------------
    -- Product 64: Carhartt Hooded Jacket
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Carhartt Hooded Jacket') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_mens_id, 'Carhartt Hooded Jacket', 129.00,
                'Duck-canvas work jacket with a quilted lining and attached hood.',
                'active', ARRAY['best_seller'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Carhartt Hooded Jacket';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/carhartt-hooded-jacket-1.jpg', 'Carhartt Hooded Jacket', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = pid) THEN
    INSERT INTO variants (productsId, sku) VALUES (pid, 'CHJ-BLK-L') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'Black')),
        (vid, get_value_id('Size',   'L'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 16, 4);

    INSERT INTO variants (productsId, sku) VALUES (pid, 'CHJ-BLU-XL') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'Blue')),
        (vid, get_value_id('Size',   'XL'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 10, 4);
    END IF;

    -- --------------------------------------------------------
    -- Product 65: Dickies Carpenter Jeans
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Dickies Carpenter Jeans') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_mens_id, 'Dickies Carpenter Jeans', 59.50,
                'Durable loose-fit carpenter jeans with a utility hammer loop.',
                'active', ARRAY['best_seller'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Dickies Carpenter Jeans';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/dickies-carpenter-jeans-1.jpg', 'Dickies Carpenter Jeans', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = pid) THEN
    INSERT INTO variants (productsId, sku) VALUES (pid, 'DICKIES-BLU-32') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'Blue')),
        (vid, get_value_id('Size',   '32'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 26, 6);

    INSERT INTO variants (productsId, sku) VALUES (pid, 'DICKIES-BLK-34') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'Black')),
        (vid, get_value_id('Size',   '34'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 15, 6);
    END IF;

    -- --------------------------------------------------------
    -- Product 66: Fred Perry Polo Shirt
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Fred Perry Polo Shirt') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_mens_id, 'Fred Perry Polo Shirt', 89.00,
                'Original twin-tipped polo shirt in breathable cotton piqué.',
                'active', ARRAY['premium'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Fred Perry Polo Shirt';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/fred-perry-polo-1.jpg', 'Fred Perry Polo Shirt', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = pid) THEN
    INSERT INTO variants (productsId, sku) VALUES (pid, 'FP-POLO-WHT-M') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'White')),
        (vid, get_value_id('Size',   'M'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 18, 5);

    INSERT INTO variants (productsId, sku) VALUES (pid, 'FP-POLO-BLK-L') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'Black')),
        (vid, get_value_id('Size',   'L'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 12, 5);
    END IF;

    -- --------------------------------------------------------
    -- Product 67: Uniqlo Fleece Jacket
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Uniqlo Fleece Jacket') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_mens_id, 'Uniqlo Fleece Jacket', 49.90,
                'Soft-touch fleece jacket that layers easily under a coat.',
                'active', ARRAY['new_arrival'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Uniqlo Fleece Jacket';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/uniqlo-fleece-1.jpg', 'Uniqlo Fleece Jacket', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = pid) THEN
    INSERT INTO variants (productsId, sku) VALUES (pid, 'UNI-FLEECE-BLK-M') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'Black')),
        (vid, get_value_id('Size',   'M'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 30, 8);

    INSERT INTO variants (productsId, sku) VALUES (pid, 'UNI-FLEECE-BLU-L') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'Blue')),
        (vid, get_value_id('Size',   'L'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 20, 8);
    END IF;

    -- --------------------------------------------------------
    -- Product 68: Champion Hoodie
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Champion Hoodie') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_mens_id, 'Champion Hoodie', 54.99,
                'Heavyweight fleece pullover hoodie with the classic Champion script.',
                'active', ARRAY['best_seller'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Champion Hoodie';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/champion-hoodie-1.jpg', 'Champion Hoodie', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = pid) THEN
    INSERT INTO variants (productsId, sku) VALUES (pid, 'CHAMP-HOOD-BLK-M') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'Black')),
        (vid, get_value_id('Size',   'M'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 28, 7);

    INSERT INTO variants (productsId, sku) VALUES (pid, 'CHAMP-HOOD-WHT-L') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'White')),
        (vid, get_value_id('Size',   'L'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 18, 7);
    END IF;

    -- --------------------------------------------------------
    -- Product 69: Converse Chuck Taylor All Star
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Converse Chuck Taylor All Star') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_footwear_id, 'Converse Chuck Taylor All Star', 65.00,
                'The original canvas high-top sneaker with a vulcanised rubber sole.',
                'active', ARRAY['best_seller'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Converse Chuck Taylor All Star';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/converse-chuck-taylor-1.jpg', 'Converse Chuck Taylor All Star', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = pid) THEN
    INSERT INTO variants (productsId, sku) VALUES (pid, 'CHUCK-BLK-9') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'Black')),
        (vid, get_value_id('Size',   'US 9'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 30, 8);

    INSERT INTO variants (productsId, sku) VALUES (pid, 'CHUCK-RED-10') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'Red')),
        (vid, get_value_id('Size',   'US 10'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 18, 8);
    END IF;

    -- --------------------------------------------------------
    -- Product 70: Vans Old Skool
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Vans Old Skool') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_footwear_id, 'Vans Old Skool', 70.00,
                'Side-stripe skate shoe in sturdy suede and canvas.',
                'active', ARRAY['best_seller'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Vans Old Skool';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/vans-old-skool-1.jpg', 'Vans Old Skool', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = pid) THEN
    INSERT INTO variants (productsId, sku) VALUES (pid, 'VANS-OS-BLK-9') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'Black')),
        (vid, get_value_id('Size',   'US 9'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 26, 6);

    INSERT INTO variants (productsId, sku) VALUES (pid, 'VANS-OS-BLU-10') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'Blue')),
        (vid, get_value_id('Size',   'US 10'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 16, 6);
    END IF;

    -- --------------------------------------------------------
    -- Product 71: Nike Air Max 90
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Nike Air Max 90') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_footwear_id, 'Nike Air Max 90', 130.00,
                'Retro runner with visible Air cushioning and waffle outsole.',
                'active', ARRAY['premium'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Nike Air Max 90';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/nike-air-max-90-1.jpg', 'Nike Air Max 90', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = pid) THEN
    INSERT INTO variants (productsId, sku) VALUES (pid, 'AM90-WHT-9') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'White')),
        (vid, get_value_id('Size',   'US 9'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 22, 6);

    INSERT INTO variants (productsId, sku) VALUES (pid, 'AM90-BLK-10') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'Black')),
        (vid, get_value_id('Size',   'US 10'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 14, 6);
    END IF;

    -- --------------------------------------------------------
    -- Product 72: Adidas Superstar
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Adidas Superstar') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_footwear_id, 'Adidas Superstar', 90.00,
                'Iconic shell-toe trainer in smooth leather with a rubber cupsole.',
                'active', ARRAY['best_seller'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Adidas Superstar';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/adidas-superstar-1.jpg', 'Adidas Superstar', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = pid) THEN
    INSERT INTO variants (productsId, sku) VALUES (pid, 'SUPER-WHT-9') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'White')),
        (vid, get_value_id('Size',   'US 9'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 27, 6);

    INSERT INTO variants (productsId, sku) VALUES (pid, 'SUPER-BLK-10') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'Black')),
        (vid, get_value_id('Size',   'US 10'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 17, 6);
    END IF;

    -- --------------------------------------------------------
    -- Product 73: Puma Suede
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Puma Suede') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_footwear_id, 'Puma Suede', 75.00,
                'Sixties basketball classic reissued in rich suede.',
                'active', ARRAY['new_arrival'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Puma Suede';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/puma-suede-1.jpg', 'Puma Suede', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = pid) THEN
    INSERT INTO variants (productsId, sku) VALUES (pid, 'PSUEDE-RED-9') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'Red')),
        (vid, get_value_id('Size',   'US 9'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 19, 5);

    INSERT INTO variants (productsId, sku) VALUES (pid, 'PSUEDE-BLK-10') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'Black')),
        (vid, get_value_id('Size',   'US 10'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 12, 5);
    END IF;

    -- --------------------------------------------------------
    -- Product 74: Reebok Classic Leather
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Reebok Classic Leather') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_footwear_id, 'Reebok Classic Leather', 85.00,
                'Soft garment-leather trainer with a timeless 80s silhouette.',
                'active', ARRAY['best_seller'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Reebok Classic Leather';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/reebok-classic-leather-1.jpg', 'Reebok Classic Leather', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM variants WHERE productsid = pid) THEN
    INSERT INTO variants (productsId, sku) VALUES (pid, 'REBOK-CL-WHT-9') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'White')),
        (vid, get_value_id('Size',   'US 9'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 21, 5);

    INSERT INTO variants (productsId, sku) VALUES (pid, 'REBOK-CL-BLK-10') RETURNING variantId INTO vid;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES
        (vid, get_value_id('Color',   'Black')),
        (vid, get_value_id('Size',   'US 10'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (pid, vid, 13, 5);
    END IF;

    -- --------------------------------------------------------
    -- Product 75: Starbucks House Blend Coffee Beans 250g
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Starbucks House Blend Coffee Beans 250g') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_food_id, 'Starbucks House Blend Coffee Beans 250g', 14.99,
                'Medium roast whole-bean blend with notes of cocoa and toasted nuts.',
                'active', ARRAY['best_seller'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Starbucks House Blend Coffee Beans 250g';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/starbucks-coffee-beans-1.jpg', 'Starbucks House Blend Coffee Beans 250g', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM stock WHERE productsid = pid AND variantid IS NULL) THEN
    INSERT INTO stock (productsId, variantId, quantity, minStock)
    VALUES (pid, NULL, 90, 20)
    ON CONFLICT (productsId, variantId) DO UPDATE SET quantity = EXCLUDED.quantity;
    END IF;

    -- --------------------------------------------------------
    -- Product 76: Twinings Earl Grey Tea 50 Bags
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Twinings Earl Grey Tea 50 Bags') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_food_id, 'Twinings Earl Grey Tea 50 Bags', 8.49,
                'Bergamot-scented black tea in individually sealed foil bags.',
                'active', ARRAY['best_seller'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Twinings Earl Grey Tea 50 Bags';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/earl-grey-tea-1.jpg', 'Twinings Earl Grey Tea 50 Bags', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM stock WHERE productsid = pid AND variantid IS NULL) THEN
    INSERT INTO stock (productsId, variantId, quantity, minStock)
    VALUES (pid, NULL, 140, 30)
    ON CONFLICT (productsId, variantId) DO UPDATE SET quantity = EXCLUDED.quantity;
    END IF;

    -- --------------------------------------------------------
    -- Product 77: Cadbury Dairy Milk 180g
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Cadbury Dairy Milk 180g') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_food_id, 'Cadbury Dairy Milk 180g', 4.49,
                'Creamy milk chocolate bar made with a glass and a half of milk.',
                'active', ARRAY['best_seller'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Cadbury Dairy Milk 180g';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/cadbury-dairy-milk-1.jpg', 'Cadbury Dairy Milk 180g', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM stock WHERE productsid = pid AND variantid IS NULL) THEN
    INSERT INTO stock (productsId, variantId, quantity, minStock)
    VALUES (pid, NULL, 200, 40)
    ON CONFLICT (productsId, variantId) DO UPDATE SET quantity = EXCLUDED.quantity;
    END IF;

    -- --------------------------------------------------------
    -- Product 78: Lindt Lindor Milk Chocolate 200g
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Lindt Lindor Milk Chocolate 200g') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_food_id, 'Lindt Lindor Milk Chocolate 200g', 9.99,
                'Assorted milk chocolate truffles with a smooth melting centre.',
                'active', ARRAY['premium'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Lindt Lindor Milk Chocolate 200g';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/lindt-lindor-1.jpg', 'Lindt Lindor Milk Chocolate 200g', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM stock WHERE productsid = pid AND variantid IS NULL) THEN
    INSERT INTO stock (productsId, variantId, quantity, minStock)
    VALUES (pid, NULL, 110, 25)
    ON CONFLICT (productsId, variantId) DO UPDATE SET quantity = EXCLUDED.quantity;
    END IF;

    -- --------------------------------------------------------
    -- Product 79: Perrier Sparkling Water 6x330ml
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Perrier Sparkling Water 6x330ml') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_food_id, 'Perrier Sparkling Water 6x330ml', 7.99,
                'Naturally carbonated mineral water in six slim cans.',
                'active', ARRAY['new_arrival'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Perrier Sparkling Water 6x330ml';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/perrier-sparkling-water-1.jpg', 'Perrier Sparkling Water 6x330ml', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM stock WHERE productsid = pid AND variantid IS NULL) THEN
    INSERT INTO stock (productsId, variantId, quantity, minStock)
    VALUES (pid, NULL, 150, 30)
    ON CONFLICT (productsId, variantId) DO UPDATE SET quantity = EXCLUDED.quantity;
    END IF;

    -- --------------------------------------------------------
    -- Product 80: Haribo Goldbären 200g
    -- --------------------------------------------------------
    pid := NULL;

    IF NOT EXISTS (SELECT 1 FROM products WHERE productname = 'Haribo Goldbären 200g') THEN
        INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
        VALUES (cat_food_id, 'Haribo Goldbären 200g', 3.99,
                'The original gummy bears in six fruity flavours.',
                'active', ARRAY['best_seller'])
        RETURNING productsId INTO pid;
    END IF;

    IF pid IS NULL THEN
        SELECT productsId INTO pid FROM products WHERE productname = 'Haribo Goldbären 200g';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM productimages WHERE productsid = pid) THEN
        INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
        VALUES (pid, '/cdn/images/products/haribo-goldbaren-1.jpg', 'Haribo Goldbären 200g', TRUE, 1)
        ON CONFLICT DO NOTHING;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM stock WHERE productsid = pid AND variantid IS NULL) THEN
    INSERT INTO stock (productsId, variantId, quantity, minStock)
    VALUES (pid, NULL, 220, 40)
    ON CONFLICT (productsId, variantId) DO UPDATE SET quantity = EXCLUDED.quantity;
    END IF;
END $$;

-- ============================================================
-- 5. Seed default permissions and role assignments
-- ============================================================
INSERT INTO permissions (permission_key, permission_name, module, description, type)
VALUES
    ('pages.dashboard', 'Dashboard Page', 'pages', 'Access the admin dashboard page', 'frontend'),
    ('pages.products', 'Products Page', 'pages', 'View products listing and details page', 'frontend'),
    ('pages.orders', 'Orders Page', 'pages', 'View orders management page', 'frontend'),
    ('pages.users', 'Users Page', 'pages', 'View user management page', 'frontend'),
    ('pages.roles', 'Roles Page', 'pages', 'View roles and permissions page', 'frontend'),
    ('pages.settings', 'Settings Page', 'pages', 'Access store settings page', 'frontend'),
    ('dashboard.view', 'View Dashboard', 'dashboard', 'Access the admin dashboard', 'backend'),
    ('products.read', 'View Products', 'products', 'View product catalog', 'backend'),
    ('products.create', 'Create Products', 'products', 'Add new products', 'backend'),
    ('products.update', 'Edit Products', 'products', 'Modify existing products', 'backend'),
    ('products.delete', 'Delete Products', 'products', 'Remove products', 'backend'),
    ('orders.read', 'View Orders', 'orders', 'View order details', 'backend'),
    ('users.read', 'View Users', 'users', 'View user list and details', 'backend'),
    ('roles.view', 'View Roles', 'roles', 'View role configurations', 'backend'),
    ('roles.manage', 'Manage Roles', 'roles', 'Create, edit, and assign roles and permissions', 'backend'),
    ('settings.view', 'View Settings', 'settings', 'Access store settings', 'backend'),
    ('settings.manage', 'Manage Settings', 'settings', 'Modify store configuration', 'backend')
ON CONFLICT (permission_key) DO UPDATE SET
    permission_name = EXCLUDED.permission_name,
    module = EXCLUDED.module,
    description = EXCLUDED.description,
    type = EXCLUDED.type;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.rolesid, p.permission_id
FROM roles r
CROSS JOIN permissions p
WHERE r.rolesid = 1
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.rolesid, p.permission_id
FROM roles r
CROSS JOIN permissions p
WHERE r.rolesid = 2
  AND p.permission_key NOT IN ('roles.manage', 'settings.manage')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 6. Clean up helper function
-- ============================================================
DROP FUNCTION IF EXISTS get_value_id(TEXT, TEXT);

COMMIT;
