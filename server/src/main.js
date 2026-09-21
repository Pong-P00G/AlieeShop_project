import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import db from './database/dbpool.js';
import csrfProtection from './middleware/csrfMiddleware.js';
import { isStorageConfigured, verifyStorage } from './services/storageService.js';

import userRoutes from './routes/userRoutes.js'
import authRoutes from './routes/authRoutes.js'
import productRoutes from './routes/productRoutes.js'
import dashboardRoutes from './routes/dashboardRoutes.js'
import imageRoutes from './routes/imageRoutes.js'
import cartRoutes from './routes/cartRoutes.js'
import orderRoutes from './routes/orderRoutes.js'
import paymentRoutes from './routes/paymentRoutes.js'
import newsletterRoutes from './routes/newsletterRoutes.js'
import reviewRoutes from './routes/reviewRoutes.js'
import roleRoutes from './routes/roleRoutes.js'
import addressRoutes from './routes/addressRoutes.js'
import shippingRoutes from './routes/shippingRoutes.js'
import wishlistRoutes from './routes/wishlistRoutes.js'
import settingsRoutes from './routes/settingsRoutes.js'
import userNotificationRoutes from './routes/userNotificationRoutes.js'
import heroRoutes from './routes/heroRoutes.js'
import productCarouselRoutes from './routes/productCarouselRoutes.js'

const app = express();


// ── Security & Performance Middleware ─────────────────────────────────

app.use(helmet());
app.use(compression());

// In production the API is expected to sit behind a reverse proxy, so trust
// exactly one hop and let req.ip (and therefore rate limiting) see the real
// client address instead of the proxy's. Not enabled in development, where
// there is no proxy in front of the server.
if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
}

// Global rate-limit: 1000 requests per 15 min per IP, overridable with
// RATE_LIMIT_MAX. The SPA spends two hits per state-changing call (the CORS
// preflight plus the request itself), so the previous ceiling of 200 was being
// hit by ordinary browsing rather than by abuse.
const GLOBAL_RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX) || 1000;

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: GLOBAL_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests, please try again later.' },
});
app.use(limiter);
app.use(cors({
    origin: (origin, callback) => {
        // Only the configured frontend origin is trusted; the localhost dev
        // origins are dropped entirely in production.
        const allowedOrigins = [
            process.env.FRONTEND_URL,
            ...(process.env.NODE_ENV === 'production'
                ? []
                : [
                    'http://localhost:3001',
                    'http://localhost:5173',
                    'http://127.0.0.1:5173',
                ]),
        ].filter(Boolean);
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// CSRF protection — sets a csrf-token cookie on GET/HEAD/OPTIONS,
// validates x-csrf-token header on state-changing methods.
app.use(csrfProtection);

// Request logging middleware (optional)
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Routes
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/shipping', shippingRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/notifications', userNotificationRoutes);
app.use('/api/hero', heroRoutes);
app.use('/api/product-carousel', productCarouselRoutes);

// Product images are served from object storage (Cloudflare R2) through its
// public CDN URLs, so the API no longer mounts a local static directory.

// Root route
app.get('/', (req, res) => {
    res.json({
        message: 'Welcome to Aliee Shop API',
        version: '1.0.0',
        endpoints: {
            auth: '/api/auth',
            users: '/api/users',
            product: '/api/products',
            health: '/health'
        }
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        message: 'Server is running',
        timestamp: new Date().toISOString()
    });
});


app.get('/robots.txt', (req, res) => {
    res.type('text/plain');
    res.send([
        'User-agent: *',
        'Allow: /',
        'Disallow: /admin/',
        'Disallow: /api/',
        'Disallow: /login',
        'Disallow: /register',
        'Disallow: /forgotPassword',
        'Disallow: /userprofile',
        '',
        `Sitemap: ${process.env.FRONTEND_URL || 'http://localhost:3001'}/sitemap.xml`,
        '',
        '# AlieeShop',
    ].join('\n'));
});


app.get('/sitemap.xml', async (req, res) => {
    try {
        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3001';

        // Fetch active products for dynamic sitemap entries
        let products = [];
        try {
            const { rows } = await db.query(
                `SELECT productsid, productname, createdat FROM products WHERE status = 'active' ORDER BY productsid`
            );
            products = rows;
        } catch (err) {
            // DB might not be available; return static sitemap only
            console.warn('Could not fetch products for sitemap:', err.message);
        }

        const today = new Date().toISOString().split('T')[0];

        const staticPages = [
            { url: '/', priority: '1.0', changefreq: 'daily' },
            { url: '/product', priority: '0.9', changefreq: 'daily' },
            { url: '/about', priority: '0.5', changefreq: 'monthly' },
            { url: '/contact', priority: '0.5', changefreq: 'monthly' },
            { url: '/gift-cards', priority: '0.6', changefreq: 'weekly' },
            { url: '/track-order', priority: '0.4', changefreq: 'monthly' },
            { url: '/returns', priority: '0.5', changefreq: 'monthly' },
            { url: '/shipping', priority: '0.5', changefreq: 'monthly' },
            { url: '/faq', priority: '0.6', changefreq: 'weekly' },
            { url: '/careers', priority: '0.3', changefreq: 'monthly' },
            { url: '/press', priority: '0.4', changefreq: 'monthly' },
        ];

        const urls = [
            ...staticPages.map(p => `  <url>\n    <loc>${baseUrl}${p.url}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${p.changefreq}</changefreq>\n    <priority>${p.priority}</priority>\n  </url>`),
            ...products.map(p => {
                const date = p.createdat ? new Date(p.createdat).toISOString().split('T')[0] : today;
                return `  <url>\n    <loc>${baseUrl}/product/${p.productsid}</loc>\n    <lastmod>${date}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`;
            }),
        ];

        const sitemap = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
            urls.join('\n'),
            '</urlset>',
        ].join('\n');

        res.header('Content-Type', 'application/xml');
        res.send(sitemap);
    } catch (err) {
        console.error('Sitemap generation error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to generate sitemap' });
    }
});

// 404 handler - must be after all routes
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

// Global error handler - must be last
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal server error'
    });
});

// Check object storage at boot so a bad R2 configuration is visible in the logs
// instead of surfacing later as a failed image upload. Non-fatal on purpose: the
// API keeps serving everything that does not need images.
async function reportObjectStorageStatus() {
    if (!isStorageConfigured()) {
        console.warn('⚠️  Object storage is not configured — image uploads are disabled and GET /api/images returns 503. See server/.env.example.');
        return;
    }

    try {
        await verifyStorage();
        console.log('✅ Object storage reachable (Cloudflare R2)');
    } catch (error) {
        console.error(`⚠️  Object storage check failed: ${error.message}`);
    }
}

const PORT = process.env.PORT || 5001;

// Prevent listen from running when imported for testing
const isTestEnv = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';

if (!isTestEnv) {
    reportObjectStorageStatus();

    app.listen(PORT, () => {
        console.log('='.repeat(50));
        console.log(`🚀 Server is running on port ${PORT}`);
        console.log(`📡 API URL: http://localhost:${PORT}`);
        console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3001'}`);
        console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log('='.repeat(50));
    });
}

export default app;