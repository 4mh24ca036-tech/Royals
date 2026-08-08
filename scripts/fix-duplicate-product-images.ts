/**
 * Script to fix duplicate product images by replacing them with unique catalog images
 */

import { getDb, persistDb } from '../server/db.js';
import fs from 'fs';
import path from 'path';

// Available catalog images
const CATALOG_IMAGES = [
  '/images/catalog/royals-garment-01.jpeg',
  '/images/catalog/royals-garment-02.jpeg',
  '/images/catalog/royals-garment-03.jpeg',
  '/images/catalog/royals-garment-04.jpeg',
  '/images/catalog/royals-garment-05.jpeg',
  '/images/catalog/royals-garment-06.jpeg',
  '/images/catalog/royals-garment-08.jpeg',
  '/images/catalog/royals-garment-09.jpeg',
  '/images/catalog/royals-garment-10.jpeg',
  '/images/catalog/royals-garment-11.jpeg',
  '/images/catalog/royals-garment-12.jpeg',
  '/images/catalog/royals-garment-13.jpeg',
  '/images/catalog/royals-garment-14.jpeg',
  '/images/catalog/royals-garment-15.jpeg',
  '/images/catalog/royals-garment-16.jpeg',
  '/images/catalog/royals-garment-17.jpeg',
  '/images/catalog/royals-garment-18.jpeg',
  '/images/catalog/royals-garment-19.jpeg',
  '/images/catalog/royals-garment-20.jpeg',
  '/images/catalog/royals-garment-21.jpeg',
  '/images/catalog/royals-garment-22.jpeg',
  '/images/catalog/royals-garment-23.jpeg',
  '/images/catalog/royals-garment-24.jpeg',
  '/images/catalog/royals-garment-25.jpeg',
  '/images/catalog/royals-garment-26.jpeg',
  '/images/catalog/royals-garment-27.jpeg',
  '/images/catalog/royals-garment-28.jpeg',
  '/images/catalog/royals-garment-29.jpeg',
  '/images/catalog/royals-garment-30.jpeg',
  '/images/catalog/royals-garment-31.jpeg',
  '/images/catalog/royals-garment-32.jpeg',
  '/images/catalog/royals-garment-33.jpeg',
  '/images/catalog/royals-garment-34.jpeg',
  '/images/catalog/royals-garment-35.jpeg',
  '/images/catalog/royals-garment-36.jpeg',
  '/images/catalog/royals-garment-37.jpeg',
  '/images/catalog/royals-garment-38.jpeg',
  '/images/catalog/royals-garment-39.jpeg',
  '/images/catalog/royals-garment-40.jpeg',
  '/images/catalog/royals-garment-41.jpeg',
  '/images/catalog/royals-garment-42.jpeg',
  '/images/catalog/royals-garment-43.jpeg',
  '/images/catalog/royals-garment-44.jpeg',
  '/images/catalog/royals-garment-45.jpeg',
  '/images/catalog/royals-garment-46.jpeg',
  '/images/catalog/royals-garment-47.jpeg',
  '/images/catalog/royals-garment-48.jpeg',
  '/images/catalog/royals-garment-49.jpeg',
  '/images/catalog/royals-garment-50.jpeg',
  '/images/catalog/royals-garment-51.jpeg',
  '/images/catalog/royals-garment-52.jpeg',
  '/images/catalog/royals-garment-53.jpeg',
  '/images/catalog/royals-garment-54.jpeg',
  '/images/catalog/royals-garment-55.jpeg',
  '/images/catalog/royals-garment-56.jpeg',
  '/images/catalog/royals-garment-57.jpeg',
  '/images/catalog/royals-garment-58.jpeg',
  '/images/catalog/royals-garment-59.jpeg',
  '/images/catalog/royals-garment-60.jpeg',
  '/images/catalog/royals-garment-61.jpeg',
  '/images/catalog/royals-garment-62.jpeg',
  '/images/catalog/royals-garment-63.jpeg',
  '/images/catalog/royals-garment-64.jpeg',
  '/images/catalog/royals-garment-65.jpeg',
  '/images/catalog/royals-garment-66.jpeg',
  '/images/catalog/royals-garment-67.jpeg',
  '/images/catalog/royals-garment-68.jpeg',
  '/images/catalog/royals-garment-69.jpeg',
  '/images/catalog/royals-garment-70.jpeg',
  '/images/catalog/royals-garment-71.jpeg',
  '/images/catalog/royals-garment-72.jpeg',
  '/images/catalog/royals-garment-73.jpeg',
  '/images/catalog/royals-garment-74.jpeg',
  '/images/catalog/royals-garment-75.jpeg',
  '/images/catalog/royals-garment-76.jpeg'
];

async function fixDuplicateProductImages() {
  try {
    const db = await getDb();
    
    console.log('🔍 Finding duplicate product images...\n');
    
    // Get all product images
    const allImages = db.exec(`
      SELECT id, product_id, image_url, is_cover, display_order 
      FROM product_images 
      ORDER BY product_id, display_order ASC
    `);
    
    if (allImages.length === 0 || !allImages[0] || !allImages[0].values) {
      console.log('No product images found in database');
      return;
    }
    
    const images = allImages[0].values;
    
    // Track image URLs and their usage
    const imageUsage = new Map<string, { count: number; products: string[]; imageIds: string[] }>();
    
    for (const row of images) {
      const imageId = row[0] as string;
      const productId = row[1] as string;
      const imageUrl = row[2] as string;
      
      if (!imageUsage.has(imageUrl)) {
        imageUsage.set(imageUrl, { count: 0, products: [], imageIds: [] });
      }
      
      const usage = imageUsage.get(imageUrl)!;
      usage.count++;
      usage.products.push(productId);
      usage.imageIds.push(imageId);
    }
    
    // Find duplicates
    const duplicates = Array.from(imageUsage.entries()).filter(([_, usage]) => usage.count > 1);
    
    if (duplicates.length === 0) {
      console.log('✅ No duplicate product images found');
      return;
    }
    
    console.log(`Found ${duplicates.length} duplicate product images to fix\n`);
    
    // Track used catalog images to avoid new duplicates
    const usedCatalogImages = new Set<string>();
    
    // First, mark all existing catalog images as used
    for (const row of images) {
      const imageUrl = row[2] as string;
      if (imageUrl.includes('/images/catalog/')) {
        usedCatalogImages.add(imageUrl);
      }
    }
    
    let fixedCount = 0;
    
    for (const [duplicateUrl, usage] of duplicates) {
      console.log(`\nFixing duplicate: ${duplicateUrl}`);
      console.log(`  Used by ${usage.count} products: ${usage.products.join(', ')}`);
      
      // Keep the first usage, fix the rest
      for (let i = 1; i < usage.products.length; i++) {
        const productId = usage.products[i];
        const imageId = usage.imageIds[i];
        
        // Find an unused catalog image
        let newImage: string | null = null;
        for (const catalogImage of CATALOG_IMAGES) {
          if (!usedCatalogImages.has(catalogImage)) {
            newImage = catalogImage;
            usedCatalogImages.add(catalogImage);
            break;
          }
        }
        
        if (newImage) {
          const now = new Date().toISOString();
          db.run(
            'UPDATE product_images SET image_url = ?, updated_at = ? WHERE id = ?',
            [newImage, now, imageId]
          );
          console.log(`  ✓ Replaced for product ${productId} with ${newImage}`);
          fixedCount++;
        } else {
          console.log(`  ⚠️  No more unique catalog images available for product ${productId}`);
        }
      }
    }
    
    if (fixedCount > 0) {
      persistDb();
      console.log(`\n✅ Successfully fixed ${fixedCount} duplicate product images`);
    } else {
      console.log('\nℹ️ No duplicate images could be fixed (no available catalog images)');
    }
    
    // Verify the fix
    console.log('\n🔍 Verifying fix...\n');
    
    const allImagesAfter = db.exec(`
      SELECT id, product_id, image_url, is_cover 
      FROM product_images 
      ORDER BY product_id, display_order ASC
    `);
    
    if (allImagesAfter.length > 0 && allImagesAfter[0] && allImagesAfter[0].values) {
      const imagesAfter = allImagesAfter[0].values;
      
      const imageUsageAfter = new Map<string, number>();
      
      for (const row of imagesAfter) {
        const imageUrl = row[2] as string;
        imageUsageAfter.set(imageUrl, (imageUsageAfter.get(imageUrl) || 0) + 1);
      }
      
      const duplicatesAfter = Array.from(imageUsageAfter.entries()).filter(([_, count]) => count > 1);
      
      if (duplicatesAfter.length === 0) {
        console.log('✅ Verification passed: No duplicate images remain');
      } else {
        console.log(`⚠️  ${duplicatesAfter.length} duplicates still remain`);
        duplicatesAfter.forEach(([url, count]) => {
          console.log(`  ${url}: used ${count} times`);
        });
      }
    }
    
  } catch (error) {
    console.error('Error fixing duplicate product images:', error);
    process.exit(1);
  }
}

fixDuplicateProductImages().then(() => {
  console.log('\n🎉 Duplicate image fixing complete');
  process.exit(0);
}).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
