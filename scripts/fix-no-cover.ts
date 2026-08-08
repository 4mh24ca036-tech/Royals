#!/usr/bin/env npx tsx

import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';

async function main() {
  const SQL = await initSqlJs();
  const dbPath = path.join(process.cwd(), 'data', 'royals.sqlite');
  const db = new SQL.Database(fs.readFileSync(dbPath));
  
  // Find the first image ID for this product
  const stmt = db.prepare('SELECT id FROM product_images WHERE product_id = ? ORDER BY display_order ASC LIMIT 1');
  stmt.bind(['prod_jaipur_angrakha_kurta']);
  const result = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  
  if (result) {
    // Set that image as cover
    db.run('UPDATE product_images SET is_cover = 1 WHERE id = ?', [result.id]);
    fs.writeFileSync(dbPath, Buffer.from(db.export()));
    console.log('✅ Set image as cover for prod_jaipur_angrakha_kurta');
  }
}

main();
