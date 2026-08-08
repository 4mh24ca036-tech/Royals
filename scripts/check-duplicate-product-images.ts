/**
 * Script to check for duplicate product images
 */

import { getDb } from '../server/db.js';

async function checkDuplicateProductImages() {
  try {
    const db = await getDb();
    
    console.log('🔍 Checking for duplicate product images...\n');
    
    // Get all product images
    const allImages = db.exec(`
      SELECT id, product_id, image_url, is_cover 
      FROM product_images 
      ORDER BY product_id, display_order ASC
    `);
    
    if (allImages.length === 0 || !allImages[0] || !allImages[0].values) {
      console.log('No product images found in database');
      return;
    }
    
    const images = allImages[0].values;
    console.log(`Found ${images.length} total product images\n`);
    
    // Track image URLs and their usage
    const imageUsage = new Map<string, { count: number; products: string[]; imageIds: string[] }>();
    
    for (const row of images) {
      const imageId = row[0] as string;
      const productId = row[1] as string;
      const imageUrl = row[2] as string;
      const isCover = row[3] as number;
      
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
    } else {
      console.log(`⚠️  Found ${duplicates.length} duplicate product images:\n`);
      
      for (const [imageUrl, usage] of duplicates) {
        console.log(`Image: ${imageUrl}`);
        console.log(`  Used ${usage.count} times by products: ${usage.products.join(', ')}`);
        console.log(`  Image IDs: ${usage.imageIds.join(', ')}`);
        console.log();
      }
    }
    
    // Check for cover image duplicates specifically
    console.log('🔍 Checking for duplicate cover images...\n');
    
    const coverImageUsage = new Map<string, { count: number; products: string[] }>();
    
    for (const row of images) {
      const productId = row[1] as string;
      const imageUrl = row[2] as string;
      const isCover = row[3] as number;
      
      if (isCover === 1) {
        if (!coverImageUsage.has(imageUrl)) {
          coverImageUsage.set(imageUrl, { count: 0, products: [] });
        }
        
        const usage = coverImageUsage.get(imageUrl)!;
        usage.count++;
        usage.products.push(productId);
      }
    }
    
    const coverDuplicates = Array.from(coverImageUsage.entries()).filter(([_, usage]) => usage.count > 1);
    
    if (coverDuplicates.length === 0) {
      console.log('✅ No duplicate cover images found');
    } else {
      console.log(`⚠️  Found ${coverDuplicates.length} duplicate cover images:\n`);
      
      for (const [imageUrl, usage] of coverDuplicates) {
        console.log(`Cover Image: ${imageUrl}`);
        console.log(`  Used as cover by ${usage.count} products: ${usage.products.join(', ')}`);
        console.log();
      }
    }
    
    // Summary
    console.log('📊 SUMMARY');
    console.log('='.repeat(50));
    console.log(`Total images: ${images.length}`);
    console.log(`Unique images: ${imageUsage.size}`);
    console.log(`Duplicate images: ${duplicates.length}`);
    console.log(`Total cover images: ${Array.from(coverImageUsage.values()).reduce((sum, usage) => sum + usage.count, 0)}`);
    console.log(`Unique cover images: ${coverImageUsage.size}`);
    console.log(`Duplicate cover images: ${coverDuplicates.length}`);
    
    if (duplicates.length > 0 || coverDuplicates.length > 0) {
      console.log('\n⚠️  ACTION REQUIRED: Fix duplicate images');
      process.exit(1);
    } else {
      console.log('\n✅ All product images are unique');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('Error checking duplicate product images:', error);
    process.exit(1);
  }
}

checkDuplicateProductImages().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
