#!/usr/bin/env npx tsx

/**
 * Cleanup: Remove legacy /images/catalog/ paths that are broken
 * These are residual images from the old fallback system.
 * Keep only valid Cloudinary URLs.
 */

import fs from 'fs';
import path from 'path';
import initSqlJs, { Database } from 'sql.js';

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

async function cleanupLegacyImages(): Promise<void> {
  console.log('\n' + '═'.repeat(80));
  console.log('  CLEANUP: Remove Legacy /images/catalog/ Paths');
  console.log('═'.repeat(80) + '\n');

  const db = await initDb();

  // Find all legacy images
  const legacyImages = queryAll(
    db,
    `SELECT id, product_id, image_url FROM product_images 
     WHERE image_url LIKE '/images/catalog/%'`
  );

  console.log(`🔍 Found ${legacyImages.length} legacy image paths\n`);

  if (legacyImages.length === 0) {
    console.log('✅ No legacy images found. Database is clean.\n');
    return;
  }

  // Group by product to show what we're removing
  const byProduct = new Map<string, any[]>();
  for (const img of legacyImages) {
    if (!byProduct.has(img.product_id)) {
      byProduct.set(img.product_id, []);
    }
    byProduct.get(img.product_id)!.push(img);
  }

  console.log('📝 PRODUCTS WITH LEGACY IMAGES:\n');
  for (const [prodId, images] of byProduct.entries()) {
    console.log(`   [${prodId}]`);
    for (const img of images) {
      console.log(`      ✗ ${img.image_url}`);
    }
  }
  console.log();

  // Delete legacy images
  let deleted = 0;
  for (const img of legacyImages) {
    db.run('DELETE FROM product_images WHERE id = ?', [img.id]);
    deleted++;
  }

  // Verify we kept valid images
  const remainingImages = queryAll(
    db,
    `SELECT COUNT(*) as total, 
            COUNT(CASE WHEN is_cover = 1 THEN 1 END) as covers
     FROM product_images`
  );

  console.log('📊 AFTER CLEANUP:\n');
  console.log(`   Deleted: ${deleted} legacy images`);
  console.log(`   Remaining total images: ${remainingImages[0].total}`);
  console.log(`   Cover images: ${remainingImages[0].covers}\n`);

  // Check for products with no images
  const productsWithoutImages = queryAll(
    db,
    `SELECT p.id, p.title FROM products p
     WHERE p.id NOT IN (SELECT DISTINCT product_id FROM product_images)`
  );

  if (productsWithoutImages.length > 0) {
    console.log(`⚠️  ${productsWithoutImages.length} products now have NO images:\n`);
    for (const prod of productsWithoutImages) {
      console.log(`   [${prod.id}] ${prod.title}`);
    }
    console.log();
  }

  // Persist changes
  const buffer = db.export();
  fs.writeFileSync(path.join(process.cwd(), 'data', 'royals.sqlite'), Buffer.from(buffer));

  console.log('═'.repeat(80) + '\n');
  console.log(`✅ Cleanup complete. Database updated.\n`);
}

async function main() {
  try {
    await cleanupLegacyImages();
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
}

main();
