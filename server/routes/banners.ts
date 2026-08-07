import { Router, Request, Response } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { getDb, persistDb } from '../db.js';
import { authenticateAdmin } from '../auth.js';

const router = Router();

// ── Storage ──────────────────────────────────────────────────────────────
const BANNERS_DIR = path.join(process.cwd(), 'public', 'uploads', 'banners');

function ensureBannersDir() {
  if (!fs.existsSync(BANNERS_DIR)) fs.mkdirSync(BANNERS_DIR, { recursive: true });
}

// Multer: memory storage so sharp can process before writing
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 2 }, // 15 MB, max 2 files per request
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
function genId() {
  return `banner_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

// ── Image helpers ─────────────────────────────────────────────────────────
async function saveImage(
  buffer: Buffer,
  mimeType: string,
  filenameBase: string,
  width: number
): Promise<string> {
  ensureBannersDir();
  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const filename = `${filenameBase}.${ext}`;
  const destPath = path.join(BANNERS_DIR, filename);

  const s = sharp(buffer).resize({ width, withoutEnlargement: true });
  if (mimeType === 'image/png') {
    await s.png({ quality: 85 }).toFile(destPath);
  } else if (mimeType === 'image/webp') {
    await s.webp({ quality: 85 }).toFile(destPath);
  } else {
    await s.jpeg({ quality: 87, progressive: true }).toFile(destPath);
  }
  return `/uploads/banners/${filename}`;
}

function deleteFile(publicUrl: string) {
  if (!publicUrl || !publicUrl.startsWith('/uploads/banners/')) return;
  const filePath = path.join(process.cwd(), 'public', publicUrl);
  if (fs.existsSync(filePath)) {
    try { fs.unlinkSync(filePath); } catch { /* ignore */ }
  }
}

function formatBanner(row: any) {
  return {
    ...row,
    is_active: Boolean(row.is_active)
  };
}

// ── GET /api/banners  (PUBLIC — no auth required) ─────────────────────────
// Returns only active banners ordered by display_order.
router.get('/', async (_req: Request, res: Response) => {
  try {
    const db = await getDb();
    const banners = queryAll(
      db,
      'SELECT * FROM banners WHERE is_active = 1 ORDER BY display_order ASC, created_at ASC'
    );
    res.json(banners.map(formatBanner));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/banners/all  (ADMIN — all banners including inactive) ─────────
router.get('/all', authenticateAdmin, async (_req: Request, res: Response) => {
  try {
    const db = await getDb();
    const banners = queryAll(db, 'SELECT * FROM banners ORDER BY display_order ASC, created_at ASC');
    res.json(banners.map(formatBanner));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/banners  (ADMIN — create banner with optional image upload) ──
// Accepts multipart/form-data.
// Fields: title, subtitle, description, button_text, button_link, tag, category_id, is_active
// Files:  image (desktop), mobile_image (optional)
router.post(
  '/',
  authenticateAdmin,
  upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'mobile_image', maxCount: 1 }
  ]),
  async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      const files = req.files as Record<string, Express.Multer.File[]> | undefined;

      const desktopFile = files?.['image']?.[0];
      const mobileFile  = files?.['mobile_image']?.[0];

      if (!desktopFile) {
        return res.status(400).json({ error: 'A desktop banner image is required.' });
      }

      const id = genId();
      const now = new Date().toISOString();

      // Determine next display order
      const maxRow = queryOne(db, 'SELECT MAX(display_order) as m FROM banners');
      const displayOrder = ((maxRow?.m as number) ?? -1) + 1;

      // Save desktop image (max 1920px wide)
      const imageUrl = await saveImage(
        desktopFile.buffer,
        desktopFile.mimetype,
        `${id}_desktop`,
        1920
      );

      // Save mobile image (max 768px wide) if provided
      let mobileImageUrl = '';
      if (mobileFile) {
        mobileImageUrl = await saveImage(
          mobileFile.buffer,
          mobileFile.mimetype,
          `${id}_mobile`,
          768
        );
      }

      const {
        title = '',
        subtitle = '',
        description = '',
        button_text = '',
        button_link = '',
        tag = '',
        category_id = '',
        is_active = '1'
      } = req.body as Record<string, string>;

      db.run(
        `INSERT INTO banners
           (id, title, subtitle, description, image_url, mobile_image_url, button_text, button_link, tag, category_id, display_order, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, title, subtitle, description, imageUrl, mobileImageUrl, button_text, button_link, tag, category_id, displayOrder, is_active === '1' || is_active === 'true' ? 1 : 0, now, now]
      );
      persistDb();

      const banner = queryOne(db, 'SELECT * FROM banners WHERE id = ?', [id]);
      res.status(201).json({ success: true, banner: formatBanner(banner) });
    } catch (err: any) {
      console.error('Banner create error:', err);
      res.status(500).json({ error: err.message });
    }
  }
);

// ── PUT /api/banners/:id  (ADMIN — update metadata + optionally replace images) ──
router.put(
  '/:id',
  authenticateAdmin,
  upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'mobile_image', maxCount: 1 }
  ]),
  async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      const { id } = req.params;
      const existing = queryOne(db, 'SELECT * FROM banners WHERE id = ?', [id]);
      if (!existing) return res.status(404).json({ error: 'Banner not found' });

      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      const desktopFile = files?.['image']?.[0];
      const mobileFile  = files?.['mobile_image']?.[0];

      const now = new Date().toISOString();
      let imageUrl: string = existing.image_url as string;
      let mobileImageUrl: string = (existing.mobile_image_url as string) || '';

      // Replace desktop image if new one provided
      if (desktopFile) {
        deleteFile(existing.image_url as string);
        imageUrl = await saveImage(desktopFile.buffer, desktopFile.mimetype, `${id}_desktop_${Date.now()}`, 1920);
      }

      // Replace / add mobile image if provided
      if (mobileFile) {
        if (mobileImageUrl) deleteFile(mobileImageUrl);
        mobileImageUrl = await saveImage(mobileFile.buffer, mobileFile.mimetype, `${id}_mobile_${Date.now()}`, 768);
      }

      const body = req.body as Record<string, string>;
      const title         = body.title         !== undefined ? body.title         : existing.title;
      const subtitle      = body.subtitle      !== undefined ? body.subtitle      : existing.subtitle;
      const description   = body.description   !== undefined ? body.description   : existing.description;
      const button_text   = body.button_text   !== undefined ? body.button_text   : existing.button_text;
      const button_link   = body.button_link   !== undefined ? body.button_link   : existing.button_link;
      const tag           = body.tag           !== undefined ? body.tag           : existing.tag;
      const category_id   = body.category_id   !== undefined ? body.category_id   : existing.category_id;
      const is_active     = body.is_active     !== undefined
        ? (body.is_active === '1' || body.is_active === 'true' ? 1 : 0)
        : Number(existing.is_active);

      db.run(
        `UPDATE banners SET
           title = ?, subtitle = ?, description = ?,
           image_url = ?, mobile_image_url = ?,
           button_text = ?, button_link = ?,
           tag = ?, category_id = ?,
           is_active = ?, updated_at = ?
         WHERE id = ?`,
        [title, subtitle, description, imageUrl, mobileImageUrl, button_text, button_link, tag, category_id, is_active, now, id]
      );
      persistDb();

      const updated = queryOne(db, 'SELECT * FROM banners WHERE id = ?', [id]);
      res.json({ success: true, banner: formatBanner(updated) });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ── PATCH /api/banners/:id/toggle  (ADMIN — enable/disable) ──────────────
router.patch('/:id/toggle', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const { id } = req.params;
    const banner = queryOne(db, 'SELECT * FROM banners WHERE id = ?', [id]);
    if (!banner) return res.status(404).json({ error: 'Banner not found' });

    const newActive = banner.is_active ? 0 : 1;
    db.run('UPDATE banners SET is_active = ?, updated_at = ? WHERE id = ?', [newActive, new Date().toISOString(), id]);
    persistDb();

    res.json({ success: true, is_active: Boolean(newActive), message: `Banner ${newActive ? 'enabled' : 'disabled'}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/banners/reorder  (ADMIN — reorder all banners) ────────────
// Body: { order: ["id1", "id2", ...] }
router.patch('/reorder', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const { order } = req.body as { order: string[] };
    if (!Array.isArray(order) || order.length === 0) {
      return res.status(400).json({ error: 'order must be a non-empty array of banner IDs' });
    }
    const now = new Date().toISOString();
    order.forEach((bannerId, idx) => {
      db.run('UPDATE banners SET display_order = ?, updated_at = ? WHERE id = ?', [idx, now, bannerId]);
    });
    persistDb();

    const banners = queryAll(db, 'SELECT * FROM banners ORDER BY display_order ASC');
    res.json({ success: true, banners: banners.map(formatBanner) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/banners/:id  (ADMIN — permanently delete) ─────────────────
router.delete('/:id', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const { id } = req.params;
    const banner = queryOne(db, 'SELECT * FROM banners WHERE id = ?', [id]);
    if (!banner) return res.status(404).json({ error: 'Banner not found' });

    // Delete physical files (only /uploads/banners/ files, never seed /images/ files)
    deleteFile(banner.image_url as string);
    if (banner.mobile_image_url) deleteFile(banner.mobile_image_url as string);

    db.run('DELETE FROM banners WHERE id = ?', [id]);
    persistDb();

    res.json({ success: true, message: 'Banner deleted permanently' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
