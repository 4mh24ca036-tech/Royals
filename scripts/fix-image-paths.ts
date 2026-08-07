/**
 * fix-image-paths.ts
 *
 * One-time fix for the live SQLite DB:
 *  1. Updates 6 category image_url values to remove timestamp suffixes
 *  2. Updates 8 hero product images_json values to remove timestamp suffixes
 *  3. Fixes product_images rows for those 8 products
 *
 * Run with: npx tsx scripts/fix-image-paths.ts
 */

import { getDb, persistDb } from '../server/db.js';

function queryAll(db: any, sql: string, params: any[] = []) {
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const rows: any[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

const db = await getDb();
const now = new Date().toISOString();

// ── 1. Fix category image_url ─────────────────────────────────────────────
const catFixes: [string, string][] = [
  ['cat_mens_kurtas',          '/images/mens_raw_silk_kurta.jpg'],
  ['cat_womens_kurtas',        '/images/women_chikankari_kurta.jpg'],
  ['cat_anarkali_kurtas',      '/images/emerald_anarkali_kurta.jpg'],
  ['cat_bandhgala_kurtas',     '/images/midnight_bandhgala_kurta.jpg'],
  ['cat_bridal_lehengas',      '/images/kurta_chanderi_sharara.jpg'],
  ['cat_heritage_accessories', '/images/kurta_jaipur_angrakha.jpg']
];

for (const [id, url] of catFixes) {
  db.run('UPDATE categories SET image_url = ? WHERE id = ?', [url, id]);
  console.log(`  cat  ${id} -> ${url}`);
}

// ── 2. Fix 8 hero product images_json ────────────────────────────────────
const prodFixes: [string, string[]][] = [
  ['prod_raw_silk_kurta_set',       ['/images/mens_raw_silk_kurta.jpg',      '/images/hero_royal_kurtas.jpg']],
  ['prod_chikankari_mukaish_kurta', ['/images/women_chikankari_kurta.jpg',   '/images/kurta_chanderi_sharara.jpg']],
  ['prod_midnight_bandhgala_kurta', ['/images/midnight_bandhgala_kurta.jpg', '/images/kurta_nehru_jacket_set.jpg']],
  ['prod_emerald_anarkali_kurta',   ['/images/emerald_anarkali_kurta.jpg',   '/images/women_chikankari_kurta.jpg']],
  ['prod_jaipur_angrakha_kurta',    ['/images/kurta_jaipur_angrakha.jpg',    '/images/hero_royal_kurtas.jpg']],
  ['prod_chanderi_sharara_kurta',   ['/images/kurta_chanderi_sharara.jpg',   '/images/women_chikankari_kurta.jpg']],
  ['prod_nehru_jacket_kurta_set',   ['/images/kurta_nehru_jacket_set.jpg',   '/images/mens_raw_silk_kurta.jpg']],
  ['prod_padmavati_kurta_lehenga',  ['/images/hero_royal_kurtas.jpg',        '/images/emerald_anarkali_kurta.jpg']]
];

for (const [id, imgs] of prodFixes) {
  db.run('UPDATE products SET images_json = ?, updated_at = ? WHERE id = ?',
    [JSON.stringify(imgs), now, id]);
  console.log(`  prod ${id}`);
}

// ── 3. Fix product_images table for those 8 products ─────────────────────
for (const [id, imgs] of prodFixes) {
  // Remove any old broken rows (those containing timestamp fragments)
  const existing = queryAll(db, 'SELECT id, image_url FROM product_images WHERE product_id = ?', [id]);
  for (const row of existing) {
    const url = row.image_url as string;
    // If URL contains a timestamp suffix pattern, remove it
    if (url && (url.match(/_\d{13}\./) || url.startsWith('data:'))) {
      db.run('DELETE FROM product_images WHERE id = ?', [row.id]);
    }
  }

  // Upsert correct rows
  imgs.forEach((url, idx) => {
    const imgId = `pimg_hero_${id}_${idx}`;
    db.run(
      `INSERT OR REPLACE INTO product_images
         (id, product_id, image_url, display_order, is_cover, view_type, alt_text, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'gallery', NULL, ?, ?)`,
      [imgId, id, url, idx, idx === 0 ? 1 : 0, now, now]
    );
  });
  console.log(`  pimg ${id}`);
}

persistDb();

// ── 4. Verify ─────────────────────────────────────────────────────────────
console.log('\n=== Verification ===');
const cats = queryAll(db, 'SELECT id, image_url FROM categories ORDER BY display_order');
cats.forEach(c => console.log(`  cat  ${c.id}: ${c.image_url}`));

const prods = queryAll(db, `SELECT id, images_json FROM products WHERE id LIKE 'prod_raw_%' OR id LIKE 'prod_chika%' OR id LIKE 'prod_midnight%' LIMIT 3`);
prods.forEach(p => console.log(`  prod ${p.id}: ${p.images_json}`));

console.log('\nDone. Database fixed and persisted.');
process.exit(0);
