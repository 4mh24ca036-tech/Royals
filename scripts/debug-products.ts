/**
 * Debug script to check product database and API issues
 */

import { getDb } from '../server/db.js';

async function debugProducts() {
  try {
    const db = await getDb();
    
    console.log('🔍 DEBUGGING PRODUCT DATABASE\n');
    console.log('='.repeat(60));
    
    // Check total products
    const totalProducts = db.exec('SELECT COUNT(*) as count FROM products');
    if (totalProducts.length > 0 && totalProducts[0] && totalProducts[0].values) {
      console.log(`Total products in database: ${totalProducts[0].values[0][0]}`);
    }
    
    // Check products with images
    const productsWithImages = db.exec(`
      SELECT COUNT(*) as count 
      FROM products p 
      INNER JOIN product_images pi ON p.id = pi.product_id
    `);
    if (productsWithImages.length > 0 && productsWithImages[0] && productsWithImages[0].values) {
      console.log(`Products with images: ${productsWithImages[0].values[0][0]}`);
    }
    
    // Check a sample product
    const sample = db.exec('SELECT id, title, category_id, is_featured, is_new_arrival FROM products LIMIT 3');
    if (sample.length > 0 && sample[0] && sample[0].values) {
      console.log('\nSample products:');
      sample[0].values.forEach((row: any[]) => {
        console.log(`  - ${row[1]} (${row[0]}): category=${row[2]}, featured=${row[3]}, new=${row[4]}`);
      });
    }
    
    // Check categories
    const categories = db.exec('SELECT id, name FROM categories');
    if (categories.length > 0 && categories[0] && categories[0].values) {
      console.log('\nCategories:');
      categories[0].values.forEach((row: any[]) => {
        console.log(`  - ${row[1]} (${row[0]})`);
      });
    }
    
    // Check product images
    const productImages = db.exec('SELECT COUNT(*) as count FROM product_images');
    if (productImages.length > 0 && productImages[0] && productImages[0].values) {
      console.log(`\nTotal product images: ${productImages[0].values[0][0]}`);
    }
    
    // Check if products have valid category_ids
    const invalidCategories = db.exec(`
      SELECT COUNT(*) as count 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id 
      WHERE c.id IS NULL
    `);
    if (invalidCategories.length > 0 && invalidCategories[0] && invalidCategories[0].values) {
      console.log(`Products with invalid category_ids: ${invalidCategories[0].values[0][0]}`);
    }
    
    console.log('\n' + '='.repeat(60));
    
  } catch (error) {
    console.error('Error debugging products:', error);
    process.exit(1);
  }
}

debugProducts().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
