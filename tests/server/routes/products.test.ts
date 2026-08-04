import request from 'supertest';
import {beforeAll, describe, expect, it} from 'vitest';
import {getDb} from '../../../server/db';
import productsRouter from '../../../server/routes/products';
import {createTestApp} from '../../helpers/app';

const app = createTestApp('/api/products', productsRouter);

beforeAll(async () => {
  await getDb();
});

describe('GET /api/products/categories', () => {
  it('returns the seeded categories ordered by display_order', async () => {
    const res = await request(app).get('/api/products/categories');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    const orders = res.body.map((c: any) => c.display_order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });
});

describe('GET /api/products', () => {
  it('parses JSON columns and coerces flags to booleans', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    const product = res.body[0];
    expect(Array.isArray(product.sizes)).toBe(true);
    expect(Array.isArray(product.images)).toBe(true);
    expect(typeof product.is_featured).toBe('boolean');
    expect(typeof product.is_new_arrival).toBe('boolean');
  });

  it('filters by category id', async () => {
    const res = await request(app).get('/api/products?category=cat_mens_kurtas');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.every((p: any) => p.category_id === 'cat_mens_kurtas')).toBe(true);
  });

  it('filters by category name', async () => {
    const res = await request(app).get(
      `/api/products?category=${encodeURIComponent("Royal Men's Kurta Sets")}`
    );
    expect(res.body.every((p: any) => p.category_name === "Royal Men's Kurta Sets")).toBe(true);
  });

  it('filters featured and new-arrival products', async () => {
    const featured = await request(app).get('/api/products?featured=true');
    expect(featured.body.every((p: any) => p.is_featured === true)).toBe(true);

    const newArrivals = await request(app).get('/api/products?newArrival=1');
    expect(newArrivals.body.every((p: any) => p.is_new_arrival === true)).toBe(true);
  });

  it('filters by fabric and colour substrings', async () => {
    const fabric = await request(app).get('/api/products?fabric=Chanderi');
    expect(fabric.body.length).toBeGreaterThan(0);
    expect(fabric.body.every((p: any) => p.fabric.includes('Chanderi'))).toBe(true);

    const color = await request(app).get('/api/products?color=Emerald');
    expect(color.body.every((p: any) => p.color.includes('Emerald'))).toBe(true);
  });

  it('filters on the effective (discounted) price', async () => {
    const res = await request(app).get('/api/products?minPrice=35000&maxPrice=45000');
    expect(res.body.length).toBeGreaterThan(0);
    for (const p of res.body) {
      const effective = p.discount_price ?? p.price;
      expect(effective).toBeGreaterThanOrEqual(35000);
      expect(effective).toBeLessThanOrEqual(45000);
    }
  });

  it('searches across title, description, fabric, embroidery, colour and category', async () => {
    const res = await request(app).get('/api/products?search=Chikankari');
    expect(res.body.length).toBeGreaterThan(0);
    const haystack = JSON.stringify(res.body).toLowerCase();
    expect(haystack).toContain('chikankari');
  });

  it('returns an empty array when nothing matches the search', async () => {
    const res = await request(app).get('/api/products?search=definitely-not-a-product');
    expect(res.body).toEqual([]);
  });

  it('sorts by ascending and descending effective price', async () => {
    const asc = await request(app).get('/api/products?sort=price-asc');
    const ascPrices = asc.body.map((p: any) => p.discount_price ?? p.price);
    expect(ascPrices).toEqual([...ascPrices].sort((a: number, b: number) => a - b));

    const desc = await request(app).get('/api/products?sort=price-desc');
    const descPrices = desc.body.map((p: any) => p.discount_price ?? p.price);
    expect(descPrices).toEqual([...descPrices].sort((a: number, b: number) => b - a));
  });

  it('sorts by rating and by discount magnitude', async () => {
    const rating = await request(app).get('/api/products?sort=rating');
    const ratings = rating.body.map((p: any) => p.rating);
    expect(ratings).toEqual([...ratings].sort((a: number, b: number) => b - a));

    const discount = await request(app).get('/api/products?sort=discount');
    const discounts = discount.body.map((p: any) => p.price - (p.discount_price ?? p.price));
    expect(discounts).toEqual([...discounts].sort((a: number, b: number) => b - a));
  });

  it('defaults to featured-first ordering', async () => {
    const res = await request(app).get('/api/products');
    const featuredFlags = res.body.map((p: any) => (p.is_featured ? 1 : 0));
    expect(featuredFlags).toEqual([...featuredFlags].sort((a, b) => b - a));
  });
});

describe('GET /api/products/:idOrSlug', () => {
  it('returns a product with reviews and inventory by id', async () => {
    const res = await request(app).get('/api/products/prod_raw_silk_kurta_set');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('prod_raw_silk_kurta_set');
    expect(res.body.reviews.length).toBeGreaterThan(0);
    expect(res.body.inventory.length).toBeGreaterThan(0);
    expect(Array.isArray(res.body.sizes)).toBe(true);
  });

  it('resolves a product by slug', async () => {
    const res = await request(app).get('/api/products/maharaja-ivory-raw-silk-kurta-pajama-set');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('prod_raw_silk_kurta_set');
  });

  it('returns 404 for an unknown product', async () => {
    const res = await request(app).get('/api/products/prod_does_not_exist');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Product not found');
  });
});

describe('POST /api/products/:id/reviews', () => {
  it('rejects an incomplete review', async () => {
    const res = await request(app)
      .post('/api/products/prod_raw_silk_kurta_set/reviews')
      .send({userName: 'Meera', rating: 4});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Missing required review fields');
  });

  it('stores the review and recalculates the aggregate rating', async () => {
    const productId = 'prod_jaipur_angrakha_kurta';
    const before = await request(app).get(`/api/products/${productId}`);
    const ratingsBefore = before.body.reviews.map((r: any) => Number(r.rating));

    const res = await request(app)
      .post(`/api/products/${productId}/reviews`)
      .send({userName: 'Meera Rathore', rating: 3, comment: 'Beautiful, though the fit ran small.'});

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      product_id: productId,
      user_name: 'Meera Rathore',
      rating: 3,
      verified_purchase: 1
    });

    const after = await request(app).get(`/api/products/${productId}`);
    const expectedAverage = Number(
      ([...ratingsBefore, 3].reduce((sum, r) => sum + r, 0) / (ratingsBefore.length + 1)).toFixed(2)
    );
    expect(after.body.rating).toBe(expectedAverage);
    expect(after.body.review_count).toBe(ratingsBefore.length + 1);
    expect(after.body.reviews).toHaveLength(ratingsBefore.length + 1);
  });
});
