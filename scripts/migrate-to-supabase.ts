/**
 * scripts/migrate-to-supabase.ts
 *
 * One-time migration: reads data/royals.sqlite → upserts into Supabase PostgreSQL.
 *
 * Idempotent: uses upsert (INSERT ... ON CONFLICT DO UPDATE) so it is safe to
 * re-run. Existing rows in Supabase are updated; new rows are inserted.
 *
 * Prerequisites:
 *   1. Copy .env.example → .env and fill in SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *   2. Run the schema SQL in supabase/schema.sql against your Supabase project first
 *   3. Run: npx tsx scripts/migrate-to-supabase.ts
 *
 * The script does NOT delete data from Supabase — it only upserts.
 * The SQLite file is never modified.
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load .env
dotenv.config();

// ── Supabase client ────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌  SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// ── SQLite loader ──────────────────────────────────────────────────────────
// We use initSqlJs (bundled via node-compatible sql.js) to read the DB file.
// sql.js is installed only as a devDependency for this migration script.
async function loadSqliteDb() {
  const DB_FILE = path.join(process.cwd(), 'data', 'royals.sqlite');
  if (!fs.existsSync(DB_FILE)) {
    throw new Error(`SQLite file not found: ${DB_FILE}`);
  }

  // Dynamically import sql.js — only needed for migration
  let initSqlJs: any;
  try {
    const mod = await import('sql.js');
    initSqlJs = mod.default ?? mod;
  } catch {
    console.error('❌  sql.js is not installed. Run: npm install --save-dev sql.js @types/sql.js');
    process.exit(1);
  }

  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync(DB_FILE);
  return new SQL.Database(fileBuffer);
}

// ── Generic SQLite query helper ────────────────────────────────────────────
function queryAll(db: any, sql: string, params: any[] = []): Record<string, any>[] {
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const results: Record<string, any>[] = [];
  while (stmt.step()) results.push(stmt.getAsObject());
  stmt.free();
  return results;
}

// ── Upsert helper with chunking ────────────────────────────────────────────
async function upsert(
  table: string,
  rows: Record<string, any>[],
  conflictColumn = 'id'
): Promise<void> {
  if (rows.length === 0) {
    console.log(`  ⊘  ${table}: 0 rows — skipped`);
    return;
  }

  // Supabase upsert is limited to ~500 rows per request
  const CHUNK = 200;
  let upserted = 0;

  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await supabase
      .from(table)
      .upsert(chunk, { onConflict: conflictColumn });

    if (error) {
      console.error(`  ❌  ${table} chunk ${i}–${i + chunk.length}: ${error.message}`);
      throw error;
    }
    upserted += chunk.length;
  }

  console.log(`  ✓  ${table}: ${upserted} rows upserted`);
}

// ── Boolean normaliser ─────────────────────────────────────────────────────
// SQLite stores booleans as 0/1 integers; Postgres expects true/false.
function normBool(val: any): boolean {
  return val === 1 || val === true || val === '1' || val === 'true';
}

// ── Timestamp normaliser ───────────────────────────────────────────────────
// SQLite stores datetimes as ISO strings or empty strings.
// Postgres TIMESTAMPTZ rejects empty strings — convert to null.
function normTs(val: any): string | null {
  if (!val || val === '') return null;
  return String(val);
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════════
async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(' ROYALS  SQLite → Supabase Migration');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const db = await loadSqliteDb();
  console.log('✓  SQLite database loaded\n');

  // ── 1. users ──────────────────────────────────────────────────────────────
  const users = queryAll(db, 'SELECT * FROM users').map((r) => ({
    id:            r.id,
    name:          r.name,
    email:         r.email,
    phone:         r.phone ?? null,
    password_hash: r.password_hash,
    role:          r.role ?? 'customer',
    created_at:    normTs(r.created_at),
    updated_at:    normTs(r.updated_at)
  }));
  await upsert('users', users);

  // ── 2. admin_users ────────────────────────────────────────────────────────
  const admins = queryAll(db, 'SELECT * FROM admin_users').map((r) => ({
    id:            r.id,
    username:      r.username,
    email:         r.email,
    name:          r.name,
    password_hash: r.password_hash,
    role:          r.role ?? 'super_admin',
    last_login:    normTs(r.last_login),
    created_at:    normTs(r.created_at)
  }));
  await upsert('admin_users', admins);

  // ── 3. categories ─────────────────────────────────────────────────────────
  const categories = queryAll(db, 'SELECT * FROM categories').map((r) => ({
    id:               r.id,
    name:             r.name,
    slug:             r.slug,
    description:      r.description ?? null,
    image_url:        r.image_url ?? null,
    mobile_image_url: r.mobile_image_url ?? '',
    is_active:        normBool(r.is_active),
    display_order:    Number(r.display_order ?? 0),
    created_at:       normTs(r.created_at) || new Date().toISOString(),
    updated_at:       normTs(r.updated_at) || new Date().toISOString()
  }));
  await upsert('categories', categories);

  // ── 4. products ───────────────────────────────────────────────────────────
  const products = queryAll(db, 'SELECT * FROM products').map((r) => ({
    id:                r.id,
    title:             r.title,
    slug:              r.slug,
    category_id:       r.category_id,
    category_name:     r.category_name,
    price:             Number(r.price),
    discount_price:    r.discount_price != null ? Number(r.discount_price) : null,
    stock:             Number(r.stock ?? 10),
    fabric:            r.fabric ?? null,
    embroidery:        r.embroidery ?? null,
    color:             r.color ?? null,
    sizes_json:        r.sizes_json ?? '[]',
    description:       r.description ?? '',
    care_instructions: r.care_instructions ?? null,
    images_json:       r.images_json ?? '[]',
    rating:            Number(r.rating ?? 4.8),
    review_count:      Number(r.review_count ?? 0),
    is_featured:       normBool(r.is_featured),
    is_new_arrival:    normBool(r.is_new_arrival),
    display_order:     Number(r.display_order ?? 0),
    created_at:        normTs(r.created_at),
    updated_at:        normTs(r.updated_at)
  }));
  await upsert('products', products);

  // ── 5. product_images ─────────────────────────────────────────────────────
  const productImages = queryAll(db, 'SELECT * FROM product_images').map((r) => ({
    id:            r.id,
    product_id:    r.product_id,
    image_url:     r.image_url,
    display_order: Number(r.display_order ?? 0),
    is_cover:      normBool(r.is_cover),
    view_type:     r.view_type ?? 'gallery',
    alt_text:      r.alt_text ?? null,
    created_at:    normTs(r.created_at),
    updated_at:    normTs(r.updated_at)
  }));
  await upsert('product_images', productImages);

  // ── 6. reviews ────────────────────────────────────────────────────────────
  const reviews = queryAll(db, 'SELECT * FROM reviews').map((r) => ({
    id:                r.id,
    product_id:        r.product_id,
    user_name:         r.user_name,
    rating:            Number(r.rating),
    comment:           r.comment,
    verified_purchase: normBool(r.verified_purchase),
    created_at:        normTs(r.created_at)
  }));
  await upsert('reviews', reviews);

  // ── 7. addresses ──────────────────────────────────────────────────────────
  const addresses = queryAll(db, 'SELECT * FROM addresses').map((r) => ({
    id:            r.id,
    user_id:       r.user_id,
    full_name:     r.full_name,
    phone:         r.phone,
    address_line1: r.address_line1,
    address_line2: r.address_line2 ?? null,
    landmark:      r.landmark ?? null,
    city:          r.city,
    state:         r.state,
    pincode:       r.pincode,
    is_default:    normBool(r.is_default),
    created_at:    normTs(r.created_at)
  }));
  await upsert('addresses', addresses);

  // ── 8. orders ─────────────────────────────────────────────────────────────
  const orders = queryAll(db, 'SELECT * FROM orders').map((r) => ({
    id:                      r.id,
    order_number:            r.order_number,
    tracking_id:             r.tracking_id,
    user_id:                 r.user_id ?? null,
    customer_name:           r.customer_name,
    customer_email:          r.customer_email,
    customer_phone:          r.customer_phone,
    shipping_address_json:   r.shipping_address_json,
    subtotal:                Number(r.subtotal),
    gst_amount:              Number(r.gst_amount),
    discount_amount:         Number(r.discount_amount ?? 0),
    delivery_fee:            Number(r.delivery_fee ?? 0),
    grand_total:             Number(r.grand_total),
    coupon_code:             r.coupon_code ?? null,
    payment_method:          r.payment_method,
    payment_status:          r.payment_status,
    order_status:            r.order_status,
    courier_name:            r.courier_name ?? 'Blue Dart Apex Luxury',
    estimated_delivery_date: r.estimated_delivery_date,
    created_at:              normTs(r.created_at),
    updated_at:              normTs(r.updated_at)
  }));
  await upsert('orders', orders);

  // ── 9. order_items ────────────────────────────────────────────────────────
  const orderItems = queryAll(db, 'SELECT * FROM order_items').map((r) => ({
    id:                  r.id,
    order_id:            r.order_id,
    product_id:          r.product_id,
    product_title:       r.product_title,
    product_image:       r.product_image,
    product_description: r.product_description ?? null,
    size:                r.size,
    color:               r.color,
    quantity:            Number(r.quantity),
    unit_price:          Number(r.unit_price),
    total_price:         Number(r.total_price)
  }));
  await upsert('order_items', orderItems);

  // ── 10. payments ──────────────────────────────────────────────────────────
  const payments = queryAll(db, 'SELECT * FROM payments').map((r) => ({
    id:             r.id,
    order_id:       r.order_id,
    payment_method: r.payment_method,
    transaction_id: r.transaction_id,
    gateway_ref:    r.gateway_ref ?? null,
    amount:         Number(r.amount),
    status:         r.status,
    paid_at:        normTs(r.paid_at)
  }));
  await upsert('payments', payments);

  // ── 11. order_status_history ──────────────────────────────────────────────
  const statusHistory = queryAll(db, 'SELECT * FROM order_status_history').map((r) => ({
    id:         r.id,
    order_id:   r.order_id,
    status:     r.status,
    notes:      r.notes ?? null,
    updated_by: r.updated_by ?? 'System',
    date_str:   r.date_str,
    time_str:   r.time_str,
    created_at: normTs(r.created_at)
  }));
  await upsert('order_status_history', statusHistory);

  // ── 12. notifications ─────────────────────────────────────────────────────
  const notifications = queryAll(db, 'SELECT * FROM notifications').map((r) => ({
    id:         r.id,
    user_id:    r.user_id ?? null,
    order_id:   r.order_id ?? null,
    title:      r.title,
    message:    r.message,
    type:       r.type,
    is_read:    normBool(r.is_read),
    created_at: normTs(r.created_at)
  }));
  await upsert('notifications', notifications);

  // ── 13. coupons ───────────────────────────────────────────────────────────
  const coupons = queryAll(db, 'SELECT * FROM coupons').map((r) => ({
    id:             r.id,
    code:           r.code,
    discount_type:  r.discount_type,
    discount_value: Number(r.discount_value),
    min_spend:      Number(r.min_spend ?? 0),
    max_discount:   r.max_discount != null ? Number(r.max_discount) : null,
    is_active:      normBool(r.is_active),
    usage_count:    Number(r.usage_count ?? 0),
    expiry_date:    r.expiry_date ?? null
  }));
  await upsert('coupons', coupons);

  // ── 14. inventory ─────────────────────────────────────────────────────────
  const inventory = queryAll(db, 'SELECT * FROM inventory').map((r) => ({
    id:                  r.id,
    product_id:          r.product_id,
    sku:                 r.sku,
    size:                r.size,
    stock_quantity:      Number(r.stock_quantity ?? 10),
    low_stock_threshold: Number(r.low_stock_threshold ?? 3),
    last_restocked_at:   normTs(r.last_restocked_at)
  }));
  await upsert('inventory', inventory);

  // ── 15. banners ───────────────────────────────────────────────────────────
  const banners = queryAll(db, 'SELECT * FROM banners').map((r) => ({
    id:               r.id,
    title:            r.title ?? '',
    subtitle:         r.subtitle ?? '',
    description:      r.description ?? '',
    image_url:        r.image_url,
    mobile_image_url: r.mobile_image_url ?? '',
    button_text:      r.button_text ?? '',
    button_link:      r.button_link ?? '',
    tag:              r.tag ?? '',
    category_id:      r.category_id ?? '',
    display_order:    Number(r.display_order ?? 0),
    is_active:        normBool(r.is_active),
    created_at:       normTs(r.created_at),
    updated_at:       normTs(r.updated_at)
  }));
  await upsert('banners', banners);

  // ── 16. editorial_strips ──────────────────────────────────────────────────
  let editorialRows: any[] = [];
  try {
    editorialRows = queryAll(db, 'SELECT * FROM editorial_strips');
  } catch {
    // Table may not exist in older DB snapshots
  }
  const editorialStrips = editorialRows.map((r) => ({
    id:            r.id,
    image_url:     r.image_url,
    label:         r.label ?? '',
    subtitle:      r.subtitle ?? '',
    category_id:   r.category_id ?? '',
    display_order: Number(r.display_order ?? 0),
    is_active:     normBool(r.is_active),
    created_at:    normTs(r.created_at),
    updated_at:    normTs(r.updated_at)
  }));
  await upsert('editorial_strips', editorialStrips);

  // ── 17. app_migrations ────────────────────────────────────────────────────
  let appMigRows: any[] = [];
  try {
    appMigRows = queryAll(db, 'SELECT * FROM app_migrations');
  } catch {
    // May not exist in very old DB snapshots
  }
  const appMigrations = appMigRows.map((r) => ({
    id:         r.id,
    applied_at: normTs(r.applied_at) || new Date().toISOString()
  }));
  await upsert('app_migrations', appMigrations);

  // ── 18. cart & cart_items (best-effort) ───────────────────────────────────
  let cartRows: any[] = [];
  let cartItemRows: any[] = [];
  try {
    cartRows = queryAll(db, 'SELECT * FROM cart');
    cartItemRows = queryAll(db, 'SELECT * FROM cart_items');
  } catch {
    // Cart data is ephemeral — skip gracefully
  }

  if (cartRows.length > 0) {
    const carts = cartRows.map((r) => ({
      id:         r.id,
      user_id:    r.user_id ?? null,
      session_id: r.session_id,
      updated_at: normTs(r.updated_at)
    }));
    await upsert('cart', carts);
  }

  if (cartItemRows.length > 0) {
    const cartItems = cartItemRows.map((r) => ({
      id:         r.id,
      cart_id:    r.cart_id,
      product_id: r.product_id,
      size:       r.size,
      color:      r.color,
      quantity:   Number(r.quantity),
      price:      Number(r.price),
      created_at: normTs(r.created_at)
    }));
    await upsert('cart_items', cartItems);
  }

  db.close();

  // ── Row count verification ─────────────────────────────────────────────────
  console.log('\n── Verification row counts in Supabase ──────────────────────');
  const tables = [
    'users', 'admin_users', 'categories', 'products', 'product_images',
    'reviews', 'addresses', 'orders', 'order_items', 'payments',
    'order_status_history', 'notifications', 'coupons', 'inventory',
    'banners', 'editorial_strips'
  ];

  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    if (error) {
      console.log(`  ✗  ${table}: error — ${error.message}`);
    } else {
      console.log(`  ✓  ${table}: ${count} rows`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(' ✅  Migration complete! All data is now in Supabase.');
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log('Next steps:');
  console.log('  1. Verify the row counts above match your SQLite data.');
  console.log('  2. Run the app in dev mode against Supabase to confirm it works.');
  console.log('  3. Deploy to Vercel and set env vars in the Vercel dashboard.');
  console.log('  4. Keep data/royals.sqlite as a backup — do not delete yet.\n');
}

main().catch((err) => {
  console.error('\n❌  Migration failed:', err);
  process.exit(1);
});
