import fs from 'fs';
import path from 'path';
import {describe, expect, it} from 'vitest';
import {getDb, persistDb} from '../../server/db';

const dbFile = path.join(process.cwd(), 'data', 'royals.sqlite');

function count(db: any, table: string): number {
  return db.exec(`SELECT COUNT(*) FROM ${table};`)[0].values[0][0] as number;
}

describe('getDb', () => {
  it('creates the data directory and persists the database file', async () => {
    await getDb();
    expect(fs.existsSync(dbFile)).toBe(true);
  });

  it('returns the same cached instance on subsequent calls', async () => {
    expect(await getDb()).toBe(await getDb());
  });

  it('creates every relational table', async () => {
    const db = await getDb();
    const tables = db
      .exec("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name;")[0]
      .values.flat();

    expect(tables).toEqual([
      'addresses',
      'admin_users',
      'cart',
      'cart_items',
      'categories',
      'coupons',
      'inventory',
      'notifications',
      'order_items',
      'order_status_history',
      'orders',
      'payments',
      'products',
      'reviews',
      'users'
    ]);
  });

  it('seeds the atelier catalogue, patrons, coupons and the demo order', async () => {
    const db = await getDb();

    expect(count(db, 'admin_users')).toBe(1);
    expect(count(db, 'users')).toBe(1);
    expect(count(db, 'addresses')).toBe(1);
    expect(count(db, 'categories')).toBe(6);
    expect(count(db, 'products')).toBeGreaterThan(0);
    expect(count(db, 'coupons')).toBe(4);
    expect(count(db, 'orders')).toBe(1);
    expect(count(db, 'order_items')).toBe(1);
    expect(count(db, 'payments')).toBe(1);
    expect(count(db, 'order_status_history')).toBe(3);
    expect(count(db, 'notifications')).toBe(2);
  });

  it('gives every seeded product inventory rows for each size plus reviews', async () => {
    const db = await getDb();
    const products = db.exec('SELECT id, sizes_json FROM products;')[0].values as [string, string][];

    for (const [id, sizesJson] of products) {
      const sizes = JSON.parse(sizesJson) as string[];
      const inventory = db.exec('SELECT COUNT(*) FROM inventory WHERE product_id = ?;', [id])[0].values[0][0];
      const reviews = db.exec('SELECT COUNT(*) FROM reviews WHERE product_id = ?;', [id])[0].values[0][0];
      expect(inventory).toBe(sizes.length);
      expect(reviews).toBe(2);
    }
  });

  it('stores hashed, not plaintext, credentials', async () => {
    const db = await getDb();
    const hashes = [
      db.exec("SELECT password_hash FROM admin_users WHERE username = 'admin';")[0].values[0][0] as string,
      db.exec("SELECT password_hash FROM users WHERE email = 'customer@royals.com';")[0].values[0][0] as string
    ];

    for (const hash of hashes) {
      expect(hash).toMatch(/^\$2[aby]\$/);
    }
  });

  it('does not duplicate seed data when re-seeding an existing database', async () => {
    const db = await getDb();
    const before = count(db, 'categories');
    await getDb();
    expect(count(db, 'categories')).toBe(before);
  });
});

describe('persistDb', () => {
  it('writes in-memory changes to disk', async () => {
    const db = await getDb();
    db.run("INSERT INTO categories (id, name, slug, display_order) VALUES ('cat_test', 'Test', 'test', 99);");
    persistDb();

    const sizeAfterInsert = fs.statSync(dbFile).size;
    expect(sizeAfterInsert).toBeGreaterThan(0);

    db.run("DELETE FROM categories WHERE id = 'cat_test';");
    persistDb();
  });

  it('recreates the data directory if it was removed', async () => {
    await getDb();
    fs.rmSync(path.dirname(dbFile), {recursive: true, force: true});

    persistDb();

    expect(fs.existsSync(dbFile)).toBe(true);
  });
});
