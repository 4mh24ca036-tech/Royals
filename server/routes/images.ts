/**
 * server/routes/images.ts
 *
 * Product image management — Cloudinary is the ONLY storage backend.
 * No local filesystem writes. All uploaded files go straight to Cloudinary;
 * the resulting secure_url is stored in Supabase product_images.
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { getDb, persistDb } from '../db.js';
import { authenticateAdmin } from '../auth.js';
import { getCloudinaryService } from '../services/cloudinary.js';

const router = Router();

// ── Multer: memory storage only (no disk) ─────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 10 },
  fileFilter(_req, file, cb) {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Only JPEG, PNG, and WebP images are accepted.'));
    }
    cb(null, true);
  }
});

// ── ID generator ──────────────────────────────────────────────────────────
function genImageId(): string {
  return `pimg_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

// ── Keep products.images_json in sync (legacy compatibility) ──────────────
async function syncImagesJson(db: any, productId: string) {
  const { data } = await db
    .from('product_images')
    .select('image_url')
    .eq('product_id', productId)
    .order('display_order', { ascending: true });

  const urls = (data ?? []).map((r: any) => r.image_url);

  await db
    .from('products')
    .update({ images_json: JSON.stringify(urls), updated_at: new Date().toISOString() })
    .eq('id', productId);
}

// ── GET /api/images/product/:productId ────────────────────────────────────
// Public — returns all images for a product ordered by display_order.
router.get('/product/:productId', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { productId } = req.params;

    const { data, error } = await db
      .from('product_images')
      .select('*')
      .eq('product_id', productId)
      .order('display_order', { ascending: true });

    if (error) throw error;
    res.json(data ?? []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Shared upload handler (used by both /upload/:productId and the alias) ─
async function handleProductImageUpload(req: Request, res: Response): Promise<void> {
  try {
    const { productId } = req.params;
    const db = getDb();
    const cloudinary = getCloudinaryService();

    if (!cloudinary.isConfigured()) {
      return res.status(503).json({
        error: 'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.'
      });
    }

    // Verify product exists
    const { data: product, error: prodErr } = await db
      .from('products')
      .select('id')
      .eq('id', productId)
      .single();

    if (prodErr || !product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No image files provided' });
    }

    // Determine starting display_order
    const { data: maxRow } = await db
      .from('product_images')
      .select('display_order')
      .eq('product_id', productId)
      .order('display_order', { ascending: false })
      .limit(1);

    const maxOrder = maxRow?.[0]?.display_order ?? -1;

    // Is this the first image for this product?
    const { count: existingCount } = await db
      .from('product_images')
      .select('*', { count: 'exact', head: true })
      .eq('product_id', productId);

    const isFirstBatch = (existingCount ?? 0) === 0;
    const now = new Date().toISOString();
    const savedImages: any[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const imgId = genImageId();

      // Upload to Cloudinary
      const cloudinaryResponse = await cloudinary.uploadImage(
        file.buffer,
        file.originalname || `image-${Date.now()}`,
        `royals/products/${productId}`
      );

      const isCover = isFirstBatch && i === 0;
      const altText = (req.body.altText as string || '').trim() || null;
      const viewType = (req.body.viewType as string || 'gallery').trim();

      const { error: imgErr } = await db.from('product_images').insert({
        id: imgId,
        product_id: productId,
        image_url: cloudinaryResponse.secure_url,
        display_order: maxOrder + 1 + i,
        is_cover: isCover,
        view_type: viewType,
        alt_text: altText,
        created_at: now,
        updated_at: now
      });

      if (imgErr) throw imgErr;

      savedImages.push({
        id: imgId,
        product_id: productId,
        image_url: cloudinaryResponse.secure_url,
        cloudinary_public_id: cloudinaryResponse.public_id,
        display_order: maxOrder + 1 + i,
        is_cover: isCover,
        view_type: viewType,
        alt_text: altText,
        created_at: now,
        updated_at: now
      });
    }

    await syncImagesJson(db, productId);

    res.status(201).json({
      success: true,
      message: `${savedImages.length} image(s) uploaded to Cloudinary successfully`,
      images: savedImages,
      storage: 'cloudinary'
    });
  } catch (err: any) {
    console.error('Image upload error:', err);
    res.status(500).json({ error: err.message || 'Image upload failed' });
  }
}

// ── POST /api/images/upload/:productId ────────────────────────────────────
// Admin — upload product images directly to Cloudinary.
router.post(
  '/upload/:productId',
  authenticateAdmin,
  upload.array('images', 10),
  handleProductImageUpload
);

// Alias — backward compatibility with admin panel calls that use the
// /upload-cloudinary/ path. Shares the exact same handler.
router.post(
  '/upload-cloudinary/:productId',
  authenticateAdmin,
  upload.array('images', 10),
  handleProductImageUpload
);

// ── DELETE /api/images/:imageId ───────────────────────────────────────────
// Admin — permanently deletes an image from Cloudinary + Supabase.
router.delete('/:imageId', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const cloudinary = getCloudinaryService();
    const { imageId } = req.params;

    const { data: img, error: fetchErr } = await db
      .from('product_images')
      .select('*')
      .eq('id', imageId)
      .single();

    if (fetchErr || !img) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Delete from Cloudinary if it is a Cloudinary URL
    if (img.image_url && img.image_url.includes('cloudinary.com')) {
      try {
        // Extract public_id from Cloudinary URL
        // URL pattern: .../upload/v.../royals/products/<productId>/<filename>
        const match = img.image_url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/);
        if (match?.[1]) {
          await cloudinary.deleteImage(match[1]);
        }
      } catch (cdnErr) {
        console.warn('Cloudinary delete warning (non-fatal):', cdnErr);
      }
    }

    // Delete from Supabase
    const { error: delErr } = await db
      .from('product_images')
      .delete()
      .eq('id', imageId);

    if (delErr) throw delErr;

    // If was cover, promote the next image
    if (img.is_cover) {
      const { data: nextImg } = await db
        .from('product_images')
        .select('id')
        .eq('product_id', img.product_id)
        .order('display_order', { ascending: true })
        .limit(1);

      if (nextImg?.[0]) {
        await db
          .from('product_images')
          .update({ is_cover: true, updated_at: new Date().toISOString() })
          .eq('id', nextImg[0].id);
      }
    }

    await syncImagesJson(db, img.product_id);

    res.json({ success: true, message: 'Image deleted permanently' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/images/:imageId/cover ─────────────────────────────────────
// Admin — makes the specified image the cover for its product.
router.patch('/:imageId/cover', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { imageId } = req.params;

    const { data: img, error: fetchErr } = await db
      .from('product_images')
      .select('*')
      .eq('id', imageId)
      .single();

    if (fetchErr || !img) {
      return res.status(404).json({ error: 'Image not found' });
    }

    const now = new Date().toISOString();

    // Clear all covers for this product
    await db
      .from('product_images')
      .update({ is_cover: false, updated_at: now })
      .eq('product_id', img.product_id);

    // Set chosen image as cover at position 0
    await db
      .from('product_images')
      .update({ is_cover: true, display_order: 0, updated_at: now })
      .eq('id', imageId);

    // Shift all other images by 1
    const { data: others } = await db
      .from('product_images')
      .select('id')
      .eq('product_id', img.product_id)
      .neq('id', imageId)
      .order('display_order', { ascending: true });

    if (others) {
      for (let i = 0; i < others.length; i++) {
        await db
          .from('product_images')
          .update({ display_order: i + 1, updated_at: now })
          .eq('id', others[i].id);
      }
    }

    await syncImagesJson(db, img.product_id);

    const { data: updatedImages } = await db
      .from('product_images')
      .select('*')
      .eq('product_id', img.product_id)
      .order('display_order', { ascending: true });

    res.json({
      success: true,
      message: 'Cover image updated',
      images: updatedImages ?? []
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/images/reorder/:productId ─────────────────────────────────
// Admin — re-orders images for a product.
// Body: { order: ["imageId1", "imageId2", ...] }
router.patch('/reorder/:productId', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { productId } = req.params;
    const { order } = req.body as { order: string[] };

    if (!Array.isArray(order) || order.length === 0) {
      return res.status(400).json({ error: 'order must be a non-empty array of image IDs' });
    }

    const now = new Date().toISOString();

    for (let i = 0; i < order.length; i++) {
      await db
        .from('product_images')
        .update({ display_order: i, updated_at: now })
        .eq('id', order[i])
        .eq('product_id', productId);
    }

    // First item in new order becomes cover
    await db
      .from('product_images')
      .update({ is_cover: false, updated_at: now })
      .eq('product_id', productId);

    if (order[0]) {
      await db
        .from('product_images')
        .update({ is_cover: true, updated_at: now })
        .eq('id', order[0])
        .eq('product_id', productId);
    }

    await syncImagesJson(db, productId);

    const { data: updatedImages } = await db
      .from('product_images')
      .select('*')
      .eq('product_id', productId)
      .order('display_order', { ascending: true });

    res.json({
      success: true,
      message: 'Image order saved',
      images: updatedImages ?? []
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/images/:imageId ────────────────────────────────────────────
// Admin — replace a single image file, preserving its metadata.
router.patch(
  '/:imageId',
  authenticateAdmin,
  upload.single('image'),
  async (req: Request, res: Response) => {
    try {
      const db = getDb();
      const cloudinary = getCloudinaryService();
      const { imageId } = req.params;

      if (!cloudinary.isConfigured()) {
        return res.status(503).json({ error: 'Cloudinary is not configured.' });
      }

      const { data: img, error: fetchErr } = await db
        .from('product_images')
        .select('*')
        .eq('id', imageId)
        .single();

      if (fetchErr || !img) {
        return res.status(404).json({ error: 'Image not found' });
      }

      const file = req.file as Express.Multer.File | undefined;
      if (!file) {
        return res.status(400).json({ error: 'No replacement image file provided' });
      }

      // Delete old Cloudinary asset
      if (img.image_url && img.image_url.includes('cloudinary.com')) {
        try {
          const match = img.image_url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/);
          if (match?.[1]) {
            await cloudinary.deleteImage(match[1]);
          }
        } catch (cdnErr) {
          console.warn('Cloudinary old-image delete warning (non-fatal):', cdnErr);
        }
      }

      // Upload replacement to Cloudinary
      const cloudinaryResponse = await cloudinary.uploadImage(
        file.buffer,
        file.originalname || `image-${Date.now()}`,
        `royals/products/${img.product_id}`
      );

      const now = new Date().toISOString();

      const { error: updateErr } = await db
        .from('product_images')
        .update({ image_url: cloudinaryResponse.secure_url, updated_at: now })
        .eq('id', imageId);

      if (updateErr) throw updateErr;

      await syncImagesJson(db, img.product_id);

      res.json({
        success: true,
        message: 'Image replaced successfully',
        image: {
          ...img,
          image_url: cloudinaryResponse.secure_url,
          updated_at: now
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

export { syncImagesJson };
export default router;
