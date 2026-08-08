#!/usr/bin/env npx tsx

/**
 * Task #2: Fix Broken Image URLs
 * 
 * Fixes 7 broken/missing image references:
 * - /images/kurta_chanderi_sharara.jpg (missing)
 * - /images/women_chikankari_kurta.jpg (missing)
 * - /images/hero_royal_kurtas.jpg (missing)
 * - /images/kurta_nehru_jacket_set.jpg (missing)
 * - /images/mens_raw_silk_kurta.jpg (missing)
 * - /images/emerald_anarkali_kurta.jpg (missing)
 * 
 * Strategy:
 * 1. Replace missing /images/*.jpg with valid Cloudinary URLs
 * 2. Keep one valid Cloudinary image per product
 * 3. Remove duplicate broken images
 */

import fs from 'fs';
import path from 'path';
import initSqlJs, { Database } from 'sql.js';

// Mapping of broken images to their replacement Cloudinary URLs
// Use the first/primary image from each product's Cloudinary set
const BROKEN_IMAGE_REPLACEMENTS: Record<string, string> = {
  '/images/kurta_chanderi_sharara.jpg': 'https://res.cloudinary.com/royals-demo/image/upload/v1786111500/royals/products/prod_chanderi_sharara_kurta/garment-06.jpeg',
  '/images/women_chikankari_kurta.jpg': 'https://res.cloudinary.com/royals-demo/image/upload/v1786111500/royals/products/prod_chikankari_mukaish_kurta/garment-chikankari.jpeg',
  '/images/hero_royal_kurtas.jpg': 'https://res.cloudinary.com/royals-demo/image/upload/v1786111500/royals/products/prod_raw_silk_kurta_set/garment-hero.jpeg',
  '/images/kurta_nehru_jacket_set.jpg': 'https://res.cloudinary.com/royals-demo/image/upload/v1786111500/royals/products/prod_nehru_jacket_kurta_set/garment-nehru.jpeg',
  '/images/mens_raw_silk_kurta.jpg': 'https://res.cloudinary.com/royals-demo/image/upload/v1786111500/royals/products/prod_raw_silk_kurta_set/pimg_1786111514293_52413.jpeg',
  '/images/emerald_anarkali_kurta.jpg': 'https://res.cloudinary.com/royals-demo/image/upload/v1786111500/royals/products/prod_emerald_anarkali_kurta/garment-emerald.jpeg'
};

async function initDb(): Promise<Database> {
  const SQL = await initSqlJs();
  const dbPath = path.join(process.cwd(), 'data', 'royals.sqlite');

  if (!fs.existsSync(dbPath)) {
    throw new Error(`Database not found at ${dbPath}`);
  }

  const fileBuffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(fileBuffer);
  return db;
}

function queryAll(db: Database, sql: string, params: any[] = []): any[] {
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const results: any[] = [];
  while (stmt.step()) results.push(stmt.getAsObject());
  stmt.free();
  return results;
}

function execute(db: Database, sql: string, params: any[] = []): void {
  db.run(sql, params);
}

async function fixBrokenImages(): Promise<void> {
  console.log('\n' + '═'.repeat(80));
  console.log('  TASK #2: FIX BROKEN IMAGE URLS');
  console.log('═'.repeat(80) + '\n');

  const db = await initDb();
  const now = new Date().toISOString();

  let fixedCount = 0;
  let deletedCount = 0;

  // Find and fix broken images
  for (const [brokenUrl, replacement] of Object.entries(BROKEN_IMAGE_REPLACEMENTS)) {
    console.log(`\n🔧 Processing: ${brokenUrl}`);
    console.log(`   → Replacement: ${replacement}\n`);

    // Find all records with this broken URL
    const brokenRecords = queryAll(
      db,
      'SELECT id, product_id FROM product_images WHERE image_url = ?',
      [brokenUrl]
    );

    console.log(`   Found ${brokenRecords.length} record(s) with broken URL\n`);

    for (const record of brokenRecords) {
      const productId = record.product_id;

      // Get all images for this product
      const allImages = queryAll(
        db,
        'SELECT id, image_url, is_cover FROM product_images WHERE product_id = ? ORDER BY display_order',
        [productId]
      );

      // Check if product already has a valid Cloudinary image
      const hasValidImage = allImages.some(img => 
        img.image_url.includes('cloudinary') && img.image_url !== brokenUrl
      );

      if (hasValidImage) {
        // Product has a valid image, just delete the broken one
        console.log(`   ✓ Deleting broken image for ${productId} (has valid image)`);
        execute(db, 'DELETE FROM product_images WHERE id = ?', [record.id]);
        deletedCount++;
      } else {
        // Replace with Cloudinary URL
        console.log(`   ✓ Fixing broken image for ${productId} → Cloudinary`);
        execute(
          db,
          'UPDATE product_images SET image_url = ?, updated_at = ? WHERE id = ?',
          [replacement, now, record.id]
        );
        fixedCount++;
      }
    }
  }

  console.log('\n' + '─'.repeat(80));
  console.log(`\n📊 RESULTS:\n`);
  console.log(`  Fixed broken URLs:    ${fixedCount}`);
  console.log(`  Deleted duplicates:   ${deletedCount}\n`);

  // Verify fixes
  console.log('🔍 VERIFYING FIXES...\n');

  const stillBroken = queryAll(
    db,
    'SELECT COUNT(*) as count FROM product_images WHERE image_url IN (' +
    Object.keys(BROKEN_IMAGE_REPLACEMENTS).map(() => '?').join(',') +
    ')',
    Object.keys(BROKEN_IMAGE_REPLACEMENTS)
  );

  const brokenCount = stillBroken[0]?.count || 0;

  if (brokenCount === 0) {
    console.log('✅ All broken images have been fixed!\n');
  } else {
    console.log(`⚠️  ${brokenCount} broken image(s) still remain\n`);
  }

  // Save database
  const dbData = db.export();
  const buffer = Buffer.from(dbData);
  const dbPath = path.join(process.cwd(), 'data', 'royals.sqlite');
  fs.writeFileSync(dbPath, buffer);
  console.log('✓ Database persisted\n');

  console.log('═'.repeat(80) + '\n');
}

async function main() {
  try {
    await fixBrokenImages();
  } catch (error) {
    console.error('❌ Fix failed:', error);
    process.exit(1);
  }
}

main();
