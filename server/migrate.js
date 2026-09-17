#!/usr/bin/env node
/**
 * Migration runner — applies all pending .sql files in migrations/.
 *
 * Every applied file is recorded in the `schema_migrations` table, so each
 * migration runs exactly once per database. Each file is executed inside a
 * single transaction together with its bookkeeping row: either the whole file
 * lands and is recorded, or nothing changes.
 *
 * Usage:
 *   npm run migrate           # apply pending migrations
 *   npm run migrate -- --status   # only list applied/pending files
 *
 * The runner reuses the app's connection pool, so it reads the same
 * DB_* variables from server/.env (loaded via --env-file in the npm script).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './src/database/dbpool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function ensureTrackingTable() {
    await db.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            filename   VARCHAR(255) PRIMARY KEY,
            applied_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        );`);
}

async function getAppliedMigrations() {
    await ensureTrackingTable();
    const { rows } = await db.query('SELECT filename FROM schema_migrations');
    return new Set(rows.map(row => row.filename));
}

function listMigrationFiles() {
    return fs.readdirSync(MIGRATIONS_DIR)
        .filter(file => file.endsWith('.sql'))
        .sort();
}

async function applyMigration(filename) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf8');
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        // The whole file is sent as one query: node-postgres uses the simple
        // query protocol, which executes every statement in the string.
        await client.query(sql);
        await client.query(
            'INSERT INTO schema_migrations (filename) VALUES ($1)',
            [filename]
        );
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        error.message = `${filename}: ${error.message}`;
        throw error;
    } finally {
        client.release();
    }
}

async function main() {
    const applied = await getAppliedMigrations();
    const files = listMigrationFiles();
    const pending = files.filter(file => !applied.has(file));

    if (process.argv.includes('--status')) {
        console.log('Migration status:');
        for (const file of files) {
            console.log(`  ${applied.has(file) ? '✅ applied' : '⬜ pending'}  ${file}`);
        }
        return;
    }

    if (pending.length === 0) {
        console.log(`✅ Database is up to date (${files.length} migrations applied).`);
        return;
    }

    console.log(`${pending.length} pending migration(s):`);
    for (const file of pending) {
        process.stdout.write(`  ⏳ Applying ${file} ... `);
        await applyMigration(file);
        console.log('done');
    }
    console.log(`✅ Applied ${pending.length} migration(s).`);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(`\n❌ Migration failed: ${error.message}`);
        process.exit(1);
    });
