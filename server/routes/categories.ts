import { Router, Request, Response } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { getDb, persistDb } from '../db.js';
import { authenticateAdmin } from '../auth.js';

const router = Router();

// ── Storage ──────────────────────────────────────────────────────────────
const CATEGORIES_DIR = path.join(process.cwd(), 'public', 'uploads', 'categories');

function ensureCategoriesDir() {
  if (!fs.existsSync(CATEGORIES_DIR)) fs.mkdirSync(CATEGORIES_DIR, { recursive: true });
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

// ── Image helpers ─────────────────────────────────────────────────────────
async function saveImage(
  buffer: Buffer,
  mimeType: string,
  filenameBase: string,
  width: number
): Promise<string> {
  ensureCategoriesDir();
  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const filename = `${filenameBase}.${ext}`;
  const destPath = path.join(CATEGORIES_DIR, filename);

  const s = sharp(buffer).resize({ width, withoutEnlargement: true });
  if (mimeType === 'image/png') {
    await s.png({ quality: 85 }).toFile(destPath);
  } else if (mimeType === 'image/webp') {
    await s.webp({ quality: 85 }).toFile(destPath);
  } else {
    await s.jpeg({ quality: 87, progressive: true }).toFile(destPath);
  }
  return `/uploads/categories/${filename}`;
}

function deleteFile(publicUrl: string) {
  if (!publicUrl || !publicUrl.startsWith('/uploads/categories/')) return;
  const filePath = path.join(process.cwd(), 'public', publicUrl);
  if (fs.existsSync(filePath)) {
    try { fs.unlinkSync(filePath); } catch { /* ignore */ }
  }
}

function formatCategory(row: any) {
  return {
    ...row,
    is_active: Boolean(row.is_active)
  };
}

// ── GET /api/categories  (PUBLIC — no auth required) ─────────────────────
// Returns only active categories ordered by display_order.
router.get('/', async (_req: Request, res: Response) => {
  try {
    const db = await getDb();
    const categories = queryAll(
      db,
      'SELECT * FROM categories WHERE is_active = 1 ORDER BY display_order ASC, created_at ASC'
    );
    res.json(categories.map(formatCategory));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/categories/all  (ADMIN — all categories including inactive) ─
router.get('/all', authenticateAdmin, async (_req: Request, res: Response) => {
  try {
    const db = await getDb();
    const categories = queryAll(db, 'SELECT * FROM categories ORDER BY display_order ASC, created_at ASC');
    res.json(categories.map(formatCategory));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/categories/:id  (PUBLIC — get single category) ───────────────
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const category = queryOne(db, 'SELECT * FROM categories WHERE id = ?', [req.params.id]);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.json(formatCategory(category));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/categories  (ADMIN — create category with optional image upload) ──
// Accepts multipart/form-data.
// Fields: name, slug, description, display_order, is_active
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
        return res.status(400).json({ error: 'A desktop category image is required.' });
      }

      const id = `cat_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      const now = new Date().toISOString();

      // Determine next display order
      const maxRow = queryOne(db, 'SELECT MAX(display_order) as m FROM categories');
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
        name = '',
        slug = '',
        description = '',
        display_order = displayOrder.toString(),
        is_active = '1'
      } = req.body as Record<string, string>;

      db.run(
        `INSERT INTO categories
           (id, name, slug, description, image_url, mobile_image_url, is_active, created_at, updated_at, display_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, name, slug, description, imageUrl, mobileImageUrl, is_active === '1' || is_active === 'true' ? 1 : 0, now, now, parseInt(display_order, 10)]
      );
      persistDb();

      const category = queryOne(db, 'SELECT * FROM categories WHERE id = ?', [id]);
      res.status(201).json({ success: true, category: formatCategory(category) });
    } catch (err: any) {
      console.error('Category create error:', err);
      res.status(500).json({ error: err.message });
    }
  }
);

// ── PUT /api/categories/:id  (ADMIN — update metadata + optionally replace images) ──
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
      const existing = queryOne(db, 'SELECT * FROM categories WHERE id = ?', [id]);
      if (!existing) return res.status(404).json({ error: 'Category not found' });

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
      const name         = body.name         !== undefined ? body.name         : existing.name;
      const slug         = body.slug         !== undefined ? body.slug         : existing.slug;
      const description  = body.description  !== undefined ? body.description  : existing.description;
      const displayOrder = body.display_order !== undefined ? parseInt(body.display_order, 10) : existing.display_order;
      const isActive     = body.is_active    !== undefined ? (body.is_active === '1' || body.is_active === 'true' ? 1 : 0) : existing.is_active;

      db.run(
        `UPDATE categories
         SET name = ?, slug = ?, description = ?, image_url = ?, mobile_image_url = ?, is_active = ?, updated_at = ?, display_order = ?
         WHERE id = ?`,
        [name, slug, description, imageUrl, mobileImageUrl, isActive, now, displayOrder, id]
      );
      persistDb();

      const category = queryOne(db, 'SELECT * FROM categories WHERE id = ?', [id]);
      res.json({ success: true, category: formatCategory(category) });
    } catch (err: any) {
      console.error('Category update error:', err);
      res.status(500).json({ error: err.message });
    }
  }
);

// ── PATCH /api/categories/:id/toggle  (ADMIN — toggle active status) ────────
router.patch('/:id/toggle', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const { id } = req.params;
    const existing = queryOne(db, 'SELECT * FROM categories WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Category not found' });

    const newStatus = existing.is_active ? 0 : 1;
    const now = new Date().toISOString();

    db.run(
      'UPDATE categories SET is_active = ?, updated_at = ? WHERE id = ?',
      [newStatus, now, id]
    );
    persistDb();

    const category = queryOne(db, 'SELECT * FROM categories WHERE id = ?', [id]);
    res.json({ success: true, category: formatCategory(category) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/categories/:id  (ADMIN — delete category) ───────────────────
router.delete('/:id', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const { id } = req.params;
    const existing = queryOne(db, 'SELECT * FROM categories WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Category not found' });

    // Delete image files
    deleteFile(existing.image_url as string);
    if (existing.mobile_image_url) {
      deleteFile(existing.mobile_image_url as string);
    }

    db.run('DELETE FROM categories WHERE id = ?', [id]);
    persistDb();

    res.json({ success: true, message: 'Category deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/categories/reorder  (ADMIN — reorder categories) ─────────────
router.patch('/reorder', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const { order } = req.body as { order: string[] };
    if (!Array.isArray(order)) {
      return res.status(400).json({ error: 'Order must be an array of category IDs' });
    }

    const now = new Date().toISOString();
    order.forEach((categoryId, index) => {
      db.run(
        'UPDATE categories SET display_order = ?, updated_at = ? WHERE id = ?',
        [index, now, categoryId]
      );
    });
    persistDb();

    const categories = queryAll(db, 'SELECT * FROM categories ORDER BY display_order ASC');
    res.json({ success: true, categories: categories.map(formatCategory) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
