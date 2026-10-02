import db from '../database/dbpool.js';

function addParam(params, val) {
    params.push(val);
    return `$${params.length}`;
}

const REVIEW_COLS = `
    r.reviewsid     AS review_id,
    r.productsid    AS product_id,
    r.usersid       AS user_id,
    u.username,
    r.rating,
    r.title,
    r.comment,
    r.status,
    r.moderationnote AS moderation_note,
    r.createdat     AS created_at,
    r.updatedat     AS updated_at,
    (SELECT COUNT(*)::int FROM review_helpful rh WHERE rh.reviewsid = r.reviewsid) AS helpful_count,
    EXISTS (
        SELECT 1
        FROM orderitems oi
        JOIN orders o ON oi.ordersid = o.ordersid
        WHERE o.usersid = r.usersid
          AND oi.productsid = r.productsid
          AND o.status <> 'cancelled'
    ) AS verified_purchase
`;

// ── CREATE ──────────────────────────────────────────────────────────────────

export const createReview = async ({ product_id, user_id, rating, title, comment }) => {
    const { rows } = await db.query(
        `INSERT INTO reviews (productsid, usersid, rating, title, comment, status)
         VALUES ($1, $2, $3, $4, $5, 'pending')
         RETURNING reviewsid`,
        [product_id, user_id, rating, title || null, comment || null]
    );
    return rows[0].reviewsid;
};

// ── READ ────────────────────────────────────────────────────────────────────

const REVIEW_SORTS = {
    newest:  'r.createdat DESC',
    oldest:  'r.createdat ASC',
    highest: 'r.rating DESC, r.createdat DESC',
    lowest:  'r.rating ASC, r.createdat DESC',
    helpful: 'helpful_count DESC, r.createdat DESC',
};

export const getReviewsByProduct = async (productId, status = 'approved', options = {}) => {
    const { rating = null, sort = 'newest' } = options;
    const params = [productId, status];
    let where = 'r.productsid = $1 AND r.status = $2';

    if (rating) {
        params.push(rating);
        where += ` AND r.rating = $${params.length}`;
    }

    const orderBy = REVIEW_SORTS[sort] || REVIEW_SORTS.newest;

    const { rows } = await db.query(
        `SELECT ${REVIEW_COLS}
         FROM reviews r
         JOIN users u ON r.usersid = u.usersid
         WHERE ${where}
         ORDER BY ${orderBy}`,
        params
    );
    return rows;
};

export const getReviewById = async (reviewId) => {
    const { rows } = await db.query(
        `SELECT ${REVIEW_COLS}
         FROM reviews r
         JOIN users u ON r.usersid = u.usersid
         WHERE r.reviewsid = $1`,
        [reviewId]
    );
    return rows[0] || null;
};

export const getReviewsByUser = async (userId) => {
    const { rows } = await db.query(
        `SELECT ${REVIEW_COLS}
         FROM reviews r
         JOIN users u ON r.usersid = u.usersid
         WHERE r.usersid = $1
         ORDER BY r.createdat DESC`,
        [userId]
    );
    return rows;
};

// ── MODERATION ──────────────────────────────────────────────────────────────

export const getPendingReviews = async (page = 1, pageSize = 20) => {
    const offset = (page - 1) * pageSize;

    const countResult = await db.query(
        `SELECT COUNT(*) AS total FROM reviews WHERE status = 'pending'`
    );
    const totalItems = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(totalItems / pageSize);

    const { rows } = await db.query(
        `SELECT ${REVIEW_COLS},
                p.productname AS product_name
         FROM reviews r
         JOIN users u   ON r.usersid   = u.usersid
         JOIN products p ON r.productsid = p.productsid
         WHERE r.status = 'pending'
         ORDER BY r.createdat ASC
         LIMIT $1 OFFSET $2`,
        [pageSize, offset]
    );

    return { page: parseInt(page), pageSize: parseInt(pageSize), totalItems, totalPages, items: rows };
};

export const getAllReviews = async (page = 1, pageSize = 20, statusFilter = null) => {
    const offset = (page - 1) * pageSize;
    const conditions = [];
    const params = [];

    if (statusFilter && statusFilter !== 'all') {
        const p = addParam(params, statusFilter);
        conditions.push(`r.status = ${p}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await db.query(`SELECT COUNT(*) AS total FROM reviews r ${where}`, params);
    const totalItems = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(totalItems / pageSize);

    const limitP  = addParam(params, pageSize);
    const offsetP = addParam(params, offset);

    const { rows } = await db.query(
        `SELECT ${REVIEW_COLS},
                p.productname AS product_name
         FROM reviews r
         JOIN users u   ON r.usersid   = u.usersid
         JOIN products p ON r.productsid = p.productsid
         ${where}
         ORDER BY r.createdat DESC
         LIMIT ${limitP} OFFSET ${offsetP}`,
        params
    );

    return { page: parseInt(page), pageSize: parseInt(pageSize), totalItems, totalPages, items: rows };
};

// ── PRODUCT RATING AGGREGATES ───────────────────────────────────────────────

export const getProductRatingSummary = async (productId) => {
    const { rows: [summary] } = await db.query(
        `SELECT
             COUNT(*)::int                                   AS total_reviews,
             COALESCE(ROUND(AVG(rating), 1), 0)              AS average_rating,
             COALESCE(SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END), 0)::int AS five_star,
             COALESCE(SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END), 0)::int AS four_star,
             COALESCE(SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END), 0)::int AS three_star,
             COALESCE(SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END), 0)::int AS two_star,
             COALESCE(SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END), 0)::int AS one_star
         FROM reviews
         WHERE productsid = $1 AND status = 'approved'`,
        [productId]
    );
    return summary;
};

// ── UPDATE ──────────────────────────────────────────────────────────────────

export const moderateReview = async (reviewId, status, moderationNote = null) => {
    const result = await db.query(
        `UPDATE reviews
         SET status = $1, moderationnote = $2, updatedat = NOW()
         WHERE reviewsid = $3`,
        [status, moderationNote, reviewId]
    );
    return result.rowCount > 0;
};

export const updateReview = async (reviewId, { rating, title, comment }) => {
    const result = await db.query(
        `UPDATE reviews
         SET rating = $1, title = $2, comment = $3, updatedat = NOW()
         WHERE reviewsid = $4`,
        [rating, title || null, comment || null, reviewId]
    );
    return result.rowCount > 0;
};

// ── DELETE ──────────────────────────────────────────────────────────────────

export const deleteReview = async (reviewId) => {
    const result = await db.query('DELETE FROM reviews WHERE reviewsid = $1', [reviewId]);
    return result.rowCount > 0;
};

// ── BULK MODERATION ─────────────────────────────────────────────────────────

export const getReviewsByIds = async (reviewIds = []) => {
    if (!reviewIds.length) return [];
    const { rows } = await db.query(
        `SELECT ${REVIEW_COLS},
                p.productname AS product_name
         FROM reviews r
         JOIN users u   ON r.usersid    = u.usersid
         JOIN products p ON r.productsid = p.productsid
         WHERE r.reviewsid = ANY($1::int[])`,
        [reviewIds]
    );
    return rows;
};

export const bulkModerate = async (reviewIds = [], status, moderationNote = null) => {
    if (!reviewIds.length) return 0;
    const result = await db.query(
        `UPDATE reviews
         SET status = $1, moderationnote = $2, updatedat = NOW()
         WHERE reviewsid = ANY($3::int[])`,
        [status, moderationNote, reviewIds]
    );
    return result.rowCount;
};

// ── EXPORT ──────────────────────────────────────────────────────────────────

export const getReviewsForExport = async (statusFilter = null) => {
    const conditions = [];
    const params = [];

    if (statusFilter && statusFilter !== 'all') {
        const p = addParam(params, statusFilter);
        conditions.push(`r.status = ${p}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await db.query(
        `SELECT ${REVIEW_COLS},
                p.productname AS product_name
         FROM reviews r
         JOIN users u   ON r.usersid    = u.usersid
         JOIN products p ON r.productsid = p.productsid
         ${where}
         ORDER BY r.createdat DESC`,
        params
    );
    return rows;
};

// ── HELPFUL VOTES ───────────────────────────────────────────────────────────

// Returns true when a new vote was recorded, false when the user had already
// voted (the INSERT is a no-op thanks to the unique constraint).
export const markHelpful = async (reviewId, userId) => {
    const result = await db.query(
        `INSERT INTO review_helpful (reviewsid, usersid)
         VALUES ($1, $2)
         ON CONFLICT (reviewsid, usersid) DO NOTHING`,
        [reviewId, userId]
    );
    return result.rowCount > 0;
};

export const unmarkHelpful = async (reviewId, userId) => {
    const result = await db.query(
        `DELETE FROM review_helpful WHERE reviewsid = $1 AND usersid = $2`,
        [reviewId, userId]
    );
    return result.rowCount > 0;
};

// Which of a product's reviews the user has already voted helpful.
export const getUserHelpfulReviewIds = async (userId, productId) => {
    const { rows } = await db.query(
        `SELECT rh.reviewsid AS review_id
         FROM review_helpful rh
         JOIN reviews r ON rh.reviewsid = r.reviewsid
         WHERE rh.usersid = $1 AND r.productsid = $2`,
        [userId, productId]
    );
    return rows.map((r) => r.review_id);
};

// ── HELPER: check if user already reviewed a product ─────────────────────────

export const userHasReviewed = async (productId, userId) => {
    const { rows } = await db.query(
        `SELECT reviewsid FROM reviews WHERE productsid = $1 AND usersid = $2`,
        [productId, userId]
    );
    return rows.length > 0;
};

// ── TABLE CREATION (for auto-bootstrap) ─────────────────────────────────────

export const ensureTable = async () => {
    await db.query(`CREATE TABLE IF NOT EXISTS reviews (
        reviewsId       INTEGER       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        productsId      INTEGER       NOT NULL,
        usersId         INTEGER       NOT NULL,
        rating          INTEGER       NOT NULL CHECK (rating >= 1 AND rating <= 5),
        title           VARCHAR(200),
        comment         TEXT,
        status          VARCHAR(50)   NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
        moderationNote  TEXT,
        createdAt       TIMESTAMPTZ   DEFAULT NOW(),
        updatedAt       TIMESTAMPTZ   DEFAULT NOW(),
        FOREIGN KEY (productsId) REFERENCES products(productsId) ON DELETE CASCADE ON UPDATE CASCADE,
        FOREIGN KEY (usersId) REFERENCES users(usersId) ON DELETE CASCADE ON UPDATE CASCADE
    )`);

    try {
        await db.query(
            `ALTER TABLE reviews ADD CONSTRAINT reviews_product_user_unique UNIQUE (productsId, usersId)`
        );
    } catch (e) {
        // constraint may already exist
    }

    await db.query(`CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(productsId)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status)`);

    await db.query(`CREATE TABLE IF NOT EXISTS review_helpful (
        helpfulId  INTEGER       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        reviewsId  INTEGER       NOT NULL,
        usersId    INTEGER       NOT NULL,
        createdAt  TIMESTAMPTZ   DEFAULT NOW(),
        FOREIGN KEY (reviewsId) REFERENCES reviews(reviewsId) ON DELETE CASCADE,
        FOREIGN KEY (usersId)   REFERENCES users(usersId)     ON DELETE CASCADE,
        CONSTRAINT review_helpful_unique UNIQUE (reviewsId, usersId)
    )`);

    await db.query(`CREATE INDEX IF NOT EXISTS idx_review_helpful_review ON review_helpful(reviewsId)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_review_helpful_user ON review_helpful(usersId)`);
};
