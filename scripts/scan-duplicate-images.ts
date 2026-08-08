#!/usr/bin/env npx tsx

/**
 * Task #4: Scan Storefront for Duplicate Product Images
 * 
 * Identifies if the same image is being used by multiple different products
 * where it shouldn't be (not legitimate variants).
 * 
 * Focus: Find cross-product image reuse that violates uniqueness requirement
 */

import fs from 'fs';
import path from 'path';
import initSqlJs, { Database } from 'sql.js';

interface DuplicateGroup {
  imageUrl: string;
  productsUsing: Array<{
    productId: string;
    title: string;
    isCover: boolean;
  }>;
  count: number;
}

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

async function scanDuplicates(): Promise<void> {
  console.log('\n' + '═'.repeat(80));
  console.log('  TASK #4: SCAN STOREFRONT FOR DUPLICATE PRODUCT IMAGES');
  console.log('═'.repeat(80) + '\n');

  const db = await initDb();

  // Get all image URLs with their products
  const imageToProducts = queryAll(
    db,
    `SELECT 
       pi.image_url,
       pi.is_cover,
       p.id as product_id,
       p.title
     FROM product_images pi
     JOIN products p ON pi.product_id = p.id
     ORDER BY pi.image_url, p.id`
  );

  console.log(`📊 Analyzing ${imageToProducts.length} image assignments...\n`);

  // Group by image URL
  const imageMap = new Map<string, DuplicateGroup['productsUsing']>();

  for (const record of imageToProducts) {
    const url = record.image_url;
    if (!imageMap.has(url)) {
      imageMap.set(url, []);
    }
    imageMap.get(url)!.push({
      productId: record.product_id,
      title: record.title,
      isCover: record.is_cover === 1
    });
  }

  // Find duplicates (same image used by multiple products)
  const duplicates: DuplicateGroup[] = [];

  for (const [url, products] of imageMap.entries()) {
    if (products.length > 1) {
      duplicates.push({
        imageUrl: url,
        productsUsing: products,
        count: products.length
      });
    }
  }

  // Sort by count (highest first)
  duplicates.sort((a, b) => b.count - a.count);

  console.log(`🔍 ANALYSIS RESULTS:\n`);
  console.log(`   Total unique images: ${imageMap.size}`);
  console.log(`   Images used by 1 product: ${imageMap.size - duplicates.length}`);
  console.log(`   Images used by multiple products: ${duplicates.length}\n`);

  if (duplicates.length === 0) {
    console.log('✅ NO DUPLICATE IMAGES FOUND - Each product has unique images!\n');
  } else {
    console.log(`⚠️  ${duplicates.length} IMAGE(S) USED BY MULTIPLE PRODUCTS:\n`);

    for (let i = 0; i < Math.min(duplicates.length, 20); i++) {
      const dup = duplicates[i];
      console.log(`  ${i + 1}. Used by ${dup.count} products:`);
      console.log(`     URL: ${dup.imageUrl.substring(0, 70)}...`);
      console.log(`     Products:`);

      for (const prod of dup.productsUsing) {
        const coverIcon = prod.isCover ? '★' : ' ';
        console.log(`       ${coverIcon} [${prod.productId}] ${prod.title.substring(0, 50)}...`);
      }
      console.log();
    }

    if (duplicates.length > 20) {
      console.log(`  ... and ${duplicates.length - 20} more duplicate images\n`);
    }
  }

  // Categorize duplicates
  const coverDuplicates = duplicates.filter(d => 
    d.productsUsing.some(p => p.isCover)
  );

  const nonCoverDuplicates = duplicates.filter(d => 
    !d.productsUsing.some(p => p.isCover)
  );

  console.log('─'.repeat(80) + '\n');
  console.log(`📈 DUPLICATE CATEGORIES:\n`);
  console.log(`   Duplicates in COVER images: ${coverDuplicates.length}`);
  console.log(`   Duplicates in non-cover images: ${nonCoverDuplicates.length}\n`);

  // Check for category-level patterns (intentional reuse)
  console.log('🏷️  CHECKING FOR CATEGORY PATTERNS:\n');

  const categoryMap = new Map<string, string[]>();
  const products = queryAll(
    db,
    `SELECT DISTINCT p.id, p.category_id
     FROM products p`
  );

  for (const prod of products) {
    if (!categoryMap.has(prod.category_id)) {
      categoryMap.set(prod.category_id, []);
    }
    categoryMap.get(prod.category_id)!.push(prod.id);
  }

  console.log(`   Categories in database: ${categoryMap.size}`);
  console.log(`   Average products per category: ${(imageToProducts.length / categoryMap.size).toFixed(1)}\n`);

  // Generate report
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalUniqueImages: imageMap.size,
      totalImageAssignments: imageToProducts.length,
      imagesWithDuplicates: duplicates.length,
      productsWithDuplicateCovers: coverDuplicates.length,
      productsWithDuplicateNonCovers: nonCoverDuplicates.length
    },
    duplicateDetails: duplicates.map(d => ({
      imageUrl: d.imageUrl,
      usedByCount: d.count,
      products: d.productsUsing.map(p => ({
        productId: p.productId,
        title: p.title,
        isCover: p.isCover
      }))
    }))
  };

  const reportPath = path.join(process.cwd(), 'duplicate-images-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log('═'.repeat(80) + '\n');
  console.log(`📄 Detailed report saved: duplicate-images-report.json\n`);

  // Final verdict
  if (duplicates.length === 0) {
    console.log('✅ DUPLICATE SCAN PASSED - No accidental image reuse detected\n');
  } else if (coverDuplicates.length === 0) {
    console.log('⚠️  SCAN COMPLETE - Duplicates found only in non-cover images\n');
    console.log('   Recommendation: Review whether these are intentional gallery variants\n');
  } else {
    console.log('❌ CRITICAL ISSUE - Cover images are duplicated across products!\n');
    console.log('   Action Required: Different products must not share cover images\n');
  }
}

async function main() {
  try {
    await scanDuplicates();
  } catch (error) {
    console.error('❌ Scan failed:', error);
    process.exit(1);
  }
}

main();
