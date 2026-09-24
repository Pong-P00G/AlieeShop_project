#!/usr/bin/env node
/**
 * One-command local setup: create the database, load the base schema into a
 * fresh one, apply migrations, and seed sample catalog data.
 *
 * Usage:
 *   npm run setup                  # create DB + migrate + seed
 *   npm run setup -- --no-seed     # create DB + migrate only
 *   npm run setup -- --force-seed  # seed even if products already exist
 *
 * Reads the same DB_* variables as the app from server/.env (loaded by the npm
 * script via --env-file), so it always operates on the database the app uses.
 *
 * Why the database name is not created by the migrations: the files in
 * migrations/ are additive — they only create feature tables and columns.
 * The core schema (products, users, category, orders, ...) predates them and
 * lives in schema/000_base_schema.sql, which is applied here when — and only
 * when — the target database has no core tables yet.
 */
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { CORE_TABLE, seedFileExists, applySeed } from './src/database/seedProducts.js';

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BASE_SCHEMA_FILE = path.join(__dirname, 'schema', '000_base_schema.sql');

const args = new Set(process.argv.slice(2));
const skipSeed = args.has('--no-seed');
const forceSeed = args.has('--force-seed');

const log = {
    step: (msg) => console.log(`\n${msg}`),
    ok: (msg) => console.log(`   ✅ ${msg}`),
    skip: (msg) => console.log(`   ⏭️  ${msg}`),
    info: (msg) => console.log(`   ${msg}`),
};

const quoteIdent = (name) => `"${String(name).replace(/"/g, '""')}"`;

function connectionConfig(database) {
    return {
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT) || 5432,
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD,
        database,
    };
}

/**
 * Create the target database if it does not exist. Returns true when it had
 * to be created. Connects to a maintenance database because CREATE DATABASE
 * cannot run from inside the database being created.
 */
async function ensureDatabase(name) {
    const maintenanceDb = process.env.DB_MAINTENANCE_DB || 'postgres';
    const client = new Client(connectionConfig(maintenanceDb));
    await client.connect();
    try {
        const { rowCount } = await client.query(
            'SELECT 1 FROM pg_database WHERE datname = $1',
            [name]
        );
        if (rowCount > 0) {
            log.skip(`Database ${name} already exists.`);
            return false;
        }
        // Cannot be parameterised, so the identifier is quoted by hand.
        await client.query(`CREATE DATABASE ${quoteIdent(name)}`);
        log.ok(`Created database ${name}.`);
        return true;
    } finally {
        await client.end();
    }
}

async function hasCoreTable(client) {
    const { rowCount } = await client.query(
        `SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = $1`,
        [CORE_TABLE]
    );
    return rowCount > 0;
}

/**
 * Load the core schema, but only into a database that has none — the file is a
 * plain pg_dump and would fail against a database that already has the tables.
 */
async function applyBaseSchema(database) {
    if (!fs.existsSync(BASE_SCHEMA_FILE)) {
        throw new Error(
            `Base schema not found at ${path.relative(process.cwd(), BASE_SCHEMA_FILE)}. ` +
            'It is committed to the repository — check that your checkout is complete.'
        );
    }

    const client = new Client(connectionConfig(database));
    await client.connect();
    try {
        if (await hasCoreTable(client)) {
            log.skip(`Database already has the core schema (found ${CORE_TABLE}).`);
            return false;
        }

        const sql = fs.readFileSync(BASE_SCHEMA_FILE, 'utf8');
        await client.query('BEGIN');
        try {
            await client.query(sql);
            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK').catch(() => {});
            throw error;
        }
        log.ok('Applied base schema (core tables, views, indexes, pgcrypto).');
        return true;
    } finally {
        await client.end();
    }
}

/**
 * Run the existing migration runner as a child process rather than importing
 * it: migrate.js executes its main() on import and calls process.exit(), and
 * spawning it keeps a single source of truth for how migrations are tracked.
 */
function runMigrations() {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, ['migrate.js'], {
            cwd: __dirname,
            stdio: 'inherit',
            env: process.env,
        });
        child.on('error', reject);
        child.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`migrate.js failed (exit code ${code}).`));
        });
    });
}

async function seed(database) {
    if (!seedFileExists()) {
        log.skip('No seed_products.sql found — nothing to seed.');
        return false;
    }

    const client = new Client(connectionConfig(database));
    await client.connect();
    try {
        const { rows } = await client.query(
            `SELECT COUNT(*)::int AS count FROM ${quoteIdent(CORE_TABLE)}`
        );
        const existing = rows[0].count;

        if (existing > 0 && !forceSeed) {
            log.skip(
                `Skipping seed — ${CORE_TABLE} already holds ${existing} row(s). ` +
                'Pass --force-seed to add the sample data anyway.'
            );
            return false;
        }

        if (existing > 0 && forceSeed) {
            log.info(
                `--force-seed: adding sample data to a non-empty ${CORE_TABLE} table. ` +
                'The seed is idempotent, so only products that are not already present are added.'
            );
        }

        // The seed file opens and commits its own transaction.
        await applySeed(client);
        log.ok('Seeded sample categories, products, variants and stock.');
        return true;
    } finally {
        await client.end();
    }
}

async function reportCounts(database) {
    const client = new Client(connectionConfig(database));
    await client.connect();
    try {
        const { rows } = await client.query(`
            SELECT
                (SELECT COUNT(*)::int FROM products)  AS products,
                (SELECT COUNT(*)::int FROM category)  AS categories,
                (SELECT COUNT(*)::int FROM variants)  AS variants,
                (SELECT COUNT(*)::int FROM users)     AS users`);
        const c = rows[0];
        log.info(
            `Now in ${database}: ${c.products} products, ${c.categories} categories, ` +
            `${c.variants} variants, ${c.users} users.`
        );
    } catch (error) {
        // Counts are cosmetic; never fail setup because of them.
        log.info(`(Could not read row counts: ${error.message})`);
    } finally {
        await client.end();
    }
}

async function main() {
    const database = process.env.DB_DATABASE;

    if (!database) {
        throw new Error(
            'DB_DATABASE is not set. Copy server/.env.example to server/.env and fill it in, ' +
            'then run `npm run setup` (which loads .env for you).'
        );
    }

    if (!fs.existsSync(path.join(__dirname, '.env'))) {
        log.info(
            'Note: no server/.env found. Copy server/.env.example to server/.env if the ' +
            'connection details below are wrong.'
        );
    }

    console.log(`Setting up AlieeShop on ${database} ...`);

    log.step('1/4  Database');
    await ensureDatabase(database);

    log.step('2/4  Base schema');
    await applyBaseSchema(database);

    log.step('3/4  Migrations');
    await runMigrations();

    if (skipSeed) {
        log.step('4/4  Seed');
        log.skip('Skipped (--no-seed).');
    } else {
        log.step('4/4  Seed');
        await seed(database);
    }

    console.log('\n' + '='.repeat(52));
    console.log('✅ Setup complete.');
    await reportCounts(database);
    console.log('   Start the API with:  npm run dev');
    console.log('='.repeat(52));
}

main().catch((error) => {
    console.error(`\n❌ Setup failed: ${error.message}`);
    if (/permission denied to create database|must be superuser/i.test(error.message)) {
        console.error(
            '   The database user lacks CREATEDB rights. Create the database manually as a ' +
            'superuser, then re-run `npm run setup`.'
        );
    }
    if (/ECONNREFUSED/i.test(error.message)) {
        console.error('   Is PostgreSQL running and are the DB_* values in server/.env correct?');
    }
    process.exit(1);
});
