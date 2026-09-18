import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const s3 = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock('@aws-sdk/client-s3', () => ({
    S3Client: vi.fn(function () { return { send: s3.send }; }),
    PutObjectCommand: vi.fn(),
    DeleteObjectCommand: vi.fn(),
    ListObjectsV2Command: vi.fn(),
    HeadObjectCommand: vi.fn(),
    CopyObjectCommand: vi.fn(),
}));

import { PutObjectCommand, CopyObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import {
    uploadObject,
    publicUrlFor,
    isStorageConfigured,
    getObjectCacheControl,
    setObjectCacheControl,
    describeStorageError,
    verifyStorage,
} from '../src/services/storageService.js';

const ENV_KEYS = [
    'R2_ENDPOINT',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET_NAME',
    'R2_PUBLIC_BASE_URL',
    'R2_CACHE_CONTROL',
];

describe('storageService', () => {
    const original = {};

    beforeEach(() => {
        vi.clearAllMocks();
        for (const key of ENV_KEYS) original[key] = process.env[key];

        process.env.R2_ENDPOINT = 'https://account.r2.cloudflarestorage.com';
        process.env.R2_ACCESS_KEY_ID = 'key';
        process.env.R2_SECRET_ACCESS_KEY = 'secret';
        process.env.R2_BUCKET_NAME = 'aliee-shop-images';
        process.env.R2_PUBLIC_BASE_URL = 'https://cdn.example.com/';
        delete process.env.R2_CACHE_CONTROL;
    });

    afterEach(() => {
        for (const key of ENV_KEYS) {
            if (original[key] === undefined) delete process.env[key];
            else process.env[key] = original[key];
        }
    });

    it('reports configured only when every R2 variable is present', () => {
        expect(isStorageConfigured()).toBe(true);
        delete process.env.R2_BUCKET_NAME;
        expect(isStorageConfigured()).toBe(false);
    });

    it('builds public URLs from the base origin, trimming trailing slashes', () => {
        expect(publicUrlFor('products/a.png')).toBe('https://cdn.example.com/products/a.png');
    });

    it('uploads object bytes with a one-year immutable cache header', async () => {
        s3.send.mockResolvedValue({});

        const url = await uploadObject({
            key: 'products/a.png',
            body: Buffer.from('bytes'),
            contentType: 'image/png',
        });

        expect(PutObjectCommand).toHaveBeenCalledWith(expect.objectContaining({
            Bucket: 'aliee-shop-images',
            Key: 'products/a.png',
            ContentType: 'image/png',
            CacheControl: 'public, max-age=31536000, immutable',
        }));

        expect(url).toBe('https://cdn.example.com/products/a.png');
    });

    it('lets R2_CACHE_CONTROL override the default TTL', async () => {
        process.env.R2_CACHE_CONTROL = 'public, max-age=60';
        s3.send.mockResolvedValue({});

        await uploadObject({ key: 'products/a.png', body: Buffer.from('bytes'), contentType: 'image/png' });

        expect(PutObjectCommand).toHaveBeenCalledWith(
            expect.objectContaining({ CacheControl: 'public, max-age=60' })
        );
    });

    it('reads the cache-control already stored on an object', async () => {
        s3.send.mockResolvedValue({ CacheControl: 'public, max-age=60' });

        await expect(getObjectCacheControl('products/a.png')).resolves.toBe('public, max-age=60');
        expect(HeadObjectCommand).toHaveBeenCalledWith({
            Bucket: 'aliee-shop-images',
            Key: 'products/a.png',
        });
    });

    it('backfills cache-control with a metadata-only self-copy', async () => {
        s3.send.mockResolvedValue({});

        const value = await setObjectCacheControl('products/a.png');

        expect(CopyObjectCommand).toHaveBeenCalledWith(expect.objectContaining({
            Bucket: 'aliee-shop-images',
            Key: 'products/a.png',
            CopySource: 'aliee-shop-images/products/a.png',
            MetadataDirective: 'REPLACE',
            CacheControl: 'public, max-age=31536000, immutable',
        }));
        expect(value).toBe('public, max-age=31536000, immutable');
    });

    describe('describeStorageError', () => {
        it('names the credential variables on a signature mismatch', () => {
            const error = Object.assign(new Error('signature mismatch'), { name: 'SignatureDoesNotMatch' });
            expect(describeStorageError(error)).toMatch(/R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY/);
        });

        it('explains an unknown access key', () => {
            const error = Object.assign(new Error('unknown key'), { name: 'InvalidAccessKeyId' });
            expect(describeStorageError(error)).toMatch(/R2_ACCESS_KEY_ID/);
        });

        it('flags a malformed endpoint', () => {
            expect(describeStorageError(new TypeError('Invalid URL'))).toMatch(/R2_ENDPOINT/);
        });

        it('falls back to the raw error for anything else', () => {
            expect(describeStorageError(new Error('boom'))).toMatch(/boom/);
        });
    });

    describe('verifyStorage', () => {
        it('resolves when the bucket answers', async () => {
            s3.send.mockResolvedValue({});
            await expect(verifyStorage()).resolves.toBeUndefined();
        });

        it('throws an actionable message when credentials are rejected', async () => {
            s3.send.mockRejectedValue(
                Object.assign(new Error('signature mismatch'), { name: 'SignatureDoesNotMatch' })
            );
            await expect(verifyStorage()).rejects.toThrow(/R2_SECRET_ACCESS_KEY/);
        });
    });
});
