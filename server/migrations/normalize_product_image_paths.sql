-- Normalise product image paths onto the public /cdn prefix.
--
-- Image files live in the top-level cdn/ directory and are published by the API
-- at /cdn (see the express.static mount in server/src/main.js). Rows written by
-- the original seed data and by the upload endpoint, however, stored either a
-- bare /images/products/... path or an absolute http(s)://<host>/cdn/images/...
-- URL. The bare form only ever resolved because the Vite dev proxy rewrote
-- /images/* to /cdn/images/*; once the SPA is served from its own origin that
-- proxy is gone and the images 404. Rewriting every stored value to the
-- host-independent /cdn path makes both the storefront and the dashboard load
-- the same URL in development and in production.
UPDATE productimages
SET imageurl = CASE
        WHEN imageurl LIKE '/images/%'
            THEN '/cdn' || imageurl
        WHEN imageurl ~ '^https?://[^/]+/cdn/images/'
            THEN regexp_replace(imageurl, '^https?://[^/]+', '')
        ELSE imageurl
    END
WHERE imageurl LIKE '/images/%'
   OR imageurl ~ '^https?://[^/]+/cdn/images/';
