/**
 * Cloudinary Image Migration Execution Script
 * 
 * This script:
 * 1. Counts all local images in /public/uploads/prod_boutique_XX/
 * 2. Uploads each to Cloudinary
 * 3. Verifies all URLs are valid and stored in database
 * 4. Generates detailed migration report
 * 5. Confirms no products lost images
 */

import fs from 'fs';
import path from 'path';
import initSqlJs, { Database } from 'sql.js';
import { CloudinaryService } from '../server/services/cloudinary.js';
import { ImageManagementService } from '../server/services/imageService.js';

interface MigrationStats {
  totalImagesOnDisk: number;
  totalProductsWithImages: number;
  migratedCount: number;
  failedCount: number;
  alreadyMigratedCount: number;
  productsWithoutImages: string[];
  productsWithAllImages: string[];
  failedImages: Array<{ product: string; file: string; error: string }>;
  cloudinaryUrls: string[];
}

const stats: MigrationStats = {
  totalImagesOnDisk: 0,
  totalProductsWithImages: 0,
  migratedCount: 0,
  failedCount: 0,
  alreadyMigratedCount: 0,
  productsWithoutImages: [],
  productsWithAllImages: [],
  failedImages: [],
  cloudinaryUrls: []
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

function queryOne(db: Database, sql: string, params: any[] = []): any {
  return queryAll(db, sql, params)[0] || null;
}

function execute(db: Database, sql: string, params: any[] = []): void {
  db.run(sql, params);
}

async function migrateImages(db: Database): Promise<void> {
  const uploadsBase = path.join(process.cwd(), 'public', 'uploads');
  const cloudinary = new CloudinaryService();

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  ROYALS IMAGE MIGRATION TO CLOUDINARY');
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (!fs.existsSync(uploadsBase)) {
    console.error('❌ Uploads directory not found:', uploadsBase);
    return;
  }

  // Scan all product directories
  const productDirs = fs.readdirSync(uploadsBase)
    .filter(f => fs.statSync(path.join(uploadsBase, f)).isDirectory())
    .sort();

  console.log(`📁 Found ${productDirs.length} product directories\n`);

  // First pass: count all local images
  console.log('📊 COUNTING LOCAL IMAGES...');
  for (const dir of productDirs) {
    const dirPath = path.join(uploadsBase, dir);
    const imageFiles = fs.readdirSync(dirPath)
      .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
    stats.totalImagesOnDisk += imageFiles.length;
  }
  console.log(`✓ Total images on disk: ${stats.totalImagesOnDisk}\n`);

  // Second pass: migrate images
  console.log('🚀 MIGRATING IMAGES TO CLOUDINARY...\n');

  for (const productDir of productDirs) {
    const dirPath = path.join(uploadsBase, productDir);
    const imageFiles = fs.readdirSync(dirPath)
      .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
      .sort();

    if (imageFiles.length === 0) {
      stats.productsWithoutImages.push(productDir);
      continue;
    }

    stats.totalProductsWithImages++;
    let productMigratedCount = 0;
    const productId = productDir;

    // Verify product exists
    const product = queryOne(db, 'SELECT id, title FROM products WHERE id = ?', [productId]);
    if (!product) {
      console.warn(`⚠️  Product not found in DB: ${productId}`);
      stats.productsWithoutImages.push(productId);
      continue;
    }

    for (const imageFile of imageFiles) {
      const imagePath = path.join(dirPath, imageFile);

      try {
        // Check if already migrated
        const existing = queryOne(
          db,
          'SELECT id, image_url FROM product_images WHERE product_id = ? AND image_url LIKE ?',
          [productId, `%cloudinary%${path.basename(imageFile)}%`]
        );

        if (existing && existing.image_url.includes('cloudinary.com')) {
          console.log(`  ⊘ Already migrated: ${imageFile}`);
          stats.alreadyMigratedCount++;
          productMigratedCount++;
          stats.cloudinaryUrls.push(existing.image_url);
          continue;
        }

        // Read file and upload
        const fileBuffer = fs.readFileSync(imagePath);
        const response = await cloudinary.uploadImage(
          fileBuffer,
          imageFile,
          `royals/products/${productId}`
        );

        // Store in database
        const imageId = `pimg_${productId}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const now = new Date().toISOString();

        const existingImage = queryOne(
          db,
          'SELECT id FROM product_images WHERE product_id = ? AND image_url LIKE ?',
          [productId, `%uploads/${productId}%`]
        );

        if (existingImage) {
          // Update existing local image URL to Cloudinary URL
          execute(
            db,
            'UPDATE product_images SET image_url = ?, updated_at = ? WHERE id = ?',
            [response.secure_url, now, existingImage.id]
          );
        } else {
          // Insert new product_images record
          execute(
            db,
            `INSERT INTO product_images
               (id, product_id, image_url, display_order, is_cover, view_type, alt_text, created_at, updated_at)
             VALUES (?, ?, ?, ?, 0, 'gallery', ?, ?, ?)`,
            [imageId, productId, response.secure_url, 0, imageFile, now, now]
          );
        }

        stats.migratedCount++;
        productMigratedCount++;
        stats.cloudinaryUrls.push(response.secure_url);

        console.log(`  ✓ ${imageFile} → ${response.secure_url.substring(0, 80)}...`);
      } catch (error: any) {
        stats.failedCount++;
        stats.failedImages.push({
          product: productId,
          file: imageFile,
          error: error.message
        });
        console.error(`  ✗ Failed: ${imageFile} - ${error.message}`);
      }
    }

    if (productMigratedCount === imageFiles.length) {
      stats.productsWithAllImages.push(productId);
    }
  }

  // Save database
  const dbData = db.export();
  const buffer = Buffer.from(dbData);
  const dbPath = path.join(process.cwd(), 'data', 'royals.sqlite');
  fs.writeFileSync(dbPath, buffer);
  console.log('\n✓ Database persisted\n');
}

async function verifyMigration(db: Database): Promise<void> {
  console.log('\n✅ VERIFYING MIGRATION...\n');

  // Check all product_images have valid URLs
  const allImages = queryAll(
    db,
    'SELECT id, product_id, image_url FROM product_images ORDER BY product_id, display_order'
  );

  let validUrls = 0;
  let invalidUrls = 0;

  for (const img of allImages) {
    if (img.image_url.includes('cloudinary.com')) {
      validUrls++;
    } else if (img.image_url.includes('/uploads/')) {
      console.warn(`  ⚠️  Still using local path: ${img.image_url}`);
      invalidUrls++;
    } else {
      console.error(`  ❌ Invalid URL format: ${img.image_url}`);
      invalidUrls++;
    }
  }

  console.log(`  Cloudinary URLs: ${validUrls}`);
  console.log(`  Invalid/Local URLs: ${invalidUrls}`);
  console.log(`  Total images in DB: ${allImages.length}\n`);

  // Check each product has at least one image
  const products = queryAll(
    db,
    `SELECT DISTINCT product_id FROM product_images ORDER BY product_id`
  );

  const productsWithoutCover = [];
  for (const prod of products) {
    const cover = queryOne(
      db,
      'SELECT id FROM product_images WHERE product_id = ? AND is_cover = 1',
      [prod.product_id]
    );
    if (!cover) {
      productsWithoutCover.push(prod.product_id);
    }
  }

  if (productsWithoutCover.length > 0) {
    console.warn(`⚠️  ${productsWithoutCover.length} products have no cover image:`);
    productsWithoutCover.forEach(p => console.warn(`   - ${p}`));
  } else {
    console.log(`✓ All ${products.length} products have cover images\n`);
  }
}

function printReport(): void {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  MIGRATION REPORT');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log('📊 STATISTICS:');
  console.log(`  Total images on disk:        ${stats.totalImagesOnDisk}`);
  console.log(`  Successfully migrated:       ${stats.migratedCount}`);
  console.log(`  Already migrated:            ${stats.alreadyMigratedCount}`);
  console.log(`  Failed migrations:           ${stats.failedCount}`);
  console.log(`  Total product directories:   ${stats.totalProductsWithImages + stats.productsWithoutImages.length}`);
  console.log(`  Products with all images:    ${stats.productsWithAllImages.length}`);
  console.log(`  Products without images:     ${stats.productsWithoutImages.length}`);
  console.log(`  Cloudinary URLs generated:   ${stats.cloudinaryUrls.length}\n`);

  if (stats.productsWithoutImages.length > 0) {
    console.log('⚠️  PRODUCTS WITHOUT IMAGES:');
    stats.productsWithoutImages.forEach(p => console.log(`  - ${p}`));
    console.log();
  }

  if (stats.failedImages.length > 0) {
    console.log('❌ FAILED MIGRATIONS:');
    stats.failedImages.forEach(img => {
      console.log(`  - ${img.product}/${img.file}: ${img.error}`);
    });
    console.log();
  }

  console.log('📝 SAMPLE CLOUDINARY URLS:');
  stats.cloudinaryUrls.slice(0, 5).forEach(url => {
    console.log(`  - ${url}`);
  });
  if (stats.cloudinaryUrls.length > 5) {
    console.log(`  ... and ${stats.cloudinaryUrls.length - 5} more\n`);
  }

  console.log('═══════════════════════════════════════════════════════════════\n');

  // Final status
  if (stats.failedCount === 0 && stats.totalImagesOnDisk > 0) {
    console.log('✅ MIGRATION COMPLETED SUCCESSFULLY\n');
  } else if (stats.failedCount > 0) {
    console.log('⚠️  MIGRATION COMPLETED WITH ERRORS\n');
  } else {
    console.log('ℹ️  NO IMAGES TO MIGRATE\n');
  }
}

async function main() {
  try {
    const db = await initDb();
    await migrateImages(db);
    await verifyMigration(db);
    printReport();
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

main();
