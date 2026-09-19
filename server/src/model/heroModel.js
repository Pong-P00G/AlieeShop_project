import db from '../database/dbpool.js';

const SLIDE_COLUMNS = `slide_id,
                       eyebrow,
                       title,
                       title_accent,
                       description,
                       image_url,
                       cta_label,
                       cta_link,
                       badge,
                       sort_order,
                       is_active,
                       created_at,
                       updated_at`;

/**
 * Return hero slides in display order.
 * activeOnly = true is used by the public storefront endpoint.
 */
export const getAllSlides = async ({ activeOnly = false } = {}) => {
    const { rows } = await db.query(
        `SELECT ${SLIDE_COLUMNS}
         FROM hero_slides
         ${activeOnly ? 'WHERE is_active = TRUE' : ''}
         ORDER BY sort_order ASC, slide_id ASC`
    );
    return rows;
};

export const getSlideById = async (slideId) => {
    const { rows } = await db.query(
        `SELECT ${SLIDE_COLUMNS} FROM hero_slides WHERE slide_id = $1`,
        [slideId]
    );
    return rows[0];
};

export const countSlides = async () => {
    const { rows } = await db.query(`SELECT COUNT(*)::int AS total FROM hero_slides`);
    return rows[0]?.total ?? 0;
};

/**
 * Append a slide at the end of the current order.
 */
export const createSlide = async (slide) => {
    const { rows } = await db.query(
        `INSERT INTO hero_slides
            (eyebrow, title, title_accent, description, image_url,
             cta_label, cta_link, badge, sort_order, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
                 COALESCE((SELECT MAX(sort_order) + 1 FROM hero_slides), 0), $9)
         RETURNING ${SLIDE_COLUMNS}`,
        [
            slide.eyebrow,
            slide.title,
            slide.title_accent,
            slide.description,
            slide.image_url,
            slide.cta_label,
            slide.cta_link,
            slide.badge,
            slide.is_active,
        ]
    );
    return rows[0];
};

export const updateSlide = async (slideId, slide) => {
    const { rows } = await db.query(
        `UPDATE hero_slides
         SET eyebrow      = $1,
             title        = $2,
             title_accent = $3,
             description  = $4,
             image_url    = $5,
             cta_label    = $6,
             cta_link     = $7,
             badge        = $8,
             is_active    = $9,
             updated_at   = NOW()
         WHERE slide_id = $10
         RETURNING ${SLIDE_COLUMNS}`,
        [
            slide.eyebrow,
            slide.title,
            slide.title_accent,
            slide.description,
            slide.image_url,
            slide.cta_label,
            slide.cta_link,
            slide.badge,
            slide.is_active,
            slideId,
        ]
    );
    return rows[0];
};

/**
 * Lightweight toggle used by the active switch in the admin list.
 */
export const setSlideActive = async (slideId, isActive) => {
    const { rows } = await db.query(
        `UPDATE hero_slides
         SET is_active = $1, updated_at = NOW()
         WHERE slide_id = $2
         RETURNING ${SLIDE_COLUMNS}`,
        [isActive, slideId]
    );
    return rows[0];
};

export const deleteSlide = async (slideId) => {
    const result = await db.query(`DELETE FROM hero_slides WHERE slide_id = $1`, [slideId]);
    return result.rowCount > 0;
};

/**
 * Persist a new display order in a single transaction.
 * orderedIds is the full list of slide ids, first-to-last.
 */
export const reorderSlides = async (orderedIds) => {
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        for (let index = 0; index < orderedIds.length; index++) {
            await client.query(
                `UPDATE hero_slides SET sort_order = $1, updated_at = NOW() WHERE slide_id = $2`,
                [index, orderedIds[index]]
            );
        }
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
    } finally {
        client.release();
    }
};
