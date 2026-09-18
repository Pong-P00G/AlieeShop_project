import {
    S3Client,
    PutObjectCommand,
    DeleteObjectCommand,
    ListObjectsV2Command,
    HeadObjectCommand,
    CopyObjectCommand,
} from '@aws-sdk/client-s3';

// Product images live in an S3-compatible bucket (Cloudflare R2) and are
// delivered through its CDN. Keeping uploads off the API's disk means the
// process holds no file state, so it can be scaled or replaced freely — the
// thing the old express.static('/cdn') mount could not do.
const REQUIRED_ENV_VARS = [
    'R2_ENDPOINT',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET_NAME',
    'R2_PUBLIC_BASE_URL',
];

export const PRODUCT_IMAGE_PREFIX = 'products';

// Extensions accepted as product images, mapped to their content type. Shared
// by the upload controller and the migration script so the two cannot drift.
export const IMAGE_CONTENT_TYPES = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.avif': 'image/avif',
    '.svg': 'image/svg+xml',
};

export const IMAGE_EXTENSIONS = Object.keys(IMAGE_CONTENT_TYPES);

// Object names are unique (timestamp + random), so an object's bytes never
// change — the CDN can cache it for a year as immutable. Override with
// R2_CACHE_CONTROL if a shorter TTL is ever needed.
export const DEFAULT_CACHE_CONTROL = 'public, max-age=31536000, immutable';

export const cacheControl = () => process.env.R2_CACHE_CONTROL || DEFAULT_CACHE_CONTROL;

export const isStorageConfigured = () =>
    REQUIRED_ENV_VARS.every((name) => Boolean(process.env[name]));

let client = null;

function getClient() {
    if (!isStorageConfigured()) {
        throw new Error(
            'Object storage is not configured. Set R2_ENDPOINT, R2_ACCESS_KEY_ID, ' +
            'R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME and R2_PUBLIC_BASE_URL ' +
            '(see server/.env.example).'
        );
    }
    if (!client) {
        client = new S3Client({
            region: 'auto',
            endpoint: process.env.R2_ENDPOINT,
            credentials: {
                accessKeyId: process.env.R2_ACCESS_KEY_ID,
                secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
            },
        });
    }
    return client;
}

/**
 * Public CDN URL for an object key. R2_PUBLIC_BASE_URL is the bucket's public
 * origin — an r2.dev subdomain or a custom domain on Cloudflare.
 */
export const publicUrlFor = (key) =>
    `${(process.env.R2_PUBLIC_BASE_URL || '').replace(/\/+$/, '')}/${key}`;

/** Upload a buffer under `key` and return its public URL. */
export const uploadObject = async ({ key, body, contentType }) => {
    await getClient().send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
        Body: body,
        ContentType: contentType,
        // Stored as object metadata and honoured by Cloudflare's CDN when the
        // bucket is served through a custom domain.
        CacheControl: cacheControl(),
    }));
    return publicUrlFor(key);
};

/** Delete an object. S3 deletes are idempotent: a missing key is not an error. */
export const deleteObject = async (key) => {
    await getClient().send(new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
    }));
};

/** List every object under `prefix`. */
export const listObjects = async (prefix) => {
    const { Contents = [] } = await getClient().send(new ListObjectsV2Command({
        Bucket: process.env.R2_BUCKET_NAME,
        Prefix: `${prefix.replace(/\/+$/, '')}/`,
    }));
    return Contents.map(({ Key, Size }) => ({ key: Key, size: Size }));
};

/**
 * Turn an SDK/network error into a message that names the likely cause and the
 * variable to fix. S3 error names are more useful than the raw message here.
 */
export const describeStorageError = (error) => {
    const name = error?.name || 'Error';
    const message = error?.message || String(error);

    switch (name) {
        case 'SignatureDoesNotMatch':
            return 'R2 rejected the request signature. Check R2_ACCESS_KEY_ID and ' +
                'R2_SECRET_ACCESS_KEY — the Secret Access Key is the one shown next to ' +
                'the Access Key ID in R2 → Manage API Tokens, not the API token value itself ' +
                '(it is the SHA-256 hash of that token).';
        case 'InvalidAccessKeyId':
            return 'R2 does not recognise R2_ACCESS_KEY_ID. Recreate the R2 API token and ' +
                'copy the Access Key ID it shows.';
        case 'AccessDenied':
            return 'R2 denied access. Give the token Object Read & Write and confirm it is ' +
                'scoped to R2_BUCKET_NAME.';
        case 'NoSuchBucket':
            return `R2 bucket "${process.env.R2_BUCKET_NAME}" was not found. Check R2_BUCKET_NAME.`;
        case 'PermanentRedirect':
            return 'R2_ENDPOINT points at the wrong region. It should be ' +
                'https://<account-id>.r2.cloudflarestorage.com (a jurisdiction endpoint ' +
                'only for jurisdiction buckets).';
        case 'ENOTFOUND':
        case 'EAI_AGAIN':
            return 'Could not resolve R2_ENDPOINT (DNS lookup failed). Check the endpoint ' +
                'and your network connection.';
        default:
            break;
    }

    if (name === 'TypeError' && /invalid url/i.test(message)) {
        return 'R2_ENDPOINT is not a valid URL. It should look like ' +
            'https://<account-id>.r2.cloudflarestorage.com.';
    }

    return `Object storage request failed (${name}): ${message}`;
};

/**
 * Lightweight credential/connectivity check: one LIST with MaxKeys=1. Resolves
 * when the bucket answers, otherwise throws with a message from
 * describeStorageError so callers can log something actionable.
 */
export const verifyStorage = async () => {
    if (!isStorageConfigured()) {
        throw new Error(
            'Object storage is not configured. Set R2_ENDPOINT, R2_ACCESS_KEY_ID, ' +
            'R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME and R2_PUBLIC_BASE_URL (see server/.env.example).'
        );
    }

    try {
        await getClient().send(new ListObjectsV2Command({
            Bucket: process.env.R2_BUCKET_NAME,
            Prefix: `${PRODUCT_IMAGE_PREFIX}/`,
            MaxKeys: 1,
        }));
    } catch (error) {
        throw new Error(describeStorageError(error), { cause: error });
    }
};

/** Read an object's current Cache-Control metadata (undefined when unset). */
export const getObjectCacheControl = async (key) => {
    const { CacheControl } = await getClient().send(new HeadObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
    }));
    return CacheControl;
};

/**
 * Replace an object's Cache-Control metadata using a self-copy, so the bytes
 * are not re-uploaded. Used to backfill objects stored before caching existed.
 */
export const setObjectCacheControl = async (key, value = cacheControl()) => {
    // CopySource is `bucket/key` with the key URL-encoded (slashes kept).
    const encodedKey = key.split('/').map(encodeURIComponent).join('/');

    await getClient().send(new CopyObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
        CopySource: `${process.env.R2_BUCKET_NAME}/${encodedKey}`,
        MetadataDirective: 'REPLACE',
        CacheControl: value,
    }));
    return value;
};
