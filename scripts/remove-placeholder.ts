#!/usr/bin/env npx tsx

import fs from 'fs';
import path from 'path';
import initSqlJs, { Database } from 'sql.js';

async function initDb(): Promise<Database> {
  const SQL = await initSqlJs();
  const dbPath = path.join(process.cwd(), 'data', 'royals.sqlite');

  if (!fs.existsSync(dbPath)) {
    throw new Error(`Database not found at ${dbPath}`);
  }

  const fileBuffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(fileBuffer);
  return db;
}

function queryAll(db: Database, sql: string, params: any[] = []): any[] {
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const results: any[] = [];
  while (stmt.step()) results.push(stmt.getAsObject());
  stmt.free();
  return results;
}

function execute(db: Database, sql: string, params: any[] = []): void {
  db.run(sql, params);
}

async function removePlaceholder() {
  console.log('Finding and removing placeholder images...\n');

  const db = await initDb();

  // Find placeholders
  const placeholders = queryAll(db, `
    SELECT id, product_id, image_url FROM product_images 
    WHERE image_url LIKE '%royals-garment-01%'
       OR image_url LIKE '%placeholder%' 
       OR image_url LIKE '%dummy%'
  `);

  console.log(`Found ${placeholders.length} placeholder images:\n`);

  for (const placeholder of placeholders) {
    console.log(`  • ${placeholder.id}`);
    console.log(`    Product: ${placeholder.product_id}`);
    console.log(`    URL: ${placeholder.image_url}`);

    // Get other images for this product
    const otherImages = queryAll(
      db,
      'SELECT id, image_url FROM product_images WHERE product_id = ? AND id != ?',
      [placeholder.product_id, placeholder.id]
    );

    if (otherImages.length > 0) {
      // Delete the placeholder, keep others
      execute(db, 'DELETE FROM product_images WHERE id = ?', [placeholder.id]);
      console.log(`    ✓ Deleted (product has ${otherImages.length} other image(s))\n`);
    } else {
      // Keep it if it's the only image
      console.log(`    ⊘ Kept (only image for product)\n`);
    }
  }

  // Save database
  const dbData = db.export();
  const buffer = Buffer.from(dbData);
  const dbPath = path.join(process.cwd(), 'data', 'royals.sqlite');
  fs.writeFileSync(dbPath, buffer);
  console.log('✓ Database saved\n');

  // Verify
  const verify = await initDb();
  const remaining = queryAll(verify, `
    SELECT COUNT(*) as count FROM product_images 
    WHERE image_url LIKE '%royals-garment-01%'
       OR image_url LIKE '%placeholder%' 
       OR image_url LIKE '%dummy%'
  `);

  console.log(`Placeholders remaining: ${remaining[0].count}`);
}

removePlaceholder().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
