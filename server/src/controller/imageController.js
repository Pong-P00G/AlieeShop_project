import multer from 'multer';
import path from 'path';
import {
    PRODUCT_IMAGE_PREFIX,
    isStorageConfigured,
    uploadObject,
    deleteObject,
    listObjects,
    publicUrlFor,
    describeStorageError,
    IMAGE_EXTENSIONS,
} from '../services/storageService.js';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// Uploads are buffered in memory and sent straight to object storage, so the
// API never writes files to its own disk.
const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter: function (req, file, cb) {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    },
    limits: {
        fileSize: MAX_FILE_SIZE,
    },
});

/** Unique object name — same scheme the disk-backed uploader used. */
const buildFilename = (file) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    return `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`;
};

const buildKey = (filename) => `${PRODUCT_IMAGE_PREFIX}/${filename}`;

const toImagePayload = (file, filename) => {
    const url = publicUrlFor(buildKey(filename));
    return {
        filename,
        originalName: file.originalname,
        size: file.size,
        imagePath: url,
        url,
    };
};

/**
 * Upload single image
 * POST /api/images/upload
 */
export const uploadImage = (req, res) => {
    upload.single('image')(req, res, async (err) => {
        if (err) {
            return res.status(400).json({
                success: false,
                message: err.message
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        try {
            const filename = buildFilename(req.file);
            await uploadObject({
                key: buildKey(filename),
                body: req.file.buffer,
                contentType: req.file.mimetype,
            });

            res.json({
                success: true,
                message: 'Image uploaded successfully',
                data: toImagePayload(req.file, filename)
            });
        } catch (error) {
            console.error('Image upload error:', describeStorageError(error));
            res.status(500).json({
                success: false,
                message: 'Image upload failed'
            });
        }
    });
};

/**
 * Upload multiple images
 * POST /api/images/upload-multiple
 */
export const uploadMultipleImages = (req, res) => {
    upload.array('images', 10)(req, res, async (err) => {
        if (err) {
            return res.status(400).json({
                success: false,
                message: err.message
            });
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No files uploaded'
            });
        }

        try {
            const uploaded = await Promise.all(
                req.files.map(async (file) => {
                    const filename = buildFilename(file);
                    await uploadObject({
                        key: buildKey(filename),
                        body: file.buffer,
                        contentType: file.mimetype,
                    });
                    return toImagePayload(file, filename);
                })
            );

            res.json({
                success: true,
                message: `${uploaded.length} images uploaded successfully`,
                data: uploaded
            });
        } catch (error) {
            console.error('Image upload error:', describeStorageError(error));
            res.status(500).json({
                success: false,
                message: 'Image upload failed'
            });
        }
    });
};

/**
 * Delete image
 * DELETE /api/images/:filename
 */
export const deleteImage = async (req, res) => {
    try {
        // basename guards against a crafted filename escaping the products/ prefix.
        const filename = path.basename(req.params.filename);
        await deleteObject(buildKey(filename));

        res.json({
            success: true,
            message: 'Image deleted successfully'
        });
    } catch (error) {
        console.error('Image delete error:', describeStorageError(error));
        res.status(500).json({
            success: false,
            message: 'Error deleting image'
        });
    }
};

/**
 * Get all images
 * GET /api/images
 */
export const getAllImages = async (req, res) => {
    if (!isStorageConfigured()) {
        return res.status(503).json({
            success: false,
            message: 'Image storage is not configured.'
        });
    }

    try {
        const objects = await listObjects(PRODUCT_IMAGE_PREFIX);
        const images = objects
            .filter(({ key }) => IMAGE_EXTENSIONS.includes(path.extname(key).toLowerCase()))
            .map(({ key }) => {
                const url = publicUrlFor(key);
                return {
                    filename: path.basename(key),
                    url,
                    path: url
                };
            });

        res.json({
            success: true,
            count: images.length,
            data: images
        });
    } catch (error) {
        console.error('Error fetching images:', describeStorageError(error));
        res.status(500).json({
            success: false,
            message: 'Error fetching images'
        });
    }
};
