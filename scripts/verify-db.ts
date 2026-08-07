import { getDb } from '../server/db.js';

function q(db: any, sql: string) {
  const stmt = db.prepare(sql);
  stmt.step();
  const r = stmt.getAsObject();
  stmt.free();
  return r;
}

const db = await getDb();

const products     = q(db, 'SELECT COUNT(*) as cnt FROM products');
const images       = q(db, 'SELECT COUNT(*) as cnt FROM product_images');
const uploadImages = q(db, "SELECT COUNT(*) as cnt FROM product_images WHERE image_url LIKE '/uploads/%'");
const legacyImages = q(db, "SELECT COUNT(*) as cnt FROM product_images WHERE image_url LIKE '/images/%'");
const base64Images = q(db, "SELECT COUNT(*) as cnt FROM product_images WHERE image_url LIKE 'data:%'");

console.log('=== DB Verification ===');
console.log('Products total           :', products.cnt);
console.log('product_images total     :', images.cnt);
console.log('  /uploads/ URLs         :', uploadImages.cnt);
console.log('  /images/ fallback URLs :', legacyImages.cnt);
console.log('  base64 data: URLs      :', base64Images.cnt, '(must be 0)');

// Sample 5 upload rows
const stmt = db.prepare("SELECT product_id, image_url FROM product_images WHERE image_url LIKE '/uploads/%' LIMIT 5");
console.log('\nSample /uploads/ rows:');
while (stmt.step()) {
  const row = stmt.getAsObject() as any;
  console.log(' ', row.product_id, '->', row.image_url);
}
stmt.free();

process.exit(0);
