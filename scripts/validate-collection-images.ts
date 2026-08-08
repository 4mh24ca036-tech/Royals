/**
 * Validation script for collection images
 * Checks for duplicates, broken images, and proper database structure
 */

import { getDb } from '../server/db.js';
import fs from 'fs';
import path from 'path';

interface ValidationResult {
  totalCategories: number;
  categoriesWithImages: number;
  categoriesWithoutImages: number;
  duplicateImages: Array<{ image: string; count: number; categories: string[] }>;
  brokenImages: Array<{ category: string; image: string; reason: string }>;
  mobileImages: number;
  activeCategories: number;
  inactiveCategories: number;
}

async function validateCollectionImages(): Promise<ValidationResult> {
  const result: ValidationResult = {
    totalCategories: 0,
    categoriesWithImages: 0,
    categoriesWithoutImages: 0,
    duplicateImages: [],
    brokenImages: [],
    mobileImages: 0,
    activeCategories: 0,
    inactiveCategories: 0
  };

  try {
    const db = await getDb();
    
    // Get all categories
    const categories = db.exec('SELECT id, name, image_url, mobile_image_url, is_active FROM categories ORDER BY display_order ASC');
    
    if (categories.length === 0 || !categories[0] || !categories[0].values) {
      console.log('No categories found in database');
      return result;
    }
    
    const categoryRows = categories[0].values;
    result.totalCategories = categoryRows.length;
    
    // Track image usage for duplicate detection
    const imageUsage = new Map<string, string[]>();
    
    for (const row of categoryRows) {
      const categoryId = row[0] as string;
      const categoryName = row[1] as string;
      const imageUrl = row[2] as string;
      const mobileImageUrl = row[3] as string;
      const isActive = row[4] as number;
      
      // Count active/inactive
      if (isActive === 1) {
        result.activeCategories++;
      } else {
        result.inactiveCategories++;
      }
      
      // Count mobile images
      if (mobileImageUrl && mobileImageUrl.trim() !== '') {
        result.mobileImages++;
      }
      
      // Check for image
      if (imageUrl && imageUrl.trim() !== '') {
        result.categoriesWithImages++;
        
        // Track for duplicates
        if (!imageUsage.has(imageUrl)) {
          imageUsage.set(imageUrl, []);
        }
        imageUsage.get(imageUrl)!.push(categoryName);
        
        // Check if file exists
        const filePath = path.join(process.cwd(), 'public', imageUrl);
        if (!fs.existsSync(filePath)) {
          result.brokenImages.push({
            category: categoryName,
            image: imageUrl,
            reason: 'File does not exist'
          });
        }
      } else {
        result.categoriesWithoutImages++;
      }
    }
    
    // Find duplicates
    for (const [image, categories] of imageUsage.entries()) {
      if (categories.length > 1) {
        result.duplicateImages.push({
          image,
          count: categories.length,
          categories
        });
      }
    }
    
    return result;
    
  } catch (error) {
    console.error('Error validating collection images:', error);
    throw error;
  }
}

async function main() {
  console.log('🔍 Validating Collection Images...\n');
  
  const result = await validateCollectionImages();
  
  console.log('📊 COLLECTION IMAGE VALIDATION REPORT');
  console.log('='.repeat(50));
  console.log(`Total Categories: ${result.totalCategories}`);
  console.log(`Categories with Images: ${result.categoriesWithImages}`);
  console.log(`Categories without Images: ${result.categoriesWithoutImages}`);
  console.log(`Active Categories: ${result.activeCategories}`);
  console.log(`Inactive Categories: ${result.inactiveCategories}`);
  console.log(`Categories with Mobile Images: ${result.mobileImages}`);
  
  console.log('\n❌ DUPLICATE IMAGES');
  console.log('-'.repeat(50));
  if (result.duplicateImages.length === 0) {
    console.log('✅ No duplicate images found');
  } else {
    result.duplicateImages.forEach(({ image, count, categories }) => {
      console.log(`⚠️  ${image}`);
      console.log(`   Used ${count} times by: ${categories.join(', ')}`);
    });
  }
  
  console.log('\n🔍 BROKEN IMAGES');
  console.log('-'.repeat(50));
  if (result.brokenImages.length === 0) {
    console.log('✅ No broken images found');
  } else {
    result.brokenImages.forEach(({ category, image, reason }) => {
      console.log(`⚠️  ${category}: ${image}`);
      console.log(`   Reason: ${reason}`);
    });
  }
  
  console.log('\n' + '='.repeat(50));
  
  const hasIssues = result.duplicateImages.length > 0 || 
                    result.brokenImages.length > 0 || 
                    result.categoriesWithoutImages > 0;
  
  if (hasIssues) {
    console.log('⚠️  VALIDATION FAILED - Issues found');
    process.exit(1);
  } else {
    console.log('✅ VALIDATION PASSED - All collection images are correct');
    process.exit(0);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
