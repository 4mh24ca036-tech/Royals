/**
 * server/routes/products.ts
 *
 * Public product & category API — reads from Supabase PostgreSQL.
 * No SQLite / sql.js dependency.
 */

import { Router } from 'express';
import { getDb, persistDb } from '../db.js';

const router = Router();

// ── GET /api/products/categories ─────────────────────────────────────────
router.get('/categories', async (req, res) => {
  try {
    const db = getDb();
    const { data, error } = await db
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) throw error;
    res.json(data ?? []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/products ─────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const { category, search, minPrice, maxPrice, fabric, color, sort, featured, newArrival } = req.query;

    let query = db.from('products').select('*');

    if (category) {
      query = query.or(`category_id.eq.${category},category_name.eq.${category}`);
    }
    if (featured === 'true' || featured === '1') {
      query = query.eq('is_featured', true);
    }
    if (newArrival === 'true' || newArrival === '1') {
      query = query.eq('is_new_arrival', true);
    }
    if (fabric) {
      query = query.ilike('fabric', `%${fabric}%`);
    }
    if (color) {
      query = query.ilike('color', `%${color}%`);
    }
    if (minPrice) {
      query = query.gte('price', Number(minPrice));
    }
    if (maxPrice) {
      query = query.lte('price', Number(maxPrice));
    }
    if (search) {
      const term = `%${search}%`;
      query = query.or(
        `title.ilike.${term},description.ilike.${term},fabric.ilike.${term},embroidery.ilike.${term},color.ilike.${term},category_name.ilike.${term}`
      );
    }

    // Sorting
    switch (sort) {
      case 'price-asc':
        query = query.order('price', { ascending: true });
        break;
      case 'price-desc':
        query = query.order('price', { ascending: false });
        break;
      case 'rating':
        query = query.order('rating', { ascending: false });
        break;
      case 'newest':
        query = query.order('updated_at', { ascending: false, nullsFirst: false });
        break;
      default:
        query = query
          .order('is_featured', { ascending: false })
          .order('display_order', { ascending: true });
    }

    const { data: rows, error } = await query;
    if (error) throw error;

    // For each product, fetch images from product_images (permanent table)
    const products = await Promise.all((rows ?? []).map(async (prod: any) => {
      const { data: imgRows } = await db
        .from('product_images')
        .select('image_url')
        .eq('product_id', prod.id)
        .order('display_order', { ascending: true });

      const images = imgRows && imgRows.length > 0
        ? imgRows.map((r: any) => r.image_url)
        : safeParseJson(prod.images_json, []);

      return {
        ...prod,
        sizes: safeParseJson(prod.sizes_json, []),
        images,
      };
    }));

    res.json(products);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/products/:idOrSlug ───────────────────────────────────────────
router.get('/:idOrSlug', async (req, res) => {
  try {
    const db = getDb();
    const { idOrSlug } = req.params;

    // Try by id first, then slug
    let { data: prod, error } = await db
      .from('products')
      .select('*')
      .eq('id', idOrSlug)
      .maybeSingle();

    if (error) throw error;

    if (!prod) {
      const result = await db
        .from('products')
        .select('*')
        .eq('slug', idOrSlug)
        .maybeSingle();
      if (result.error) throw result.error;
      prod = result.data;
    }

    if (!prod) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const [reviewsResult, inventoryResult, imageRecordsResult] = await Promise.all([
      db.from('reviews').select('*').eq('product_id', prod.id).order('created_at', { ascending: false }),
      db.from('inventory').select('*').eq('product_id', prod.id),
      db.from('product_images').select('*').eq('product_id', prod.id).order('display_order', { ascending: true })
    ]);

    if (reviewsResult.error) throw reviewsResult.error;
    if (inventoryResult.error) throw inventoryResult.error;
    if (imageRecordsResult.error) throw imageRecordsResult.error;

    const imageRecords = imageRecordsResult.data ?? [];
    const images = imageRecords.length > 0
      ? imageRecords.map((r: any) => r.image_url)
      : safeParseJson(prod.images_json, []);

    res.json({
      ...prod,
      sizes: safeParseJson(prod.sizes_json, []),
      images,
      image_records: imageRecords,
      reviews: reviewsResult.data ?? [],
      inventory: inventoryResult.data ?? []
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/products/:id/reviews ────────────────────────────────────────
router.post('/:id/reviews', async (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { userName, rating, comment } = req.body;

    if (!userName || !rating || !comment) {
      return res.status(400).json({ error: 'Missing required review fields' });
    }

    const reviewId = `rev_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const createdAt = new Date().toISOString();

    const { error: insertErr } = await db.from('reviews').insert({
      id: reviewId,
      product_id: id,
      user_name: userName,
      rating: Number(rating),
      comment,
      verified_purchase: true,
      created_at: createdAt
    });

    if (insertErr) throw insertErr;

    // Recalculate product rating
    const { data: allReviews } = await db
      .from('reviews')
      .select('rating')
      .eq('product_id', id);

    const revs = allReviews ?? [];
    const avgRating = revs.reduce((acc: number, r: any) => acc + Number(r.rating), 0) / revs.length;

    await db
      .from('products')
      .update({
        rating: Number(avgRating.toFixed(2)),
        review_count: revs.length,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    res.status(201).json({
      id: reviewId,
      product_id: id,
      user_name: userName,
      rating: Number(rating),
      comment,
      verified_purchase: true,
      created_at: createdAt
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────
function safeParseJson(value: any, fallback: any) {
  try {
    return JSON.parse(value ?? '[]');
  } catch {
    return fallback;
  }
}

export default router;
