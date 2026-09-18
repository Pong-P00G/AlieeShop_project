# Base schema baseline

`000_base_schema.sql` is a `pg_dump --schema-only` snapshot of the **core**
schema — the tables that exist *before* anything in `../migrations/` is applied.

It exists because the migrations are purely additive. They create feature tables
(`notifications`, `reviews`, `refresh_tokens`, `permissions`, …) and add columns,
but nothing in this repository created `products`, `users`, `category`, `orders`,
`cart`, `stock`, and so on. Without this file, `npm run migrate` on an empty
database produces only the feature tables and then `seed_products.sql` fails with
`relation "category" does not exist`.

`npm run setup` applies it **only when the target database has no core tables**,
then runs the migrations normally, so the migrations still create and own
their tables on a fresh database.

## What it contains

| Object | Count |
|---|---|
| Tables | 18 (`products`, `users`, `category`, `orders`, `cart`, `stock`, …) |
| Views | 5 (`view_products`, `view_users`, `view_orders`, `view_order_detail`, `view_cart`) |
| Foreign keys | 54 |
| Indexes | 11 |
| Functions | 1 (`touch_updated_at_user` — the `updatedat` trigger) |
| Extensions | 1 (`pgcrypto`) |

## What it deliberately omits

Objects owned by migrations, so the migrations create them for real:

`notifications`, `audit_log`, `reviews`, `refresh_tokens`, `permissions`,
`role_permissions`, `store_settings`, `wishlist_items`, `view_stock_low`, and
`schema_migrations` (which the migration runner owns).

The legacy `hash_password()`, `verify_password()` and
`before_update_user_password()` functions are also omitted. They were the
database side of the double-hashing bug fixed by
`remove_password_hash_triggers.sql`: pgcrypto would re-hash the bcrypt hash the
app had just written. No trigger references them any more, so dumping them would
only resurrect dead DB-side hashing on every new machine.

## Schema only, no data

The dump uses `--schema-only`, so no rows are copied — no users, no roles, and
none of the sample catalog. Products come from `../seed_products.sql`.

Note that neither the baseline nor the seed creates `roles` or `users` rows, so a
brand-new database has no account to log in with. Roles and the existing user
accounts were never reproducible from this repository. If you need a working
login on a fresh database, create the role and admin user yourself (or copy them
from an existing database).

## Regenerating

Run this against a database that already has the core schema (for example a
developer's working copy), from the `server/` directory:

```bash
set -a; . ./.env; set +a

pg_dump --schema-only --no-owner --no-privileges \
  --exclude-table=schema_migrations \
  --exclude-table=notifications --exclude-table=audit_log \
  --exclude-table=reviews --exclude-table=refresh_tokens \
  --exclude-table=permissions --exclude-table=role_permissions \
  --exclude-table=store_settings --exclude-table=wishlist_items \
  --exclude-table=view_stock_low \
  -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_DATABASE" \
  -f schema/000_base_schema.sql
```

Then two manual fix-ups are required, because the dump is written for `psql`
while `npm run setup` executes it through the `pg` driver:

1. **Delete the `\restrict` line near the top and the matching `\unrestrict`
   line at the end.** These are psql meta-commands (added by PostgreSQL 17+),
   not SQL, and the Node driver cannot parse them.
2. **Delete any `CREATE SEQUENCE` block for a table you excluded** — for example
   `refresh_tokens_refresh_token_id_seq` and
   `wishlist_items_wishlist_id_seq`. The sequence survives the table-level
   exclusion, and it collides with the sequence the corresponding `SERIAL`
   column creates during migration.

Restore the explanatory header comment at the top of the file afterwards.
