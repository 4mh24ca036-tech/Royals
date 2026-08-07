/**
 * Image Management Service
 * High-level service for managing product, category, and section images
 */

import { Database } from 'sql.js';
import sharp from 'sharp';
import { getCloudinaryService } from './cloudinary.js';

export interface ProductImage {
  id: string;
  product_id: string;
  image_url: string;
  display_order: number;
  is_cover: number;
  view_type: string;
  alt_text: string | null;
  width?: number;
  height?: number;
  created_at: string;
  updated_at: string;
}

export interface ImageUploadResult {
  imageId: string;
  productId: string;
  imageUrl: string;
  cloudinaryPublicId: string;
  displayOrder: number;
  isCover: boolean;
  width: number;
  height: number;
  createdAt: string;
}

export class ImageManagementService {
  private db: Database;
  private cloudinary = getCloudinaryService();

  constructor(db: Database) {
    this.db = db;
  }

  /**
   * Query helper - get all rows from a query
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
   * Query helper - get one row from a query
   */
  private queryOne(sql: string, params: any[] = []): any {
    return this.queryAll(sql, params)[0] || null;
  }

  /**
   * Generate a unique image ID
   */
  private generateImageId(): string {
    return `pimg_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  }

  /**
   * Upload a product image to Cloudinary and save metadata to database
   */
  async uploadProductImage(
    productId: string,
    fileBuffer: Buffer,
    filename: string,
    altText?: string
  ): Promise<ImageUploadResult> {
    // Verify product exists
    const product = this.queryOne('SELECT id FROM products WHERE id = ?', [productId]);
    if (!product) {
      throw new Error(`Product not found: ${productId}`);
    }

    // Optimize image with sharp and get metadata
    const metadata = await sharp(fileBuffer).metadata();
    const optimizedBuffer = await sharp(fileBuffer)
      .resize({ width: 1200, withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();

    // Upload to Cloudinary
    const cloudinaryResponse = await this.cloudinary.uploadImage(
      optimizedBuffer,
      filename.replace(/\.[^.]+$/, ''),
      `royals/products/${productId}`
    );

    // Get next display order
    const maxOrderRow = this.queryOne(
      'SELECT MAX(display_order) as maxOrder FROM product_images WHERE product_id = ?',
      [productId]
    );
    const displayOrder = (maxOrderRow?.maxOrder ?? -1) + 1;

    // Check if this is the first image
    const existingCount = this.queryOne(
      'SELECT COUNT(*) as cnt FROM product_images WHERE product_id = ?',
      [productId]
    );
    const isCover = (existingCount?.cnt ?? 0) === 0 ? 1 : 0;

    // Save to database
    const imageId = this.generateImageId();
    const now = new Date().toISOString();

    this.db.run(
      `INSERT INTO product_images (id, product_id, image_url, display_order, is_cover, view_type, alt_text, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        imageId,
        productId,
        cloudinaryResponse.secure_url,
        displayOrder,
        isCover,
        'gallery',
        altText || null,
        now,
        now
      ]
    );

    // Sync images_json in products table for legacy compatibility
    this.syncProductImagesJson(productId);

    return {
      imageId,
      productId,
      imageUrl: cloudinaryResponse.secure_url,
      cloudinaryPublicId: cloudinaryResponse.public_id,
      displayOrder,
      isCover: Boolean(isCover),
      width: cloudinaryResponse.width || (metadata?.width ?? 1200),
      height: cloudinaryResponse.height || (metadata?.height ?? 1200),
      createdAt: now
    };
  }

  /**
   * Delete a product image from both Cloudinary and database
   */
  async deleteProductImage(imageId: string): Promise<boolean> {
    const image = this.queryOne('SELECT * FROM product_images WHERE id = ?', [imageId]);
    if (!image) {
      throw new Error(`Image not found: ${imageId}`);
    }

    // Extract public_id from Cloudinary URL
    // URL format: https://res.cloudinary.com/cloud/image/upload/v1234/royals/products/prod_id/filename.webp
    const urlParts = image.image_url.split('/');
    const publicId = `royals/products/${image.product_id}/${urlParts[urlParts.length - 1].split('.')[0]}`;

    // Delete from Cloudinary
    await this.cloudinary.deleteImage(publicId);

    // Delete from database
    this.db.run('DELETE FROM product_images WHERE id = ?', [imageId]);

    // If this was the cover image, promote the next one
    if (image.is_cover) {
      const nextImage = this.queryOne(
        'SELECT id FROM product_images WHERE product_id = ? ORDER BY display_order ASC LIMIT 1',
        [image.product_id]
      );
      if (nextImage) {
        const now = new Date().toISOString();
        this.db.run(
          'UPDATE product_images SET is_cover = 1, updated_at = ? WHERE id = ?',
          [now, nextImage.id]
        );
      }
    }

    // Sync images_json
    this.syncProductImagesJson(image.product_id);

    return true;
  }

  /**
   * Set an image as the cover for its product
   */
  setProductImageCover(imageId: string): ProductImage[] {
    const image = this.queryOne('SELECT * FROM product_images WHERE id = ?', [imageId]);
    if (!image) {
      throw new Error(`Image not found: ${imageId}`);
    }

    const now = new Date().toISOString();

    // Clear all covers for this product
    this.db.run(
      'UPDATE product_images SET is_cover = 0, updated_at = ? WHERE product_id = ?',
      [now, image.product_id]
    );

    // Set this image as cover and move to position 0
    this.db.run(
      'UPDATE product_images SET is_cover = 1, display_order = 0, updated_at = ? WHERE id = ?',
      [now, imageId]
    );

    // Shift all other images by 1
    const others = this.queryAll(
      'SELECT id FROM product_images WHERE product_id = ? AND id != ? ORDER BY display_order ASC',
      [image.product_id, imageId]
    );
    others.forEach((r, idx) => {
      this.db.run(
        'UPDATE product_images SET display_order = ?, updated_at = ? WHERE id = ?',
        [idx + 1, now, r.id]
      );
    });

    // Sync images_json
    this.syncProductImagesJson(image.product_id);

    // Return updated images
    const updated = this.queryAll(
      'SELECT * FROM product_images WHERE product_id = ? ORDER BY display_order ASC',
      [image.product_id]
    );
    return updated;
  }

  /**
   * Reorder images for a product
   */
  reorderProductImages(productId: string, imageIds: string[]): ProductImage[] {
    const now = new Date().toISOString();

    imageIds.forEach((imgId, idx) => {
      this.db.run(
        'UPDATE product_images SET display_order = ?, updated_at = ? WHERE id = ? AND product_id = ?',
        [idx, now, imgId, productId]
      );
    });

    // First image becomes cover
    this.db.run(
      'UPDATE product_images SET is_cover = 0, updated_at = ? WHERE product_id = ?',
      [now, productId]
    );

    if (imageIds[0]) {
      this.db.run(
        'UPDATE product_images SET is_cover = 1, updated_at = ? WHERE id = ? AND product_id = ?',
        [now, imageIds[0], productId]
      );
    }

    // Sync images_json
    this.syncProductImagesJson(productId);

    const updated = this.queryAll(
      'SELECT * FROM product_images WHERE product_id = ? ORDER BY display_order ASC',
      [productId]
    );
    return updated;
  }

  /**
   * Get all images for a product
   */
  getProductImages(productId: string): ProductImage[] {
    return this.queryAll(
      'SELECT * FROM product_images WHERE product_id = ? ORDER BY display_order ASC',
      [productId]
    );
  }

  /**
   * Get the cover image for a product
   */
  getProductCoverImage(productId: string): ProductImage | null {
    return this.queryOne(
      'SELECT * FROM product_images WHERE product_id = ? AND is_cover = 1 LIMIT 1',
      [productId]
    );
  }

  /**
   * Sync images_json in products table to keep legacy code working
   */
  private syncProductImagesJson(productId: string): void {
    const images = this.queryAll(
      'SELECT image_url FROM product_images WHERE product_id = ? ORDER BY display_order ASC',
      [productId]
    );
    const urls = images.map((r) => r.image_url);
    const now = new Date().toISOString();
    this.db.run(
      'UPDATE products SET images_json = ?, updated_at = ? WHERE id = ?',
      [JSON.stringify(urls), now, productId]
    );
  }

  /**
   * Update category image
   */
  async updateCategoryImage(
    categoryId: string,
    fileBuffer: Buffer,
    filename: string
  ): Promise<string> {
    const category = this.queryOne('SELECT id FROM categories WHERE id = ?', [categoryId]);
    if (!category) {
      throw new Error(`Category not found: ${categoryId}`);
    }

    const optimizedBuffer = await sharp(fileBuffer)
      .resize({ width: 800, withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();

    const cloudinaryResponse = await this.cloudinary.uploadImage(
      optimizedBuffer,
      filename.replace(/\.[^.]+$/, ''),
      'royals/categories'
    );

    this.db.run(
      'UPDATE categories SET image_url = ? WHERE id = ?',
      [cloudinaryResponse.secure_url, categoryId]
    );

    return cloudinaryResponse.secure_url;
  }

  /**
   * Update section (homepage) image
   */
  async updateSectionImage(
    sectionKey: string,
    fileBuffer: Buffer,
    filename: string
  ): Promise<string> {
    const optimizedBuffer = await sharp(fileBuffer)
      .resize({ width: 1920, withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();

    const cloudinaryResponse = await this.cloudinary.uploadImage(
      optimizedBuffer,
      filename.replace(/\.[^.]+$/, ''),
      `royals/sections/${sectionKey}`
    );

    return cloudinaryResponse.secure_url;
  }

  /**
   * Replace an existing image
   */
  async replaceProductImage(
    imageId: string,
    fileBuffer: Buffer,
    filename: string
  ): Promise<ProductImage> {
    const image = this.queryOne('SELECT * FROM product_images WHERE id = ?', [imageId]);
    if (!image) {
      throw new Error(`Image not found: ${imageId}`);
    }

    // Optimize and upload new image
    const metadata = await sharp(fileBuffer).metadata();
    const optimizedBuffer = await sharp(fileBuffer)
      .resize({ width: 1200, withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();

    const cloudinaryResponse = await this.cloudinary.uploadImage(
      optimizedBuffer,
      filename.replace(/\.[^.]+$/, ''),
      `royals/products/${image.product_id}`
    );

    // Update database
    const now = new Date().toISOString();
    this.db.run(
      'UPDATE product_images SET image_url = ?, updated_at = ? WHERE id = ?',
      [cloudinaryResponse.secure_url, now, imageId]
    );

    // Sync images_json
    this.syncProductImagesJson(image.product_id);

    return {
      ...image,
      image_url: cloudinaryResponse.secure_url,
      updated_at: now
    };
  }
}

export default ImageManagementService;
