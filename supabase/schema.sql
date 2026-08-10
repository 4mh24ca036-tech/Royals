-- ============================================================
-- ROYALS Luxury Couture — Supabase PostgreSQL Schema
-- Run this entire file in the Supabase SQL editor ONCE.
-- It is fully idempotent (CREATE TABLE IF NOT EXISTS).
-- ============================================================

-- Enable pgcrypto for gen_random_uuid() if needed
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── users ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  phone         TEXT,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'customer',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── admin_users ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_users (
  id            TEXT PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'super_admin',
  last_login    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── categories ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  slug             TEXT UNIQUE NOT NULL,
  description      TEXT,
  image_url        TEXT,
  mobile_image_url TEXT NOT NULL DEFAULT '',
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  display_order    INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── products ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id                TEXT PRIMARY KEY,
  title             TEXT NOT NULL,
  slug              TEXT UNIQUE NOT NULL,
  category_id       TEXT NOT NULL,
  category_name     TEXT NOT NULL,
  price             NUMERIC(12,2) NOT NULL,
  discount_price    NUMERIC(12,2),
  stock             INTEGER NOT NULL DEFAULT 10,
  fabric            TEXT,
  embroidery        TEXT,
  color             TEXT,
  sizes_json        TEXT NOT NULL DEFAULT '[]',
  description       TEXT NOT NULL DEFAULT '',
  care_instructions TEXT,
  images_json       TEXT NOT NULL DEFAULT '[]',
  rating            NUMERIC(3,2) DEFAULT 4.8,
  review_count      INTEGER DEFAULT 0,
  is_featured       BOOLEAN NOT NULL DEFAULT FALSE,
  is_new_arrival    BOOLEAN NOT NULL DEFAULT FALSE,
  display_order     INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ
);

-- ── product_images ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_images (
  id            TEXT PRIMARY KEY,
  product_id    TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url     TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_cover      BOOLEAN NOT NULL DEFAULT FALSE,
  view_type     TEXT NOT NULL DEFAULT 'gallery',
  alt_text      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_images_order ON product_images(product_id, display_order);

-- ── reviews ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id                TEXT PRIMARY KEY,
  product_id        TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_name         TEXT NOT NULL,
  rating            NUMERIC(3,2) NOT NULL,
  comment           TEXT NOT NULL,
  verified_purchase BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON reviews(product_id);

-- ── addresses ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS addresses (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  full_name     TEXT NOT NULL,
  phone         TEXT NOT NULL,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  landmark      TEXT,
  city          TEXT NOT NULL,
  state         TEXT NOT NULL,
  pincode       TEXT NOT NULL,
  is_default    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON addresses(user_id);

-- ── cart ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cart (
  id         TEXT PRIMARY KEY,
  user_id    TEXT,
  session_id TEXT UNIQUE NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── cart_items ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cart_items (
  id         TEXT PRIMARY KEY,
  cart_id    TEXT NOT NULL REFERENCES cart(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  size       TEXT NOT NULL,
  color      TEXT NOT NULL,
  quantity   INTEGER NOT NULL DEFAULT 1,
  price      NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── orders ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id                      TEXT PRIMARY KEY,
  order_number            TEXT UNIQUE NOT NULL,
  tracking_id             TEXT UNIQUE NOT NULL,
  user_id                 TEXT,
  customer_name           TEXT NOT NULL,
  customer_email          TEXT NOT NULL,
  customer_phone          TEXT NOT NULL,
  shipping_address_json   TEXT NOT NULL,
  subtotal                NUMERIC(12,2) NOT NULL,
  gst_amount              NUMERIC(12,2) NOT NULL,
  discount_amount         NUMERIC(12,2) NOT NULL DEFAULT 0,
  delivery_fee            NUMERIC(12,2) NOT NULL DEFAULT 0,
  grand_total             NUMERIC(12,2) NOT NULL,
  coupon_code             TEXT,
  payment_method          TEXT NOT NULL,
  payment_status          TEXT NOT NULL,
  order_status            TEXT NOT NULL,
  courier_name            TEXT DEFAULT 'Blue Dart Apex Luxury',
  estimated_delivery_date TEXT NOT NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_tracking_id ON orders(tracking_id);

-- ── order_items ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
  id                  TEXT PRIMARY KEY,
  order_id            TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id          TEXT NOT NULL,
  product_title       TEXT NOT NULL,
  product_image       TEXT NOT NULL,
  product_description TEXT,
  size                TEXT NOT NULL,
  color               TEXT NOT NULL,
  quantity            INTEGER NOT NULL,
  unit_price          NUMERIC(12,2) NOT NULL,
  total_price         NUMERIC(12,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- ── payments ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id             TEXT PRIMARY KEY,
  order_id       TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  payment_method TEXT NOT NULL,
  transaction_id TEXT NOT NULL,
  gateway_ref    TEXT,
  amount         NUMERIC(12,2) NOT NULL,
  status         TEXT NOT NULL,
  paid_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);

-- ── order_status_history ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_status_history (
  id         TEXT PRIMARY KEY,
  order_id   TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status     TEXT NOT NULL,
  notes      TEXT,
  updated_by TEXT DEFAULT 'System',
  date_str   TEXT NOT NULL,
  time_str   TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON order_status_history(order_id);

-- ── notifications ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id         TEXT PRIMARY KEY,
  user_id    TEXT,
  order_id   TEXT,
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  type       TEXT NOT NULL,
  is_read    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);

-- ── coupons ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coupons (
  id             TEXT PRIMARY KEY,
  code           TEXT UNIQUE NOT NULL,
  discount_type  TEXT NOT NULL,
  discount_value NUMERIC(12,2) NOT NULL,
  min_spend      NUMERIC(12,2) DEFAULT 0,
  max_discount   NUMERIC(12,2),
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  usage_count    INTEGER NOT NULL DEFAULT 0,
  expiry_date    TEXT
);

-- ── inventory ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory (
  id                  TEXT PRIMARY KEY,
  product_id          TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku                 TEXT NOT NULL,
  size                TEXT NOT NULL,
  stock_quantity      INTEGER NOT NULL DEFAULT 10,
  low_stock_threshold INTEGER DEFAULT 3,
  last_restocked_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_inventory_product_id ON inventory(product_id);

-- ── banners ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS banners (
  id               TEXT PRIMARY KEY,
  title            TEXT NOT NULL DEFAULT '',
  subtitle         TEXT DEFAULT '',
  description      TEXT DEFAULT '',
  image_url        TEXT NOT NULL,
  mobile_image_url TEXT DEFAULT '',
  button_text      TEXT DEFAULT '',
  button_link      TEXT DEFAULT '',
  tag              TEXT DEFAULT '',
  category_id      TEXT DEFAULT '',
  display_order    INTEGER NOT NULL DEFAULT 0,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── editorial_strips ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS editorial_strips (
  id            TEXT PRIMARY KEY,
  image_url     TEXT NOT NULL,
  label         TEXT NOT NULL DEFAULT '',
  subtitle      TEXT DEFAULT '',
  category_id   TEXT DEFAULT '',
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── app_migrations ────────────────────────────────────────────────────────────
-- Tracks which one-time data migrations have been applied.
CREATE TABLE IF NOT EXISTS app_migrations (
  id         TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Row Level Security (RLS)
-- Public tables: products, categories, banners, editorial_strips
-- are readable by anyone. All writes require service role key.
-- ============================================================

-- Disable RLS on all tables so the service role key can access everything.
-- The API layer enforces its own JWT-based auth.
ALTER TABLE users                 DISABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users           DISABLE ROW LEVEL SECURITY;
ALTER TABLE categories            DISABLE ROW LEVEL SECURITY;
ALTER TABLE products              DISABLE ROW LEVEL SECURITY;
ALTER TABLE product_images        DISABLE ROW LEVEL SECURITY;
ALTER TABLE reviews               DISABLE ROW LEVEL SECURITY;
ALTER TABLE addresses             DISABLE ROW LEVEL SECURITY;
ALTER TABLE cart                  DISABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items            DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders                DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_items           DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments              DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history  DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications         DISABLE ROW LEVEL SECURITY;
ALTER TABLE coupons               DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory             DISABLE ROW LEVEL SECURITY;
ALTER TABLE banners               DISABLE ROW LEVEL SECURITY;
ALTER TABLE editorial_strips      DISABLE ROW LEVEL SECURITY;
ALTER TABLE app_migrations        DISABLE ROW LEVEL SECURITY;
