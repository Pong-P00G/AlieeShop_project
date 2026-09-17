import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { headInstance } from "../head.js";
import DashboardLayout from "../Layout/DashboardLayout.vue";
import HomeLayout from "../Layout/HomeLayout.vue";

const DEFAULT_OG_IMAGE = 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=1200&h=630&fit=crop&crop=center';

const PAGE_META = {
    home: {
        title: 'Welcome',
        description: 'Discover a wide range of products at unbeatable prices. Shop now and enjoy fast shipping and excellent customer service at AlieeShop!',
        keywords: 'online store, ecommerce, shop online, AlieeShop',
    },
    about: {
        title: 'About Us',
        description: 'Learn about AlieeShop - our story, mission, and commitment to providing the best online shopping experience.',
    },
    contact: {
        title: 'Contact Us',
        description: 'Get in touch with AlieeShop. We are here to help with any questions about your orders, products, or services.',
    },
    checkout: {
        title: 'Checkout',
        description: 'Complete your purchase securely at AlieeShop.',
    },
    payment: {
        title: 'Payment',
        description: 'Secure payment processing for your AlieeShop order.',
    },
    orderSucces: {
        title: 'Order Confirmed',
        description: 'Your order has been placed successfully. Thank you for shopping at AlieeShop!',
    },
    Product: {
        title: 'Shop All Products',
        description: 'Browse our complete collection of products at AlieeShop. Find everything you need in one place.',
    },
    ProductDetail: {
        title: 'Product Details',
        description: 'View product details, pricing, and availability at AlieeShop.',
    },
    userprofile: {
        title: 'My Profile',
        description: 'Manage your AlieeShop account profile and settings.',
    },
    userNotifications: {
        title: 'Notifications',
        description: 'View and manage your personal notifications.',
    },
    wishlist: {
        title: 'My Wishlist',
        description: 'View and manage your saved items at AlieeShop.',
    },
    giftCards: {
        title: 'Gift Cards',
        description: 'Give the gift of choice with AlieeShop gift cards. Perfect for any occasion.',
    },
    trackOrder: {
        title: 'Track Order',
        description: 'Track your AlieeShop order in real time. Enter your order number to get the latest status.',
    },
    returns: {
        title: 'Returns & Exchanges',
        description: 'Learn about AlieeShop return policy and how to initiate a return or exchange.',
    },
    shipping: {
        title: 'Shipping Information',
        description: 'Learn about AlieeShop shipping options, delivery times, and shipping rates.',
    },
    faq: {
        title: 'Frequently Asked Questions',
        description: 'Find answers to common questions about shopping at AlieeShop.',
    },
    careers: {
        title: 'Careers',
        description: 'Join the AlieeShop team. Explore current job openings and career opportunities.',
    },
    press: {
        title: 'Press',
        description: 'AlieeShop press releases, media resources, and brand information.',
    },
    blog: {
        title: 'Our Journal',
        description: 'Read the latest stories, style guides, and company news from AlieeShop.',
        keywords: 'blog, journal, style, fashion, AlieeShop',
    },
    blogPost: {
        title: 'Article',
        description: 'Read our latest journal entry at AlieeShop.',
    },
    privacy: {
        title: 'Privacy Policy',
        description: 'Learn how AlieeShop collects, uses, and protects your personal information.',
    },
    terms: {
        title: 'Terms of Service',
        description: 'Read the terms and conditions for using AlieeShop.',
    },
    compare: {
        title: 'Product Comparison',
        description: 'Compare products side by side to find the perfect fit at AlieeShop.',
    },
    sitemap: {
        title: 'Sitemap',
        description: 'Complete site index for AlieeShop. Find any page quickly.',
    },
    login: {
        title: 'Sign In',
        description: 'Sign in to your AlieeShop account to access your orders, wishlist, and more.',
    },
    register: {
        title: 'Create Account',
        description: 'Create your AlieeShop account for a personalized shopping experience.',
    },
    forgotPassword: {
        title: 'Reset Password',
        description: 'Reset your AlieeShop account password.',
    },
    notFound: {
        title: 'Page Not Found',
        description: 'The page you are looking for does not exist. Return to AlieeShop homepage.',
    },
    config: {
        title: 'Store Config',
        description: 'Manage your store configuration, payment options, and service fees.',
    },
    settings: {
        title: 'Settings',
        description: 'Manage your account, notification preferences, security, and push alerts.',
    },
    managePaymentMethods: {
        title: 'Payment Methods',
        description: 'Manage payment methods, fees, and availability.',
    },
    manageCategories: {
        title: 'Categories',
        description: 'Organise products by creating and managing categories.',
    },
};

const routes = [
    {
        path: '/',
        component: HomeLayout,
        children: [
            {
                name: 'home',
                path: '/',
                meta: { page: 'home' },
                component: () => import("../views/Home.vue"),
            },
            {
                name: 'about',
                path: '/about',
                meta: { page: 'about' },
                component: () => import("../views/About.vue")
            },
            {
                name: 'contact',
                path: '/contact',
                meta: { page: 'contact' },
                component: () => import("../views/Contact.vue")
            },
            {
                name: 'checkout',
                path: '/checkout',
                meta: { page: 'checkout' },
                component: () => import("../views/checkout/Checkout.vue")
            },
            {
                name: 'payment',
                path: '/payment',
                meta: { page: 'payment' },
                component: () => import("../views/Payment.vue")
            },
            {
                name: 'orderSucces',
                path: '/orderSucces',
                meta: { page: 'orderSucces' },
                component: () => import("../views/OrderSucces.vue")
            },
            {
                name: 'Product',
                path: '/product',
                meta: { page: 'Product' },
                component: () => import("../views/products/Product.vue"),
            },
            {
                name: 'ProductDetail',
                path: '/product/:id',
                meta: { page: 'ProductDetail' },
                component: () => import("../views/products/ProductDetail.vue"),
            },
            {
                name: 'userprofile',
                path: '/userprofile',
                component: () => import("../views/UserProfile.vue"),
                meta: { requiresAuth: true, page: 'userprofile' },
            },
            {
                name: 'wishlist',
                path: '/wishlist',
                meta: { page: 'wishlist' },
                component: () => import("../views/Wishlist.vue"),
                
            },
            {
                name: 'giftCards',
                path: '/gift-cards',
                meta: { page: 'giftCards' },
                component: () => import("../views/pages/GiftCards.vue"),
            },
            {
                name: 'trackOrder',
                path: '/track-order',
                meta: { page: 'trackOrder' },
                component: () => import("../views/pages/TrackOrder.vue"),
            },
            {
                name: 'returns',
                path: '/returns',
                meta: { page: 'returns' },
                component: () => import("../views/pages/Returns.vue"),
            },
            {
                name: 'shipping',
                path: '/shipping',
                meta: { page: 'shipping' },
                component: () => import("../views/pages/Shipping.vue"),
            },
            {
                name: 'faq',
                path: '/faq',
                meta: { page: 'faq' },
                component: () => import("../views/pages/FAQ.vue"),
            },
            {
                name: 'careers',
                path: '/careers',
                meta: { page: 'careers' },
                component: () => import("../views/pages/Careers.vue"),
            },
            {
                name: 'press',
                path: '/press',
                meta: { page: 'press' },
                component: () => import("../views/pages/Press.vue"),
            },
            {
                name: 'blog',
                path: '/blog',
                meta: { page: 'blog' },
                component: () => import("../views/pages/Blog.vue"),
            },
            {
                name: 'blogPost',
                path: '/blog/:id',
                meta: { page: 'blogPost' },
                component: () => import("../views/pages/BlogPost.vue"),
            },
            {
                name: 'privacy',
                path: '/privacy',
                meta: { page: 'privacy' },
                component: () => import("../views/pages/PrivacyPolicy.vue"),
            },
            {
                name: 'terms',
                path: '/terms',
                meta: { page: 'terms' },
                component: () => import("../views/pages/TermsOfService.vue"),
            },
            {
                name: 'compare',
                path: '/compare',
                meta: { page: 'compare' },
                component: () => import("../views/pages/CompareProducts.vue"),
            },
            {
                name: 'sitemap',
                path: '/sitemap',
                meta: { page: 'sitemap' },
                component: () => import("../views/pages/Sitemap.vue"),
            },
            {
                name: 'userNotifications',
                path: '/notifications',
                meta: { page: 'userNotifications', requiresAuth: true },
                component: () => import('../views/UserNotifications.vue'),
            },
        ]
    },
    {
        path: '/admin/dashboard',
        component: DashboardLayout,
        meta: { requiresAuth: true, requiresAdmin: true, page: 'DashboardHome' },
        children: [
            {
                name: 'DashboardHome',
                path: '',
                component: () => import('../views/dashboard/Dashboard.vue'),
            },
            {
                path: '/admin/add-product',
                name: 'addproduct',
                meta: { page: 'addproduct' },
                component: () => import('../views/dashboard/AddProduct.vue')
            },
            {
                path: '/admin/manage-products',
                name: 'manageproducts',
                meta: { page: 'manageproducts' },
                component: () => import('../views/dashboard/ManageProducts.vue')
            },
            {
                path: '/admin/manage-stock',
                name: 'managestock',
                meta: { page: 'managestock' },
                component: () => import('../views/dashboard/ManageStocks.vue')
            },
            {
                path: '/admin/manage-user',
                name: 'manageuser',
                meta: { page: 'manageuser' },
                component: () => import('../views/dashboard/ManageUser.vue')
            },
            {
                path: '/admin/analytics',
                name: 'analytics',
                meta: { page: 'analytics' },
                component: () => import('../views/dashboard/Analytic.vue')
            },
            {
                path: '/admin/orders',
                name: 'orders',
                meta: { page: 'orders' },
                component: () => import('../views/dashboard/Orders.vue')
            },

            {
                path: '/admin/notifications',
                name: 'notifications',
                meta: { page: 'notifications' },
                component: () => import('../views/dashboard/NotificationsPage.vue')
            },
            {
                path: '/admin/activity-log',
                name: 'activityLog',
                meta: { page: 'activityLog' },
                component: () => import('../views/dashboard/ActivityLog.vue')
            },
            {
                path: '/admin/report',
                name: 'report',
                meta: { page: 'report' },
                component: () => import('../views/dashboard/Reports.vue')
            },
            {
                path: '/admin/reviews',
                name: 'manageReviews',
                meta: { page: 'manageReviews' },
                component: () => import('../views/dashboard/ManageReviews.vue')
            },
            {
                path: '/admin/payment-methods',
                name: 'managePaymentMethods',
                meta: { page: 'managePaymentMethods' },
                component: () => import('../views/dashboard/ManagePaymentMethods.vue')
            },
            {
                path: '/admin/manage-categories',
                name: 'manageCategories',
                meta: { page: 'manageCategories' },
                component: () => import('../views/dashboard/ManageCategories.vue')
            },
            {
                path: '/admin/config',
                name: 'config',
                meta: { page: 'config' },
                component: () => import('../views/dashboard/Config.vue')
            },
            {
                path: '/admin/settings',
                name: 'settings',
                meta: { page: 'settings' },
                component: () => import('../views/Settings.vue')
            },
        ],
    },
    {
        name: 'login',
        path: '/login',
        meta: { page: 'login' },
        component: () => import("../views/auth/Login.vue")
    },
    {
        name: 'register',
        path: '/register',
        meta: { page: 'register' },
        component: () => import("../views/auth/Register.vue")
    },
    {
        name: 'forgotPassword',
        path: '/forgotPassword',
        meta: { page: 'forgotPassword' },
        component: () => import("../views/auth/ForgetPass.vue")
    },
    {
        name: 'notFound',
        path: '/:pathMatch(.*)*',
        meta: { page: 'notFound' },
        component: () => import("../views/NotFound.vue")
    },
]

const router = createRouter({
    history: createWebHistory(),
    routes,
    scrollBehavior() {
        return { top: 0 };
    }
});

router.beforeEach((to, from, next) => {
    const authStore = useAuthStore();

    // ── Defer auth checks until init completes ──────────────────────────
    // The auth loading overlay in App.vue hides all content until init
    // finishes. If we redirect here before init, the redirect persists
    // even after the user is authenticated, leaving them on the login page.
    if (!authStore.initialized) {
        return next();
    }

    const isAuthenticated = authStore.isAuthenticated;
    const user = authStore.user;
    const isAdmin = Number(user?.role_id) === 1;

    // Check if route requires authentication
    if (to.meta.requiresAuth && !isAuthenticated) {
        return next({ name: 'login' });
    }

    // Check if route requires admin privileges (role_id = 1)
    if (to.meta.requiresAdmin && !isAdmin) {
        return next({ name: isAuthenticated ? 'home' : 'login' });
    }

    // Redirect authenticated users away from login/register pages
    if ((to.name === 'login' || to.name === 'register') && isAuthenticated) {
        // Redirect based on role
        if (isAdmin) {
            return next({ name: 'DashboardHome' });
        }
        return next({ name: 'home' });
    }

    return next();
});

// ── SEO: Set page meta after each navigation ─────────────────────────────────
// ProductDetail manages its own OG tags dynamically, so we skip it here.
const SEO_SKIP_PAGES = ['ProductDetail', 'blogPost'];

let seoDisposer = null;

router.afterEach((to) => {
    const pageKey = to.meta.page;
    const pageMeta = PAGE_META[pageKey];

    // Dispose previous route's head entries to prevent accumulation
    if (seoDisposer && typeof seoDisposer.dispose === 'function') {
        seoDisposer.dispose();
        seoDisposer = null;
    }

    if (pageMeta && !SEO_SKIP_PAGES.includes(pageKey)) {
        const meta = [
            { name: 'description', content: pageMeta.description },
            { property: 'og:title', content: `${pageMeta.title} | AlieeShop` },
            { property: 'og:description', content: pageMeta.description },
            { property: 'og:image', content: DEFAULT_OG_IMAGE },
            { property: 'og:image:width', content: '1200' },
            { property: 'og:image:height', content: '630' },
            { property: 'og:image:type', content: 'image/jpeg' },
            { property: 'og:url', content: `https://alieeshop.com${to.path}` },
            { property: 'og:type', content: 'website' },
            { name: 'twitter:title', content: `${pageMeta.title} | AlieeShop` },
            { name: 'twitter:description', content: pageMeta.description },
            { name: 'twitter:image', content: DEFAULT_OG_IMAGE },
            { name: 'twitter:card', content: 'summary_large_image' },
        ];
        if (pageMeta.keywords) {
            meta.push({ name: 'keywords', content: pageMeta.keywords });
        }
        seoDisposer = headInstance.push({
            title: pageMeta.title,
            meta,
            link: [
                { rel: 'canonical', href: `https://alieeshop.com${to.path}` },
            ],
        });
    }
});

export default router;
