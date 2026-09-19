import db from '../database/dbpool.js';

/**
 * Return all settings as a flat array of { key, value }.
 */
export const getAllSettings = async () => {
    const { rows } = await db.query(
        `SELECT setting_key AS "key", setting_value AS "value"
         FROM store_settings
         ORDER BY setting_key ASC`
    );
    return rows;
};

/**
 * Bulk upsert multiple settings in a single transaction.
 * Accepts an object { key: value, ... }.
 */
export const bulkUpsertSettings = async (settings) => {
    const entries = Object.entries(settings);
    if (entries.length === 0) return [];

    const client = await db.connect();
    try {
        await client.query('BEGIN');

        const results = [];
        for (const [key, value] of entries) {
            const { rows } = await client.query(
                `INSERT INTO store_settings (setting_key, setting_value, updated_at)
                 VALUES ($1, $2, NOW())
                 ON CONFLICT (setting_key)
                 DO UPDATE SET setting_value = EXCLUDED.setting_value,
                               updated_at    = NOW()
                 RETURNING setting_key AS "key", setting_value AS "value", updated_at AS "updatedAt"`,
                [key, String(value)]
            );
            results.push(rows[0]);
        }

        await client.query('COMMIT');
        return results;
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
    } finally {
        client.release();
    }
};
