import { Router, Request } from 'express';
import { getDb, persistDb } from '../db.js';
import { optionalAuthenticateUser, UserJwtPayload } from '../auth.js';
import { rateLimit, sanitizeText, serverError } from '../security.js';

const router = Router();

const reviewLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Too many reviews submitted. Please try again later.'
});

// Helper to convert db results to objects
function queryAll(db: any, sql: string, params: any[] = []) {
  const stmt = db.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

// GET all categories
router.get('/categories', async (req, res) => {
  try {
    const db = await getDb();
    const categories = queryAll(db, 'SELECT * FROM categories ORDER BY display_order ASC');
    res.json(categories);
  } catch (err: any) {
    return serverError(res, 'products route', err);
  }
});

// GET all products with filtering, search, sorting
router.get('/', async (req, res) => {
  try {
    const db = await getDb();
    const { category, search, minPrice, maxPrice, fabric, color, sort, featured, newArrival } = req.query;

    let sql = 'SELECT * FROM products WHERE 1=1';
    const params: any[] = [];

    if (category) {
      sql += ' AND (category_id = ? OR category_name = ?)';
      params.push(category, category);
    }

    if (featured === 'true' || featured === '1') {
      sql += ' AND is_featured = 1';
    }

    if (newArrival === 'true' || newArrival === '1') {
      sql += ' AND is_new_arrival = 1';
    }

    if (fabric) {
      sql += ' AND fabric LIKE ?';
      params.push(`%${fabric}%`);
    }

    if (color) {
      sql += ' AND color LIKE ?';
      params.push(`%${color}%`);
    }

    if (minPrice) {
      sql += ' AND (COALESCE(discount_price, price) >= ?)';
      params.push(Number(minPrice));
    }

    if (maxPrice) {
      sql += ' AND (COALESCE(discount_price, price) <= ?)';
      params.push(Number(maxPrice));
    }

    if (search) {
      sql += ' AND (title LIKE ? OR description LIKE ? OR fabric LIKE ? OR embroidery LIKE ? OR color LIKE ? OR category_name LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term, term, term, term);
    }

    // Sorting
    switch (sort) {
      case 'price-asc':
        sql += ' ORDER BY COALESCE(discount_price, price) ASC';
        break;
      case 'price-desc':
        sql += ' ORDER BY COALESCE(discount_price, price) DESC';
        break;
      case 'rating':
        sql += ' ORDER BY rating DESC';
        break;
      case 'newest':
        sql += ' ORDER BY created_at DESC';
        break;
      case 'discount':
        sql += ' ORDER BY (price - COALESCE(discount_price, price)) DESC';
        break;
      default:
        sql += ' ORDER BY is_featured DESC, created_at DESC';
    }

    const rows = queryAll(db, sql, params);

    const formatted = rows.map((r: any) => ({
      ...r,
      sizes: JSON.parse(r.sizes_json || '[]'),
      images: JSON.parse(r.images_json || '[]'),
      is_featured: Boolean(r.is_featured),
      is_new_arrival: Boolean(r.is_new_arrival)
    }));

    res.json(formatted);
  } catch (err: any) {
    return serverError(res, 'products route', err);
  }
});

// GET single product by ID or Slug
router.get('/:idOrSlug', async (req, res) => {
  try {
    const db = await getDb();
    const { idOrSlug } = req.params;

    const rows = queryAll(db, 'SELECT * FROM products WHERE id = ? OR slug = ? LIMIT 1', [idOrSlug, idOrSlug]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const prod = rows[0];
    const reviews = queryAll(db, 'SELECT * FROM reviews WHERE product_id = ? ORDER BY created_at DESC', [prod.id]);
    const inventory = queryAll(db, 'SELECT * FROM inventory WHERE product_id = ?', [prod.id]);

    const formatted = {
      ...prod,
      sizes: JSON.parse(prod.sizes_json || '[]'),
      images: JSON.parse(prod.images_json || '[]'),
      is_featured: Boolean(prod.is_featured),
      is_new_arrival: Boolean(prod.is_new_arrival),
      reviews,
      inventory
    };

    res.json(formatted);
  } catch (err: any) {
    return serverError(res, 'products route', err);
  }
});

// POST a review for a product
router.post('/:id/reviews', reviewLimiter, optionalAuthenticateUser, async (req: Request & { user?: UserJwtPayload }, res) => {
  try {
    const db = await getDb();
    const { id } = req.params;
    const userName = req.user?.name || sanitizeText(req.body?.userName, 60);
    const comment = sanitizeText(req.body?.comment, 2000);
    const rating = Number(req.body?.rating);

    if (!userName || !comment || !Number.isFinite(rating)) {
      return res.status(400).json({ error: 'Missing required review fields' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    const product = queryAll(db, 'SELECT id FROM products WHERE id = ? LIMIT 1', [id])[0];
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // A review is only flagged as verified when the reviewer actually bought the product.
    const verifiedPurchase = req.user
      ? queryAll(
          db,
          `SELECT oi.id FROM order_items oi JOIN orders o ON oi.order_id = o.id
           WHERE oi.product_id = ? AND (o.user_id = ? OR o.customer_email = ?) LIMIT 1`,
          [id, req.user.id, req.user.email]
        ).length > 0
        ? 1
        : 0
      : 0;

    const reviewId = `rev_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const createdAt = new Date().toISOString();

    db.run(
      `INSERT INTO reviews (id, product_id, user_name, rating, comment, verified_purchase, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      [reviewId, id, userName, rating, comment, verifiedPurchase, createdAt]
    );

    // Recalculate product rating
    const revs = queryAll(db, 'SELECT rating FROM reviews WHERE product_id = ?', [id]);
    const avgRating = revs.reduce((acc: number, r: any) => acc + Number(r.rating), 0) / revs.length;
    const roundedRating = Number(avgRating.toFixed(2));

    db.run('UPDATE products SET rating = ?, review_count = ? WHERE id = ?', [roundedRating, revs.length, id]);
    persistDb();

    res.status(201).json({
      id: reviewId,
      product_id: id,
      user_name: userName,
      rating,
      comment,
      verified_purchase: verifiedPurchase,
      created_at: createdAt
    });
  } catch (err: any) {
    return serverError(res, 'products route', err);
  }
});

export default router;
