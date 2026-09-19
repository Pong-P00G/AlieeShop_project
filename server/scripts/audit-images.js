#!/usr/bin/env node
/**
 * Audit product image storage. READ ONLY — this script never deletes or writes
 * anything, in the bucket or in the database. It answers three questions:
 *
 *   1. Stale rows    — productimages rows whose imageurl is not served from the
 *                      configured R2 public origin (a leftover local path, a
 *                      data: URI, or some other host).
 *   2. Broken refs   — rows pointing at a filename that does not exist in the
 *                      bucket, i.e. an image that would render as a 404.
 *   3. Orphaned files — objects in the bucket that no productimages row
 *                      references. These are what the delete paths leak when a
 *                      product or image is removed from the database without
 *                      removing the underlying object.
 *
 * Requires a reachable database and configured R2 credentials (it lists the
 * bucket, so it needs Object Read).
 *
 * Usage:
 *   npm run images:audit                  # report, always exits 0
 *   npm run images:audit -- --fail-on-findings   # exit 1 when anything is found
 */
import path from 'path';
import db from '../src/database/dbpool.js';
import {
    PRODUCT_IMAGE_PREFIX,
    isStorageConfigured,
    listObjects,
    publicUrlFor,
    describeStorageError,
} from '../src/services/storageService.js';

// A path segment shared by every stored value that points at a local file.
// Kept in step with scripts/migrate-images-to-r2.js.
const LOCAL_PATH_SEGMENT = `/images/${PRODUCT_IMAGE_PREFIX}/`;

const R2_BASE = (process.env.R2_PUBLIC_BASE_URL || '').replace(/\/+$/, '');
const FAIL_ON_FINDINGS = process.argv.includes('--fail-on-findings');

const log = {
    step: (msg) => console.log(`\n${msg}`),
    ok: (msg) => console.log(`   ✅ ${msg}`),
    skip: (msg) => console.log(`   ⏭️  ${msg}`),
    info: (msg) => console.log(`   ${msg}`),
    warn: (msg) => console.log(`   ⚠️  ${msg}`),
};

const bytes = (n) => `${n.toLocaleString('en-US')} B`;

/** Where does a stored URL actually point? */
const classify = (url) => {
    if (R2_BASE && (url === R2_BASE || url.startsWith(`${R2_BASE}/`))) return 'r2';
    if (url.includes(LOCAL_PATH_SEGMENT)) return 'local_path';
    if (/^data:/i.test(url)) return 'data_uri';
    if (/^https?:\/\//i.test(url)) return 'external';
    if (url.startsWith('/')) return 'other_relative';
    return 'unknown';
};

/** The object filename a stored URL refers to, or null when it has none. */
const filenameOf = (url) => {
    if (/^data:/i.test(url)) return null;
    const withoutQuery = url.split('#')[0].split('?')[0];
    const name = withoutQuery.split('/').pop();
    if (!name) return null;
    try {
        return decodeURIComponent(name);
    } catch {
        return name;
    }
};

async function main() {
    if (!isStorageConfigured()) {
        throw new Error(
            'Object storage is not configured. Set R2_ENDPOINT, R2_ACCESS_KEY_ID, ' +
            'R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME and R2_PUBLIC_BASE_URL in server/.env.'
        );
    }

    console.log('Auditing product image storage (read-only) ...');
    log.info(`bucket prefix : ${PRODUCT_IMAGE_PREFIX}/`);
    log.info(`public origin : ${R2_BASE}`);

    // ── Bucket ───────────────────────────────────────────────────────────────
    log.step(`1/2  Listing ${PRODUCT_IMAGE_PREFIX}/ in object storage`);
    let objects;
    try {
        objects = await listObjects(PRODUCT_IMAGE_PREFIX);
    } catch (error) {
        throw new Error(describeStorageError(error));
    }
    const bucketBytes = objects.reduce((sum, o) => sum + (o.size || 0), 0);
    log.ok(`${objects.length} object(s), ${bytes(bucketBytes)}`);

    // ── Database ─────────────────────────────────────────────────────────────
    log.step('2/2  Reading productimages');
    const { rows } = await db.query(
        `SELECT imageid, productsid, isthumbnail, imageurl
           FROM productimages
          ORDER BY productsid, imageid`
    );
    log.ok(`${rows.length} row(s)`);

    // ── Compare ──────────────────────────────────────────────────────────────
    const bucketNames = new Set(objects.map((o) => path.basename(o.key)));
    const referenced = new Set();
    const stale = [];
    const broken = [];

    for (const row of rows) {
        if (classify(row.imageurl) !== 'r2') stale.push(row);

        const name = filenameOf(row.imageurl);
        if (!name) continue;
        referenced.add(name);
        if (!bucketNames.has(name)) broken.push({ ...row, name });
    }

    const orphans = objects
        .map((o) => ({ key: o.key, name: path.basename(o.key), size: o.size || 0 }))
        .filter((o) => !referenced.has(o.name))
        .sort((a, b) => a.name.localeCompare(b.name));
    const orphanBytes = orphans.reduce((sum, o) => sum + o.size, 0);

    // ── Report ───────────────────────────────────────────────────────────────
    console.log('\n' + '-'.repeat(60));
    console.log('STALE ROWS — imageurl not served from the R2 public origin');
    console.log('-'.repeat(60));
    if (stale.length === 0) {
        log.ok('none — every row points at the R2 origin.');
    } else {
        for (const row of stale) {
            log.warn(`[${classify(row.imageurl)}] imageid=${row.imageid} product=${row.productsid}`);
            log.info(`   ${row.imageurl}`);
        }
    }

    console.log('\n' + '-'.repeat(60));
    console.log('BROKEN REFERENCES — row points at a file missing from the bucket');
    console.log('-'.repeat(60));
    if (broken.length === 0) {
        log.ok('none — every referenced file exists.');
    } else {
        for (const row of broken) {
            log.warn(`imageid=${row.imageid} product=${row.productsid} → ${row.name}`);
            log.info(`   ${row.imageurl}`);
        }
    }

    console.log('\n' + '-'.repeat(60));
    console.log('ORPHANED OBJECTS — in the bucket, referenced by no row');
    console.log('-'.repeat(60));
    if (orphans.length === 0) {
        log.ok('none.');
    } else {
        for (const o of orphans) {
            log.warn(`${o.key}  (${bytes(o.size)})`);
            log.info(`   ${publicUrlFor(o.key)}`);
        }
    }

    const findings = stale.length + broken.length + orphans.length;
    console.log('\n' + '='.repeat(60));
    console.log(
        `Summary: ${rows.length} row(s), ${objects.length} object(s) | ` +
        `stale ${stale.length} | broken ${broken.length} | orphaned ${orphans.length} (${bytes(orphanBytes)})`
    );
    if (findings === 0) {
        console.log('✅ Storage and database agree — nothing to clean up.');
    } else {
        console.log(`⚠️  ${findings} finding(s) above. This audit is read-only: nothing was changed.`);
    }
    console.log('='.repeat(60));

    return findings;
}

main()
    .then(async (findings) => {
        await db.end().catch(() => {});
        process.exit(FAIL_ON_FINDINGS && findings > 0 ? 1 : 0);
    })
    .catch(async (error) => {
        console.error(`\n❌ Image audit failed: ${error.message}`);
        await db.end().catch(() => {});
        process.exit(1);
    });
