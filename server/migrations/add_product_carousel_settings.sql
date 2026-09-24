-- ============================================================
-- Product carousel — admin-managed storefront section
-- ============================================================
-- The home page "Curated Collections" carousel was previously
-- hardcoded in Home.vue (section heading, View-all link, the four
-- tabs with their labels, and the product count per tab).
-- This migration moves that configuration into store_settings so the
-- admin dashboard can manage it.
--
-- Unlike the hero carousel there is no item table: the carousel's
-- contents come from live product queries, so only the section
-- settings and the tab list (order, labels, visibility, product
-- count) are configurable. Besides the four built-in tabs, admins can
-- add their own tabs whose contents are hand-picked product ids.
-- ============================================================

INSERT INTO store_settings (setting_key, setting_value) VALUES
    ('product_carousel_section_enabled',    'true'),
    ('product_carousel_eyebrow',            'Discover'),
    ('product_carousel_title',              'Curated Collections'),
    ('product_carousel_view_all_label',     'View all'),
    ('product_carousel_view_all_link',      '/product'),
    ('product_carousel_autoplay_enabled',   'true'),
    ('product_carousel_autoplay_interval',  '4000'),
    -- Ordered list of tabs. Unknown keys are dropped and missing ones are
    -- appended by productCarouselService, so this can be replaced wholesale.
    ('product_carousel_tabs',               '[{"key":"featured","label":"Hand-picked","title":"Featured this week","productsPerTab":8,"isActive":true},{"key":"new-arrivals","label":"Just landed","title":"New Arrivals","productsPerTab":8,"isActive":true},{"key":"best-sellers","label":"Trending now","title":"Best Sellers","productsPerTab":8,"isActive":true},{"key":"coming-soon","label":"Coming up","title":"Coming Soon","productsPerTab":8,"isActive":true}]')
ON CONFLICT (setting_key) DO NOTHING;

-- Verify
SELECT * FROM store_settings WHERE setting_key LIKE 'product_carousel_%' ORDER BY setting_key;
