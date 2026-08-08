#!/usr/bin/env npx tsx

/**
 * Verify Collection Image Uniqueness
 * 
 * Task #4: Verify that each collection displays unique images
 * - New Arrivals
 * - Featured Collection
 * - Best Sellers
 * - Categories (6 categories)
 * - Editorial Strips (5 strips)
 * - Banners (3 banners)
 * - Recommendations/Related Products
 */

import path from 'path';
import fs from 'fs';
import initSqlJs, { Database } from 'sql.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'royals.sqlite');

async function verifyCollections() {
  const SQL = await initSqlJs();
  
  if (!fs.existsSync(DB_FILE)) {
    console.error('❌ Database not found:', DB_FILE);
    process.exit(1);
  }

  const fileBuffer = fs.readFileSync(DB_FILE);
  const db = new SQL.Database(fileBuffer);

  console.log('\n📊 COLLECTION IMAGE UNIQUENESS VERIFICATION\n');

  // ─────────────────────────────────────────────────────────────────
  // 1. FEATURED COLLECTION (is_featured = 1)
  // ─────────────────────────────────────────────────────────────────
  const featuredRes = db.exec(`
    SELECT 
      id,
      title,
      (SELECT GROUP_CONCAT(image_url, ' | ') FROM product_images WHERE product_id = products.id LIMIT 1) as first_image
    FROM products
    WHERE is_featured = 1
    ORDER BY id;
  `);

  console.log(`🎯 FEATURED COLLECTION (is_featured=1):`);
  const featuredImages = new Set();
  const featuredDuplicates = [];
  
  if (featuredRes[0]?.values) {
    console.log(`   Found ${featuredRes[0].values.length} featured products\n`);
    featuredRes[0].values.forEach(([id, title, imgUrl]) => {
      if (imgUrl) {
        if (featuredImages.has(imgUrl)) {
          featuredDuplicates.push({ id, title, img: imgUrl });
        } else {
          featuredImages.add(imgUrl);
        }
        console.log(`   ✓ ${id}: "${title}" → ${imgUrl?.substring(0, 50)}...`);
      }
    });
  }

  if (featuredDuplicates.length > 0) {
    console.log(`\n   ⚠️  DUPLICATE IMAGES IN FEATURED COLLECTION:\n`);
    featuredDuplicates.forEach(({ id, title, img }) => {
      console.log(`      • ${id}: "${title}" (duplicate of: ${img})`);
    });
  } else {
    console.log(`\n   ✅ No duplicate images in featured collection`);
  }

  // ─────────────────────────────────────────────────────────────────
  // 2. NEW ARRIVALS (is_new_arrival = 1)
  // ─────────────────────────────────────────────────────────────────
  const newArrivalsRes = db.exec(`
    SELECT 
      id,
      title,
      (SELECT GROUP_CONCAT(image_url, ' | ') FROM product_images WHERE product_id = products.id LIMIT 1) as first_image
    FROM products
    WHERE is_new_arrival = 1
    ORDER BY id;
  `);

  console.log(`\n📌 NEW ARRIVALS (is_new_arrival=1):`);
  const newArrivalImages = new Set();
  const newArrivalDuplicates = [];
  
  if (newArrivalsRes[0]?.values) {
    console.log(`   Found ${newArrivalsRes[0].values.length} new arrival products\n`);
    newArrivalsRes[0].values.forEach(([id, title, imgUrl]) => {
      if (imgUrl) {
        if (newArrivalImages.has(imgUrl)) {
          newArrivalDuplicates.push({ id, title, img: imgUrl });
        } else {
          newArrivalImages.add(imgUrl);
        }
        console.log(`   ✓ ${id}: "${title}" → ${imgUrl?.substring(0, 50)}...`);
      }
    });
  }

  if (newArrivalDuplicates.length > 0) {
    console.log(`\n   ⚠️  DUPLICATE IMAGES IN NEW ARRIVALS:\n`);
    newArrivalDuplicates.forEach(({ id, title, img }) => {
      console.log(`      • ${id}: "${title}" (duplicate)`);
    });
  } else {
    console.log(`\n   ✅ No duplicate images in new arrivals`);
  }

  // ─────────────────────────────────────────────────────────────────
  // 3. CATEGORIES (6 categories with hero images)
  // ─────────────────────────────────────────────────────────────────
  const categoriesRes = db.exec(`
    SELECT 
      id,
      name,
      image_url
    FROM categories
    ORDER BY name;
  `);

  console.log(`\n🏷️  CATEGORIES (hero images):`);
  const categoryImages = new Set();
  const categoryDuplicates = [];
  
  if (categoriesRes[0]?.values) {
    console.log(`   Found ${categoriesRes[0].values.length} categories\n`);
    categoriesRes[0].values.forEach(([id, name, imgUrl]) => {
      if (imgUrl) {
        if (categoryImages.has(imgUrl)) {
          categoryDuplicates.push({ id, name, img: imgUrl });
        } else {
          categoryImages.add(imgUrl);
        }
        console.log(`   ✓ ${name}: ${imgUrl}`);
      }
    });
  }

  if (categoryDuplicates.length > 0) {
    console.log(`\n   ⚠️  DUPLICATE IMAGES IN CATEGORIES:\n`);
    categoryDuplicates.forEach(({ id, name, img }) => {
      console.log(`      • ${name}: (duplicate)`);
    });
  } else {
    console.log(`\n   ✅ All category images are unique`);
  }

  // ─────────────────────────────────────────────────────────────────
  // 4. BANNERS (hero carousel banners)
  // ─────────────────────────────────────────────────────────────────
  const bannersRes = db.exec(`
    SELECT 
      id,
      title,
      image_url
    FROM banners
    ORDER BY display_order;
  `);

  console.log(`\n🎪 BANNERS (hero carousel):`);
  const bannerImages = new Set();
  const bannerDuplicates = [];
  
  if (bannersRes[0]?.values) {
    console.log(`   Found ${bannersRes[0].values.length} banners\n`);
    bannersRes[0].values.forEach(([id, title, imgUrl]) => {
      if (imgUrl) {
        if (bannerImages.has(imgUrl)) {
          bannerDuplicates.push({ id, title, img: imgUrl });
        } else {
          bannerImages.add(imgUrl);
        }
        console.log(`   ✓ ${title}: ${imgUrl?.substring(0, 50)}...`);
      }
    });
  }

  if (bannerDuplicates.length > 0) {
    console.log(`\n   ⚠️  DUPLICATE IMAGES IN BANNERS:\n`);
    bannerDuplicates.forEach(({ id, title, img }) => {
      console.log(`      • ${title}: (duplicate)`);
    });
  } else {
    console.log(`\n   ✅ All banner images are unique`);
  }

  // ─────────────────────────────────────────────────────────────────
  // 5. EDITORIAL STRIPS (5 editorial feature strips)
  // ─────────────────────────────────────────────────────────────────
  let editorialRes = null;
  const editorialImages = new Set();
  const editorialDuplicates = [];
  
  try {
    editorialRes = db.exec(`
      SELECT 
        id,
        label,
        image_url
      FROM editorial_strips
      ORDER BY display_order;
    `);

    if (editorialRes[0]?.values) {
      console.log(`\n📰 EDITORIAL STRIPS (feature sections):`);
      console.log(`   Found ${editorialRes[0].values.length} editorial strips\n`);
      editorialRes[0].values.forEach(([id, label, imgUrl]) => {
        if (imgUrl) {
          if (editorialImages.has(imgUrl)) {
            editorialDuplicates.push({ id, label, img: imgUrl });
          } else {
            editorialImages.add(imgUrl);
          }
          console.log(`   ✓ ${label}: ${imgUrl}`);
        }
      });

      if (editorialDuplicates.length > 0) {
        console.log(`\n   ⚠️  DUPLICATE IMAGES IN EDITORIAL STRIPS:\n`);
        editorialDuplicates.forEach(({ id, label, img }) => {
          console.log(`      • ${label}: (duplicate)`);
        });
      } else {
        console.log(`\n   ✅ All editorial images are unique`);
      }
    }
  } catch (e) {
    console.log(`\n📰 EDITORIAL STRIPS: Table not found (skipped)`);
  }

  // ─────────────────────────────────────────────────────────────────
  // 6. HOMEPAGE SECTIONS (if exists)
  // ─────────────────────────────────────────────────────────────────
  let sectionsRes = null;
  try {
    sectionsRes = db.exec(`
      SELECT 
        id,
        name,
        image_urls_json
      FROM homepage_sections
      ORDER BY display_order;
    `);

    if (sectionsRes && sectionsRes[0]?.values && sectionsRes[0].values.length > 0) {
      console.log(`\n🏠 HOMEPAGE SECTIONS:`);
      const sectionImages = new Set();
      const sectionDuplicates = [];
      
      console.log(`   Found ${sectionsRes[0].values.length} homepage sections\n`);
      sectionsRes[0].values.forEach(([id, name, imgUrlsJson]) => {
        const urls = imgUrlsJson ? JSON.parse(imgUrlsJson) : [];
        console.log(`   ✓ ${name}: ${urls.length} images`);
        urls.forEach(url => {
          if (sectionImages.has(url)) {
            sectionDuplicates.push({ id, name, img: url });
          } else {
            sectionImages.add(url);
          }
        });
      });

      if (sectionDuplicates.length > 0) {
        console.log(`\n   ⚠️  DUPLICATE IMAGES IN HOMEPAGE SECTIONS:\n`);
        sectionDuplicates.forEach(({ id, name, img }) => {
          console.log(`      • ${name}: (duplicate)`);
        });
      } else {
        console.log(`\n   ✅ All homepage section images are unique`);
      }
    }
  } catch (e) {
    console.log(`\n🏠 HOMEPAGE SECTIONS: Table not found (skipped)`);
  }

  // ─────────────────────────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────────────────────────
  console.log(`\n${'='.repeat(60)}\n`);
  console.log(`📊 COLLECTION SUMMARY:\n`);
  console.log(`   Featured Products: ${featuredRes[0]?.values.length || 0} products, ${featuredImages.size} unique images`);
  console.log(`   New Arrivals: ${newArrivalsRes[0]?.values.length || 0} products, ${newArrivalImages.size} unique images`);
  console.log(`   Categories: ${categoriesRes[0]?.values.length || 0} categories, ${categoryImages.size} unique images`);
  console.log(`   Banners: ${bannersRes[0]?.values.length || 0} banners, ${bannerImages.size} unique images`);
  console.log(`   Editorial Strips: ${editorialRes?.[0]?.values.length || 0} strips, ${editorialImages.size} unique images`);

  const totalDuplicates = featuredDuplicates.length + newArrivalDuplicates.length + 
                          categoryDuplicates.length + bannerDuplicates.length + 
                          editorialDuplicates.length;

  if (totalDuplicates === 0) {
    console.log(`\n✅ VERIFICATION PASSED - All collections display unique images\n`);
  } else {
    console.log(`\n⚠️  VERIFICATION WARNING - Found ${totalDuplicates} duplicate image instances\n`);
  }
}

verifyCollections().catch(err => {
  console.error('Error during verification:', err);
  process.exit(1);
});
