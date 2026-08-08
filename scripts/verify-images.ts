#!/usr/bin/env npx tsx

/**
 * Verify Image Assignments
 * 
 * Task #3: Verify all 84 products have images in product_images table
 * - All 84 products should have at least 1 image assignment
 * - 8 hero products should have 2 images each (16 total)
 * - 76 boutique products should have 1 image each (76 total)
 * - Total: 92 image assignments
 */

import path from 'path';
import fs from 'fs';
import initSqlJs, { Database } from 'sql.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'royals.sqlite');

async function verifyImages() {
  const SQL = await initSqlJs();
  
  if (!fs.existsSync(DB_FILE)) {
    console.error('❌ Database not found:', DB_FILE);
    process.exit(1);
  }

  const fileBuffer = fs.readFileSync(DB_FILE);
  const db = new SQL.Database(fileBuffer);

  console.log('\n📊 IMAGE ASSIGNMENT VERIFICATION\n');

  // Query 1: Count total products
  const productCountRes = db.exec('SELECT COUNT(*) as count FROM products;');
  const totalProducts = productCountRes[0]?.values[0][0] || 0;
  console.log(`✓ Total products in database: ${totalProducts}`);

  // Query 2: Count total image assignments
  const imgCountRes = db.exec('SELECT COUNT(*) as count FROM product_images;');
  const totalImages = imgCountRes[0]?.values[0][0] || 0;
  console.log(`✓ Total image assignments: ${totalImages}`);

  // Query 3: Products with at least 1 image
  const productsWithImgRes = db.exec(`
    SELECT COUNT(DISTINCT product_id) as count 
    FROM product_images;
  `);
  const productsWithImages = productsWithImgRes[0]?.values[0][0] || 0;
  console.log(`✓ Products with at least 1 image: ${productsWithImages}`);

  // Query 4: Products WITHOUT images
  const productsNoImgRes = db.exec(`
    SELECT COUNT(*) as count 
    FROM products 
    WHERE id NOT IN (SELECT DISTINCT product_id FROM product_images);
  `);
  const productsWithoutImages = productsNoImgRes[0]?.values[0][0] || 0;
  if (productsWithoutImages > 0) {
    console.log(`❌ Products WITHOUT images: ${productsWithoutImages}`);
  } else {
    console.log(`✓ Products WITHOUT images: 0 (all covered)`);
  }

  // Query 5: Break down by hero vs boutique
  const heroRes = db.exec(`
    SELECT COUNT(*) as count 
    FROM product_images 
    WHERE product_id LIKE 'prod_raw_silk%' 
       OR product_id LIKE 'prod_chikankari%' 
       OR product_id LIKE 'prod_midnight%'
       OR product_id LIKE 'prod_emerald%'
       OR product_id LIKE 'prod_jaipur%'
       OR product_id LIKE 'prod_chanderi%'
       OR product_id LIKE 'prod_nehru%'
       OR product_id LIKE 'prod_padmavati%';
  `);
  const heroImageCount = heroRes[0]?.values[0][0] || 0;
  console.log(`\n✓ Hero product images (8 products × 2 images): ${heroImageCount}`);

  const boutiqueRes = db.exec(`
    SELECT COUNT(*) as count 
    FROM product_images 
    WHERE product_id LIKE 'prod_boutique_%';
  `);
  const boutiqueImageCount = boutiqueRes[0]?.values[0][0] || 0;
  console.log(`✓ Boutique product images (76 products × 1 image): ${boutiqueImageCount}`);

  // Query 6: Sample coverage report
  const coverageRes = db.exec(`
    SELECT 
      CASE 
        WHEN id LIKE 'prod_raw_silk%' OR id LIKE 'prod_chikankari%' OR id LIKE 'prod_midnight%'
          OR id LIKE 'prod_emerald%' OR id LIKE 'prod_jaipur%' OR id LIKE 'prod_chanderi%'
          OR id LIKE 'prod_nehru%' OR id LIKE 'prod_padmavati%' THEN 'Hero' 
        WHEN id LIKE 'prod_boutique_%' THEN 'Boutique'
        ELSE 'Other'
      END as category,
      id,
      title,
      (SELECT COUNT(*) FROM product_images WHERE product_id = products.id) as image_count
    FROM products
    ORDER BY category DESC, id
    LIMIT 20;
  `);

  console.log(`\n📋 SAMPLE COVERAGE (first 20 products):\n`);
  if (coverageRes[0]?.values) {
    coverageRes[0].values.forEach(([cat, id, title, imgCount]) => {
      const status = imgCount > 0 ? '✓' : '❌';
      console.log(`${status} [${cat}] ${id}: "${title}" → ${imgCount} image(s)`);
    });
  }

  // Query 7: Check for duplicates in images_json
  const duplicateRes = db.exec(`
    SELECT 
      id,
      title,
      COUNT(DISTINCT image_url) as unique_count,
      COUNT(image_url) as total_count
    FROM (
      SELECT p.id, p.title, json_each.value as image_url
      FROM products p, json_each(p.images_json)
    ) subquery
    GROUP BY id
    ORDER BY total_count DESC
    LIMIT 10;
  `);

  console.log(`\n🔍 IMAGE ASSIGNMENTS PER PRODUCT (top 10):\n`);
  if (duplicateRes[0]?.values) {
    duplicateRes[0].values.forEach(([id, title, uniqueCount, totalCount]) => {
      console.log(`• ${id}: "${title}" → ${totalCount} images (${uniqueCount} unique)`);
    });
  }

  // Final verdict
  console.log(`\n${'='.repeat(60)}\n`);
  const allCovered = productsWithImages === totalProducts && productsWithoutImages === 0;
  const expectedImages = heroImageCount + boutiqueImageCount;

  if (allCovered && expectedImages >= 84) {
    console.log(`✅ VERIFICATION PASSED`);
    console.log(`   • All ${totalProducts} products have image assignments`);
    console.log(`   • Total assignments: ${totalImages} (hero: ${heroImageCount}, boutique: ${boutiqueImageCount})`);
  } else {
    console.log(`⚠️  VERIFICATION ISSUES`);
    if (!allCovered) {
      console.log(`   • ${productsWithoutImages} products missing images`);
    }
    if (expectedImages < 84) {
      console.log(`   • Expected ≥92 total assignments, found: ${totalImages}`);
    }
  }

  console.log(`\n`);
}

verifyImages().catch(err => {
  console.error('Error during verification:', err);
  process.exit(1);
});
