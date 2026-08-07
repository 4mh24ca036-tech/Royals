import { Router, Request, Response } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { getDb, persistDb } from '../db.js';
import { authenticateAdmin } from '../auth.js';
import { getCloudinaryService } from '../services/cloudinary.js';
import ImageManagementService from '../services/imageService.js';

const router = Router();

// ── Storage configuration ──────────────────────────────────────────────────
// Images are stored under /public/uploads/<productId>/ so they are served
// as static assets and survive every restart, rebuild, and deployment.
const UPLOADS_BASE = path.join(process.cwd(), 'public', 'uploads');

function ensureProductDir(productId: string): string {
  const dir = path.join(UPLOADS_BASE, productId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

// Multer: store uploaded file in memory so sharp can process it before writing
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB per file
    files: 10                    // max 10 files per request
  },
  fileFilter(_req, file, cb) {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Only JPEG, PNG, and WebP images are accepted.'));
    }
    cb(null, true);
  }
});

// ── DB helpers ────────────────────────────────────────────────────────────
function queryAll(db: any, sql: string, params: any[] = []) {
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const results: any[] = [];
  while (stmt.step()) results.push(stmt.getAsObject());
  stmt.free();
  return results;
}

function queryOne(db: any, sql: string, params: any[] = []) {
  const rows = queryAll(db, sql, params);
  return rows[0] || null;
}

function genImageId(): string {
  return `pimg_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

// ── Image processing helper ───────────────────────────────────────────────
async function processAndSave(
  buffer: Buffer,
  destPath: string,
  mimeType: string
): Promise<void> {
  const sharpInstance = sharp(buffer);

  // Resize: max 1200px wide, preserve aspect ratio, no upscaling
  sharpInstance.resize({ width: 1200, withoutEnlargement: true });

  if (mimeType === 'image/png') {
    await sharpInstance.png({ quality: 85, compressionLevel: 8 }).toFile(destPath);
  } else if (mimeType === 'image/webp') {
    await sharpInstance.webp({ quality: 85 }).toFile(destPath);
  } else {
    // jpeg / jpg — default output format
    await sharpInstance.jpeg({ quality: 85, progressive: true }).toFile(destPath);
  }
}

// ── GET /api/images/product/:productId ───────────────────────────────────
// Returns all images for a product ordered by display_order.
// Public endpoint — no auth required.
router.get('/product/:productId', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const { productId } = req.params;
    const images = queryAll(
      db,
      'SELECT * FROM product_images WHERE product_id = ? ORDER BY display_order ASC, created_at ASC',
      [productId]
    );
    res.json(images.map((img) => ({
      ...img,
      is_cover: Boolean(img.is_cover)
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/images/upload-cloudinary/:productId ──────────────────────────
// NEW: Upload images directly to Cloudinary (admin only)
// This is the new preferred method; local uploads still supported for backward compatibility
router.post(
  '/upload-cloudinary/:productId',
  authenticateAdmin,
  upload.array('images', 10),
  async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      const { productId } = req.params;
      const cloudinary = getCloudinaryService();

      if (!cloudinary.isConfigured()) {
        return res.status(503).json({
          error: 'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME and API credentials in .env'
        });
      }

      const product = queryOne(db, 'SELECT id FROM products WHERE id = ?', [productId]);
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No image files provided' });
      }

      // Get current max display order
      const maxOrderRow = queryOne(
        db,
        'SELECT MAX(display_order) as maxOrder FROM product_images WHERE product_id = ?',
        [productId]
      );
      let nextOrder = (maxOrderRow?.maxOrder ?? -1) + 1;

      // Check if first batch
      const existingCount = queryOne(
        db,
        'SELECT COUNT(*) as cnt FROM product_images WHERE product_id = ?',
        [productId]
      );
      const isFirstBatch = (existingCount?.cnt ?? 0) === 0;

      const savedImages: any[] = [];
      const now = new Date().toISOString();

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const imgId = genImageId();

        try {
          // Upload to Cloudinary
          const cloudinaryResponse = await cloudinary.uploadImage(
            file.buffer,
            file.originalname || `image-${Date.now()}`,
            `royals/products/${productId}`
          );

          const isCover = isFirstBatch && i === 0 ? 1 : 0;
          const altText = (req.body.altText || '').trim() || null;
          const viewType = (req.body.viewType || 'gallery').trim();

          db.run(
            `INSERT INTO product_images (id, product_id, image_url, display_order, is_cover, view_type, alt_text, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [imgId, productId, cloudinaryResponse.secure_url, nextOrder + i, isCover, viewType, altText, now, now]
          );

          savedImages.push({
            id: imgId,
            product_id: productId,
            image_url: cloudinaryResponse.secure_url,
            cloudinary_public_id: cloudinaryResponse.public_id,
            display_order: nextOrder + i,
            is_cover: Boolean(isCover),
            view_type: viewType,
            alt_text: altText,
            created_at: now,
            updated_at: now
          });
        } catch (uploadErr: any) {
          console.error(`Failed to upload image ${file.originalname}:`, uploadErr);
          throw new Error(`Upload failed for ${file.originalname}: ${uploadErr.message}`);
        }
      }

      syncImagesJson(db, productId);
      persistDb();

      res.status(201).json({
        success: true,
        message: `${savedImages.length} image(s) uploaded to Cloudinary successfully`,
        images: savedImages,
        storage: 'cloudinary'
      });
    } catch (err: any) {
      console.error('Cloudinary upload error:', err);
      res.status(500).json({ error: err.message || 'Image upload to Cloudinary failed' });
    }
  }
);

// ── POST /api/images/upload/:productId ───────────────────────────────────
router.post(
  '/upload/:productId',
  authenticateAdmin,
  upload.array('images', 10),
  async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      const { productId } = req.params;

      // Verify product exists
      const product = queryOne(db, 'SELECT id FROM products WHERE id = ?', [productId]);
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No image files provided' });
      }

      const productDir = ensureProductDir(productId);

      // Determine starting display_order
      const maxOrderRow = queryOne(
        db,
        'SELECT MAX(display_order) as maxOrder FROM product_images WHERE product_id = ?',
        [productId]
      );
      let nextOrder = (maxOrderRow?.maxOrder ?? -1) + 1;

      // Is this the first image for this product?
      const existingCount = queryOne(
        db,
        'SELECT COUNT(*) as cnt FROM product_images WHERE product_id = ?',
        [productId]
      );
      const isFirstBatch = (existingCount?.cnt ?? 0) === 0;

      const savedImages: any[] = [];
      const now = new Date().toISOString();

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const imgId = genImageId();
        const ext = file.mimetype === 'image/png' ? 'png'
          : file.mimetype === 'image/webp' ? 'webp'
          : 'jpg';
        const filename = `${imgId}.${ext}`;
        const destPath = path.join(productDir, filename);
        const publicUrl = `/uploads/${productId}/${filename}`;

        await processAndSave(file.buffer, destPath, file.mimetype);

        const isCover = isFirstBatch && i === 0 ? 1 : 0;
        const altText = (req.body.altText || '').trim() || null;
        const viewType = (req.body.viewType || 'gallery').trim();

        db.run(
          `INSERT INTO product_images (id, product_id, image_url, display_order, is_cover, view_type, alt_text, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [imgId, productId, publicUrl, nextOrder + i, isCover, viewType, altText, now, now]
        );

        savedImages.push({
          id: imgId,
          product_id: productId,
          image_url: publicUrl,
          display_order: nextOrder + i,
          is_cover: Boolean(isCover),
          view_type: viewType,
          alt_text: altText,
          created_at: now,
          updated_at: now
        });
      }

      // Keep products.images_json in sync so legacy code still works
      syncImagesJson(db, productId);
      persistDb();

      res.status(201).json({
        success: true,
        message: `${savedImages.length} image(s) uploaded successfully`,
        images: savedImages
      });
    } catch (err: any) {
      console.error('Image upload error:', err);
      res.status(500).json({ error: err.message || 'Image upload failed' });
    }
  }
);

// ── DELETE /api/images/:imageId ───────────────────────────────────────────
// Permanently deletes an image record and its file from disk.
router.delete('/:imageId', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const { imageId } = req.params;

    const img = queryOne(db, 'SELECT * FROM product_images WHERE id = ?', [imageId]);
    if (!img) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Delete the physical file
    const filePath = path.join(process.cwd(), 'public', img.image_url);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    db.run('DELETE FROM product_images WHERE id = ?', [imageId]);

    // If the deleted image was the cover, promote the next image
    if (img.is_cover) {
      const nextImg = queryOne(
        db,
        'SELECT id FROM product_images WHERE product_id = ? ORDER BY display_order ASC LIMIT 1',
        [img.product_id]
      );
      if (nextImg) {
        db.run(
          'UPDATE product_images SET is_cover = 1, updated_at = ? WHERE id = ?',
          [new Date().toISOString(), nextImg.id]
        );
      }
    }

    syncImagesJson(db, img.product_id);
    persistDb();

    res.json({ success: true, message: 'Image deleted permanently' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/images/:imageId/cover ─────────────────────────────────────
// Makes the specified image the cover for its product.
router.patch('/:imageId/cover', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const { imageId } = req.params;

    const img = queryOne(db, 'SELECT * FROM product_images WHERE id = ?', [imageId]);
    if (!img) {
      return res.status(404).json({ error: 'Image not found' });
    }

    const now = new Date().toISOString();

    // Clear all covers for this product then set the chosen one
    db.run(
      'UPDATE product_images SET is_cover = 0, updated_at = ? WHERE product_id = ?',
      [now, img.product_id]
    );
    db.run(
      'UPDATE product_images SET is_cover = 1, display_order = 0, updated_at = ? WHERE id = ?',
      [now, imageId]
    );

    // Reorder remaining images (shift by 1)
    const others = queryAll(
      db,
      'SELECT id FROM product_images WHERE product_id = ? AND id != ? ORDER BY display_order ASC',
      [img.product_id, imageId]
    );
    others.forEach((r, idx) => {
      db.run(
        'UPDATE product_images SET display_order = ?, updated_at = ? WHERE id = ?',
        [idx + 1, now, r.id]
      );
    });

    syncImagesJson(db, img.product_id);
    persistDb();

    const updatedImages = queryAll(
      db,
      'SELECT * FROM product_images WHERE product_id = ? ORDER BY display_order ASC',
      [img.product_id]
    );
    res.json({
      success: true,
      message: 'Cover image updated',
      images: updatedImages.map((i) => ({ ...i, is_cover: Boolean(i.is_cover) }))
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/images/reorder/:productId ─────────────────────────────────
// Re-orders images for a product.
// Body: { order: ["imageId1", "imageId2", ...] }
router.patch('/reorder/:productId', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const { productId } = req.params;
    const { order } = req.body as { order: string[] };

    if (!Array.isArray(order) || order.length === 0) {
      return res.status(400).json({ error: 'order must be a non-empty array of image IDs' });
    }

    const now = new Date().toISOString();
    order.forEach((imgId, idx) => {
      db.run(
        'UPDATE product_images SET display_order = ?, updated_at = ? WHERE id = ? AND product_id = ?',
        [idx, now, imgId, productId]
      );
    });

    // First item in the new order becomes cover
    db.run(
      'UPDATE product_images SET is_cover = 0, updated_at = ? WHERE product_id = ?',
      [now, productId]
    );
    if (order[0]) {
      db.run(
        'UPDATE product_images SET is_cover = 1, updated_at = ? WHERE id = ? AND product_id = ?',
        [now, order[0], productId]
      );
    }

    syncImagesJson(db, productId);
    persistDb();

    const updatedImages = queryAll(
      db,
      'SELECT * FROM product_images WHERE product_id = ? ORDER BY display_order ASC',
      [productId]
    );
    res.json({
      success: true,
      message: 'Image order saved',
      images: updatedImages.map((i) => ({ ...i, is_cover: Boolean(i.is_cover) }))
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/images/:imageId ────────────────────────────────────────────
// Replace a single image file while keeping its metadata (id, order, cover).
router.patch(
  '/:imageId',
  authenticateAdmin,
  upload.single('image'),
  async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      const { imageId } = req.params;

      const img = queryOne(db, 'SELECT * FROM product_images WHERE id = ?', [imageId]);
      if (!img) {
        return res.status(404).json({ error: 'Image not found' });
      }

      const file = req.file as Express.Multer.File | undefined;
      if (!file) {
        return res.status(400).json({ error: 'No replacement image file provided' });
      }

      // Delete old file
      const oldFilePath = path.join(process.cwd(), 'public', img.image_url);
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }

      // Save new file
      const productDir = ensureProductDir(img.product_id);
      const ext = file.mimetype === 'image/png' ? 'png'
        : file.mimetype === 'image/webp' ? 'webp'
        : 'jpg';
      const newFilename = `${imageId}_r${Date.now()}.${ext}`;
      const destPath = path.join(productDir, newFilename);
      const publicUrl = `/uploads/${img.product_id}/${newFilename}`;

      await processAndSave(file.buffer, destPath, file.mimetype);

      const now = new Date().toISOString();
      db.run(
        'UPDATE product_images SET image_url = ?, updated_at = ? WHERE id = ?',
        [publicUrl, now, imageId]
      );

      syncImagesJson(db, img.product_id);
      persistDb();

      res.json({
        success: true,
        message: 'Image replaced successfully',
        image: {
          ...img,
          image_url: publicUrl,
          updated_at: now,
          is_cover: Boolean(img.is_cover)
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ── Helper: keep products.images_json in sync ─────────────────────────────
// This ensures legacy product API responses still include images correctly
// until all consumers have migrated to use product_images directly.
function syncImagesJson(db: any, productId: string) {
  const images = queryAll(
    db,
    'SELECT image_url FROM product_images WHERE product_id = ? ORDER BY display_order ASC',
    [productId]
  );
  const urls = images.map((r) => r.image_url);
  db.run(
    'UPDATE products SET images_json = ?, updated_at = ? WHERE id = ?',
    [JSON.stringify(urls), new Date().toISOString(), productId]
  );
}

export { syncImagesJson };
export default router;
