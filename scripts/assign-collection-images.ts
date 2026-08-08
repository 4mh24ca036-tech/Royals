/**
 * Script to assign unique collection images to categories
 * This ensures no duplicate images across different collection cards
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

async function assignCollectionImages() {
  try {
    const db = await getDb();
    
    // Get all categories
    const categories = db.exec('SELECT id, name, image_url FROM categories ORDER BY display_order ASC');
    
    if (categories.length === 0 || !categories[0] || !categories[0].values) {
      console.log('No categories found in database');
      return;
    }
    
    const categoryRows = categories[0].values;
    console.log(`Found ${categoryRows.length} categories`);
    
    // Track used images to ensure no duplicates
    const usedImages = new Set<string>();
    const now = new Date().toISOString();
    
    let updatedCount = 0;
    
    for (const row of categoryRows) {
      const categoryId = row[0] as string;
      const categoryName = row[1] as string;
      const currentImageUrl = row[2] as string;
      
      // Skip if already has a unique catalog image (not from /images/ root)
      if (currentImageUrl && currentImageUrl.includes('/images/catalog/')) {
        console.log(`✓ Category "${categoryName}" already has catalog image: ${currentImageUrl}`);
        usedImages.add(currentImageUrl);
        continue;
      }
      
      // Find an unused image
      let assignedImage: string | null = null;
      for (const imagePath of CATALOG_IMAGES) {
        if (!usedImages.has(imagePath)) {
          assignedImage = imagePath;
          usedImages.add(imagePath);
          break;
        }
      }
      
      if (assignedImage) {
        // Update the category with the new image
        db.run(
          'UPDATE categories SET image_url = ?, updated_at = ? WHERE id = ?',
          [assignedImage, now, categoryId]
        );
        console.log(`✓ Assigned ${assignedImage} to category "${categoryName}"`);
        updatedCount++;
      } else {
        console.log(`⚠ No more unique images available for category "${categoryName}"`);
      }
    }
    
    if (updatedCount > 0) {
      persistDb();
      console.log(`\n✅ Successfully updated ${updatedCount} categories with unique images`);
    } else {
      console.log('\nℹ️ All categories already have unique catalog images');
    }
    
    // Verify no duplicates
    const allCategories = db.exec('SELECT id, name, image_url FROM categories');
    const imageCount = new Map<string, number>();
    
    if (allCategories.length > 0 && allCategories[0] && allCategories[0].values) {
      for (const row of allCategories[0].values) {
        const imageUrl = row[2] as string;
        if (imageUrl) {
          imageCount.set(imageUrl, (imageCount.get(imageUrl) || 0) + 1);
        }
      }
      
      const duplicates = Array.from(imageCount.entries()).filter(([_, count]) => count > 1);
      
      if (duplicates.length > 0) {
        console.log('\n⚠️ Found duplicate images:');
        duplicates.forEach(([url, count]) => {
          console.log(`  ${url}: used ${count} times`);
        });
      } else {
        console.log('\n✅ No duplicate images found across categories');
      }
    }
    
  } catch (error) {
    console.error('Error assigning collection images:', error);
    process.exit(1);
  }
}

assignCollectionImages().then(() => {
  console.log('\n🎉 Collection image assignment complete');
  process.exit(0);
}).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
