import db from '../../database/dbpool.js';
import { createStockLog } from './stockLogModel.js';

// ── helpers ──────────────────────────────────────────────────────────────────

const PRODUCT_COLS = `
    productsid  AS product_id,
    productname AS product_name,
    baseprice   AS base_price,
    description AS descriptions,
    status      AS product_status,
    tags,
    categoryname AS category_name,
    thumbnail,
    totalstock  AS total_stock,
    createdat   AS created_at
`;

/** Build $1, $2, ... placeholders and track current index */
function addParam(params, val) {
    params.push(val);
    return `$${params.length}`;
}

/** Shared variant+options+stock query */
const VARIANT_QUERY = `
    SELECT
        v.variantid   AS variant_id,
        v.productsid  AS product_id,
        v.sku,
        v.createdat   AS created_at,
        MAX(CASE WHEN va.attributename = 'Color'   THEN vav.value END) AS variant_color,
        MAX(CASE WHEN va.attributename = 'Size'    THEN vav.value END) AS variant_size,
        MAX(CASE WHEN va.attributename = 'Storage' THEN vav.value END) AS variant_storage,
        COALESCE(
            JSON_AGG(
                JSON_BUILD_OBJECT(
                    'attribute_name', va.attributename,
                    'value', vav.value
                )
            ) FILTER (WHERE va.attributename IS NOT NULL AND vav.value IS NOT NULL),
            '[]'::JSON
        ) AS options,
        v.price       AS variant_price,
        COALESCE(s.quantity, 0)   AS quantity,
        COALESCE(s.minstock,  5)  AS reorder_level
    FROM variants v
    LEFT JOIN variantoptionvalue    vov ON v.variantid   = vov.variantid
    LEFT JOIN variantattributevalue vav ON vov.valueid   = vav.valueid
    LEFT JOIN variantattribute      va  ON vav.attributeid = va.attributeid
    LEFT JOIN stock                 s   ON v.variantid   = s.variantid
`;

// ── PRODUCTS ──────────────────────────────────────────────────────────────────

export const getAllProducts = async () => {
    const { rows } = await db.query(
        `SELECT ${PRODUCT_COLS} FROM view_products ORDER BY createdat DESC`
    );
    return rows;
};

/**
 * Fetch products by id, preserving the order of `ids`.
 *
 * The product carousel stores its hand-picked products in display order, and a
 * single query keeps that order without N round trips. Ids that no longer exist
 * (deleted products) are skipped rather than returned as holes.
 */
export const getProductsByIds = async (ids = []) => {
    const unique = [...new Set(
        (Array.isArray(ids) ? ids : [])
            .map(Number)
            .filter(id => Number.isInteger(id) && id > 0)
    )];
    if (unique.length === 0) return [];

    const { rows } = await db.query(
        `SELECT ${PRODUCT_COLS} FROM view_products WHERE productsid = ANY($1::int[])`,
        [unique]
    );

    const byId = new Map(rows.map(row => [row.product_id, row]));
    return unique.map(id => byId.get(id)).filter(Boolean);
};

export const getProductById = async (productId) => {
    const { rows: product } = await db.query(
        `SELECT ${PRODUCT_COLS} FROM view_products WHERE productsid = $1`,
        [productId]
    );
    if (product.length === 0) return null;

    const { rows: images } = await db.query(
        `SELECT imageid AS image_id, imageurl AS image_url, isthumbnail AS is_main
         FROM productimages WHERE productsid = $1 ORDER BY isthumbnail DESC, imageid ASC`,
        [productId]
    );

    const { rows: variants } = await db.query(
        `${VARIANT_QUERY} WHERE v.productsid = $1
         GROUP BY v.variantid, v.productsid, v.sku, v.createdat, s.quantity, s.minstock`,
        [productId]
    );

    return { ...product[0], images, variants };
};

export const searchProducts = async (searchTerm = null, category = null, minPrice = null, maxPrice = null, status = null) => {
    const conditions = [];
    const params = [];

    if (searchTerm) {
        const p = addParam(params, `%${searchTerm}%`);
        conditions.push(`(productname ILIKE ${p} OR categoryname ILIKE ${p})`);
    }
    if (category) conditions.push(`categoryname = ${addParam(params, category)}`);
    if (status)   conditions.push(`status = ${addParam(params, status)}`);
    if (minPrice != null) conditions.push(`baseprice >= ${addParam(params, minPrice)}`);
    if (maxPrice != null) conditions.push(`baseprice <= ${addParam(params, maxPrice)}`);

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await db.query(
        `SELECT ${PRODUCT_COLS} FROM view_products ${where} ORDER BY productname`,
        params
    );
    return rows;
};

/** Whitelist of allowed sort fields to prevent SQL injection */
const SORT_WHITELIST = {
    'product_name':  'productname',
    'base_price':    'baseprice',
    'product_status':'status',
    'created_at':    'createdat',
    'category_name': 'categoryname',
    'total_stock':   'totalstock',
};

export const getPaginatedProducts = async (page = 1, pageSize = 10, filters = {}) => {
    const { search, category, minPrice, maxPrice, status, stockStatus, sortField, sortDirection } = filters;
    const offset = (page - 1) * pageSize;

    const conditions = [];
    const params = [];

    if (search) {
        const p = addParam(params, `%${search}%`);
        conditions.push(`(productname ILIKE ${p} OR categoryname ILIKE ${p})`);
    }
    if (category) conditions.push(`categoryname = ${addParam(params, category)}`);
    if (status)   conditions.push(`status = ${addParam(params, status)}`);
    if (minPrice != null) conditions.push(`baseprice >= ${addParam(params, minPrice)}`);
    if (maxPrice != null) conditions.push(`baseprice <= ${addParam(params, maxPrice)}`);
    if (stockStatus === 'in_stock')   conditions.push('totalstock >= 10');
    if (stockStatus === 'low_stock')  conditions.push('totalstock > 0 AND totalstock < 10');
    if (stockStatus === 'out_of_stock') conditions.push('(totalstock = 0 OR totalstock IS NULL)');

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await db.query(
        `SELECT COUNT(*) AS total FROM view_products ${where}`,
        params
    );
    const totalItems = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(totalItems / pageSize);

    const limitP  = addParam(params, pageSize);
    const offsetP = addParam(params, offset);

    // Safe sort — fall back to createdat DESC if the requested field is not in the whitelist
    const sortCol   = SORT_WHITELIST[sortField] || 'createdat';
    const sortDir   = sortDirection === 'asc' ? 'ASC' : 'DESC';

    const { rows: items } = await db.query(
        `SELECT ${PRODUCT_COLS} FROM view_products ${where}
         ORDER BY ${sortCol} ${sortDir}, productsid DESC
         LIMIT ${limitP} OFFSET ${offsetP}`,
        params
    );

    return { page: parseInt(page), pageSize: parseInt(pageSize), totalItems, totalPages, items };
};

export const getProductsByCategory = async (categoryName) => {
    const { rows } = await db.query(
        `SELECT ${PRODUCT_COLS} FROM view_products WHERE categoryname = $1 ORDER BY createdat DESC`,
        [categoryName]
    );
    return rows;
};

export const getFeaturedProducts = async (limit = 10) => {
    const { rows } = await db.query(
        `SELECT ${PRODUCT_COLS} FROM view_products
         WHERE status = 'active'
         ORDER BY totalstock DESC, createdat DESC
         LIMIT $1`,
        [limit]
    );
    return rows;
};

export const getNewArrivals = async (limit = 10) => {
    const { rows } = await db.query(
        `SELECT ${PRODUCT_COLS} FROM view_products
         WHERE status = 'active'
           AND ('new_arrival' = ANY(tags) OR createdat >= NOW() - INTERVAL '30 days')
         ORDER BY
           CASE WHEN 'new_arrival' = ANY(tags) THEN 0 ELSE 1 END,
           createdat DESC
         LIMIT $1`,
        [limit]
    );
    return rows;
};

export const getComingSoon = async (limit = 10) => {
    const { rows } = await db.query(
        `SELECT ${PRODUCT_COLS} FROM view_products
         WHERE 'coming_soon' = ANY(tags)
         ORDER BY createdat DESC
         LIMIT $1`,
        [limit]
    );
    return rows;
};

export const getBestSellers = async (limit = 10) => {
    const { rows } = await db.query(
        `SELECT ${PRODUCT_COLS} FROM view_products
         WHERE status = 'active'
           AND ('best_seller' = ANY(tags) OR totalstock > 20)
         ORDER BY
           CASE WHEN 'best_seller' = ANY(tags) THEN 0 ELSE 1 END,
           totalstock DESC
         LIMIT $1`,
        [limit]
    );
    return rows;
};

export const getProductsByTag = async (tag, limit = 10) => {
    const { rows } = await db.query(
        `SELECT ${PRODUCT_COLS} FROM view_products
         WHERE $1 = ANY(tags)
         ORDER BY createdat DESC
         LIMIT $2`,
        [tag, limit]
    );
    return rows;
};

export const createProduct = async (productData) => {
    const { category_id, product_name, base_price, descriptions, product_status, tags } = productData;
    const { rows } = await db.query(
        `INSERT INTO products (categoriesid, productname, baseprice, description, status, tags)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING productsid`,
        [category_id, product_name, base_price, descriptions, product_status, tags || []]
    );
    return rows[0].productsid;
};

export const updateProduct = async (productId, productData) => {
    const { category_id, product_name, base_price, descriptions, product_status, tags } = productData;
    const result = await db.query(
        `UPDATE products
         SET categoriesid = COALESCE($1, categoriesid),
             productname = $2,
             baseprice = $3,
             description = $4,
             status = $5,
             tags = $6
         WHERE productsid = $7`,
        [category_id ?? null, product_name, base_price, descriptions, product_status, tags || [], productId]
    );
    return result.rowCount;
};

export const deleteProduct = async (productId, forceDelete = false) => {
    // Cascade-delete associated data in FK-safe order, then delete the product.
    // Uses a transaction so a failure mid-way rolls everything back.
    //
    // When forceDelete is true, order items are deleted first (before variants)
    // to clear both the productsid and variantid FK references, since variantid
    // has a NOT NULL constraint and cannot be set to NULL.
    const client = await db.connect();
    try {
        await client.query('BEGIN');

        // ── Phase 1: clean FK-safe children (no dependencies on each other) ──

        // 1. Discounts (FK → products)
        await client.query('DELETE FROM discounts WHERE productsid = $1', [productId]);

        // 2. Stock log entries (FK → stock → products)
        await client.query(
            `DELETE FROM stocklog WHERE stockid IN (
                SELECT stockid FROM stock WHERE productsid = $1
            )`,
            [productId]
        );

        // 3. Stock records (FK → products, FK → variants)
        await client.query('DELETE FROM stock WHERE productsid = $1', [productId]);

        // ── Phase 2: order items & variants ──
        // Order items have FK constraints on BOTH productsid AND variantid.
        // variantid is NOT NULL, so in force mode we must DELETE order items
        // before variants. In normal mode the order doesn't matter since no
        // order items reference test products.

        if (forceDelete) {
            // Force mode: delete order items first to clear both FK references
            await client.query('DELETE FROM orderitems WHERE productsid = $1', [productId]);
        }

        // 4. Variant option values (FK → variants → products)
        await client.query(
            `DELETE FROM variantoptionvalue WHERE variantid IN (
                SELECT variantid FROM variants WHERE productsid = $1
            )`,
            [productId]
        );

        // 5. Variants (FK → products)
        await client.query('DELETE FROM variants WHERE productsid = $1', [productId]);

        if (!forceDelete) {
            // Normal mode: try to delete order items (must come after variants
            // since this is the same order as before; it only works when no
            // order items exist for this product).
            await client.query('DELETE FROM orderitems WHERE productsid = $1', [productId]);
        }

        // ── Phase 3: remaining FK-safe children ──

        // 6. Product images (FK → products)
        await client.query('DELETE FROM productimages WHERE productsid = $1', [productId]);

        // 7. Reviews (FK → products, ON DELETE CASCADE, but be explicit)
        await client.query('DELETE FROM reviews WHERE productsid = $1', [productId]);

        // 8. Cart items (FK → products)
        await client.query('DELETE FROM cartitems WHERE productsid = $1', [productId]);

        // 9. Wishlist items (FK → products, ON DELETE CASCADE)
        await client.query('DELETE FROM wishlist_items WHERE productsid = $1', [productId]);

        // 10. Finally, the product itself
        const result = await client.query('DELETE FROM products WHERE productsid = $1', [productId]);

        await client.query('COMMIT');
        return result.rowCount > 0;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

export const productExists = async (productId) => {
    const { rows } = await db.query('SELECT productsid FROM products WHERE productsid = $1', [productId]);
    return rows.length > 0;
};

// ── IMAGES ────────────────────────────────────────────────────────────────────

export const addProductImage = async (productId, imageUrl, isMain = 0, altText = null, sortOrder = 0) => {
    if (isMain) {
        await db.query('UPDATE productimages SET isthumbnail = FALSE WHERE productsid = $1', [productId]);
    }
    const { rows } = await db.query(
        `INSERT INTO productimages (productsid, imageurl, alttext, isthumbnail, sortorder)
         VALUES ($1, $2, $3, $4, $5) RETURNING imageid`,
        [productId, imageUrl, altText, Boolean(isMain), sortOrder]
    );
    return rows[0].imageid;
};

export const getProductImages = async (productId) => {
    const { rows } = await db.query(
        `SELECT imageid AS image_id,
                imageurl AS image_url,
                alttext  AS alt_text,
                isthumbnail AS is_main,
                sortorder AS sort_order
         FROM productimages WHERE productsid = $1 ORDER BY sortorder ASC, imageid ASC`,
        [productId]
    );
    return rows;
};

export const deleteProductImage = async (imageId) => {
    const result = await db.query('DELETE FROM productimages WHERE imageid = $1', [imageId]);
    return result.rowCount > 0;
};

export const setMainImage = async (imageId, productId) => {
    await db.query('UPDATE productimages SET isthumbnail = FALSE WHERE productsid = $1', [productId]);
    const result = await db.query(
        'UPDATE productimages SET isthumbnail = TRUE WHERE imageid = $1',
        [imageId]
    );
    return result.rowCount > 0;
};

// ── VARIANTS ─────────────────────────────────────────────────────────────────

export const getProductVariants = async (productId) => {
    const { rows } = await db.query(
        `${VARIANT_QUERY} WHERE v.productsid = $1
         GROUP BY v.variantid, v.productsid, v.sku, v.createdat, s.quantity, s.minstock`,
        [productId]
    );
    return rows;
};

export const getVariantById = async (variantId) => {
    const { rows } = await db.query(
        `${VARIANT_QUERY} WHERE v.variantid = $1
         GROUP BY v.variantid, v.productsid, v.sku, v.createdat, s.quantity, s.minstock`,
        [variantId]
    );
    return rows[0];
};

export const createVariant = async (variantData) => {
    const { product_id, sku, price } = variantData;
    const { rows } = await db.query(
        `INSERT INTO variants (productsid, sku, price) VALUES ($1, $2, $3) RETURNING variantid`,
        [product_id, sku, price ?? null]
    );
    return rows[0].variantid;
};

export const updateVariant = async (variantId, variantData) => {
    const { sku, price } = variantData;
    const updates = [];
    const params = [];
    if (sku !== undefined) {
        updates.push(`sku = $${params.length + 1}`);
        params.push(sku);
    }
    if (price !== undefined) {
        updates.push(`price = $${params.length + 1}`);
        params.push(price);
    }
    if (updates.length === 0) return 0;
    params.push(variantId);
    const result = await db.query(
        `UPDATE variants SET ${updates.join(', ')} WHERE variantid = $${params.length}`,
        params
    );
    return result.rowCount;
};

export const deleteVariant = async (variantId) => {
    const result = await db.query('DELETE FROM variants WHERE variantid = $1', [variantId]);
    return result.rowCount > 0;
};

export const skuExists = async (sku) => {
    const { rows } = await db.query('SELECT variantid FROM variants WHERE sku = $1', [sku]);
    return rows.length > 0;
};

// ── VARIANT OPTIONS (Color / Size) ────────────────────────────────────────────

async function getOrCreateAttribute(name) {
    const { rows } = await db.query(
        `INSERT INTO variantattribute (attributename) VALUES ($1)
         ON CONFLICT (attributename) DO UPDATE SET attributename = EXCLUDED.attributename
         RETURNING attributeid`,
        [name]
    );
    return rows[0].attributeid;
}

async function getOrCreateAttributeValue(attributeId, value) {
    const { rows } = await db.query(
        `INSERT INTO variantattributevalue (attributeid, value) VALUES ($1, $2)
         ON CONFLICT (attributeid, value) DO UPDATE SET value = EXCLUDED.value
         RETURNING valueid`,
        [attributeId, value]
    );
    return rows[0].valueid;
}

/**
 * Add a list of variant attribute options for a variant.
 * optionsArray: [{ attribute_name: 'Color', value: 'Red' }, ...]
 * Returns the variantId on success.
 */
export const addVariantOptions = async (variantId, optionsArray = []) => {
    if (!Array.isArray(optionsArray)) {
        // Backward compat: legacy signature (variantId, color, size)
        const [color, size] = arguments.length > 2 ? [arguments[1], arguments[2]] : [null, null];
        optionsArray = [];
        if (color) optionsArray.push({ attribute_name: 'Color', value: color });
        if (size)  optionsArray.push({ attribute_name: 'Size',  value: size  });
    }

    for (const opt of optionsArray) {
        if (!opt || !opt.attribute_name || !opt.value) continue;
        const attrId  = await getOrCreateAttribute(String(opt.attribute_name));
        const valueId = await getOrCreateAttributeValue(attrId, String(opt.value));
        await db.query(
            `INSERT INTO variantoptionvalue (variantid, valueid) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [variantId, valueId]
        );
    }
    return variantId;
};

/**
 * Get the options attached to a variant.
 * Returns: { option_id, options: [{ attribute_name, value }, ...], variant_color, variant_size }
 * `variant_color`/`variant_size` are kept as backward-compatible aliases for the legacy Color/Size attributes.
 */
export const getVariantOptions = async (variantId) => {
    const { rows } = await db.query(
        `SELECT
             v.variantid AS option_id,
             va.attributename AS attribute_name,
             vav.value AS value
         FROM variants v
         LEFT JOIN variantoptionvalue    vov ON v.variantid   = vov.variantid
         LEFT JOIN variantattributevalue vav ON vov.valueid   = vav.valueid
         LEFT JOIN variantattribute      va  ON vav.attributeid = va.attributeid
         WHERE v.variantid = $1
         ORDER BY va.attributename ASC`,
        [variantId]
    );

    const options = rows
        .filter(r => r.attribute_name && r.value)
        .map(r => ({ attribute_name: r.attribute_name, value: r.value }));

    const findValue = (name) => {
        const m = options.find(o => o.attribute_name === name);
        return m ? m.value : null;
    };

    return {
        option_id: variantId,
        options,
        variant_color:   findValue('Color'),
        variant_size:    findValue('Size'),
        variant_storage: findValue('Storage'),
    };
};

/**
 * Replace the options attached to a variant. Deletes existing `variantOptionValue` rows
 * for the variant, then re-inserts from `optionsArray`.
 */
export const updateVariantOptions = async (variantId, optionsArray = []) => {
    await db.query(
        `DELETE FROM variantoptionvalue WHERE variantid = $1`,
        [variantId]
    );
    await addVariantOptions(variantId, optionsArray);
    return 1;
};

// ── STOCK ─────────────────────────────────────────────────────────────────────

export const getStock = async (variantId) => {
    const { rows } = await db.query(
        `SELECT stockid AS stock_id, productsid AS product_id, variantid AS variant_id,
                quantity, minstock AS reorder_level
         FROM stock WHERE variantid = $1`,
        [variantId]
    );
    return rows[0];
};

/**
 * Upsert product-level stock (variantId IS NULL).
 * Returns the stockId of the affected row.
 */
export const getProductStock = async (productId) => {
    const { rows } = await db.query(
        `SELECT stockid AS stock_id, productsid AS product_id, variantid AS variant_id,
                quantity, minstock AS reorder_level
         FROM stock WHERE productsid = $1 AND variantid IS NULL`,
        [productId]
    );
    return rows[0];
};

/**
 * Upsert product-level stock (variantId IS NULL).
 * Returns the stockId of the affected row.
 */
export const updateProductStock = async (productId, quantity, reorderLevel = 5, userId = null, reason = null) => {
    // Try UPDATE first
    const updateResult = await db.query(
        `UPDATE stock SET quantity = $1, minstock = $2, updatedat = NOW()
         WHERE productsid = $3 AND variantid IS NULL
         RETURNING stockid`,
        [quantity, reorderLevel, productId]
    );
    let stockId;
    if (updateResult.rows.length > 0) {
        stockId = updateResult.rows[0].stockid;
    } else {
        // No row exists yet — INSERT
        const insertResult = await db.query(
            `INSERT INTO stock (productsid, variantid, quantity, minstock)
             VALUES ($1, NULL, $2, $3) RETURNING stockid`,
            [productId, quantity, reorderLevel]
        );
        stockId = insertResult.rows[0].stockid;
    }
    if (stockId != null) {
        await createStockLog({
            stock_id: stockId,
            user_id: userId,
            change_type: 'ADJUST',
            quantity,
            reason: reason || 'Product stock update',
        });
    }
    return stockId;
};

// Upserts stock for a variant, auto-resolving the product ID from the variants table.
// Returns the stockId of the affected row.
export const updateStock = async (variantId, quantity, reorderLevel = 5, userId = null, reason = null) => {
    const result = await db.query(
        `INSERT INTO stock (productsid, variantid, quantity, minstock)
         VALUES ((SELECT productsid FROM variants WHERE variantid = $1), $1, $2, $3)
         ON CONFLICT (productsid, variantid)
         DO UPDATE SET quantity = $2, minstock = $3, updatedat = NOW()
         RETURNING stockid`,
        [variantId, quantity, reorderLevel]
    );
    const stockId = result.rows[0] ? result.rows[0].stockid : null;
    if (stockId != null) {
        await createStockLog({
            stock_id: stockId,
            user_id: userId,
            change_type: 'ADJUST',
            quantity,
            reason: reason || 'Variant stock update',
        });
    }
    return stockId;
};

export const incrementStock = async (variantId, amount, userId = null, reason = null) => {
    const result = await db.query(
        `UPDATE stock SET quantity = quantity + $1, updatedat = NOW()
         WHERE variantid = $2 RETURNING stockid`,
        [amount, variantId]
    );
    const stockId = result.rows[0] ? result.rows[0].stockid : null;
    if (stockId != null) {
        await createStockLog({
            stock_id: stockId,
            user_id: userId,
            change_type: 'IN',
            quantity: amount,
            reason: reason || 'Stock increment',
        });
    }
    return stockId;
};

export const decrementStock = async (variantId, amount, userId = null, reason = null) => {
    const result = await db.query(
        `UPDATE stock SET quantity = quantity - $1, updatedat = NOW()
         WHERE variantid = $2 AND quantity >= $1 RETURNING stockid`,
        [amount, variantId]
    );
    const stockId = result.rows[0] ? result.rows[0].stockid : null;
    if (stockId != null) {
        await createStockLog({
            stock_id: stockId,
            user_id: userId,
            change_type: 'OUT',
            quantity: amount,
            reason: reason || 'Stock decrement',
        });
    }
    return stockId;
};

export const getLowStockProducts = async () => {
    const { rows } = await db.query(
        `SELECT
             COALESCE(s.stockid, 0)          AS stock_id,
             v.product_name,
             v.sku,
             v.quantity,
             v.minstock                      AS reorder_level,
             v.shortage
         FROM view_stock_low v
         LEFT JOIN stock s ON (
             (s.variantid IS NOT NULL AND s.variantid = v.variant_id)
             OR
             (s.variantid IS NULL AND s.productsid = v.product_id)
         )`
    );
    return rows;
};

// ── DISCOUNTS ─────────────────────────────────────────────────────────────────

export const applyDiscount = async (productId, discountAmount, startDate, endDate) => {
    const { rows } = await db.query(
        `INSERT INTO discounts (productsid, amounts, startdate, enddate)
         VALUES ($1, $2, $3, $4) RETURNING discountsid`,
        [productId, discountAmount, startDate, endDate]
    );
    return rows[0].discountsid;
};

export const getActiveDiscount = async (productId) => {
    const { rows } = await db.query(
        `SELECT discountsid AS discount_id, productsid AS product_id,
                amounts AS discount_amount, startdate AS start_date, enddate AS end_date
         FROM discounts
         WHERE productsid = $1 AND NOW() BETWEEN startdate AND enddate
         ORDER BY discountsid DESC
         LIMIT 1`,
        [productId]
    );
    return rows[0];
};

export const getProductDiscounts = async (productId) => {
    const { rows } = await db.query(
        `SELECT discountsid AS discount_id, productsid AS product_id,
                amounts AS discount_amount, startdate AS start_date, enddate AS end_date
         FROM discounts WHERE productsid = $1 ORDER BY startdate DESC`,
        [productId]
    );
    return rows;
};

export const deleteDiscount = async (discountId) => {
    const result = await db.query('DELETE FROM discounts WHERE discountsid = $1', [discountId]);
    return result.rowCount > 0;
};

export const updateDiscount = async (discountId, discountData) => {
    const { discount_amount, start_date, end_date } = discountData;
    const result = await db.query(
        `UPDATE discounts SET amounts = $1, startdate = $2, enddate = $3 WHERE discountsid = $4`,
        [discount_amount, start_date, end_date, discountId]
    );
    return result.rowCount;
};

export const getAllDiscounts = async () => {
    const { rows } = await db.query(
        `SELECT
             d.discountsid    AS discount_id,
             d.productsid     AS product_id,
             p.productname    AS product_name,
             d.amounts        AS discount_amount,
             d.startdate      AS start_date,
             d.enddate        AS end_date,
             d.createdat      AS created_at
         FROM discounts d
         JOIN products p ON d.productsid = p.productsid
         ORDER BY d.createdat DESC`
    );
    return rows;
};

export { db };
