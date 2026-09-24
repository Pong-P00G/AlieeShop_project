#!/usr/bin/env node
/**
 * Seed runner — loads the sample catalog from seed_products.sql into the
 * database the app is configured to use.
 *
 * Usage:
 *   npm run seed                  # seed only when the catalog is empty
 *   npm run seed -- --force-seed  # add sample rows to a non-empty catalog
 *
 * Reads the same DB_* variables as the app from server/.env (loaded by the npm
 * script via --env-file). The SQL is executed through the `pg` driver rather
 * than `psql`, so no local psql install is required, and the file is
 * idempotent — re-running only inserts rows that are missing.
 */
import db from './src/database/dbpool.js';
import { CORE_TABLE, seedFileExists, applySeed } from './src/database/seedProducts.js';

const args = new Set(process.argv.slice(2));
const forceSeed = args.has('--force-seed');

async function main() {
    if (!seedFileExists()) {
        console.log('⏭️  No seed_products.sql found — nothing to seed.');
        return;
    }

    const { rows } = await db.query(
        `SELECT COUNT(*)::int AS count FROM ${CORE_TABLE}`
    );
    const existing = rows[0].count;

    if (existing > 0 && !forceSeed) {
        console.log(
            `⏭️  Skipping seed — ${CORE_TABLE} already holds ${existing} row(s). ` +
            'Pass --force-seed to add the sample data anyway.'
        );
        return;
    }

    if (existing > 0) {
        console.log(
            `--force-seed: adding sample data to a non-empty ${CORE_TABLE} table. ` +
            'The seed is idempotent, so only products that are not already present are added.'
        );
    }

    await applySeed(db);
    console.log('✅ Seeded sample categories, products, variants, stock and permissions.');

    await reportCounts();
}

async function reportCounts() {
    try {
        const { rows } = await db.query(`
            SELECT
                (SELECT COUNT(*)::int FROM products)  AS products,
                (SELECT COUNT(*)::int FROM category)  AS categories,
                (SELECT COUNT(*)::int FROM variants)  AS variants`);
        const c = rows[0];
        console.log(
            `   Now: ${c.products} products, ${c.categories} categories, ${c.variants} variants.`
        );
    } catch (error) {
        // Counts are cosmetic; never fail the seed because of them.
        console.log(`   (Could not read row counts: ${error.message})`);
    }
}

main()
    .then(() => db.end())
    .then(() => process.exit(0))
    .catch(async (error) => {
        console.error(`\n❌ Seed failed: ${error.message}`);
        await db.end().catch(() => {});
        process.exit(1);
    });
