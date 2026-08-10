/**
 * server/routes/categories.ts
 *
 * Category management — Cloudinary is the ONLY image storage backend.
 * No local filesystem writes. All category images go to Cloudinary;
 * the resulting secure_url is stored in Supabase categories table.
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
  limits: { fileSize: 15 * 1024 * 1024, files: 2 },
  fileFilter(_req, file, cb) {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Only JPEG, PNG, and WebP images are accepted.'));
    }
    cb(null, true);
  }
});

function formatCategory(row: any) {
  return { ...row };
}

// ── Upload helper: image → Cloudinary ────────────────────────────────────
async function uploadCategoryImage(
  buffer: Buffer,
  originalname: string,
  folder: string
): Promise<string> {
  const cloudinary = getCloudinaryService();
  if (!cloudinary.isConfigured()) {
    throw new Error('Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.');
  }
  const result = await cloudinary.uploadImage(buffer, originalname, folder);
  return result.secure_url;
}

// ── Delete helper: remove old Cloudinary asset ────────────────────────────
async function deleteCategoryImage(imageUrl: string): Promise<void> {
  if (!imageUrl || !imageUrl.includes('cloudinary.com')) return;
  const cloudinary = getCloudinaryService();
  try {
    const match = imageUrl.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/);
    if (match?.[1]) {
      await cloudinary.deleteImage(match[1]);
    }
  } catch (err) {
    console.warn('Cloudinary category delete warning (non-fatal):', err);
  }
}

// ── GET /api/categories  (PUBLIC) ─────────────────────────────────────────
// Returns only active categories ordered by display_order.
router.get('/', async (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const { data, error } = await db
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) throw error;
    res.json((data ?? []).map(formatCategory));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/categories/all  (ADMIN) ─────────────────────────────────────
// Returns all categories including inactive.
router.get('/all', authenticateAdmin, async (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const { data, error } = await db
      .from('categories')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) throw error;
    res.json((data ?? []).map(formatCategory));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/categories/:id  (PUBLIC) ────────────────────────────────────
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { data: category, error } = await db
      .from('categories')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.json(formatCategory(category));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/categories  (ADMIN) ────────────────────────────────────────
// Accepts multipart/form-data.
// Files: image (desktop, required), mobile_image (optional)
router.post(
  '/',
  authenticateAdmin,
  upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'mobile_image', maxCount: 1 }
  ]),
  async (req: Request, res: Response) => {
    try {
      const db = getDb();
      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      const desktopFile = files?.['image']?.[0];
      const mobileFile = files?.['mobile_image']?.[0];

      if (!desktopFile) {
        return res.status(400).json({ error: 'A desktop category image is required.' });
      }

      const id = `cat_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      const now = new Date().toISOString();

      // Get next display_order
      const { data: maxRow } = await db
        .from('categories')
        .select('display_order')
        .order('display_order', { ascending: false })
        .limit(1);
      const displayOrder = ((maxRow?.[0]?.display_order as number) ?? -1) + 1;

      // Upload desktop image to Cloudinary
      const imageUrl = await uploadCategoryImage(
        desktopFile.buffer,
        desktopFile.originalname || 'category-desktop',
        `royals/categories/${id}`
      );

      // Upload mobile image if provided
      let mobileImageUrl = '';
      if (mobileFile) {
        mobileImageUrl = await uploadCategoryImage(
          mobileFile.buffer,
          mobileFile.originalname || 'category-mobile',
          `royals/categories/${id}`
        );
      }

      const body = req.body as Record<string, string>;
      const isActive = body.is_active === undefined || body.is_active === '1' || body.is_active === 'true';
      const explicitOrder = body.display_order !== undefined
        ? parseInt(body.display_order, 10)
        : displayOrder;

      const { error: insertErr } = await db.from('categories').insert({
        id,
        name: body.name ?? '',
        slug: body.slug ?? id,
        description: body.description ?? '',
        image_url: imageUrl,
        mobile_image_url: mobileImageUrl,
        is_active: isActive,
        display_order: explicitOrder,
        created_at: now,
        updated_at: now
      });

      if (insertErr) throw insertErr;

      const { data: category } = await db.from('categories').select('*').eq('id', id).single();
      res.status(201).json({ success: true, category: formatCategory(category) });
    } catch (err: any) {
      console.error('Category create error:', err);
      res.status(500).json({ error: err.message });
    }
  }
);

// ── PUT /api/categories/:id  (ADMIN) ─────────────────────────────────────
// Update metadata + optionally replace images.
router.put(
  '/:id',
  authenticateAdmin,
  upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'mobile_image', maxCount: 1 }
  ]),
  async (req: Request, res: Response) => {
    try {
      const db = getDb();
      const { id } = req.params;

      const { data: existing, error: fetchErr } = await db
        .from('categories')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchErr || !existing) {
        return res.status(404).json({ error: 'Category not found' });
      }

      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      const desktopFile = files?.['image']?.[0];
      const mobileFile = files?.['mobile_image']?.[0];
      const now = new Date().toISOString();

      let imageUrl: string = existing.image_url as string;
      let mobileImageUrl: string = (existing.mobile_image_url as string) || '';

      if (desktopFile) {
        await deleteCategoryImage(existing.image_url as string);
        imageUrl = await uploadCategoryImage(
          desktopFile.buffer,
          desktopFile.originalname || 'category-desktop',
          `royals/categories/${id}`
        );
      }

      if (mobileFile) {
        if (mobileImageUrl) await deleteCategoryImage(mobileImageUrl);
        mobileImageUrl = await uploadCategoryImage(
          mobileFile.buffer,
          mobileFile.originalname || 'category-mobile',
          `royals/categories/${id}`
        );
      }

      const body = req.body as Record<string, string>;
      const updates: Record<string, any> = {
        image_url: imageUrl,
        mobile_image_url: mobileImageUrl,
        updated_at: now
      };

      if (body.name !== undefined) updates.name = body.name;
      if (body.slug !== undefined) updates.slug = body.slug;
      if (body.description !== undefined) updates.description = body.description;
      if (body.display_order !== undefined) updates.display_order = parseInt(body.display_order, 10);
      if (body.is_active !== undefined) {
        updates.is_active = body.is_active === '1' || body.is_active === 'true';
      }

      const { error: updateErr } = await db
        .from('categories')
        .update(updates)
        .eq('id', id);

      if (updateErr) throw updateErr;

      const { data: category } = await db.from('categories').select('*').eq('id', id).single();
      res.json({ success: true, category: formatCategory(category) });
    } catch (err: any) {
      console.error('Category update error:', err);
      res.status(500).json({ error: err.message });
    }
  }
);

// ── PATCH /api/categories/:id/toggle  (ADMIN) ───────────────────────────
router.patch('/:id/toggle', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { id } = req.params;

    const { data: existing, error: fetchErr } = await db
      .from('categories')
      .select('is_active')
      .eq('id', id)
      .single();

    if (fetchErr || !existing) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const newStatus = !existing.is_active;
    const { error: updateErr } = await db
      .from('categories')
      .update({ is_active: newStatus, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (updateErr) throw updateErr;

    const { data: category } = await db.from('categories').select('*').eq('id', id).single();
    res.json({ success: true, category: formatCategory(category) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/categories/:id  (ADMIN) ──────────────────────────────────
router.delete('/:id', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { id } = req.params;

    const { data: existing, error: fetchErr } = await db
      .from('categories')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !existing) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Delete Cloudinary assets
    await deleteCategoryImage(existing.image_url as string);
    if (existing.mobile_image_url) {
      await deleteCategoryImage(existing.mobile_image_url as string);
    }

    const { error: delErr } = await db.from('categories').delete().eq('id', id);
    if (delErr) throw delErr;

    res.json({ success: true, message: 'Category deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/categories/reorder  (ADMIN) ───────────────────────────────
// Body: { order: ["id1", "id2", ...] }
router.patch('/reorder', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { order } = req.body as { order: string[] };

    if (!Array.isArray(order)) {
      return res.status(400).json({ error: 'order must be an array of category IDs' });
    }

    const now = new Date().toISOString();

    for (let i = 0; i < order.length; i++) {
      await db
        .from('categories')
        .update({ display_order: i, updated_at: now })
        .eq('id', order[i]);
    }

    const { data: categories } = await db
      .from('categories')
      .select('*')
      .order('display_order', { ascending: true });

    res.json({ success: true, categories: (categories ?? []).map(formatCategory) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
