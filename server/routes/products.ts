import { Router } from 'express';
import { getDb, persistDb } from '../db.js';
import { queryAll, parseJsonColumn } from '../dbUtils.js';
import { asyncHandler, HttpError } from '../errors.js';

const router = Router();

// GET all categories
router.get(
  '/categories',
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const categories = queryAll(db, 'SELECT * FROM categories ORDER BY display_order ASC');
    res.json(categories);
  })
);

// GET all products with filtering, search, sorting
router.get(
  '/',
  asyncHandler(async (req, res) => {
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
      sizes: parseJsonColumn<string[]>(r.sizes_json, 'products.sizes_json', r.id, []),
      images: parseJsonColumn<string[]>(r.images_json, 'products.images_json', r.id, []),
      is_featured: Boolean(r.is_featured),
      is_new_arrival: Boolean(r.is_new_arrival)
    }));

    res.json(formatted);
  })
);

// GET single product by ID or Slug
router.get(
  '/:idOrSlug',
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const { idOrSlug } = req.params;

    const rows = queryAll(db, 'SELECT * FROM products WHERE id = ? OR slug = ? LIMIT 1', [idOrSlug, idOrSlug]);

    if (rows.length === 0) {
      throw new HttpError(404, 'Product not found');
    }

    const prod = rows[0];
    const reviews = queryAll(db, 'SELECT * FROM reviews WHERE product_id = ? ORDER BY created_at DESC', [prod.id]);
    const inventory = queryAll(db, 'SELECT * FROM inventory WHERE product_id = ?', [prod.id]);

    const formatted = {
      ...prod,
      sizes: parseJsonColumn<string[]>(prod.sizes_json, 'products.sizes_json', prod.id, []),
      images: parseJsonColumn<string[]>(prod.images_json, 'products.images_json', prod.id, []),
      is_featured: Boolean(prod.is_featured),
      is_new_arrival: Boolean(prod.is_new_arrival),
      reviews,
      inventory
    };

    res.json(formatted);
  })
);

// POST a review for a product
router.post(
  '/:id/reviews',
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const { id } = req.params;
    const { userName, rating, comment } = req.body;

    if (!userName || !rating || !comment) {
      throw new HttpError(400, 'Missing required review fields');
    }

    const product = queryAll(db, 'SELECT id FROM products WHERE id = ? LIMIT 1', [id]);
    if (product.length === 0) {
      throw new HttpError(404, 'Product not found');
    }

    const reviewId = `rev_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const createdAt = new Date().toISOString();

    db.run(
      `INSERT INTO reviews (id, product_id, user_name, rating, comment, verified_purchase, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      [reviewId, id, userName, Number(rating), comment, 1, createdAt]
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
      rating: Number(rating),
      comment,
      verified_purchase: 1,
      created_at: createdAt
    });
  })
);

export default router;
