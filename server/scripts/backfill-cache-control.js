#!/usr/bin/env node
/**
 * Backfill Cache-Control on existing objects.
 *
 * Objects uploaded before caching was added carry no Cache-Control, so the CDN
 * has to revalidate them. This walks every object under the products/ prefix,
 * compares its stored Cache-Control with the configured value
 * (R2_CACHE_CONTROL, default one year immutable) and rewrites the metadata of
 * the mismatches with a self-copy — the bytes are not re-uploaded.
 *
 * Safe to re-run: objects that already carry the target value are skipped.
 *
 * Usage:
 *   npm run images:cache
 */
import {
    PRODUCT_IMAGE_PREFIX,
    isStorageConfigured,
    listObjects,
    getObjectCacheControl,
    setObjectCacheControl,
    cacheControl,
    describeStorageError,
} from '../src/services/storageService.js';

const log = {
    step: (msg) => console.log(`\n${msg}`),
    ok: (msg) => console.log(`   ✅ ${msg}`),
    skip: (msg) => console.log(`   ⏭️  ${msg}`),
    info: (msg) => console.log(`   ${msg}`),
};

async function main() {
    if (!isStorageConfigured()) {
        throw new Error(
            'Object storage is not configured. Set R2_ENDPOINT, R2_ACCESS_KEY_ID, ' +
            'R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME and R2_PUBLIC_BASE_URL in server/.env.'
        );
    }

    const desired = cacheControl();
    console.log(`Backfilling Cache-Control: ${desired}`);

    log.step(`Listing ${PRODUCT_IMAGE_PREFIX}/`);
    const objects = await listObjects(PRODUCT_IMAGE_PREFIX);

    if (objects.length === 0) {
        log.skip('No objects found — nothing to backfill.');
        return;
    }

    let updated = 0;
    let current = 0;
    let failed = 0;

    for (const { key } of objects) {
        try {
            if ((await getObjectCacheControl(key)) === desired) {
                current += 1;
                continue;
            }
            await setObjectCacheControl(key, desired);
            updated += 1;
            log.info(`updated ${key}`);
        } catch (error) {
            failed += 1;
            console.error(`   ❌ ${key}: ${describeStorageError(error)}`);
        }
    }

    console.log('\n' + '='.repeat(52));
    log.ok(`${updated} updated, ${current} already current, ${failed} failed.`);
    console.log('='.repeat(52));

    if (failed > 0) {
        throw new Error(`${failed} object(s) could not be updated.`);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(`\n❌ Cache-Control backfill failed: ${error.message}`);
        process.exit(1);
    });
