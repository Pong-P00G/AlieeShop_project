-- ============================================================
-- Sample Product Seed for Testing
-- PostgreSQL | Aliee Shop
--
-- Run with:
--   psql -U postgres -d aliee_shop -f server/seed_products.sql
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
    ('Food & Beverages',   NULL)
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
    ('Color',   'Black Titanium')
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
    INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
    VALUES (cat_smartphones_id, 'iPhone 15 Pro', 999.00,
            'Apple iPhone 15 Pro with titanium design, A17 Pro chip, and pro camera system.',
            'active', ARRAY['best_seller', 'premium'])
    ON CONFLICT DO NOTHING
    RETURNING productsId INTO prod1_id;

    IF prod1_id IS NULL THEN
        SELECT productsId INTO prod1_id FROM products WHERE productname = 'iPhone 15 Pro';
    END IF;

    INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
    VALUES
        (prod1_id, '/cdn/images/products/iphone-15-pro-1.jpg', 'iPhone 15 Pro',            TRUE,  1),
        (prod1_id, '/cdn/images/products/iphone-15-pro-2.jpg', 'iPhone 15 Pro front view', FALSE, 2),
        (prod1_id, '/cdn/images/products/iphone-15-pro-3.jpg', 'iPhone 15 Pro in hand',    FALSE, 3)
    ON CONFLICT DO NOTHING;

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

    -- --------------------------------------------------------
    -- Product 2: Nike Air Max
    -- --------------------------------------------------------
    INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
    VALUES (cat_footwear_id, 'Nike Air Max', 129.99,
            'Classic Nike Air Max sneakers with visible Air cushioning.',
            'active', ARRAY['best_seller'])
    ON CONFLICT DO NOTHING
    RETURNING productsId INTO prod2_id;

    IF prod2_id IS NULL THEN
        SELECT productsId INTO prod2_id FROM products WHERE productname = 'Nike Air Max';
    END IF;

    INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
    VALUES
        (prod2_id, '/cdn/images/products/nike-air-max-1.jpg', 'Nike Air Max 180',  TRUE,  1),
        (prod2_id, '/cdn/images/products/nike-air-max-2.jpg', 'Nike Air Max Plus', FALSE, 2)
    ON CONFLICT DO NOTHING;

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

    -- --------------------------------------------------------
    -- Product 3: Levi's 501 Jeans
    -- --------------------------------------------------------
    INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
    VALUES (cat_mens_id, 'Levi''s 501 Original Jeans', 79.50,
            'Iconic straight fit jeans with button fly.',
            'active', ARRAY['best_seller'])
    ON CONFLICT DO NOTHING
    RETURNING productsId INTO prod3_id;

    IF prod3_id IS NULL THEN
        SELECT productsId INTO prod3_id FROM products WHERE productname = 'Levi''s 501 Original Jeans';
    END IF;

    INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
    VALUES
        (prod3_id, '/cdn/images/products/levis-501-1.jpg', 'Levi''s 501 Red Tab',        TRUE,  1),
        (prod3_id, '/cdn/images/products/levis-501-2.jpg', 'Levi''s 501 Red Tab detail', FALSE, 2)
    ON CONFLICT DO NOTHING;

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

    -- --------------------------------------------------------
    -- Product 4: Sony WH-1000XM5
    -- --------------------------------------------------------
    INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
    VALUES (cat_audio_id, 'Sony WH-1000XM5', 348.00,
            'Industry-leading noise canceling wireless headphones.',
            'active', ARRAY['premium'])
    ON CONFLICT DO NOTHING
    RETURNING productsId INTO prod4_id;

    IF prod4_id IS NULL THEN
        SELECT productsId INTO prod4_id FROM products WHERE productname = 'Sony WH-1000XM5';
    END IF;

    INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
    VALUES
        (prod4_id, '/cdn/images/products/sony-headphones-1.jpg', 'Sony headphones',       TRUE,  1),
        (prod4_id, '/cdn/images/products/sony-headphones-2.jpg', 'Sony headphones boxed', FALSE, 2)
    ON CONFLICT DO NOTHING;

    INSERT INTO variants (productsId, sku) VALUES (prod4_id, 'SONY-XM5-BLK') RETURNING variantId INTO var_id;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES (var_id, get_value_id('Color', 'Black'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (prod4_id, var_id, 20, 5);

    INSERT INTO variants (productsId, sku) VALUES (prod4_id, 'SONY-XM5-SLV') RETURNING variantId INTO var_id;
    INSERT INTO variantOptionValue (variantId, valueId) VALUES (var_id, get_value_id('Color', 'White'));
    INSERT INTO stock (productsId, variantId, quantity, minStock) VALUES (prod4_id, var_id, 14, 5);

    -- --------------------------------------------------------
    -- Product 5: Organic Green Tea (no variants)
    -- --------------------------------------------------------
    INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
    VALUES (cat_food_id, 'Organic Green Tea - 20 Bags', 12.99,
            'Premium organic green tea, 20 tea bags per box.',
            'active', ARRAY['new_arrival'])
    ON CONFLICT DO NOTHING
    RETURNING productsId INTO prod5_id;

    IF prod5_id IS NULL THEN
        SELECT productsId INTO prod5_id FROM products WHERE productname = 'Organic Green Tea - 20 Bags';
    END IF;

    INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
    VALUES
        (prod5_id, '/cdn/images/products/green-tea-1.jpg', 'Brewed organic green tea', TRUE, 1)
    ON CONFLICT DO NOTHING;

    -- Product-level stock (variantId = NULL)
    INSERT INTO stock (productsId, variantId, quantity, minStock)
    VALUES (prod5_id, NULL, 100, 20)
    ON CONFLICT (productsId, variantId) DO UPDATE SET quantity = EXCLUDED.quantity;

    -- --------------------------------------------------------
    -- Product 6: iPhone 16 Pro Max
    -- --------------------------------------------------------
    INSERT INTO products (categoriesId, productname, baseprice, description, status, tags)
    VALUES (cat_smartphones_id, 'iPhone 16 Pro Max', 1199.00,
            'Apple iPhone 16 Pro Max with A18 Pro chip, 48MP Fusion camera system, and all-day battery life.',
            'active',
            ARRAY['new_arrival', 'best_seller', 'premium'])
    ON CONFLICT DO NOTHING
    RETURNING productsId INTO prod6_id;

    IF prod6_id IS NULL THEN
        SELECT productsId INTO prod6_id FROM products WHERE productname = 'iPhone 16 Pro Max';
    END IF;

    INSERT INTO productImages (productsId, imageUrl, altText, isThumbnail, sortOrder)
    VALUES
        (prod6_id, '/cdn/images/products/iphone-16-pro-max-1.jpg', 'iPhone 16 Pro Max Natural Titanium',  TRUE,  1),
        (prod6_id, '/cdn/images/products/iphone-16-pro-max-2.jpg', 'iPhone 16 Pro Max White Titanium',    FALSE, 2),
        (prod6_id, '/cdn/images/products/iphone-16-pro-max-3.jpg', 'iPhone 16 Pro Max with clear case',   FALSE, 3)
    ON CONFLICT DO NOTHING;

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
