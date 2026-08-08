/**
 * seed-catalog-images.ts
 *
 * One-time (idempotent) script that:
 *  1. Copies every royals-garment-XX.jpeg from public/images/catalog/ into
 *     public/uploads/<productId>/ (the permanent uploads directory).
 *  2. Ensures a product row exists in the DB for every garment (01–76).
 *     - Garments 01–21: map to the existing prod_boutique_XX rows seeded by db.ts.
 *     - Garments 22–76: new product rows are inserted via INSERT OR IGNORE.
 *  3. Inserts rows into product_images (INSERT OR IGNORE = safe to re-run).
 *  4. Updates products.images_json to stay in sync.
 *
 * Run with:  npx tsx scripts/seed-catalog-images.ts
 */

import fs from 'fs';
import path from 'path';
import { getDb, persistDb } from '../server/db.js';

// ── Catalog metadata ──────────────────────────────────────────────────────
// 76 garments. Each entry: [garmentNumber, title, color, embroidery, category_id]
const CATALOG: [number, string, string, string, string][] = [
  // 01–21: these map to existing prod_boutique_01 … prod_boutique_21
  [1, 'Teal Maroon Heritage Kurta Set', 'Teal & Maroon', 'Resham accent work', 'cat_womens_kurtas'],
  [2, 'Ivory Floral Embroidered Anarkali Set', 'Ivory & Rose', 'Floral thread embroidery', 'cat_anarkali_kurtas'],
  [3, 'Olive Rose Garden Kurta Set', 'Olive & Pink', 'Floral thread embroidery', 'cat_womens_kurtas'],
  [4, 'Teal Mustard Dupatta Kurta Set', 'Teal & Mustard', 'Geometric motif embroidery', 'cat_womens_kurtas'],
  [5, 'Forest Green Mirror Work Kurta', 'Forest Green', 'Mirror and block-print yoke', 'cat_womens_kurtas'],
  [6, 'Black Maroon Printed Kurta Set', 'Black & Maroon', 'Printed border detailing', 'cat_womens_kurtas'],
  [7, 'Magenta Floral Dupatta Kurta Set', 'Magenta', 'All-over floral print', 'cat_womens_kurtas'],
  [8, 'Wine Ajrakh Dupatta Kurta Set', 'Wine', 'Ajrakh-inspired yoke and dupatta', 'cat_womens_kurtas'],
  [9, 'Rust Brown Embroidered Kurta Set', 'Rust Brown', 'Mirror and leaf embroidery', 'cat_womens_kurtas'],
  [10, 'Mustard Teal Printed Kurta Set', 'Teal & Mustard', 'Paisley print', 'cat_womens_kurtas'],
  [11, 'Plum Diamond Motif Kurta Set', 'Plum', 'Diamond thread embroidery', 'cat_womens_kurtas'],
  [12, 'Crimson Black Dupatta Kurta Set', 'Crimson & Black', 'Contrast border print', 'cat_womens_kurtas'],
  [13, 'Navy Floral Tiered Kurta', 'Navy Blue', 'Floral print', 'cat_anarkali_kurtas'],
  [14, 'Midnight Floral Kurta Set', 'Midnight Blue', 'Floral yoke and border embroidery', 'cat_womens_kurtas'],
  [15, 'Black Mustard Block Print Kurta Set', 'Black & Mustard', 'Hand block print', 'cat_womens_kurtas'],
  [16, 'Olive Rust Yoke Kurta Set', 'Olive & Rust', 'Geometric yoke embroidery', 'cat_womens_kurtas'],
  [17, 'Ivory Garden Embroidered Anarkali', 'Ivory & Berry', 'Floral embroidery', 'cat_anarkali_kurtas'],
  [18, 'Ivory Garden Embroidered Anarkali Detail', 'Ivory & Berry', 'Floral embroidery', 'cat_anarkali_kurtas'],
  [19, 'White Multi-Floral Kurta Set', 'White & Multicolor', 'Floral applique work', 'cat_womens_kurtas'],
  [20, 'Navy Mustard Border Kurta Set', 'Navy & Mustard', 'Embroidered neckline', 'cat_womens_kurtas'],
  [21, 'Turquoise Maroon Kurta Set', 'Turquoise & Maroon', 'Sun motif embroidery', 'cat_womens_kurtas'],
  // 22–76: new products
  [22, 'Lime Yellow Dupatta Kurta Set', 'Lime Yellow', 'Minimal geometric print', 'cat_womens_kurtas'],
  [23, 'Peach Floral Block Print Kurta Set', 'Peach & Orange', 'Block print floral', 'cat_womens_kurtas'],
  [24, 'Sky Blue Embroidered Kurta Set', 'Sky Blue', 'Yoke embroidery with sequins', 'cat_womens_kurtas'],
  [25, 'Purple Ikat Kurta Set', 'Purple', 'Ikat weave', 'cat_womens_kurtas'],
  [26, 'Maroon Heritage Block Print Set', 'Maroon', 'Heritage block print', 'cat_womens_kurtas'],
  [27, 'Dark Teal Geometric Kurta Set', 'Dark Teal', 'Geometric woven motifs', 'cat_womens_kurtas'],
  [28, 'Dusty Pink Rose Kurta Set', 'Dusty Pink', 'Rose embroidery', 'cat_womens_kurtas'],
  [29, 'Crimson Floral Anarkali Set', 'Crimson', 'Floral embroidery', 'cat_anarkali_kurtas'],
  [30, 'Bottle Green Zari Kurta Set', 'Bottle Green', 'Zari border work', 'cat_womens_kurtas'],
  [31, 'Coral Orange Embroidered Set', 'Coral Orange', 'Neck and sleeve embroidery', 'cat_womens_kurtas'],
  [32, 'Lavender Chikankari Kurta Set', 'Lavender', 'Chikankari thread work', 'cat_womens_kurtas'],
  [33, 'Khaki Floral Kurta Set', 'Khaki', 'Floral motif embroidery', 'cat_womens_kurtas'],
  [34, 'Olive Ikat Dupatta Set', 'Olive', 'Ikat pattern', 'cat_womens_kurtas'],
  [35, 'Navy Banarasi Anarkali Set', 'Navy Blue', 'Banarasi weave', 'cat_anarkali_kurtas'],
  [36, 'Coral Ajrakh Kurta Set', 'Coral', 'Ajrakh block print', 'cat_womens_kurtas'],
  [37, 'Dark Brown Floral Embroidered Set', 'Dark Brown', 'Floral embroidery', 'cat_womens_kurtas'],
  [38, 'Teal Gold Paisley Kurta Set', 'Teal & Gold', 'Paisley block print', 'cat_womens_kurtas'],
  [39, 'Wine Mirror Work Anarkali Set', 'Wine', 'Mirror work', 'cat_anarkali_kurtas'],
  [40, 'Indigo Bandhani Kurta Set', 'Indigo', 'Bandhani tie-dye', 'cat_womens_kurtas'],
  [41, 'Forest Green Zari Anarkali', 'Forest Green', 'Zari embroidery', 'cat_anarkali_kurtas'],
  [42, 'Mauve Palazzo Kurta Set', 'Mauve', 'Gota patti trim', 'cat_womens_kurtas'],
  [43, 'Rust Ikat Dupatta Set', 'Rust', 'Ikat weave', 'cat_womens_kurtas'],
  [44, 'Pink Chikankari Anarkali', 'Pink', 'Chikankari thread work', 'cat_anarkali_kurtas'],
  [45, 'Plum Gold Brocade Kurta Set', 'Plum & Gold', 'Brocade weave', 'cat_womens_kurtas'],
  [46, 'Maroon Mukaish Kurta Set', 'Maroon', 'Mukaish badla work', 'cat_womens_kurtas'],
  [47, 'Teal Embroidered Cotton Set', 'Teal', 'Cotton thread embroidery', 'cat_womens_kurtas'],
  [48, 'Olive Cotton Floral Set', 'Olive', 'Floral print', 'cat_womens_kurtas'],
  [49, 'Navy Sequin Kurta Set', 'Navy Blue', 'Sequin work neckline', 'cat_womens_kurtas'],
  [50, 'Dark Green Woven Kurta Set', 'Dark Green', 'Woven geometric border', 'cat_womens_kurtas'],
  [51, 'Burgundy Anarkali Lehenga', 'Burgundy', 'Zardozi & sequin work', 'cat_anarkali_kurtas'],
  [52, 'Pastel Pink Floral Anarkali', 'Pastel Pink', 'Floral embroidery', 'cat_anarkali_kurtas'],
  [53, 'Teal Floral Block Print Set', 'Teal', 'Block print', 'cat_womens_kurtas'],
  [54, 'Brown Gold Motif Kurta Set', 'Brown & Gold', 'Woven motif border', 'cat_womens_kurtas'],
  [55, 'Purple Phulkari Dupatta Set', 'Purple', 'Phulkari embroidery', 'cat_womens_kurtas'],
  [56, 'Sage Green Kurta Set', 'Sage Green', 'Minimal embroidery', 'cat_womens_kurtas'],
  [57, 'Red Bandhani Kurta Set', 'Red', 'Bandhani tie-dye', 'cat_womens_kurtas'],
  [58, 'Midnight Blue Floral Set', 'Midnight Blue', 'Floral block print', 'cat_womens_kurtas'],
  [59, 'Black Ajrakh Printed Set', 'Black', 'Ajrakh block print', 'cat_womens_kurtas'],
  [60, 'Coral Embroidered Anarkali', 'Coral', 'Thread embroidery', 'cat_anarkali_kurtas'],
  [61, 'Maroon Woven Cotton Set', 'Maroon', 'Woven cotton motif', 'cat_womens_kurtas'],
  [62, 'Peacock Blue Kurta Set', 'Peacock Blue', 'Peacock motif embroidery', 'cat_womens_kurtas'],
  [63, 'Ivory Resham Kurta Set', 'Ivory', 'Resham thread embroidery', 'cat_womens_kurtas'],
  [64, 'Emerald Cotton Kurta Set', 'Emerald', 'Geometric print', 'cat_womens_kurtas'],
  [65, 'Mustard Kalamkari Kurta Set', 'Mustard', 'Kalamkari print', 'cat_womens_kurtas'],
  [66, 'Fuschia Mirror Dupatta Set', 'Fuschia', 'Mirror work', 'cat_womens_kurtas'],
  [67, 'Beige Gota Kurta Set', 'Beige', 'Gota patti trim', 'cat_womens_kurtas'],
  [68, 'Rose Pink Anarkali Lehenga', 'Rose Pink', 'Zardozi embroidery', 'cat_anarkali_kurtas'],
  [69, 'Dark Red Heritage Kurta Set', 'Dark Red', 'Heritage block print', 'cat_womens_kurtas'],
  [70, 'Olive Yellow Ikat Kurta Set', 'Olive Yellow', 'Ikat weave', 'cat_womens_kurtas'],
  [71, 'Light Purple Embroidered Set', 'Light Purple', 'Thread embroidery', 'cat_womens_kurtas'],
  [72, 'Black Gold Printed Set', 'Black & Gold', 'Gold foil print', 'cat_womens_kurtas'],
  [73, 'Brick Red Floral Kurta Set', 'Brick Red', 'Floral print', 'cat_womens_kurtas'],
  [74, 'Deep Blue Bandhani Set', 'Deep Blue', 'Bandhani tie-dye', 'cat_womens_kurtas'],
  [75, 'Sage Floral Embroidered Set', 'Sage Green', 'Floral embroidery', 'cat_womens_kurtas'],
  [76, 'Teal Paisley Embroidered Set', 'Teal', 'Paisley embroidery', 'cat_womens_kurtas'],
];

function queryAll(db: any, sql: string, params: any[] = []) {
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const results: any[] = [];
  while (stmt.step()) results.push(stmt.getAsObject());
  stmt.free();
  return results;
}

function buildSlug(title: string, suffix: string): string {
  return title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + suffix;
}

async function main() {
  const db = await getDb();

  const CATALOG_SRC = path.join(process.cwd(), 'public', 'images', 'catalog');
  const UPLOADS_BASE = path.join(process.cwd(), 'public', 'uploads');
  const now = new Date().toISOString();

  let copied = 0;
  let seeded = 0;
  let skipped = 0;

  for (const [num, title, color, embroidery, categoryId] of CATALOG) {
    const garmentNum = String(num).padStart(2, '0');
    const srcFilename = `royals-garment-${garmentNum}.jpeg`;
    const srcPath = path.join(CATALOG_SRC, srcFilename);

    if (!fs.existsSync(srcPath)) {
      console.warn(`  ⚠  Source file not found: ${srcFilename}, skipping.`);
      skipped++;
      continue;
    }

    // Determine product ID
    const productId = num <= 21
      ? `prod_boutique_${garmentNum}`
      : `prod_boutique_${garmentNum}`;

    // Ensure product row exists (INSERT OR IGNORE for safety)
    const exists = queryAll(db, 'SELECT id FROM products WHERE id = ? LIMIT 1', [productId]);
    if (exists.length === 0) {
      const slug = buildSlug(title, garmentNum);
      const price = 500 + ((num % 6) * 100);
      const displayOrder = 100 + num;
      db.run(
        `INSERT OR IGNORE INTO products (
          id, title, slug, category_id, category_name, price, discount_price, stock,
          fabric, embroidery, color, sizes_json, description, care_instructions,
          images_json, rating, review_count, is_featured, is_new_arrival,
          display_order, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          productId, title, slug, categoryId, "Designer Women's Kurta Sets",
          price, 10, 'Comfortable blended cotton', embroidery, color,
          JSON.stringify(['S', 'M', 'L', 'XL', 'XXL']),
          `${title}, curated for the Lucknow Chikan Emporium boutique collection.`,
          'Gentle hand wash or dry clean as preferred.',
          JSON.stringify([]),
          4.8, 0,
          num <= 8 ? 1 : 0,
          num <= 6 ? 1 : 0,
          displayOrder, now, now
        ]
      );
      console.log(`  ✦  Created product ${productId}`);
    }

    // Ensure uploads directory exists for this product
    const uploadDir = path.join(UPLOADS_BASE, productId);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Copy image file into uploads (overwrite = always keep latest)
    const destFilename = `garment-${garmentNum}.jpeg`;
    const destPath = path.join(uploadDir, destFilename);
    fs.copyFileSync(srcPath, destPath);
    copied++;

    const publicUrl = `/uploads/${productId}/${destFilename}`;
    const imgId = `pimg_boutique_${garmentNum}_seed`;

    // Insert into product_images (INSERT OR REPLACE = idempotent)
    db.run(
      `INSERT OR REPLACE INTO product_images
         (id, product_id, image_url, display_order, is_cover, view_type, alt_text, created_at, updated_at)
       VALUES (?, ?, ?, 0, 1, 'gallery', ?, ?, ?)`,
      [imgId, productId, publicUrl, title, now, now]
    );
    seeded++;

    // Sync images_json on the product row
    db.run(
      'UPDATE products SET images_json = ?, updated_at = ? WHERE id = ?',
      [JSON.stringify([publicUrl]), now, productId]
    );

    console.log(`  ✓  ${srcFilename} → ${publicUrl}`);
  }

  persistDb();

  console.log('\n══════════════════════════════════════════════════');
  console.log(`  ROYALS Catalog Image Seed Complete`);
  console.log(`  Files copied  : ${copied}`);
  console.log(`  DB rows seeded: ${seeded}`);
  console.log(`  Skipped       : ${skipped}`);
  console.log('══════════════════════════════════════════════════\n');
}

main().catch((err) => {
  console.error('Seed script failed:', err);
  process.exit(1);
});
