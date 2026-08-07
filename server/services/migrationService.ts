/**
 * Migration Service
 * Handles migration of local images to Cloudinary
 */

import { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';
import ImageManagementService from './imageService.js';

export interface MigrationReport {
  totalImages: number;
  migratedCount: number;
  failedCount: number;
  skippedCount: number;
  failedImages: Array<{ filename: string; error: string }>;
  duration: number;
  timestamp: string;
}

export class MigrationService {
  private db: Database;
  private imageService: ImageManagementService;

  constructor(db: Database) {
    this.db = db;
    this.imageService = new ImageManagementService(db);
  }

  /**
   * Query helper
   */
  private queryAll(sql: string, params: any[] = []): any[] {
    const stmt = this.db.prepare(sql);
    if (params.length > 0) stmt.bind(params);
    const results: any[] = [];
    while (stmt.step()) results.push(stmt.getAsObject());
    stmt.free();
    return results;
  }

  /**
   * Query one helper
   */
  private queryOne(sql: string, params: any[] = []): any {
    return this.queryAll(sql, params)[0] || null;
  }

  /**
   * Migrate existing local images in /uploads/ to Cloudinary
   * Returns a migration report with success/failure details
   */
  async migrateLocalImagesToCloudinary(): Promise<MigrationReport> {
    const startTime = Date.now();
    const report: MigrationReport = {
      totalImages: 0,
      migratedCount: 0,
      failedCount: 0,
      skippedCount: 0,
      failedImages: [],
      duration: 0,
      timestamp: new Date().toISOString()
    };

    const uploadsBase = path.join(process.cwd(), 'public', 'uploads');

    // Check if uploads directory exists
    if (!fs.existsSync(uploadsBase)) {
      console.warn('Uploads directory does not exist. No local images to migrate.');
      return report;
    }

    // Get all product directories in /uploads/
    const productDirs = fs.readdirSync(uploadsBase).filter((f) => {
      const stat = fs.statSync(path.join(uploadsBase, f));
      return stat.isDirectory();
    });

    // Iterate through each product directory
    for (const productDir of productDirs) {
      const productPath = path.join(uploadsBase, productDir);
      const imageFiles = fs.readdirSync(productPath).filter((f) => {
        const ext = path.extname(f).toLowerCase();
        return ['.jpg', '.jpeg', '.png', '.webp'].includes(ext);
      });

      for (const imageFile of imageFiles) {
        report.totalImages++;
        const imagePath = path.join(productPath, imageFile);

        try {
          // Check if already migrated (look for Cloudinary URL in DB)
          const alreadyInDb = this.queryOne(
            'SELECT id FROM product_images WHERE image_url LIKE ?',
            [`%cloudinary%${path.basename(imageFile)}%`]
          );

          if (alreadyInDb) {
            report.skippedCount++;
            console.log(`⊘ Skipped (already migrated): ${imageFile}`);
            continue;
          }

          // Read the image file
          const fileBuffer = fs.readFileSync(imagePath);

          // Determine product ID from directory name
          // Directory names are like: prod_boutique_01, prod_raw_silk_kurta_set, etc.
          const productId = productDir;

          // Verify product exists
          const product = this.queryOne('SELECT id FROM products WHERE id = ?', [productId]);
          if (!product) {
            report.failedCount++;
            report.failedImages.push({
              filename: imageFile,
              error: `Product not found: ${productId}`
            });
            console.warn(`✗ Failed: Product not found: ${productId}`);
            continue;
          }

          // Upload to Cloudinary using ImageManagementService
          const result = await this.imageService.uploadProductImage(
            productId,
            fileBuffer,
            imageFile,
            path.basename(imageFile)
          );

          report.migratedCount++;
          console.log(`✓ Migrated: ${imageFile} → ${result.imageUrl}`);
        } catch (error: any) {
          report.failedCount++;
          report.failedImages.push({
            filename: imageFile,
            error: error.message || 'Unknown error'
          });
          console.error(`✗ Failed to migrate ${imageFile}: ${error.message}`);
        }
      }
    }

    report.duration = Date.now() - startTime;

    // Log summary
    console.log('\n ═════════════════════════════════════════════════════════');
    console.log(' IMAGE MIGRATION COMPLETE');
    console.log(' ═════════════════════════════════════════════════════════');
    console.log(`  Total images found:     ${report.totalImages}`);
    console.log(`  Successfully migrated:  ${report.migratedCount}`);
    console.log(`  Skipped (already done): ${report.skippedCount}`);
    console.log(`  Failed:                 ${report.failedCount}`);
    console.log(`  Duration:               ${(report.duration / 1000).toFixed(2)}s`);
    console.log(' ═════════════════════════════════════════════════════════\n');

    if (report.failedImages.length > 0) {
      console.log('Failed images:');
      report.failedImages.forEach((img) => {
        console.log(`  - ${img.filename}: ${img.error}`);
      });
    }

    return report;
  }

  /**
   * Verify migration: check that all images in product_images have valid URLs
   */
  verifyMigration(): {
    validCount: number;
    invalidCount: number;
    brokenUrls: string[];
  } {
    const result = {
      validCount: 0,
      invalidCount: 0,
      brokenUrls: [] as string[]
    };

    const images = this.queryAll(
      'SELECT id, image_url, product_id FROM product_images ORDER BY product_id, display_order'
    );

    for (const img of images) {
      // Check if URL is valid (Cloudinary or local)
      if (img.image_url && (img.image_url.includes('cloudinary') || img.image_url.includes('/uploads/'))) {
        result.validCount++;
      } else {
        result.invalidCount++;
        result.brokenUrls.push(img.image_url);
      }
    }

    return result;
  }

  /**
   * Rollback: if needed, revert migrated images back to local paths
   * (This is a safety measure and should rarely be needed)
   */
  async rollbackToLocal(): Promise<number> {
    // This would require keeping track of original local paths
    // For now, this is a placeholder for future use
    console.warn('Rollback not yet implemented');
    return 0;
  }
}

export default MigrationService;
