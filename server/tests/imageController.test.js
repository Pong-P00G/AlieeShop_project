import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/services/storageService.js', () => ({
    PRODUCT_IMAGE_PREFIX: 'products',
    isStorageConfigured: vi.fn(),
    uploadObject: vi.fn(),
    deleteObject: vi.fn(),
    listObjects: vi.fn(),
    publicUrlFor: vi.fn((key) => `https://cdn.test/${key}`),
    describeStorageError: vi.fn((error) => error?.message || String(error)),
    IMAGE_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.svg'],
}));

import * as storage from '../src/services/storageService.js';
import { deleteImage, getAllImages } from '../src/controller/imageController.js';

const mockRes = () => {
    const res = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return res;
};

describe('imageController (object storage)', () => {
    beforeEach(() => vi.clearAllMocks());

    describe('deleteImage', () => {
        it('deletes products/<filename> from the bucket', async () => {
            storage.deleteObject.mockResolvedValue();
            const res = mockRes();

            await deleteImage({ params: { filename: 'images-1-2.jpg' } }, res);

            expect(storage.deleteObject).toHaveBeenCalledWith('products/images-1-2.jpg');
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                message: 'Image deleted successfully',
            });
        });

        it('strips any path segments from the filename', async () => {
            storage.deleteObject.mockResolvedValue();
            const res = mockRes();

            await deleteImage({ params: { filename: '../secrets/key.pem' } }, res);

            expect(storage.deleteObject).toHaveBeenCalledWith('products/key.pem');
        });

        it('answers 500 when the object store fails', async () => {
            storage.deleteObject.mockRejectedValue(new Error('storage down'));
            const res = mockRes();

            await deleteImage({ params: { filename: 'x.jpg' } }, res);

            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    describe('getAllImages', () => {
        it('answers 503 when object storage is not configured', async () => {
            storage.isStorageConfigured.mockReturnValue(false);
            const res = mockRes();

            await getAllImages({}, res);

            expect(res.status).toHaveBeenCalledWith(503);
            expect(storage.listObjects).not.toHaveBeenCalled();
        });

        it('maps stored objects to public CDN URLs', async () => {
            storage.isStorageConfigured.mockReturnValue(true);
            storage.listObjects.mockResolvedValue([
                { key: 'products/a.png', size: 10 },
                { key: 'products/notes.txt', size: 1 },
            ]);
            const res = mockRes();

            await getAllImages({}, res);

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                count: 1,
                data: [{
                    filename: 'a.png',
                    url: 'https://cdn.test/products/a.png',
                    path: 'https://cdn.test/products/a.png',
                }],
            });
        });
    });
});
