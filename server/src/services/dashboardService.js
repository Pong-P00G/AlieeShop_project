import db from '../database/dbpool.js';

export const getDashboardStats = async () => {
    const [productStats, userStats, revenueStats, orderStats, recentOrders, topProducts, reviewStats] =
        await Promise.all([
            getProductStats(),
            getUserStats(),
            getRevenueStats(),
            getOrderStats(),
            getRecentOrders(5),
            getTopProducts(5),
            getReviewStats()
        ]);

    return {
        products: productStats,
        users: userStats,
        revenue: revenueStats,
        orders:  orderStats,
        recent_orders: recentOrders,
        top_products:  topProducts,
        reviews: reviewStats
    };
};

export const getProductStats = async () => {
    const { rows: [stats] } = await db.query(`
        SELECT
            COUNT(*)                                              AS total_products,
            SUM(CASE WHEN status = 'active'   THEN 1 ELSE 0 END) AS active_products,
            SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) AS inactive_products,
            SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END) AS draft_products
        FROM products
    `);

    const { rows: [stockStats] } = await db.query(`
        SELECT COALESCE(SUM(quantity), 0) AS total_stock FROM stock
    `);

    const { rows: [lowStockRow] } = await db.query(`
        SELECT COUNT(DISTINCT p.productsid) AS low_stock_count
        FROM products p
        LEFT JOIN variants v ON p.productsid = v.productsid
        LEFT JOIN stock    s ON v.variantid  = s.variantid
        GROUP BY p.productsid
        HAVING SUM(s.quantity) > 0 AND SUM(s.quantity) < 10
    `);

    const { rows: [outOfStockRow] } = await db.query(`
        SELECT COUNT(DISTINCT p.productsid) AS out_of_stock_count
        FROM products p
        LEFT JOIN variants v ON p.productsid = v.productsid
        LEFT JOIN stock    s ON v.variantid  = s.variantid
        GROUP BY p.productsid
        HAVING COALESCE(SUM(s.quantity), 0) = 0
    `);

    const { rows: categories } = await db.query(`
        SELECT c.categoryname AS name, COUNT(p.productsid) AS product_count
        FROM category c
        LEFT JOIN products p ON c.categoriesid = p.categoriesid
        GROUP BY c.categoriesid, c.categoryname
        ORDER BY product_count DESC
    `);

    return {
        ...stats,
        total_stock:        parseFloat(stockStats.total_stock) || 0,
        low_stock_count:    lowStockRow ? parseInt(lowStockRow.low_stock_count) : 0,
        out_of_stock_count: outOfStockRow ? parseInt(outOfStockRow.out_of_stock_count) : 0,
        categories
    };
};

export const getUserStats = async () => {
    const { rows: [stats] } = await db.query(`
        SELECT
            COUNT(*)                                                              AS total_users,
            SUM(CASE WHEN rolesid <= 2 THEN 1 ELSE 0 END)                        AS admin_users,
            SUM(CASE WHEN rolesid  = 3 THEN 1 ELSE 0 END)                        AS regular_users,
            SUM(CASE WHEN createdat::date = CURRENT_DATE THEN 1 ELSE 0 END)       AS new_today,
            SUM(CASE WHEN createdat >= CURRENT_DATE - INTERVAL '7 days' THEN 1 ELSE 0 END)  AS new_this_week,
            SUM(CASE WHEN createdat >= CURRENT_DATE - INTERVAL '30 days' THEN 1 ELSE 0 END) AS new_this_month
        FROM users
    `);

    const { rows: recentUsers } = await db.query(`
        SELECT usersid AS user_id, username, email, rolesid AS role_id, createdat AS created_at
        FROM users
        ORDER BY createdat DESC
        LIMIT 5
    `);

    return { ...stats, recent_users: recentUsers };
};

// ── REVENUE STATS ────────────────────────────────────────────────────────────

export const getRevenueStats = async () => {
    const { rows: [revenue] } = await db.query(`
        SELECT
            COALESCE(SUM(CASE WHEN createdat::date = CURRENT_DATE THEN totalamount ELSE 0 END), 0) AS today,
            COALESCE(SUM(CASE WHEN createdat >= date_trunc('week', CURRENT_DATE) THEN totalamount ELSE 0 END), 0) AS week,
            COALESCE(SUM(CASE WHEN createdat >= date_trunc('month', CURRENT_DATE) THEN totalamount ELSE 0 END), 0) AS month
        FROM orders
        WHERE status NOT IN ('cancelled')
    `);

    const { rows: [growthRow] } = await db.query(`
        WITH current_period AS (
            SELECT COALESCE(SUM(totalamount), 0) AS revenue
            FROM orders
            WHERE status NOT IN ('cancelled')
              AND date_trunc('month', createdat) = date_trunc('month', CURRENT_DATE)
        ),
        previous_period AS (
            SELECT COALESCE(SUM(totalamount), 0) AS revenue
            FROM orders
            WHERE status NOT IN ('cancelled')
              AND date_trunc('month', createdat) = date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
        )
        SELECT CASE WHEN previous_period.revenue > 0
                    THEN ROUND(((current_period.revenue - previous_period.revenue) / previous_period.revenue) * 100, 1)
                    ELSE 0
               END AS growth
        FROM current_period, previous_period
    `);

    return {
        today:  parseFloat(revenue.today) || 0,
        week:   parseFloat(revenue.week) || 0,
        month:  parseFloat(revenue.month) || 0,
        growth: parseFloat(growthRow.growth) || 0
    };
};

// ── ORDER STATS ───────────────────────────────────────────────────────────────

export const getOrderStats = async () => {
    const { rows: [orders] } = await db.query(`
        SELECT
            COUNT(*)                                           AS total,
            COUNT(*) FILTER (WHERE status = 'pending')         AS pending,
            COUNT(*) FILTER (WHERE status = 'confirmed')       AS processing,
            COUNT(*) FILTER (WHERE status = 'shipped')        AS shipped,
            COUNT(*) FILTER (WHERE status = 'delivered')      AS completed,
            COUNT(*) FILTER (WHERE status = 'cancelled')      AS cancelled
        FROM orders
    `);

    return {
        total:      parseInt(orders.total) || 0,
        pending:    parseInt(orders.pending) || 0,
        processing: parseInt(orders.processing) || 0,
        shipped:    parseInt(orders.shipped) || 0,
        completed:  parseInt(orders.completed) || 0,
        cancelled:  parseInt(orders.cancelled) || 0
    };
};

// ── RECENT ORDERS ─────────────────────────────────────────────────────────────

export const getRecentOrders = async (limit = 5) => {
    const { rows } = await db.query(`
        SELECT
            o.ordersid       AS id,
            u.username       AS customer_name,
            u.email          AS customer_email,
            o.status,
            o.totalamount    AS amount,
            COUNT(oi.orderitemid)::int AS items_count,
            o.createdat      AS created_at,
            o.updatedat      AS updated_at
        FROM orders o
        JOIN users u           ON o.usersid = u.usersid
        LEFT JOIN orderitems oi ON o.ordersid = oi.ordersid
        GROUP BY o.ordersid, u.username, u.email, o.status, o.totalamount, o.createdat, o.updatedat
        ORDER BY o.createdat DESC
        LIMIT $1
    `, [limit]);

    return rows.map(order => ({
        ...order,
        amount:      parseFloat(order.amount) || 0,
        items_count: parseInt(order.items_count) || 0
    }));
};

// ── TOP PRODUCTS ──────────────────────────────────────────────────────────────

export const getTopProducts = async (limit = 5) => {
    const { rows } = await db.query(`
        SELECT
            p.productsid    AS product_id,
            p.productname   AS product_name,
            p.baseprice     AS base_price,
            pi.imageurl     AS main_image,
            c.categoryname  AS category_name,
            COALESCE(SUM(oi.quantity), 0)::int  AS units_sold,
            COALESCE(SUM(oi.subtotal), 0)       AS revenue
        FROM orderitems oi
        JOIN products p             ON oi.productsid = p.productsid
        LEFT JOIN productimages pi  ON p.productsid = pi.productsid AND pi.isthumbnail = TRUE
        LEFT JOIN category c        ON p.categoriesid = c.categoriesid
        GROUP BY p.productsid, p.productname, p.baseprice, pi.imageurl, c.categoryname
        ORDER BY revenue DESC
        LIMIT $1
    `, [limit]);

    return rows.map(product => ({
        ...product,
        base_price: parseFloat(product.base_price) || 0,
        revenue:    parseFloat(product.revenue) || 0,
        units_sold: parseInt(product.units_sold) || 0
    }));
};

export const getRecentActivities = async (limit = 10) => {
    const activities = [];
    const half = Math.ceil(limit / 2);

    const { rows: recentUsers } = await db.query(`
        SELECT usersid AS user_id, username, rolesid AS role_id, createdat AS created_at
        FROM users
        ORDER BY createdat DESC
        LIMIT $1
    `, [half]);

    recentUsers.forEach(user => {
        const isAdmin = user.role_id <= 2;
        activities.push({
            type:      isAdmin ? 'admin' : 'user',
            message:   `New ${isAdmin ? 'admin' : 'customer'} registration: ${user.username}`,
            time:      formatTimeAgo(user.created_at),
            timestamp: user.created_at,
            icon:      isAdmin ? '👨‍💼' : '👤'
        });
    });

    const { rows: recentProducts } = await db.query(`
        SELECT
            p.productsid AS product_id,
            p.productname AS product_name,
            COALESCE(SUM(s.quantity), 0) AS total_stock,
            p.createdat AS created_at
        FROM products p
        LEFT JOIN variants v ON p.productsid = v.productsid
        LEFT JOIN stock    s ON v.variantid  = s.variantid
        GROUP BY p.productsid, p.productname, p.createdat
        ORDER BY p.createdat DESC
        LIMIT $1
    `, [half]);

    recentProducts.forEach(product => {
        const stock = parseInt(product.total_stock);
        activities.push({
            type:      'product',
            message:   stock > 0 && stock < 10
                ? `Product "${product.product_name}" low stock (${stock} left)`
                : `New product added: ${product.product_name}`,
            time:      formatTimeAgo(product.created_at),
            timestamp: product.created_at,
            icon:      stock > 0 && stock < 10 ? '⚠️' : '📦'
        });
    });

    return activities
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, limit);
};

export const getAnalytics = async (timeframe = 'month') => {
    const userStats = await getUserStats();

    // Determine date range
    let dateFilter, orderDateFilter, prevDateFilter, groupBy, periodLabel;

    if (timeframe === 'week') {
        dateFilter    = `createdat >= date_trunc('week', CURRENT_DATE)`;
        orderDateFilter = `o.createdat >= date_trunc('week', CURRENT_DATE)`;
        prevDateFilter = `createdat >= date_trunc('week', CURRENT_DATE - INTERVAL '1 week')
                          AND createdat < date_trunc('week', CURRENT_DATE)`;
        groupBy = `to_char(createdat, 'Dy')`;
        periodLabel = 'week';
    } else if (timeframe === 'year') {
        dateFilter    = `createdat >= date_trunc('year', CURRENT_DATE)`;
        orderDateFilter = `o.createdat >= date_trunc('year', CURRENT_DATE)`;
        prevDateFilter = `createdat >= date_trunc('year', CURRENT_DATE - INTERVAL '1 year')
                          AND createdat < date_trunc('year', CURRENT_DATE)`;
        groupBy = `to_char(createdat, 'Mon YYYY')`;
        periodLabel = 'year';
    } else {
        dateFilter    = `createdat >= date_trunc('month', CURRENT_DATE)`;
        orderDateFilter = `o.createdat >= date_trunc('month', CURRENT_DATE)`;
        prevDateFilter = `createdat >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
                          AND createdat < date_trunc('month', CURRENT_DATE)`;
        groupBy = `to_char(createdat, 'Mon DD')`;
        periodLabel = 'month';
    }

    // Current period summary
    const { rows: [summary] } = await db.query(`
        SELECT
            COALESCE(SUM(totalamount), 0)   AS total_revenue,
            COUNT(*)                         AS total_orders,
            COUNT(DISTINCT usersid)          AS total_customers,
            CASE WHEN COUNT(*) > 0
                 THEN ROUND(SUM(totalamount) / COUNT(*), 2)
                 ELSE 0
            END                              AS average_order_value
        FROM orders
        WHERE status NOT IN ('cancelled')
          AND ${dateFilter}
    `);

    // Previous period summary (for growth)
    const { rows: [prevSummary] } = await db.query(`
        SELECT
            COALESCE(SUM(totalamount), 0) AS total_revenue,
            COUNT(*)                       AS total_orders,
            COUNT(DISTINCT usersid)        AS total_customers
        FROM orders
        WHERE status NOT IN ('cancelled')
          AND ${prevDateFilter}
    `);

    // Sales trend
    const { rows: salesTrend } = await db.query(`
        SELECT
            ${groupBy} AS period,
            COUNT(*)::int                    AS orders_count,
            COALESCE(SUM(totalamount), 0)    AS sales
        FROM orders
        WHERE status NOT IN ('cancelled')
          AND ${dateFilter}
        GROUP BY ${groupBy}
        ORDER BY MIN(createdat) ASC
    `);

    // Top products by actual order item sales
    const { rows: topProducts } = await db.query(`
        SELECT
            p.productsid    AS product_id,
            p.productname   AS product_name,
            p.baseprice     AS base_price,
            pi.imageurl     AS main_image,
            c.categoryname  AS category_name,
            COALESCE(SUM(oi.quantity), 0)::int  AS units_sold,
            COALESCE(SUM(oi.subtotal), 0)       AS revenue
        FROM orderitems oi
        JOIN orders o               ON oi.ordersid = o.ordersid
        JOIN products p             ON oi.productsid = p.productsid
        LEFT JOIN productimages pi  ON p.productsid = pi.productsid AND pi.isthumbnail = TRUE
        LEFT JOIN category c        ON p.categoriesid = c.categoriesid
        WHERE o.status NOT IN ('cancelled')
          AND ${orderDateFilter}
        GROUP BY p.productsid, p.productname, p.baseprice, pi.imageurl, c.categoryname
        ORDER BY revenue DESC
        LIMIT 5
    `);

    // Category sales from actual orders
    const { rows: categoryPerformance } = await db.query(`
        SELECT
            c.categoryname AS category_name,
            COUNT(DISTINCT p.productsid)::int         AS product_count,
            COALESCE(SUM(oi.subtotal), 0)              AS sales
        FROM orderitems oi
        JOIN orders o               ON oi.ordersid = o.ordersid
        JOIN products p             ON oi.productsid = p.productsid
        RIGHT JOIN category c       ON p.categoriesid = c.categoriesid
        WHERE (o.status NOT IN ('cancelled') OR o.ordersid IS NULL)
          AND (${orderDateFilter} OR o.ordersid IS NULL)
        GROUP BY c.categoriesid, c.categoryname
        ORDER BY sales DESC
    `);

    const totalCategorySales = categoryPerformance.reduce(
        (sum, cat) => sum + parseFloat(cat.sales || 0), 0
    );

    // Calculate growth percentages
    const calcGrowth = (current, previous) => {
        if (previous > 0) return Math.round(((current - previous) / previous) * 100 * 10) / 10;
        return current > 0 ? 100 : 0;
    };

    return {
        timeframe: periodLabel,
        summary: {
            total_revenue:       parseFloat(summary.total_revenue) || 0,
            total_orders:        parseInt(summary.total_orders) || 0,
            total_customers:     parseInt(summary.total_customers) || 0,
            average_order_value: parseFloat(summary.average_order_value) || 0,
            growth: {
                revenue:  calcGrowth(parseFloat(summary.total_revenue), parseFloat(prevSummary.total_revenue)),
                orders:   calcGrowth(parseInt(summary.total_orders), parseInt(prevSummary.total_orders)),
                customers: calcGrowth(parseInt(summary.total_customers), parseInt(prevSummary.total_customers))
            }
        },
        product_performance: topProducts.map(p => ({
            name:    p.product_name,
            units:   parseInt(p.units_sold)  || 0,
            revenue: parseFloat(p.revenue)   || 0,
            sales:   parseFloat(p.revenue)   || 0
        })),
        category_data: categoryPerformance.map(cat => ({
            name:          cat.category_name,
            product_count: cat.product_count,
            sales:         parseFloat(cat.sales || 0),
            percentage:    totalCategorySales > 0
                ? Math.round((parseFloat(cat.sales || 0) / totalCategorySales) * 100)
                : 0
        })),
        sales_trend: salesTrend.map(s => ({
            period:       s.period,
            orders_count: parseInt(s.orders_count) || 0,
            sales:        parseFloat(s.sales) || 0
        }))
    };
};

// ── REPORT GENERATION ────────────────────────────────────────────────────────

/**
 * Generate a report on-the-fly using existing dashboard service functions.
 * Returns structured report data that the frontend can display or download.
 */
export const generateReport = async ({ type = 'sales', dateRange = 'month', startDate, endDate }) => {
    // Map dateRange to timeframe for analytics
    let timeframe = 'month';
    if (dateRange === 'week') timeframe = 'week';
    else if (dateRange === 'year' || dateRange === 'quarter') timeframe = 'month';
    else if (dateRange === 'custom' && startDate && endDate) {
        // For custom ranges, use the analytics month view (most complete data)
        timeframe = 'month';
    }

    switch (type) {
        case 'sales': {
            const analytics = await getAnalytics(timeframe);
            const stats = await getDashboardStats();
            return {
                type: 'sales',
                label: 'Sales Report',
                generated_at: new Date().toISOString(),
                date_range: dateRange,
                summary: analytics.summary,
                sales_trend: analytics.sales_trend,
                product_performance: analytics.product_performance,
                category_data: analytics.category_data,
                recent_orders: stats.recent_orders
            };
        }

        case 'inventory': {
            const productStats = await getProductStats();
            const lowStock = await db.query(`
                SELECT p.productname, v.sku, s.quantity, s.minstock AS reorder_level,
                       (s.minstock - s.quantity) AS shortage
                FROM stock s
                JOIN products p       ON s.productsid = p.productsid
                LEFT JOIN variants v  ON s.variantid = v.variantid
                WHERE s.quantity < s.minstock
                ORDER BY shortage DESC
            `);
            const outOfStock = await db.query(`
                SELECT p.productname, v.sku
                FROM stock s
                JOIN products p       ON s.productsid = p.productsid
                LEFT JOIN variants v  ON s.variantid = v.variantid
                WHERE s.quantity = 0
                ORDER BY p.productname
            `);
            return {
                type: 'inventory',
                label: 'Inventory Report',
                generated_at: new Date().toISOString(),
                date_range: dateRange,
                total_products: productStats.total_products,
                total_stock: productStats.total_stock,
                low_stock_count: productStats.low_stock_count,
                out_of_stock_count: productStats.out_of_stock_count,
                low_stock_items: lowStock.rows,
                out_of_stock_items: outOfStock.rows,
                categories: productStats.categories
            };
        }

        case 'customer': {
            const userStats = await getUserStats();
            const recentUsers = await db.query(`
                SELECT usersid AS id, username, email, firstname, lastname, createdat AS joined_at
                FROM users ORDER BY createdat DESC LIMIT 20
            `);
            return {
                type: 'customer',
                label: 'Customer Report',
                generated_at: new Date().toISOString(),
                date_range: dateRange,
                total_users: userStats.total_users,
                admin_users: userStats.admin_users,
                regular_users: userStats.regular_users,
                new_today: userStats.new_today,
                new_this_week: userStats.new_this_week,
                new_this_month: userStats.new_this_month,
                recent_users: recentUsers.rows
            };
        }

        case 'financial': {
            const revenueStats = await getRevenueStats();
            const orderStats = await getOrderStats();
            const analytics = await getAnalytics(timeframe);
            return {
                type: 'financial',
                label: 'Financial Report',
                generated_at: new Date().toISOString(),
                date_range: dateRange,
                revenue: revenueStats,
                orders: orderStats,
                average_order_value: analytics.summary.average_order_value,
                growth: analytics.summary.growth
            };
        }

        case 'discount': {
            // ── Overall discount stats ──────────────────────────────────────
            const { rows: [discountStats] } = await db.query(`
                SELECT
                    COUNT(*)                                                              AS total_discounts,
                    COALESCE(SUM(amounts), 0)                                             AS total_discount_amount,
                    COALESCE(AVG(amounts), 0)                                             AS avg_discount_amount,
                    SUM(CASE WHEN NOW() BETWEEN startdate AND enddate THEN 1 ELSE 0 END)  AS active_count,
                    SUM(CASE WHEN NOW() < startdate THEN 1 ELSE 0 END)                    AS scheduled_count,
                    SUM(CASE WHEN NOW() > enddate THEN 1 ELSE 0 END)                      AS expired_count
                FROM discounts
            `);

            // ── Usage info: how many times each discount has been redeemed ──
            const { rows: discountUsage } = await db.query(`
                SELECT
                    d.discountsid   AS discount_id,
                    p.productname   AS product_name,
                    d.amounts       AS discount_amount,
                    d.startdate     AS start_date,
                    d.enddate       AS end_date,
                    COUNT(pay.paymentsid)::int    AS times_used,
                    COALESCE(SUM(pay.amount), 0)  AS revenue_from_used
                FROM discounts d
                JOIN products p        ON d.productsid = p.productsid
                LEFT JOIN payments pay ON d.discountsid = pay.discountsid
                GROUP BY d.discountsid, p.productname, d.amounts, d.startdate, d.enddate
                ORDER BY times_used DESC, d.discountsid DESC
            `);

            // ── Revenue impact: discounted orders vs non-discounted ─────────
            // Uses EXISTS subqueries to avoid double-counting orders with
            // mixed (discounted + non-discounted) payments.
            const { rows: revenueImpact } = await db.query(`
                SELECT 'discounted' AS category,
                       COUNT(*)::int AS order_count,
                       COALESCE(SUM(totalamount), 0) AS total_revenue
                FROM orders o
                WHERE o.status NOT IN ('cancelled')
                  AND EXISTS (SELECT 1 FROM payments p
                              WHERE p.ordersid = o.ordersid AND p.discountsid IS NOT NULL)

                UNION ALL

                SELECT 'non_discounted' AS category,
                       COUNT(*)::int AS order_count,
                       COALESCE(SUM(totalamount), 0) AS total_revenue
                FROM orders o
                WHERE o.status NOT IN ('cancelled')
                  AND EXISTS (SELECT 1 FROM payments p WHERE p.ordersid = o.ordersid)
                  AND NOT EXISTS (SELECT 1 FROM payments p
                                  WHERE p.ordersid = o.ordersid AND p.discountsid IS NOT NULL)
            `);

            // ── Monthly discount usage trend ────────────────────────────────
            const dateFilterClause = dateRange === 'week'
                ? `pay.paidat >= date_trunc('week', CURRENT_DATE)`
                : dateRange === 'year'
                    ? `pay.paidat >= date_trunc('year', CURRENT_DATE)`
                    : `pay.paidat >= date_trunc('month', CURRENT_DATE)`;

            const { rows: usageTrend } = await db.query(`
                SELECT
                    to_char(pay.paidat, 'Mon DD')          AS period,
                    COUNT(DISTINCT pay.paymentsid)::int    AS times_used,
                    COALESCE(SUM(pay.amount), 0)           AS revenue
                FROM payments pay
                WHERE pay.discountsid IS NOT NULL
                  AND ${dateFilterClause}
                GROUP BY to_char(pay.paidat, 'Mon DD')
                ORDER BY MIN(pay.paidat) ASC
            `);

            // ── Active discounts expiring soon (next 7 days) ────────────────
            const { rows: expiringSoon } = await db.query(`
                SELECT
                    d.discountsid   AS discount_id,
                    p.productname   AS product_name,
                    d.amounts       AS discount_amount,
                    d.enddate       AS end_date
                FROM discounts d
                JOIN products p ON d.productsid = p.productsid
                WHERE NOW() BETWEEN d.startdate AND d.enddate
                  AND d.enddate <= NOW() + INTERVAL '7 days'
                ORDER BY d.enddate ASC
            `);

            // ── Compute redemption rate ─────────────────────────────────────
            const totalDiscounts = parseInt(discountStats.total_discounts) || 0;
            const usedCount = discountUsage.filter(d => d.times_used > 0).length;
            const redemptionRate = totalDiscounts > 0
                ? Math.round((usedCount / totalDiscounts) * 100)
                : 0;

            // ── Revenue from discounted vs non-discounted ───────────────────
            const discountedRev = parseFloat(
                (revenueImpact.find(r => r.category === 'discounted') || {}).total_revenue || 0
            );
            const nonDiscountedRev = parseFloat(
                (revenueImpact.find(r => r.category === 'non_discounted') || {}).total_revenue || 0
            );
            const totalRevenue = discountedRev + nonDiscountedRev;
            const discountRevenueShare = totalRevenue > 0
                ? Math.round((discountedRev / totalRevenue) * 100)
                : 0;

            return {
                type: 'discount',
                label: 'Discount Usage Report',
                generated_at: new Date().toISOString(),
                date_range: dateRange,
                summary: {
                    total_discounts:       parseInt(discountStats.total_discounts) || 0,
                    total_discount_amount: parseFloat(discountStats.total_discount_amount) || 0,
                    avg_discount_amount:   parseFloat(discountStats.avg_discount_amount) || 0,
                    active_count:          parseInt(discountStats.active_count) || 0,
                    scheduled_count:       parseInt(discountStats.scheduled_count) || 0,
                    expired_count:         parseInt(discountStats.expired_count) || 0,
                    redemption_rate:       redemptionRate,
                    used_count:            usedCount,
                    unused_count:          totalDiscounts - usedCount,
                    discounted_revenue:    discountedRev,
                    non_discounted_revenue: nonDiscountedRev,
                    discount_revenue_share: discountRevenueShare,
                },
                discount_usage: discountUsage.map(d => ({
                    ...d,
                    discount_amount:  parseFloat(d.discount_amount) || 0,
                    revenue_from_used: parseFloat(d.revenue_from_used) || 0,
                    times_used:        parseInt(d.times_used) || 0,
                })),
                expiring_soon: expiringSoon.map(e => ({
                    ...e,
                    discount_amount: parseFloat(e.discount_amount) || 0,
                })),
                usage_trend: usageTrend.map(u => ({
                    period:     u.period,
                    times_used: parseInt(u.times_used) || 0,
                    revenue:    parseFloat(u.revenue) || 0,
                })),
            };
        }

        default:
            throw new Error(`Unknown report type: ${type}`);
    }
};

// ── ALL ACTIVITIES (paginated) ──────────────────────────────────────────────

export const getAllActivities = async (page = 1, pageSize = 20, typeFilter = null) => {
    const offset = (page - 1) * pageSize;
    const activities = [];

    // New user registrations
    const { rows: users } = await db.query(`
        SELECT usersid AS id, username, rolesid AS role_id, createdat AS created_at
        FROM users ORDER BY createdat DESC LIMIT $1 OFFSET $2
    `, [pageSize, offset]);
    users.forEach(u => {
        const isAdmin = u.role_id <= 2;
        activities.push({
            id: 'user-' + u.id,
            type: 'user_registration',
            type_label: isAdmin ? 'Admin Registration' : 'Customer Registration',
            message: isAdmin
                ? `Admin registered: ${u.username}`
                : `New customer registered: ${u.username}`,
            user: u.username,
            created_at: u.created_at,
            timestamp: new Date(u.created_at).getTime(),
        });
    });

    // New products
    const { rows: products } = await db.query(`
        SELECT productsid AS id, productname AS name, createdat AS created_at
        FROM products ORDER BY createdat DESC LIMIT $1 OFFSET $2
    `, [pageSize, offset]);
    products.forEach(p => {
        activities.push({
            id: 'product-' + p.id,
            type: 'product_added',
            type_label: 'Product Added',
            message: `New product added: ${p.name}`,
            user: null,
            created_at: p.created_at,
            timestamp: new Date(p.created_at).getTime(),
        });
    });

    // Stock changes
    const { rows: stockChanges } = await db.query(`
        SELECT sl.logid AS id, sl.changetype AS change_type, sl.quantity, sl.reason,
               p.productname, u.username, sl.createdat AS created_at
        FROM stocklog sl
        JOIN stock s ON sl.stockid = s.stockid
        JOIN products p ON s.productsid = p.productsid
        LEFT JOIN users u ON sl.usersid = u.usersid
        ORDER BY sl.createdat DESC LIMIT $1 OFFSET $2
    `, [pageSize, offset]);
    stockChanges.forEach(sc => {
        const changeLabels = { IN: 'Stock In', OUT: 'Stock Out', ADJUST: 'Stock Adjusted', RETURN: 'Stock Return', DAMAGED: 'Damaged' };
        activities.push({
            id: 'stock-' + sc.id,
            type: 'stock_' + sc.change_type.toLowerCase(),
            type_label: changeLabels[sc.change_type] || 'Stock Change',
            message: `${sc.productname}: ${sc.change_type === 'IN' ? '+' : ''}${sc.quantity} (${sc.reason || 'no reason'})`,
            user: sc.username || null,
            created_at: sc.created_at,
            timestamp: new Date(sc.created_at).getTime(),
        });
    });

    // Order status changes
    const { rows: orders } = await db.query(`
        SELECT ordersid AS id, status, totalamount, usersid, createdat AS created_at
        FROM orders ORDER BY createdat DESC LIMIT $1 OFFSET $2
    `, [pageSize, offset]);
    orders.forEach(o => {
        activities.push({
            id: 'order-' + o.id,
            type: 'order_created',
            type_label: 'New Order',
            message: `Order #${o.id} created - $${parseFloat(o.totalamount || 0).toFixed(2)}`,
            user: null,
            created_at: o.created_at,
            timestamp: new Date(o.created_at).getTime(),
        });
    });

    // Audit log entries (role/permission changes)
    try {
        const { rows: auditEntries } = await db.query(`
            SELECT auditid AS id, action, entity_type, entity_id, entity_name,
                   performed_by, details, createdat AS created_at
            FROM audit_log
            ORDER BY createdat DESC
            LIMIT $1 OFFSET $2
        `, [pageSize, offset]);
        auditEntries.forEach(a => {
            const actionLabels = {
                create: 'Created',
                update: 'Updated',
                delete: 'Deleted',
                update_permissions: 'Permissions Updated'
            };
            const typeLabels = {
                role: 'Role Management',
                permission: 'Permission Management'
            };
            activities.push({
                id: 'audit-' + a.id,
                type: a.entity_type === 'role' ? 'role_managed' : 'permission_managed',
                type_label: typeLabels[a.entity_type] || 'Audit',
                message: a.details || `${actionLabels[a.action] || a.action} ${a.entity_type}: ${a.entity_name}`,
                user: a.performed_by,
                created_at: a.created_at,
                timestamp: new Date(a.created_at).getTime(),
            });
        });
    } catch (err) {
        // audit_log table might not exist yet
        console.warn('Could not fetch audit logs:', err.message);
    }

    // Filter by type if specified
    let filtered = activities;
    if (typeFilter && typeFilter !== 'all') {
        filtered = activities.filter(a => a.type === typeFilter || a.type.startsWith(typeFilter));
    }

    // Sort by timestamp descending and paginate
    filtered.sort((a, b) => b.timestamp - a.timestamp);
    const total = filtered.length;
    const paginated = filtered.slice(0, pageSize);

    return {
        page,
        pageSize,
        totalItems: total,
        totalPages: Math.ceil(total / pageSize),
        items: paginated,
    };
};

const formatTimeAgo = (date) => {
    const diffInSeconds = Math.floor((Date.now() - new Date(date)) / 1000);
    if (diffInSeconds < 60)      return 'Just now';
    if (diffInSeconds < 3600)    return `${Math.floor(diffInSeconds / 60)} min ago`;
    if (diffInSeconds < 86400)   return `${Math.floor(diffInSeconds / 3600)} hour${Math.floor(diffInSeconds / 3600) > 1 ? 's' : ''} ago`;
    if (diffInSeconds < 604800)  return `${Math.floor(diffInSeconds / 86400)} day${Math.floor(diffInSeconds / 86400) > 1 ? 's' : ''} ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 604800)} week${Math.floor(diffInSeconds / 604800) > 1 ? 's' : ''} ago`;
    return `${Math.floor(diffInSeconds / 2592000)} month${Math.floor(diffInSeconds / 2592000) > 1 ? 's' : ''} ago`;
};

// ── GLOBAL SEARCH ────────────────────────────────────────────────────────────

export const globalSearch = async (query) => {
    if (!query || query.trim().length < 2) {
        return { products: [], orders: [], users: [] };
    }
    const searchTerm = query.trim();
    const pattern = `%${searchTerm}%`;

    const [productsResult, ordersResult, usersResult] = await Promise.all([
        db.query(
            `SELECT productsid AS id, productname AS name, baseprice AS price,
                    thumbnail AS image, status
             FROM view_products
             WHERE productname ILIKE $1 OR categoryname ILIKE $1
             LIMIT 5`,
            [pattern]
        ),
        db.query(
            `SELECT o.ordersid AS id, u.username, o.status, o.totalamount AS amount,
                    o.createdat AS created_at
             FROM orders o
             JOIN users u ON o.usersid = u.usersid
             WHERE o.ordersid::text ILIKE $1
                OR u.username ILIKE $1
                OR u.email ILIKE $1
             ORDER BY o.createdat DESC
             LIMIT 5`,
            [pattern]
        ),
        db.query(
            `SELECT usersid AS id, username, email, rolesid AS role_id,
                    firstname AS first_name, lastname AS last_name
             FROM users
             WHERE username ILIKE $1
                OR email ILIKE $1
                OR firstname ILIKE $1
                OR lastname ILIKE $1
             LIMIT 5`,
            [pattern]
        ),
    ]);

    return {
        products: productsResult.rows.map(p => ({
            ...p,
            price: parseFloat(p.price) || 0,
        })),
        orders: ordersResult.rows.map(o => ({
            ...o,
            amount: parseFloat(o.amount) || 0,
        })),
        users: usersResult.rows.map(u => ({
            ...u,
        })),
    };
};

// ── NOTIFICATIONS ────────────────────────────────────────────────────────────

import * as NotificationModel from '../model/notificationModel.js';
import * as pushService from './pushService.js';

// ── NOTIFICATION + PUSH DISPATCH ─────────────────────────────────────────────

const NOTIFICATION_TITLES = {
    order:   'Order update',
    user:    'New user',
    stock:   'Low stock alert',
    product: 'New product',
    system:  'AlieeShop',
};

/**
 * Persist a notification, then deliver it as a web push (fire-and-forget).
 *
 * Admin broadcasts (no userId) go to every push subscriber; user-specific
 * notifications go to that user's subscribed devices. Push delivery failures
 * are logged only — they never prevent the notification row from being stored.
 */
const createNotification = async ({ type, message, link = null, userId = null }) => {
    const notification = await NotificationModel.createNotification({ type, message, link, userId });

    const payload = {
        title: NOTIFICATION_TITLES[type] || 'AlieeShop',
        body: message,
        url: link || (userId ? '/notifications' : '/admin/dashboard'),
        tag: `${type}-${notification?.id ?? Date.now()}`,
    };

    const dispatch = userId
        ? pushService.sendPushToUser(userId, payload)
        : pushService.sendPushToAllSubscribers(payload);

    dispatch.catch((err) => console.error('[Push] Dispatch failed:', err.message));

    return notification;
};

export const getNotifications = async (limit = 20) => {
    const [notifications, unreadCount] = await Promise.all([
        NotificationModel.getNotifications(limit),
        NotificationModel.getUnreadCount(),
    ]);
    return { notifications, unreadCount };
};

export const getAllNotifications = async (page = 1, pageSize = 20, type = null) => {
    return await NotificationModel.getAllNotifications(page, pageSize, type);
};

export const markNotificationRead = async (notificationId) => {
    return await NotificationModel.markAsRead(notificationId);
};

export const markAllNotificationsRead = async () => {
    return await NotificationModel.markAllAsRead();
};

// ── NOTIFICATION PREFERENCES ────────────────────────────────────────────────

export const getNotificationPreferences = async (userId) => {
    let prefs = await NotificationModel.getPreferences(userId);
    if (!prefs) {
        // Create default preferences
        prefs = await NotificationModel.upsertPreferences(userId, {});
    }
    return prefs;
};

export const updateNotificationPreferences = async (userId, prefs) => {
    return await NotificationModel.upsertPreferences(userId, prefs);
};

// ── PUSH SUBSCRIPTIONS ─────────────────────────────────────────────────────

export const savePushSubscription = async (userId, subscription) => {
    return await NotificationModel.savePushSubscription(userId, subscription);
};

export const removePushSubscription = async (userId, endpoint) => {
    await NotificationModel.removePushSubscription(userId, endpoint);
};

// Returns the configured VAPID public key, or null when web push is unconfigured.
// There is deliberately no fallback key: handing the browser a placeholder
// would let it "subscribe" successfully and then never receive anything.
export const getVapidPublicKey = () => pushService.getVapidConfig()?.publicKey ?? null;

export const isPushConfigured = () => pushService.isPushConfigured();

// ── AUTO-NOTIFICATION GENERATORS ─────────────────────────────────────────────

// ── REVIEW STATS ────────────────────────────────────────────────────────────

export const getReviewStats = async () => {
    const { rows: [stats] } = await db.query(`
        SELECT
            COUNT(*)::int                                                           AS total_reviews,
            COUNT(*) FILTER (WHERE status = 'approved')::int                        AS approved_count,
            COUNT(*) FILTER (WHERE status = 'pending')::int                         AS pending_count,
            COUNT(*) FILTER (WHERE status = 'rejected')::int                        AS rejected_count,
            COALESCE(ROUND(AVG(rating), 1), 0)                                      AS average_rating
        FROM reviews
    `);

    const totalDecided = stats.approved_count + stats.rejected_count;
    const approvalRate = totalDecided > 0
        ? Math.round((stats.approved_count / totalDecided) * 100)
        : 0;

    // 5-star distribution
    const { rows: [distribution] } = await db.query(`
        SELECT
            COALESCE(SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END), 0)::int AS five_star,
            COALESCE(SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END), 0)::int AS four_star,
            COALESCE(SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END), 0)::int AS three_star,
            COALESCE(SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END), 0)::int AS two_star,
            COALESCE(SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END), 0)::int AS one_star
        FROM reviews
        WHERE status = 'approved'
    `);

    // Recent reviews (last 5)
    const { rows: recent } = await db.query(`
        SELECT
            r.reviewsid  AS review_id,
            r.productsid AS product_id,
            p.productname AS product_name,
            u.username,
            r.rating,
            r.title,
            r.status,
            r.createdat  AS created_at
        FROM reviews r
        JOIN users u    ON r.usersid = u.usersid
        JOIN products p ON r.productsid = p.productsid
        ORDER BY r.createdat DESC
        LIMIT 5
    `);

    return {
        total_reviews:   stats.total_reviews,
        approved_count:  stats.approved_count,
        pending_count:   stats.pending_count,
        rejected_count:  stats.rejected_count,
        average_rating:  stats.average_rating,
        approval_rate:   approvalRate,
        distribution,
        recent_reviews:  recent,
    };
};

/** Called after a new order is created */
export const notifyNewOrder = async (orderId, username, totalAmount, userId) => {
    // Admin broadcast (independent try/catch so a failure doesn't block the user notification)
    try {
        await createNotification({
            type: 'order',
            message: `New order #${orderId} from ${username} — $${parseFloat(totalAmount || 0).toFixed(2)}`,
            link: `/admin/orders`,
        });
    } catch (err) {
        console.error('Failed to create admin order notification:', err.message);
    }

    // User-specific notification
    if (userId) {
        try {
            await createNotification({
                type: 'order',
                message: `Order #${orderId} placed successfully — $${parseFloat(totalAmount || 0).toFixed(2)}`,
                link: `/notifications`,
                userId,
            });
        } catch (err) {
            console.error('Failed to create user order notification:', err.message);
        }
    }
};

/** Called after a new user registers */
export const notifyNewUser = async (username, isAdmin = false) => {
    try {
        await createNotification({
            type: 'user',
            message: isAdmin
                ? `New admin registered: ${username}`
                : `New customer registered: ${username}`,
            link: `/admin/manage-user`,
        });
    } catch (err) {
        console.error('Failed to create user notification:', err.message);
    }
};

/** Called when stock level drops below threshold */
export const notifyLowStock = async (productName, stockLeft, variantSku = null) => {
    try {
        const label = variantSku ? `${productName} (${variantSku})` : productName;
        await createNotification({
            type: 'stock',
            message: `Low stock alert: ${label} — only ${stockLeft} left`,
            link: `/admin/manage-stock`,
        });
    } catch (err) {
        console.error('Failed to create stock notification:', err.message);
    }
};

// ── SCHEDULED LOW-STOCK CHECK ──────────────────────────────────────────────

/**
 * Check all products/variants below their reorder level and create
 * notifications. Skips products that already have an unresolved (unread)
 * low-stock notification from the last 24 hours to avoid spamming.
 * Returns the number of new notifications created.
 */
export const checkAndNotifyLowStock = async () => {
    try {
        // view_stock_low already has all the fields we need
        const { rows: lowStockItems } = await db.query(`
            SELECT productname, sku, quantity, minstock AS reorder_level
            FROM view_stock_low
            LIMIT 50
        `);

        let created = 0;

        for (const item of lowStockItems) {
            const label = item.sku ? `${item.productname} (${item.sku})` : item.productname;

            // Check if there's already an unread low-stock notification for this item
            const { rows: existing } = await db.query(
                `SELECT notificationid FROM notifications
                 WHERE type = 'stock'
                   AND message LIKE $1
                   AND isread = FALSE
                   AND createdat > NOW() - INTERVAL '24 hours'
                 LIMIT 1`,
                [`%${label}%`]
            );

            if (existing.length > 0) continue; // Skip — already notified

            await createNotification({
                type: 'stock',
                message: `Low stock alert: ${label} — only ${item.quantity} left (reorder at ${item.reorder_level})`,
                link: `/admin/manage-stock`,
            });
            created++;
        }

        if (created > 0) {
            console.log(`[LowStockCheck] Created ${created} low-stock notification(s)`);
        }
        return created;
    } catch (err) {
        console.error('[LowStockCheck] Error:', err.message);
        return 0;
    }
};

/** Called when a new product is added */
export const notifyNewProduct = async (productName) => {
    try {
        await createNotification({
            type: 'product',
            message: `New product added: ${productName}`,
            link: `/admin/manage-products`,
        });
    } catch (err) {
        console.error('Failed to create product notification:', err.message);
    }
};

/** Called when an order status is updated — notifies the customer */
export const notifyOrderStatusChange = async (orderId, userId, username, email, newStatus) => {
    try {
        const statusLabels = {
            pending: 'Pending',
            confirmed: 'Confirmed',
            shipped: 'Shipped',
            delivered: 'Delivered',
            cancelled: 'Cancelled'
        };
        const label = statusLabels[newStatus] || newStatus;

        // Admin broadcast (visible in admin dashboard)
        await createNotification({
            type: 'order',
            message: `Order #${orderId} (${username}) status: ${label}`,
            link: `/admin/orders`,
        });

        // User-specific notification (appears on /notifications page)
        await createNotification({
            type: 'order',
            message: `Order #${orderId} status update: ${label}`,
            link: `/notifications`,
            userId,
        });

        console.log(`[OrderNotification] User #${userId} (${username}, ${email}) notified: Order #${orderId} → ${label}`);
    } catch (err) {
        console.error('Failed to create order status notification:', err.message);
    }
};
