// One-shot script: set every product price to 500 and stamp migration records.
// Run with: node scripts/fix-prices-db.cjs
const fs = require('fs');
const path = require('path');
const initSqlJs = require(path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-asm.js'));

const DB_FILE = path.join(process.cwd(), 'data', 'royals.sqlite');
const now = new Date().toISOString();

async function run() {
  const SQL = await initSqlJs();
  const buf = fs.readFileSync(DB_FILE);
  const db = new SQL.Database(buf);

  // 1. Set ALL product prices to ₹500, clear any discount_price
  db.run('UPDATE products SET price = 500, discount_price = NULL');
  const countRes = db.exec('SELECT COUNT(*) FROM products');
  console.log('Products set to ₹500:', countRes[0].values[0][0]);

  // 2. Spot-check
  const sample = db.exec('SELECT id, price, discount_price FROM products ORDER BY ROWID LIMIT 6');
  console.log('Sample rows:', JSON.stringify(sample[0].values));

  // 3. Stamp migration records so seedInitialData skips price-band logic on next boot
  db.run('CREATE TABLE IF NOT EXISTS app_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
  db.run('INSERT OR REPLACE INTO app_migrations (id, applied_at) VALUES (?, ?)', ['catalog_price_band_20260807', now]);
  db.run('INSERT OR REPLACE INTO app_migrations (id, applied_at) VALUES (?, ?)', ['price_flat_500_20260808', now]);

  // 4. Confirm
  const migs = db.exec("SELECT id, applied_at FROM app_migrations WHERE id LIKE '%price%'");
  console.log('Migration records:', JSON.stringify(migs[0]?.values));

  // 5. Persist DB back to disk
  const data = db.export();
  fs.writeFileSync(DB_FILE, Buffer.from(data));
  console.log('DB written to disk successfully.');
  db.close();
}

run().catch(e => { console.error(e); process.exit(1); });
