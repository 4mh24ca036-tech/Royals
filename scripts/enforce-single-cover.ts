/**
 * Script to enforce single cover image per product and detect duplicate cover images
 */

import { getDb, persistDb } from '../server/db.js';

async function enforceSingleCoverImages() {
  try {
    const db = await getDb();
    
    console.log('🔍 Checking for products with multiple cover images...\n');
    
    // Find products with multiple cover images
    const multipleCovers = db.exec(`
      SELECT product_id, COUNT(*) as count 
      FROM product_images 
      WHERE is_cover = 1 
      GROUP BY product_id 
      HAVING count > 1
    `);
    
    if (multipleCovers.length === 0 || !multipleCovers[0] || !multipleCovers[0].values) {
      console.log('✅ No products with multiple cover images found');
    } else {
      const productsWithMultipleCovers = multipleCovers[0].values;
      console.log(`⚠️  Found ${productsWithMultipleCovers.length} products with multiple cover images`);
      
      for (const row of productsWithMultipleCovers) {
        const productId = row[0] as string;
        const count = row[1] as number;
        console.log(`  - Product ${productId}: ${count} cover images`);
        
        // Get all cover images for this product, ordered by display_order
        const coverImages = db.exec(
          'SELECT id, image_url FROM product_images WHERE product_id = ? AND is_cover = 1 ORDER BY display_order ASC, created_at ASC',
          [productId]
        );
        
        if (coverImages.length > 0 && coverImages[0] && coverImages[0].values) {
          const coverImageIds = coverImages[0].values.map((r: any[]) => ({ id: r[0] as string, url: r[1] as string }));
          
          // Keep the first one as cover, set all others to non-cover
          const now = new Date().toISOString();
          for (let i = 1; i < coverImageIds.length; i++) {
            db.run(
              'UPDATE product_images SET is_cover = 0, updated_at = ? WHERE id = ?',
              [now, coverImageIds[i].id]
            );
            console.log(`    ✓ Removed cover flag from: ${coverImageIds[i].url}`);
          }
          console.log(`    ✓ Kept as cover: ${coverImageIds[0].url}`);
        }
      }
      
      persistDb();
      console.log('\n✅ Fixed multiple cover images');
    }
    
    // Check for products with no cover images
    console.log('\n🔍 Checking for products with no cover images...\n');
    
    const productsWithoutCover = db.exec(`
      SELECT DISTINCT p.id, p.title 
      FROM products p 
      LEFT JOIN product_images pi ON p.id = pi.product_id AND pi.is_cover = 1 
      WHERE pi.id IS NULL
    `);
    
    if (productsWithoutCover.length === 0 || !productsWithoutCover[0] || !productsWithoutCover[0].values) {
      console.log('✅ All products have cover images');
    } else {
      const products = productsWithoutCover[0].values;
      console.log(`⚠️  Found ${products.length} products with no cover images`);
      
      for (const row of products) {
        const productId = row[0] as string;
        const productTitle = row[1] as string;
        console.log(`  - ${productTitle} (${productId})`);
        
        // Check if product has any images at all
        const anyImages = db.exec(
          'SELECT id FROM product_images WHERE product_id = ? LIMIT 1',
          [productId]
        );
        
        if (anyImages.length > 0 && anyImages[0] && anyImages[0].values && anyImages[0].values.length > 0) {
          // Set the first image as cover
          const firstImageId = anyImages[0].values[0][0] as string;
          const now = new Date().toISOString();
          db.run(
            'UPDATE product_images SET is_cover = 1, updated_at = ? WHERE id = ?',
            [now, firstImageId]
          );
          console.log(`    ✓ Set first image as cover`);
        } else {
          console.log(`    ⚠️  No images available for this product`);
        }
      }
      
      persistDb();
      console.log('\n✅ Fixed products without cover images');
    }
    
    // Check for duplicate cover images across different products
    console.log('\n� Checking for duplicate cover images across products...\n');
    
    const duplicateCovers = db.exec(`
      SELECT image_url, COUNT(*) as count, GROUP_CONCAT(product_id) as product_ids
      FROM product_images 
      WHERE is_cover = 1 
      GROUP BY image_url 
      HAVING count > 1
    `);
    
    if (duplicateCovers.length === 0 || !duplicateCovers[0] || !duplicateCovers[0].values) {
      console.log('✅ No duplicate cover images found across products');
    } else {
      const duplicates = duplicateCovers[0].values;
      console.log(`⚠️  Found ${duplicates.length} duplicate cover images across products`);
      
      for (const row of duplicates) {
        const imageUrl = row[0] as string;
        const count = row[1] as number;
        const productIds = (row[2] as string).split(',');
        console.log(`  - ${imageUrl}: used by ${count} products (${productIds.join(', ')})`);
        
        // For each duplicate, keep only the first product's cover, remove from others
        const coverImages = db.exec(
          'SELECT id, product_id FROM product_images WHERE image_url = ? AND is_cover = 1 ORDER BY product_id ASC',
          [imageUrl]
        );
        
        if (coverImages.length > 0 && coverImages[0] && coverImages[0].values) {
          const images = coverImages[0].values;
          const now = new Date().toISOString();
          
          // Keep the first one, remove cover flag from others
          for (let i = 1; i < images.length; i++) {
            const imageId = images[i][0] as string;
            const productId = images[i][1] as string;
            db.run(
              'UPDATE product_images SET is_cover = 0, updated_at = ? WHERE id = ?',
              [now, imageId]
            );
            console.log(`    ✓ Removed cover from product ${productId}`);
          }
          
          // Try to set a different image as cover for the affected products
          for (let i = 1; i < images.length; i++) {
            const productId = images[i][1] as string;
            const otherImages = db.exec(
              'SELECT id FROM product_images WHERE product_id = ? AND id != ? ORDER BY display_order ASC LIMIT 1',
              [productId, images[i][0]]
            );
            
            if (otherImages.length > 0 && otherImages[0] && otherImages[0].values && otherImages[0].values.length > 0) {
              const newCoverId = otherImages[0].values[0][0] as string;
              db.run(
                'UPDATE product_images SET is_cover = 1, updated_at = ? WHERE id = ?',
                [now, newCoverId]
              );
              console.log(`    ✓ Set new cover for product ${productId}`);
            } else {
              console.log(`    ⚠️  No alternative image available for product ${productId}`);
            }
          }
        }
      }
      
      persistDb();
      console.log('\n✅ Fixed duplicate cover images');
    }
    
    console.log('\n🎉 Cover image enforcement complete');
    
  } catch (error) {
    console.error('Error enforcing single cover images:', error);
    process.exit(1);
  }
}

enforceSingleCoverImages().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
