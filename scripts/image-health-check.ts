#!/usr/bin/env npx tsx

/**
 * Task #9: Create Automated Validation Script for Image Health Checks
 * 
 * Scans all 84 products and reports:
 * - Total products
 * - Products with valid images
 * - Products with missing images
 * - Products with duplicate image URLs
 * - Products with multiple cover images
 * - Products with no cover image
 * - Invalid image URLs
 */

import fs from 'fs';
import path from 'path';
import initSqlJs, { Database } from 'sql.js';

interface ProductImageStatus {
  productId: string;
  title: string;
  imageCount: number;
  images: Array<{
    url: string;
    isCover: boolean;
    displayOrder: number;
  }>;
  hasCover: boolean;
  multipleCoverImages: boolean;
  coverCount: number;
  duplicateUrls: string[];
  brokenUrls: string[];
  status: 'OK' | 'WARNING' | 'ERROR';
  issues: string[];
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

async function imageHealthCheck(): Promise<void> {
  console.log('\n' + '═'.repeat(80));
  console.log('  IMAGE HEALTH CHECK - COMPREHENSIVE VALIDATION');
  console.log('═'.repeat(80) + '\n');

  const db = await initDb();

  // Get all products
  const products = queryAll(db, 'SELECT id, title FROM products ORDER BY id ASC');
  console.log(`📊 Scanning ${products.length} products...\n`);

  const productStatuses: ProductImageStatus[] = [];
  let totalValidProducts = 0;
  let totalMissingImages = 0;
  let totalMultipleCover = 0;
  let totalNoCover = 0;
  let totalDuplicates = 0;
  let totalErrors = 0;

  for (const product of products) {
    const images = queryAll(
      db,
      `SELECT image_url, is_cover, display_order FROM product_images 
       WHERE product_id = ? ORDER BY display_order ASC`,
      [product.id]
    );

    const status: ProductImageStatus = {
      productId: product.id,
      title: product.title,
      imageCount: images.length,
      images: images.map(img => ({
        url: img.image_url,
        isCover: img.is_cover === 1,
        displayOrder: img.display_order
      })),
      hasCover: false,
      multipleCoverImages: false,
      coverCount: 0,
      duplicateUrls: [],
      brokenUrls: [],
      status: 'OK',
      issues: []
    };

    // Check for cover images
    const coverImages = images.filter(i => i.is_cover === 1);
    status.coverCount = coverImages.length;
    status.hasCover = coverImages.length > 0;

    if (coverImages.length === 0) {
      status.issues.push('No cover image assigned');
      status.status = 'ERROR';
      totalNoCover++;
    } else if (coverImages.length > 1) {
      status.multipleCoverImages = true;
      status.issues.push(`Multiple cover images: ${coverImages.length}`);
      status.status = 'ERROR';
      totalMultipleCover++;
    }

    // Check for duplicate URLs
    const urlCounts = new Map<string, number>();
    for (const img of images) {
      urlCounts.set(img.image_url, (urlCounts.get(img.image_url) || 0) + 1);
    }

    for (const [url, count] of urlCounts.entries()) {
      if (count > 1) {
        status.duplicateUrls.push(url);
        status.issues.push(`Duplicate URL used ${count} times: ${url.substring(0, 50)}...`);
        if (status.status === 'OK') status.status = 'WARNING';
        totalDuplicates++;
      }
    }

    // Check for broken URLs (basic validation)
    for (const img of images) {
      // Check if URL is empty or invalid format
      if (!img.image_url || img.image_url.trim() === '') {
        status.brokenUrls.push('(empty)');
        status.issues.push('Empty image URL');
        status.status = 'ERROR';
      }
      // Check if it's a valid URL format
      else if (!img.image_url.startsWith('http') && !img.image_url.startsWith('/')) {
        status.brokenUrls.push(img.image_url);
        status.issues.push(`Invalid URL format: ${img.image_url.substring(0, 50)}...`);
        if (status.status === 'OK') status.status = 'WARNING';
      }
      // Check for legacy broken paths
      else if (img.image_url.includes('/images/') && !img.image_url.includes('cloudinary')) {
        status.brokenUrls.push(img.image_url);
        status.issues.push(`Legacy path (possibly broken): ${img.image_url}`);
        if (status.status === 'OK') status.status = 'WARNING';
      }
    }

    // Determine overall status
    if (status.issues.length === 0) {
      totalValidProducts++;
    } else if (status.status === 'ERROR') {
      totalErrors++;
    }

    productStatuses.push(status);
  }

  // Generate detailed report
  console.log('📈 HEALTH CHECK RESULTS:\n');
  console.log(`   Total products scanned:        ${products.length}`);
  console.log(`   ✅ Products with valid images: ${totalValidProducts}`);
  console.log(`   ⚠️  Products with warnings:    ${productStatuses.filter(s => s.status === 'WARNING').length}`);
  console.log(`   ❌ Products with errors:       ${totalErrors}\n`);

  console.log('🔍 ISSUE BREAKDOWN:\n');
  console.log(`   No cover image:                ${totalNoCover}`);
  console.log(`   Multiple cover images:        ${totalMultipleCover}`);
  console.log(`   Duplicate URLs within product: ${totalDuplicates}`);
  console.log(`   Broken/invalid URLs:          ${productStatuses.reduce((sum, s) => sum + s.brokenUrls.length, 0)}\n`);

  // Show errors only
  const errorProducts = productStatuses.filter(s => s.status === 'ERROR');
  if (errorProducts.length > 0) {
    console.log('❌ PRODUCTS WITH ERRORS:\n');
    for (const prod of errorProducts.slice(0, 20)) {
      console.log(`   [${prod.productId}] ${prod.title.substring(0, 60)}`);
      for (const issue of prod.issues) {
        console.log(`      → ${issue}`);
      }
    }
    if (errorProducts.length > 20) {
      console.log(`   ... and ${errorProducts.length - 20} more\n`);
    } else {
      console.log();
    }
  }

  // Show warnings only
  const warningProducts = productStatuses.filter(s => s.status === 'WARNING');
  if (warningProducts.length > 0) {
    console.log('⚠️  PRODUCTS WITH WARNINGS:\n');
    for (const prod of warningProducts.slice(0, 15)) {
      console.log(`   [${prod.productId}] ${prod.title.substring(0, 60)}`);
      for (const issue of prod.issues) {
        console.log(`      → ${issue}`);
      }
    }
    if (warningProducts.length > 15) {
      console.log(`   ... and ${warningProducts.length - 15} more\n`);
    } else {
      console.log();
    }
  }

  // Summary statistics
  console.log('─'.repeat(80) + '\n');
  console.log('📊 COMPLIANCE SUMMARY:\n');

  const checks = [
    {
      name: 'All products have exactly ONE cover image',
      pass: totalNoCover === 0 && totalMultipleCover === 0,
      count: `${totalNoCover} missing + ${totalMultipleCover} multiple`
    },
    {
      name: 'No duplicate image URLs within products',
      pass: totalDuplicates === 0,
      count: totalDuplicates
    },
    {
      name: 'No broken or invalid URLs',
      pass: productStatuses.reduce((sum, s) => sum + s.brokenUrls.length, 0) === 0,
      count: productStatuses.reduce((sum, s) => sum + s.brokenUrls.length, 0)
    },
    {
      name: 'All 84 products scanned',
      pass: products.length === 84,
      count: products.length
    }
  ];

  for (const check of checks) {
    const icon = check.pass ? '✅' : '❌';
    console.log(`   ${icon} ${check.name}`);
    if (!check.pass) {
      console.log(`      Issues found: ${check.count}`);
    }
  }

  console.log();

  // Overall pass/fail
  const allPassed = checks.every(c => c.pass);
  console.log('═'.repeat(80) + '\n');

  if (allPassed) {
    console.log('✅ IMAGE SYSTEM HEALTH: EXCELLENT\n');
    console.log('   All 84 products validated successfully.');
    console.log('   ✓ Every product has exactly 1 cover image');
    console.log('   ✓ Zero duplicate image URLs');
    console.log('   ✓ Zero broken or invalid URLs');
    console.log('   ✓ Ready for production\n');
  } else {
    console.log('❌ IMAGE SYSTEM HEALTH: ISSUES DETECTED\n');
    console.log('   Please review errors above and run fixes.\n');
  }

  // Save detailed report
  const reportPath = path.join(process.cwd(), 'image-health-check-report.json');
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalProducts: products.length,
      productsWithValidImages: totalValidProducts,
      productsWithErrors: totalErrors,
      productsWithWarnings: warningProducts.length,
      noCoverImage: totalNoCover,
      multipleCoverImages: totalMultipleCover,
      duplicateUrls: totalDuplicates,
      brokenUrls: productStatuses.reduce((sum, s) => sum + s.brokenUrls.length, 0)
    },
    complianceChecks: checks.map(c => ({
      check: c.name,
      passed: c.pass,
      issues: c.count
    })),
    productDetails: productStatuses,
    overallStatus: allPassed ? 'PASS' : 'FAIL'
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`📄 Detailed report: image-health-check-report.json\n`);
  console.log('═'.repeat(80) + '\n');
}

async function main() {
  try {
    await imageHealthCheck();
  } catch (error) {
    console.error('❌ Health check failed:', error);
    process.exit(1);
  }
}

main();
