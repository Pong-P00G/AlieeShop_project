/**
 * Shared helpers for loading the sample catalog.
 *
 * Used by both `npm run setup` (fresh databases) and `npm run seed` (an
 * existing database), so there is a single definition of where the seed lives
 * and how it is executed.
 *
 * The seed file is plain PostgreSQL — it opens and commits its own transaction
 * and guards every insert with ON CONFLICT — so it runs straight through the
 * `pg` driver instead of shelling out to `psql`, which keeps seeding working on
 * machines without the psql client installed.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// src/database/ -> server/
export const SEED_FILE = path.join(__dirname, '..', '..', 'seed_products.sql');

// Presence of rows in this table marks the sample catalog as already loaded.
export const CORE_TABLE = 'products';

export function seedFileExists() {
    return fs.existsSync(SEED_FILE);
}

/**
 * Execute the seed file on an already-connected client or pool. The file is
 * idempotent, so running it against a catalog that already holds some rows only
 * inserts what is missing.
 */
export async function applySeed(client) {
    await client.query(fs.readFileSync(SEED_FILE, 'utf8'));
}
