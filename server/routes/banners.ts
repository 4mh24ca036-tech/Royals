/**
 * server/routes/banners.ts
 *
 * Banner management — Cloudinary is the ONLY image storage backend.
 * No local filesystem writes. All banner images go to Cloudinary;
 * the resulting secure_url is stored in Supabase banners table.
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

function genId(): string {
  return `banner_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

function formatBanner(row: any) {
  return { ...row };
}

// ── Upload helper: image → Cloudinary ────────────────────────────────────
async function uploadBannerImage(
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
async function deleteBannerImage(imageUrl: string): Promise<void> {
  if (!imageUrl || !imageUrl.includes('cloudinary.com')) return;
  const cloudinary = getCloudinaryService();
  try {
    const match = imageUrl.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/);
    if (match?.[1]) {
      await cloudinary.deleteImage(match[1]);
    }
  } catch (err) {
    console.warn('Cloudinary banner delete warning (non-fatal):', err);
  }
}

// ── GET /api/banners  (PUBLIC) ────────────────────────────────────────────
// Returns only active banners ordered by display_order.
router.get('/', async (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const { data, error } = await db
      .from('banners')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) throw error;
    res.json((data ?? []).map(formatBanner));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/banners/all  (ADMIN) ─────────────────────────────────────────
// Returns all banners including inactive.
router.get('/all', authenticateAdmin, async (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const { data, error } = await db
      .from('banners')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) throw error;
    res.json((data ?? []).map(formatBanner));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/banners  (ADMIN) ────────────────────────────────────────────
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
        return res.status(400).json({ error: 'A desktop banner image is required.' });
      }

      const id = genId();
      const now = new Date().toISOString();

      // Get next display_order
      const { data: maxRow } = await db
        .from('banners')
        .select('display_order')
        .order('display_order', { ascending: false })
        .limit(1);
      const displayOrder = ((maxRow?.[0]?.display_order as number) ?? -1) + 1;

      // Upload desktop image to Cloudinary
      const imageUrl = await uploadBannerImage(
        desktopFile.buffer,
        desktopFile.originalname || 'banner-desktop',
        `royals/banners/${id}`
      );

      // Upload mobile image if provided
      let mobileImageUrl = '';
      if (mobileFile) {
        mobileImageUrl = await uploadBannerImage(
          mobileFile.buffer,
          mobileFile.originalname || 'banner-mobile',
          `royals/banners/${id}`
        );
      }

      const body = req.body as Record<string, string>;
      const isActive = body.is_active === '1' || body.is_active === 'true';

      const { error: insertErr } = await db.from('banners').insert({
        id,
        title: body.title ?? '',
        subtitle: body.subtitle ?? '',
        description: body.description ?? '',
        image_url: imageUrl,
        mobile_image_url: mobileImageUrl,
        button_text: body.button_text ?? '',
        button_link: body.button_link ?? '',
        tag: body.tag ?? '',
        category_id: body.category_id ?? '',
        display_order: displayOrder,
        is_active: isActive,
        created_at: now,
        updated_at: now
      });

      if (insertErr) throw insertErr;

      const { data: banner } = await db.from('banners').select('*').eq('id', id).single();
      res.status(201).json({ success: true, banner: formatBanner(banner) });
    } catch (err: any) {
      console.error('Banner create error:', err);
      res.status(500).json({ error: err.message });
    }
  }
);

// ── PUT /api/banners/:id  (ADMIN) ─────────────────────────────────────────
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
        .from('banners')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchErr || !existing) {
        return res.status(404).json({ error: 'Banner not found' });
      }

      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      const desktopFile = files?.['image']?.[0];
      const mobileFile = files?.['mobile_image']?.[0];
      const now = new Date().toISOString();

      let imageUrl: string = existing.image_url as string;
      let mobileImageUrl: string = (existing.mobile_image_url as string) || '';

      // Replace desktop image if new one uploaded
      if (desktopFile) {
        await deleteBannerImage(existing.image_url as string);
        imageUrl = await uploadBannerImage(
          desktopFile.buffer,
          desktopFile.originalname || 'banner-desktop',
          `royals/banners/${id}`
        );
      }

      // Replace / add mobile image if uploaded
      if (mobileFile) {
        if (mobileImageUrl) await deleteBannerImage(mobileImageUrl);
        mobileImageUrl = await uploadBannerImage(
          mobileFile.buffer,
          mobileFile.originalname || 'banner-mobile',
          `royals/banners/${id}`
        );
      }

      const body = req.body as Record<string, string>;

      const updates: Record<string, any> = {
        image_url: imageUrl,
        mobile_image_url: mobileImageUrl,
        updated_at: now
      };

      if (body.title !== undefined) updates.title = body.title;
      if (body.subtitle !== undefined) updates.subtitle = body.subtitle;
      if (body.description !== undefined) updates.description = body.description;
      if (body.button_text !== undefined) updates.button_text = body.button_text;
      if (body.button_link !== undefined) updates.button_link = body.button_link;
      if (body.tag !== undefined) updates.tag = body.tag;
      if (body.category_id !== undefined) updates.category_id = body.category_id;
      if (body.is_active !== undefined) {
        updates.is_active = body.is_active === '1' || body.is_active === 'true';
      }

      const { error: updateErr } = await db
        .from('banners')
        .update(updates)
        .eq('id', id);

      if (updateErr) throw updateErr;

      const { data: updated } = await db.from('banners').select('*').eq('id', id).single();
      res.json({ success: true, banner: formatBanner(updated) });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ── PATCH /api/banners/:id/toggle  (ADMIN) ───────────────────────────────
router.patch('/:id/toggle', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { id } = req.params;

    const { data: banner, error: fetchErr } = await db
      .from('banners')
      .select('is_active')
      .eq('id', id)
      .single();

    if (fetchErr || !banner) {
      return res.status(404).json({ error: 'Banner not found' });
    }

    const newActive = !banner.is_active;

    const { error: updateErr } = await db
      .from('banners')
      .update({ is_active: newActive, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (updateErr) throw updateErr;

    res.json({
      success: true,
      is_active: newActive,
      message: `Banner ${newActive ? 'enabled' : 'disabled'}`
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/banners/reorder  (ADMIN) ──────────────────────────────────
// Body: { order: ["id1", "id2", ...] }
router.patch('/reorder', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { order } = req.body as { order: string[] };

    if (!Array.isArray(order) || order.length === 0) {
      return res.status(400).json({ error: 'order must be a non-empty array of banner IDs' });
    }

    const now = new Date().toISOString();

    for (let i = 0; i < order.length; i++) {
      await db
        .from('banners')
        .update({ display_order: i, updated_at: now })
        .eq('id', order[i]);
    }

    const { data: banners } = await db
      .from('banners')
      .select('*')
      .order('display_order', { ascending: true });

    res.json({ success: true, banners: (banners ?? []).map(formatBanner) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/banners/:id  (ADMIN) ─────────────────────────────────────
router.delete('/:id', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { id } = req.params;

    const { data: banner, error: fetchErr } = await db
      .from('banners')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !banner) {
      return res.status(404).json({ error: 'Banner not found' });
    }

    // Delete Cloudinary assets
    await deleteBannerImage(banner.image_url as string);
    if (banner.mobile_image_url) {
      await deleteBannerImage(banner.mobile_image_url as string);
    }

    const { error: delErr } = await db.from('banners').delete().eq('id', id);
    if (delErr) throw delErr;

    res.json({ success: true, message: 'Banner deleted permanently' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
