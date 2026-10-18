#!/usr/bin/env node
/**
 * One-off migration: move the images that used to be served by the local
 * `express.static('/cdn')` mount into the object store and point the database
 * at their new CDN URLs.
 *
 * What it does:
 *   1. Uploads every file in cdn/images/products/ to `<bucket>/products/<file>`.
 *   2. Rewrites productimages.imageurl entries that still reference a local
 *      path (`/images/products/...`, `/cdn/images/products/...`) or an absolute
 *      `http(s)://<host>/cdn/images/products/...` URL to the public CDN URL.
 *
 * Safe to re-run: uploads overwrite the same keys and the UPDATE only touches
 * rows that still contain a local `/images/products/` segment.
 *
 * Usage:
 *   npm run images:migrate
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../src/database/dbpool.js';
import {
    PRODUCT_IMAGE_PREFIX,
    isStorageConfigured,
    uploadObject,
    listObjects,
    publicUrlFor,
    describeStorageError,
    IMAGE_CONTENT_TYPES,
} from '../src/services/storageService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_IMAGE_DIR = path.join(__dirname, '..', '..', 'cdn', 'images', PRODUCT_IMAGE_PREFIX);

// A path segment shared by every stored value that points at a local file.
const LOCAL_PATH_SEGMENT = `/images/${PRODUCT_IMAGE_PREFIX}/`;

const log = {
    step: (msg) => console.log(`\n${msg}`),
    ok: (msg) => console.log(`   ✅ ${msg}`),
    skip: (msg) => console.log(`   ⏭️  ${msg}`),
    info: (msg) => console.log(`   ${msg}`),
    warn: (msg) => console.log(`   ⚠️  ${msg}`),
};

async function uploadLocalFiles() {
    if (!fs.existsSync(LOCAL_IMAGE_DIR)) {
        log.skip(`No ${path.relative(process.cwd(), LOCAL_IMAGE_DIR)} directory — nothing to upload.`);
        return 0;
    }

    const files = fs.readdirSync(LOCAL_IMAGE_DIR).filter((file) => {
        const ext = path.extname(file).toLowerCase();
        return IMAGE_CONTENT_TYPES[ext];
    });

    if (files.length === 0) {
        log.skip('No image files found to upload.');
        return 0;
    }

    try {
        for (const file of files) {
            const key = `${PRODUCT_IMAGE_PREFIX}/${file}`;
            await uploadObject({
                key,
                body: fs.readFileSync(path.join(LOCAL_IMAGE_DIR, file)),
                contentType: IMAGE_CONTENT_TYPES[path.extname(file).toLowerCase()],
            });
        }
    } catch (error) {
        throw new Error(describeStorageError(error));
    }

    log.ok(`Uploaded ${files.length} file(s) to ${PRODUCT_IMAGE_PREFIX}/.`);
    return files.length;
}

async function rewriteStoredUrls() {
    const { rows } = await db.query(
        `SELECT imageid, imageurl FROM productimages WHERE imageurl LIKE $1`,
        [`%${LOCAL_PATH_SEGMENT}%`]
    );

    if (rows.length === 0) {
        log.skip('No stored image URLs need rewriting.');
        return { rewritten: 0, missing: [] };
    }

    // Only point a row at the bucket when the object is really there. Seeded
    // rows can reference filenames that were never committed to
    // cdn/images/products/, and rewriting those would replace a visible local
    // path with a CDN URL that 404s forever.
    const stored = new Set(
        (await listObjects(PRODUCT_IMAGE_PREFIX)).map(({ key }) => path.basename(key))
    );

    let rewritten = 0;
    const missing = [];

    for (const row of rows) {
        const filename = row.imageurl.split(LOCAL_PATH_SEGMENT).pop();
        if (!filename) continue;

        if (!stored.has(filename)) {
            missing.push({ imageid: row.imageid, filename, imageurl: row.imageurl });
            continue;
        }

        const url = publicUrlFor(`${PRODUCT_IMAGE_PREFIX}/${filename}`);
        await db.query('UPDATE productimages SET imageurl = $1 WHERE imageid = $2', [url, row.imageid]);
        rewritten++;
    }

    log.ok(`Rewrote ${rewritten} stored image URL(s).`);
    return { rewritten, missing };
}

function reportMissing(missing) {
    if (missing.length === 0) return;

    console.log('\n' + '!'.repeat(52));
    log.warn(`${missing.length} row(s) left unchanged — their file is not in the bucket:`);
    for (const row of missing) {
        log.info(`imageid=${row.imageid}  ${row.imageurl}`);
    }
    log.info('Add the missing files to cdn/images/products/ and re-run, or point');
    log.info('the rows at an existing image (npm run images:audit lists them).');
    console.log('!'.repeat(52));
}

async function main() {
    if (!isStorageConfigured()) {
        throw new Error(
            'Object storage is not configured. Set R2_ENDPOINT, R2_ACCESS_KEY_ID, ' +
            'R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME and R2_PUBLIC_BASE_URL in server/.env.'
        );
    }

    console.log('Migrating product images to object storage ...');

    log.step('1/2  Upload local files');
    await uploadLocalFiles();

    log.step('2/2  Rewrite stored URLs');
    const { missing } = await rewriteStoredUrls();
    reportMissing(missing);

    console.log('\n' + '='.repeat(52));
    console.log(
        missing.length === 0
            ? '✅ Image migration complete.'
            : `⚠️  Image migration finished with ${missing.length} unresolved row(s).`
    );
    console.log('='.repeat(52));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(`\n❌ Image migration failed: ${error.message}`);
        process.exit(1);
    });
