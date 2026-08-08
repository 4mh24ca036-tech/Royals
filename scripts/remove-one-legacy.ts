#!/usr/bin/env npx tsx

import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';

async function main() {
  const SQL = await initSqlJs();
  const dbPath = path.join(process.cwd(), 'data', 'royals.sqlite');
  const db = new SQL.Database(fs.readFileSync(dbPath));
  
  db.run('DELETE FROM product_images WHERE image_url = ?', ['/images/kurta_jaipur_angrakha.jpg']);
  
  fs.writeFileSync(dbPath, Buffer.from(db.export()));
  console.log('✅ Removed 1 legacy image');
}

main();
