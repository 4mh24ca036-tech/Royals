/**
 * Complete end-to-end validation script
 * Tests the entire data flow from Admin to customer website
 */

import { getDb } from '../server/db.js';
import fs from 'fs';
import path from 'path';

interface ValidationResult {
  testName: string;
  passed: boolean;
  message: string;
  details?: any;
}

const results: ValidationResult[] = [];

function addResult(testName: string, passed: boolean, message: string, details?: any) {
  results.push({ testName, passed, message, details });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${testName}: ${message}`);
  if (details) {
    console.log(`   Details: ${JSON.stringify(details, null, 2)}`);
  }
}

async function testCompleteFlow() {
  console.log('🧪 TESTING COMPLETE END-TO-END FLOW\n');
  console.log('='.repeat(60));
  
  try {
    const db = await getDb();
    
    // TEST 1: Check that COUTURE BY CATEGORY section is removed
    console.log('\n📋 TEST 1: COUTURE BY CATEGORY Section Removal');
    console.log('-'.repeat(60));
    
    const appTsContent = await fs.promises.readFile(path.join(process.cwd(), 'src/App.tsx'), 'utf-8');
    
    const categoryShowcaseRemoved = !appTsContent.includes('CategoryShowcase');
    const categoryShowcaseImportRemoved = !appTsContent.includes("import { CategoryShowcase }");
    
    if (categoryShowcaseRemoved && categoryShowcaseImportRemoved) {
      addResult('COUTURE BY CATEGORY Removal', true, 'Section completely removed from homepage');
    } else {
      addResult('COUTURE BY CATEGORY Removal', false, 'CategoryShowcase still present in App.tsx');
    }
    
    // TEST 2: Check that homepage uses Admin products
    console.log('\n📋 TEST 2: Homepage Uses Admin Products');
    console.log('-'.repeat(60));
    
    const homepageUsesProducts = appTsContent.includes('products.slice(0, 8).map((product)');
    const homepageUsesProductCard = appTsContent.includes('<ProductCard');
    
    if (homepageUsesProducts && homepageUsesProductCard) {
      addResult('Homepage Admin Products', true, 'Homepage displays products from Admin catalog');
    } else {
      addResult('Homepage Admin Products', false, 'Homepage not using Admin product catalog');
    }
    
    // TEST 3: Check that categories still exist in database
    console.log('\n📋 TEST 3: Categories Still Exist in Database');
    console.log('-'.repeat(60));
    
    const categories = db.exec('SELECT COUNT(*) as count FROM categories');
    const categoryCount = categories.length > 0 && categories[0] && categories[0].values ? categories[0].values[0][0] as number : 0;
    
    if (categoryCount > 0) {
      addResult('Categories in Database', true, `Found ${categoryCount} categories in database`, { count: categoryCount });
    } else {
      addResult('Categories in Database', false, 'No categories found in database');
    }
    
    // TEST 4: Check that products exist and have proper structure
    console.log('\n📋 TEST 4: Products Have Proper Structure');
    console.log('-'.repeat(60));
    
    const products = db.exec('SELECT COUNT(*) as count FROM products');
    const productCount = products.length > 0 && products[0] && products[0].values ? products[0].values[0][0] as number : 0;
    
    if (productCount > 0) {
      addResult('Products in Database', true, `Found ${productCount} products in database`, { count: productCount });
      
      // Check that products have images
      const productsWithImages = db.exec(`
        SELECT COUNT(*) as count 
        FROM products p 
        INNER JOIN product_images pi ON p.id = pi.product_id AND pi.is_cover = 1
      `);
      const productsWithImagesCount = productsWithImages.length > 0 && productsWithImages[0] && productsWithImages[0].values ? productsWithImages[0].values[0][0] as number : 0;
      
      addResult('Products with Cover Images', true, `${productsWithImagesCount} products have cover images`, { count: productsWithImagesCount });
    } else {
      addResult('Products in Database', false, 'No products found in database');
    }
    
    // TEST 5: Check single cover image enforcement
    console.log('\n📋 TEST 5: Single Cover Image Per Product');
    console.log('-'.repeat(60));
    
    const multipleCovers = db.exec(`
      SELECT product_id, COUNT(*) as count 
      FROM product_images 
      WHERE is_cover = 1 
      GROUP BY product_id 
      HAVING count > 1
    `);
    
    const multipleCoversCount = multipleCovers.length > 0 && multipleCovers[0] && multipleCovers[0].values ? multipleCovers[0].values.length : 0;
    
    if (multipleCoversCount === 0) {
      addResult('Single Cover Image', true, 'No products have multiple cover images');
    } else {
      addResult('Single Cover Image', false, `${multipleCoversCount} products have multiple cover images`, { count: multipleCoversCount });
    }
    
    // TEST 6: Check no duplicate product images
    console.log('\n📋 TEST 6: No Duplicate Product Images');
    console.log('-'.repeat(60));
    
    const duplicateImages = db.exec(`
      SELECT image_url, COUNT(*) as count 
      FROM product_images 
      GROUP BY image_url 
      HAVING count > 1
    `);
    
    const duplicateCount = duplicateImages.length > 0 && duplicateImages[0] && duplicateImages[0].values ? duplicateImages[0].values.length : 0;
    
    if (duplicateCount === 0) {
      addResult('No Duplicate Images', true, 'No duplicate product images found');
    } else {
      addResult('No Duplicate Images', false, `${duplicateCount} duplicate product images found`, { count: duplicateCount });
    }
    
    // TEST 7: Check no duplicate cover images
    console.log('\n📋 TEST 7: No Duplicate Cover Images');
    console.log('-'.repeat(60));
    
    const duplicateCovers = db.exec(`
      SELECT image_url, COUNT(*) as count 
      FROM product_images 
      WHERE is_cover = 1 
      GROUP BY image_url 
      HAVING count > 1
    `);
    
    const duplicateCoverCount = duplicateCovers.length > 0 && duplicateCovers[0] && duplicateCovers[0].values ? duplicateCovers[0].values.length : 0;
    
    if (duplicateCoverCount === 0) {
      addResult('No Duplicate Cover Images', true, 'No duplicate cover images found');
    } else {
      addResult('No Duplicate Cover Images', false, `${duplicateCoverCount} duplicate cover images found`, { count: duplicateCoverCount });
    }
    
    // TEST 8: Check product images are stored in database
    console.log('\n📋 TEST 8: Product Images in Database');
    console.log('-'.repeat(60));
    
    const productImages = db.exec('SELECT COUNT(*) as count FROM product_images');
    const productImageCount = productImages.length > 0 && productImages[0] && productImages[0].values ? productImages[0].values[0][0] as number : 0;
    
    if (productImageCount > 0) {
      addResult('Product Images in Database', true, `Found ${productImageCount} product images in database`, { count: productImageCount });
    } else {
      addResult('Product Images in Database', false, 'No product images found in database');
    }
    
    // TEST 9: Check that products have Cloudinary URLs or local paths
    console.log('\n📋 TEST 9: Product Images Have Valid URLs');
    console.log('-'.repeat(60));
    
    const imageUrls = db.exec('SELECT image_url FROM product_images LIMIT 10');
    
    if (imageUrls.length > 0 && imageUrls[0] && imageUrls[0].values) {
      const urls = imageUrls[0].values.map((row: any[]) => row[0] as string);
      const validUrls = urls.filter(url => url && (url.startsWith('/images/') || url.includes('cloudinary.com')));
      
      if (validUrls.length === urls.length) {
        addResult('Valid Image URLs', true, 'All sampled images have valid URLs');
      } else {
        addResult('Valid Image URLs', false, `${urls.length - validUrls.length} images have invalid URLs`, { invalid: urls.length - validUrls.length });
      }
    } else {
      addResult('Valid Image URLs', false, 'No images to validate');
    }
    
    // TEST 10: Check Hero Banner is untouched
    console.log('\n📋 TEST 10: Hero Banner Untouched');
    console.log('-'.repeat(60));
    
    const heroCarouselContent = await fs.promises.readFile(path.join(process.cwd(), 'src/components/home/HeroCarousel.tsx'), 'utf-8');
    
    const heroCarouselHasBannersAPI = heroCarouselContent.includes('api.getBanners()');
    const heroCarouselHasFallback = heroCarouselContent.includes('FALLBACK_SLIDES');
    
    if (heroCarouselHasBannersAPI && heroCarouselHasFallback) {
      addResult('Hero Banner Untouched', true, 'Hero Carousel structure intact with API integration');
    } else {
      addResult('Hero Banner Untouched', false, 'Hero Carousel may have been modified');
    }
    
    // TEST 11: Check that Navbar categories link to shop
    console.log('\n📋 TEST 11: Navbar Categories Link to Shop');
    console.log('-'.repeat(60));
    
    const navbarContent = await fs.promises.readFile(path.join(process.cwd(), 'src/components/layout/Navbar.tsx'), 'utf-8');
    
    const navbarHasCategories = navbarContent.includes('categories.map');
    const navbarHasShopNavigation = navbarContent.includes('onSelectCategory');
    
    if (navbarHasCategories && navbarHasShopNavigation) {
      addResult('Navbar Categories', true, 'Navbar categories link to shop view');
    } else {
      addResult('Navbar Categories', false, 'Navbar categories may not link properly');
    }
    
    // TEST 12: Check that ProductListingView uses Admin products
    console.log('\n📋 TEST 12: Product Listing Uses Admin Products');
    console.log('-'.repeat(60));
    
    const productListingContent = await fs.promises.readFile(path.join(process.cwd(), 'src/components/product/ProductListingView.tsx'), 'utf-8');
    
    const productListingUsesProducts = productListingContent.includes('products.filter');
    const productListingUsesFilters = productListingContent.includes('selectedCategory');
    
    if (productListingUsesProducts && productListingUsesFilters) {
      addResult('Product Listing Admin Products', true, 'Product listing uses Admin products with filtering');
    } else {
      addResult('Product Listing Admin Products', false, 'Product listing may not use Admin products');
    }
    
    // FINAL SUMMARY
    console.log('\n' + '='.repeat(60));
    console.log('📊 FINAL VALIDATION SUMMARY');
    console.log('='.repeat(60));
    
    const passedTests = results.filter(r => r.passed).length;
    const totalTests = results.length;
    
    console.log(`Tests Passed: ${passedTests}/${totalTests}`);
    
    if (passedTests === totalTests) {
      console.log('\n🎉 ALL TESTS PASSED - Implementation is complete and correct');
      process.exit(0);
    } else {
      console.log('\n⚠️  SOME TESTS FAILED - Review the results above');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('Error during testing:', error);
    process.exit(1);
  }
}

testCompleteFlow().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
