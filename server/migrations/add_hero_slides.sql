-- ============================================================
-- Hero slides — admin-managed storefront hero carousel
-- ============================================================
-- The storefront hero was previously hardcoded in HeroCarousel.vue.
-- This migration moves both the individual slides and the section
-- behaviour (autoplay, secondary CTA) into the database so the
-- admin dashboard can manage them.
-- ============================================================

CREATE TABLE IF NOT EXISTS hero_slides (
    slide_id     SERIAL       PRIMARY KEY,
    eyebrow      VARCHAR(120),
    title        VARCHAR(150) NOT NULL DEFAULT '',
    title_accent VARCHAR(150),
    description  VARCHAR(500),
    image_url    TEXT         NOT NULL,
    cta_label    VARCHAR(80),
    cta_link     VARCHAR(500),
    badge        VARCHAR(60),
    sort_order   INTEGER      NOT NULL DEFAULT 0,
    is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Slides render in sort_order; ordering the index keeps the storefront read cheap.
CREATE INDEX IF NOT EXISTS idx_hero_slides_order ON hero_slides (sort_order, slide_id);

-- ------------------------------------------------------------
-- Seed the three slides that were hardcoded in the component.
-- Guarded so re-running the migration never duplicates them.
-- ------------------------------------------------------------
INSERT INTO hero_slides (eyebrow, title, title_accent, description, image_url, cta_label, cta_link, badge, sort_order)
SELECT * FROM (VALUES
    (
        'Summer Collection 2024',
        'Threads of',
        'Modernity',
        'Curated apparel and essentials designed for the contemporary wardrobe.',
        'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&h=600&fit=crop',
        'Shop Collection',
        '/product',
        'New Season',
        0
    ),
    (
        'Premium Electronics',
        'Built for',
        'Tomorrow',
        'Cutting-edge devices and accessories engineered for everyday excellence.',
        'https://images.unsplash.com/photo-1468495244123-6c6c332eeece?w=1200&h=600&fit=crop',
        'Explore Tech',
        '/product?category=tech',
        'Trending',
        1
    ),
    (
        'Home & Living',
        'Spaces that',
        'Inspire',
        'Transformative pieces that turn any room into a personal sanctuary.',
        'https://images.unsplash.com/photo-1484101403633-562f891dc89a?w=1200&h=600&fit=crop',
        'Discover More',
        '/product?category=home',
        'On Sale',
        2
    )
) AS seed(eyebrow, title, title_accent, description, image_url, cta_label, cta_link, badge, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM hero_slides);

-- ------------------------------------------------------------
-- Section-level settings (stored alongside the other store settings)
-- ------------------------------------------------------------
INSERT INTO store_settings (setting_key, setting_value) VALUES
    ('hero_section_enabled',   'true'),
    ('hero_autoplay_enabled',  'true'),
    ('hero_autoplay_interval', '5000'),
    ('hero_secondary_label',   'Our Story'),
    ('hero_secondary_link',    '/about')
ON CONFLICT (setting_key) DO NOTHING;

-- Verify
SELECT slide_id, title, title_accent, sort_order, is_active FROM hero_slides ORDER BY sort_order;
SELECT * FROM store_settings WHERE setting_key LIKE 'hero_%' ORDER BY setting_key;
