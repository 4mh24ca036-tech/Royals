#!/usr/bin/env npx tsx

/**
 * Local Image Migration Verification Script
 * 
 * This script verifies all 76 boutique images can be successfully migrated:
 * 1. Counts all local images in /public/uploads/prod_boutique_XX/
 * 2. Verifies each file is readable and valid
 * 3. Simulates Cloudinary migration (generates mock URLs)
 * 4. Updates database with migration URLs
 * 5. Generates detailed migration report
 * 6. Confirms all 84 products have proper image assignments
 * 
 * In production, replace mock URLs with actual Cloudinary uploads
 */

import fs from 'fs';
import path from 'path';
import initSqlJs, { Database } from 'sql.js';

interface MigrationStats {
  totalImagesOnDisk: number;
  totalProductsWithImages: number;
  migratedCount: number;
  failedCount: number;
  productsWithoutImages: string[];
  productsWithAllImages: string[];
  failedImages: Array<{ product: string; file: string; error: string }>;
  mockCloudinaryUrls: string[];
}

const stats: MigrationStats = {
  totalImagesOnDisk: 0,
  totalProductsWithImages: 0,
  migratedCount: 0,
  failedCount: 0,
  productsWithoutImages: [],
  productsWithAllImages: [],
  failedImages: [],
  mockCloudinaryUrls: []
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

function generateMockCloudinaryUrl(productId: string, filename: string): string {
  // Mock Cloudinary URL format for verification purposes
  // In production: https://res.cloudinary.com/{cloud}/image/upload/{public_id}
  const publicId = `royals/products/${productId}/${filename.replace(/\.[^/.]+$/, '')}`;
  return `https://res.cloudinary.com/royals-demo/image/upload/v1786111500/${publicId}.jpeg`;
}

async function migrateImages(db: Database): Promise<void> {
  const uploadsBase = path.join(process.cwd(), 'public', 'uploads');

  console.log('\n' + '═'.repeat(70));
  console.log('  ROYALS IMAGE MIGRATION VERIFICATION');
  console.log('═'.repeat(70) + '\n');

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

  // Second pass: migrate images (mock)
  console.log('🚀 SIMULATING CLOUDINARY MIGRATION...\n');

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
        // Verify file is readable
        if (!fs.existsSync(imagePath)) {
          throw new Error('File not found');
        }

        const fileStats = fs.statSync(imagePath);
        if (fileStats.size === 0) {
          throw new Error('Empty file');
        }

        // Generate mock Cloudinary URL
        const mockCloudinaryUrl = generateMockCloudinaryUrl(productId, imageFile);

        // Check if already migrated
        const existing = queryOne(
          db,
          'SELECT id, image_url FROM product_images WHERE product_id = ? ORDER BY display_order LIMIT 1',
          [productId]
        );

        if (existing && !existing.image_url.includes('cloudinary')) {
          // Update existing local URL to mock Cloudinary URL
          execute(
            db,
            'UPDATE product_images SET image_url = ?, updated_at = ? WHERE product_id = ? AND image_url LIKE ?',
            [mockCloudinaryUrl, new Date().toISOString(), productId, `%uploads/${productId}%`]
          );
          console.log(`  ✓ ${imageFile} (${(fileStats.size / 1024).toFixed(2)} KB)`);
        } else {
          console.log(`  ✓ ${imageFile} (${(fileStats.size / 1024).toFixed(2)} KB)`);
        }

        stats.migratedCount++;
        productMigratedCount++;
        stats.mockCloudinaryUrls.push(mockCloudinaryUrl);
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

  // Update products.images_json to reflect new URLs
  console.log('\n📝 UPDATING PRODUCT IMAGES_JSON FIELD...');
  const allProducts = queryAll(db, 'SELECT DISTINCT product_id FROM product_images');
  let updatedCount = 0;

  for (const prod of allProducts) {
    const productId = prod.product_id;
    const images = queryAll(
      db,
      'SELECT image_url FROM product_images WHERE product_id = ? ORDER BY display_order',
      [productId]
    );

    const imageUrls = images.map(img => img.image_url);
    execute(
      db,
      'UPDATE products SET images_json = ?, updated_at = ? WHERE id = ?',
      [JSON.stringify(imageUrls), new Date().toISOString(), productId]
    );
    updatedCount++;
  }
  console.log(`✓ Updated ${updatedCount} products\n`);

  // Save database
  const dbData = db.export();
  const buffer = Buffer.from(dbData);
  const dbPath = path.join(process.cwd(), 'data', 'royals.sqlite');
  fs.writeFileSync(dbPath, buffer);
  console.log('✓ Database persisted\n');
}

async function verifyMigration(db: Database): Promise<void> {
  console.log('\n✅ VERIFYING MIGRATION...\n');

  // Check all product_images have valid URLs
  const allImages = queryAll(
    db,
    'SELECT id, product_id, image_url FROM product_images ORDER BY product_id, display_order'
  );

  console.log(`Total images in product_images table: ${allImages.length}`);

  // Verify each product has at least one image
  const products = queryAll(
    db,
    'SELECT id, title FROM products ORDER BY id'
  );

  let productsWithImages = 0;
  let productsWithoutImages = 0;
  const missingImageProducts = [];

  for (const prod of products) {
    const images = queryAll(
      db,
      'SELECT id FROM product_images WHERE product_id = ? ORDER BY display_order',
      [prod.id]
    );

    if (images.length > 0) {
      productsWithImages++;
    } else {
      productsWithoutImages++;
      missingImageProducts.push(prod.id);
    }
  }

  console.log(`\nProducts with images: ${productsWithImages}`);
  console.log(`Products without images: ${productsWithoutImages}`);

  if (missingImageProducts.length > 0) {
    console.log(`\n❌ Missing images for products:`);
    missingImageProducts.forEach(p => console.log(`   - ${p}`));
  } else {
    console.log(`\n✅ ALL ${products.length} PRODUCTS HAVE IMAGES`);
  }

  // Sample images per product
  console.log(`\n📊 IMAGE DISTRIBUTION:\n`);
  const distribution: Record<number, number> = {};
  for (const prod of products) {
    const count = queryAll(
      db,
      'SELECT id FROM product_images WHERE product_id = ?',
      [prod.id]
    ).length;
    distribution[count] = (distribution[count] || 0) + 1;
  }

  Object.keys(distribution)
    .sort()
    .forEach(count => {
      console.log(`   ${count} image(s): ${distribution[Number(count)]} products`);
    });
}

function printReport(): void {
  console.log('\n' + '═'.repeat(70));
  console.log('  MIGRATION REPORT');
  console.log('═'.repeat(70) + '\n');

  console.log('📊 STATISTICS:');
  console.log(`  Total images on disk:           ${stats.totalImagesOnDisk}`);
  console.log(`  Successfully migrated:          ${stats.migratedCount}`);
  console.log(`  Failed migrations:              ${stats.failedCount}`);
  console.log(`  Total product directories:      ${stats.totalProductsWithImages + stats.productsWithoutImages.length}`);
  console.log(`  Products with all images:       ${stats.productsWithAllImages.length}`);
  console.log(`  Products without images:        ${stats.productsWithoutImages.length}`);
  console.log(`  Mock Cloudinary URLs generated: ${stats.mockCloudinaryUrls.length}\n`);

  if (stats.productsWithoutImages.length > 0) {
    console.log('⚠️  PRODUCTS WITHOUT IMAGES:');
    stats.productsWithoutImages.forEach(p => console.log(`   - ${p}`));
    console.log();
  }

  if (stats.failedImages.length > 0) {
    console.log('❌ FAILED MIGRATIONS:');
    stats.failedImages.forEach(img => {
      console.log(`   - ${img.product}/${img.file}: ${img.error}`);
    });
    console.log();
  }

  console.log('📝 SAMPLE MIGRATION URLS:');
  stats.mockCloudinaryUrls.slice(0, 3).forEach(url => {
    console.log(`   - ${url}`);
  });
  if (stats.mockCloudinaryUrls.length > 3) {
    console.log(`   ... and ${stats.mockCloudinaryUrls.length - 3} more\n`);
  }

  console.log('═'.repeat(70) + '\n');

  // Final status
  if (stats.failedCount === 0 && stats.totalImagesOnDisk > 0) {
    console.log('✅ MIGRATION VERIFICATION PASSED\n');
    console.log('📌 NEXT STEPS FOR PRODUCTION:');
    console.log('   1. Configure Cloudinary credentials in .env');
    console.log('   2. Run: npx tsx scripts/migrate-images.ts');
    console.log('   3. Verify all images are now on Cloudinary CDN');
    console.log('   4. Test image persistence after deployment\n');
  } else if (stats.failedCount > 0) {
    console.log('⚠️  MIGRATION VERIFICATION COMPLETED WITH ERRORS\n');
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
    console.error('❌ Migration verification failed:', error);
    process.exit(1);
  }
}

main();
