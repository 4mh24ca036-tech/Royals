#!/usr/bin/env npx tsx

/**
 * Repair Display Order Script
 * 
 * Fixes display_order values in product_images table to ensure
 * they are sequential (0, 1, 2, ...) for each product.
 */

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

async function repairDisplayOrder(): Promise<void> {
  console.log('\n' + '═'.repeat(70));
  console.log('  REPAIR DISPLAY ORDER');
  console.log('═'.repeat(70) + '\n');

  const db = await initDb();

  // Get all products
  const allProducts = queryAll(db, 'SELECT id FROM products ORDER BY id');

  console.log(`🔧 Repairing display_order for ${allProducts.length} products...\n`);

  let repairsNeeded = 0;

  for (const prod of allProducts) {
    const productId = prod.id;
    const images = queryAll(
      db,
      'SELECT id, display_order FROM product_images WHERE product_id = ? ORDER BY display_order, id',
      [productId]
    );

    // Check if repair needed
    let needsRepair = false;
    for (let i = 0; i < images.length; i++) {
      if (images[i].display_order !== i) {
        needsRepair = true;
        break;
      }
    }

    if (needsRepair) {
      repairsNeeded++;
      // Fix the display_order
      for (let i = 0; i < images.length; i++) {
        execute(
          db,
          'UPDATE product_images SET display_order = ? WHERE id = ?',
          [i, images[i].id]
        );
      }
      console.log(`  ✓ ${productId}: fixed ${images.length} images`);
    }
  }

  console.log(`\n✓ Repaired ${repairsNeeded} products\n`);

  // Save database
  const dbData = db.export();
  const buffer = Buffer.from(dbData);
  const dbPath = path.join(process.cwd(), 'data', 'royals.sqlite');
  fs.writeFileSync(dbPath, buffer);
  console.log('✓ Database persisted\n');

  // Verify
  console.log('🔍 VERIFYING REPAIRS...\n');

  const verifyDb = await initDb();
  const verifyProducts = queryAll(verifyDb, 'SELECT id FROM products ORDER BY id');
  let issuesFound = 0;

  for (const prod of verifyProducts) {
    const images = queryAll(
      verifyDb,
      'SELECT display_order FROM product_images WHERE product_id = ? ORDER BY display_order',
      [prod.id]
    );

    for (let i = 0; i < images.length; i++) {
      if (images[i].display_order !== i) {
        issuesFound++;
        console.log(`  ❌ ${prod.id}: image ${i} has order ${images[i].display_order}`);
      }
    }
  }

  if (issuesFound === 0) {
    console.log('✅ ALL DISPLAY ORDERS REPAIRED\n');
  } else {
    console.log(`⚠️  ${issuesFound} issues remaining\n`);
  }
}

repairDisplayOrder().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
