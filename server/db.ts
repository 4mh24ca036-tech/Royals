import fs from 'fs';
import path from 'path';
import initSqlJs, { Database } from 'sql.js';
import bcrypt from 'bcryptjs';

let dbInstance: Database | null = null;
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'royals.sqlite');

export async function getDb(): Promise<Database> {
  if (dbInstance) {
    return dbInstance;
  }

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const SQL = await initSqlJs();
  let db: Database;

  if (fs.existsSync(DB_FILE)) {
    try {
      const fileBuffer = fs.readFileSync(DB_FILE);
      db = new SQL.Database(fileBuffer);
    } catch (err) {
      console.error('Error loading database file, creating fresh database:', err);
      db = new SQL.Database();
    }
  } else {
    db = new SQL.Database();
  }

  dbInstance = db;
  initializeSchema(db);
  seedInitialData(db);
  persistDb();

  return dbInstance;
}

export function persistDb() {
  if (!dbInstance) return;
  try {
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, buffer);
  } catch (err) {
    console.error('Failed to persist database to disk:', err);
  }
}

function initializeSchema(db: Database) {
  // Execute table creation for all normalized MySQL/SQLite tables
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'customer',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admin_users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'super_admin',
      last_login TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      image_url TEXT,
      mobile_image_url TEXT DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      display_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      category_id TEXT NOT NULL,
      category_name TEXT NOT NULL,
      price REAL NOT NULL,
      discount_price REAL,
      stock INTEGER NOT NULL DEFAULT 10,
      fabric TEXT,
      embroidery TEXT,
      color TEXT,
      sizes_json TEXT NOT NULL,
      description TEXT NOT NULL,
      care_instructions TEXT,
      images_json TEXT NOT NULL,
      rating REAL DEFAULT 4.8,
      review_count INTEGER DEFAULT 0,
      is_featured INTEGER DEFAULT 0,
      is_new_arrival INTEGER DEFAULT 0,
      display_order INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      rating REAL NOT NULL,
      comment TEXT NOT NULL,
      verified_purchase INTEGER DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS addresses (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      address_line1 TEXT NOT NULL,
      address_line2 TEXT,
      landmark TEXT,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      pincode TEXT NOT NULL,
      is_default INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cart (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      session_id TEXT UNIQUE NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cart_items (
      id TEXT PRIMARY KEY,
      cart_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      size TEXT NOT NULL,
      color TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      price REAL NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_number TEXT UNIQUE NOT NULL,
      tracking_id TEXT UNIQUE NOT NULL,
      user_id TEXT,
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      shipping_address_json TEXT NOT NULL,
      subtotal REAL NOT NULL,
      gst_amount REAL NOT NULL,
      discount_amount REAL NOT NULL DEFAULT 0,
      delivery_fee REAL NOT NULL DEFAULT 0,
      grand_total REAL NOT NULL,
      coupon_code TEXT,
      payment_method TEXT NOT NULL,
      payment_status TEXT NOT NULL,
      order_status TEXT NOT NULL,
      courier_name TEXT DEFAULT 'Blue Dart Apex Luxury',
      estimated_delivery_date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      product_title TEXT NOT NULL,
      product_image TEXT NOT NULL,
      product_description TEXT,
      size TEXT NOT NULL,
      color TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      total_price REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      payment_method TEXT NOT NULL,
      transaction_id TEXT NOT NULL,
      gateway_ref TEXT,
      amount REAL NOT NULL,
      status TEXT NOT NULL,
      paid_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_status_history (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      status TEXT NOT NULL,
      notes TEXT,
      updated_by TEXT DEFAULT 'System',
      date_str TEXT NOT NULL,
      time_str TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      order_id TEXT,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS coupons (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      discount_type TEXT NOT NULL,
      discount_value REAL NOT NULL,
      min_spend REAL DEFAULT 0,
      max_discount REAL,
      is_active INTEGER DEFAULT 1,
      usage_count INTEGER DEFAULT 0,
      expiry_date TEXT
    );

    CREATE TABLE IF NOT EXISTS inventory (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      sku TEXT NOT NULL,
      size TEXT NOT NULL,
      stock_quantity INTEGER NOT NULL DEFAULT 10,
      low_stock_threshold INTEGER DEFAULT 3,
      last_restocked_at TEXT
    );

    CREATE TABLE IF NOT EXISTS product_images (
      id          TEXT PRIMARY KEY,
      product_id  TEXT NOT NULL,
      image_url   TEXT NOT NULL,
      display_order INTEGER NOT NULL DEFAULT 0,
      is_cover    INTEGER NOT NULL DEFAULT 0,
      view_type   TEXT DEFAULT 'gallery',
      alt_text    TEXT,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS banners (
      id               TEXT PRIMARY KEY,
      title            TEXT NOT NULL DEFAULT '',
      subtitle         TEXT DEFAULT '',
      description      TEXT DEFAULT '',
      image_url        TEXT NOT NULL,
      mobile_image_url TEXT DEFAULT '',
      button_text      TEXT DEFAULT '',
      button_link      TEXT DEFAULT '',
      tag              TEXT DEFAULT '',
      category_id      TEXT DEFAULT '',
      display_order    INTEGER NOT NULL DEFAULT 0,
      is_active        INTEGER NOT NULL DEFAULT 1,
      created_at       TEXT NOT NULL,
      updated_at       TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS editorial_strips (
      id            TEXT PRIMARY KEY,
      image_url     TEXT NOT NULL,
      label         TEXT NOT NULL DEFAULT '',
      subtitle      TEXT DEFAULT '',
      category_id   TEXT DEFAULT '',
      display_order INTEGER NOT NULL DEFAULT 0,
      is_active     INTEGER NOT NULL DEFAULT 1,
      created_at    TEXT NOT NULL,
      updated_at    TEXT NOT NULL
    );
  `);

  // Lightweight, idempotent migration for databases created before catalog
  // management gained ordering and edit timestamps.
  const productColumns = db.exec('PRAGMA table_info(products)')[0]?.values.map((column: any[]) => column[1]) || [];
  if (!productColumns.includes('display_order')) {
    db.run('ALTER TABLE products ADD COLUMN display_order INTEGER DEFAULT 0');
  }
  if (!productColumns.includes('updated_at')) {
    db.run('ALTER TABLE products ADD COLUMN updated_at TEXT');
  }

  const orderItemColumns = db.exec('PRAGMA table_info(order_items)')[0]?.values.map((column: any[]) => column[1]) || [];
  if (!orderItemColumns.includes('product_description')) {
    db.run('ALTER TABLE order_items ADD COLUMN product_description TEXT');
  }

  // Migration for categories table to add new columns for permanent image management
  const categoryColumns = db.exec('PRAGMA table_info(categories)')[0]?.values.map((column: any[]) => column[1]) || [];
  if (!categoryColumns.includes('mobile_image_url')) {
    db.run('ALTER TABLE categories ADD COLUMN mobile_image_url TEXT DEFAULT \'\'');
  }
  if (!categoryColumns.includes('is_active')) {
    db.run('ALTER TABLE categories ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1');
  }
  if (!categoryColumns.includes('created_at')) {
    db.run('ALTER TABLE categories ADD COLUMN created_at TEXT NOT NULL DEFAULT \'\'');
  }
  if (!categoryColumns.includes('updated_at')) {
    db.run('ALTER TABLE categories ADD COLUMN updated_at TEXT NOT NULL DEFAULT \'\'');
  }

  // Migration to enforce single cover image per product
  // This ensures that if a product has multiple images marked as cover, only the first one remains as cover
  const productImagesRes = db.exec('SELECT product_id, COUNT(*) as count FROM product_images WHERE is_cover = 1 GROUP BY product_id HAVING count > 1');
  if (productImagesRes.length > 0 && productImagesRes[0] && productImagesRes[0].values) {
    const productIdsWithMultipleCovers = productImagesRes[0].values.map((row: any[]) => row[0] as string);
    
    for (const productId of productIdsWithMultipleCovers) {
      // Get all cover images for this product, ordered by display_order
      const coverImages = db.exec(
        'SELECT id FROM product_images WHERE product_id = ? AND is_cover = 1 ORDER BY display_order ASC, created_at ASC',
        [productId]
      );
      
      if (coverImages.length > 0 && coverImages[0] && coverImages[0].values) {
        const coverImageIds = coverImages[0].values.map((row: any[]) => row[0] as string);
        
        // Keep the first one as cover, set all others to non-cover
        for (let i = 1; i < coverImageIds.length; i++) {
          db.run(
            'UPDATE product_images SET is_cover = 0, updated_at = ? WHERE id = ?',
            [new Date().toISOString(), coverImageIds[i]]
          );
        }
      }
    }
  }
}

function seedInitialData(db: Database) {
  const salt = bcrypt.genSaltSync(10);
  const adminHash = bcrypt.hashSync('Royals@2026', salt);
  const demoUserHash = bcrypt.hashSync('Customer@123', salt);

  // Check if admin user exists
  const adminRes = db.exec(`SELECT COUNT(*) as count FROM admin_users;`);
  const adminCount = adminRes.length > 0 && adminRes[0].values.length > 0 ? (adminRes[0].values[0][0] as number) : 0;

  if (adminCount === 0) {
    db.run(
      `INSERT INTO admin_users (id, username, email, name, password_hash, role, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      ['adm_1', 'admin', 'admin@royals.com', 'Atelier Director', adminHash, 'super_admin', new Date().toISOString()]
    );
  } else {
    // Ensure admin user password hash matches Royals@2026
    db.run(`UPDATE admin_users SET password_hash = ? WHERE username = 'admin';`, [adminHash]);
  }

  const userRes = db.exec(`SELECT COUNT(*) as count FROM users;`);
  const userCount = userRes.length > 0 && userRes[0].values.length > 0 ? (userRes[0].values[0][0] as number) : 0;

  if (userCount === 0) {
    db.run(
      `INSERT INTO users (id, name, email, phone, password_hash, role, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      ['usr_1', 'Princess Gayatri', 'customer@royals.com', '8000461784', demoUserHash, 'customer', new Date().toISOString(), new Date().toISOString()]
    );

    db.run(
      `INSERT INTO addresses (id, user_id, full_name, phone, address_line1, address_line2, landmark, city, state, pincode, is_default, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      ['addr_1', 'usr_1', 'Princess Gayatri', '8000461784', 'Suite 402, Royal Heritage Haveli', 'Road No. 6, Chaksu', 'Near Pink City Gateway', 'Jaipur', 'Rajasthan', '303901', 1, new Date().toISOString()]
    );
  }

  // Check categories
  const catRes = db.exec(`SELECT COUNT(*) as count FROM categories;`);
  const catCount = catRes.length > 0 && catRes[0].values.length > 0 ? (catRes[0].values[0][0] as number) : 0;

  if (catCount === 0) {
    const categories = [
      {
        id: 'cat_mens_kurtas',
        name: "Royal Men's Kurta Sets",
        slug: 'mens-kurta-sets',
        description: 'Imperial handloom Matka raw silk, Chanderi, and Angrakha kurta pajama sets tailored with antique gold embroidery.',
        image_url: '/images/mens_raw_silk_kurta.jpg',
        mobile_image_url: '',
        display_order: 1
      },
      {
        id: 'cat_womens_kurtas',
        name: "Designer Women's Kurta Sets",
        slug: 'womens-kurta-sets',
        description: 'Lucknowi Chikankari tunics, Gota Patti sharara sets, and pure georgette kurtas adorned with 24K gold mukaish work.',
        image_url: '/images/women_chikankari_kurta.jpg',
        mobile_image_url: '',
        display_order: 2
      },
      {
        id: 'cat_anarkali_kurtas',
        name: 'Flared Anarkali & Angrakha Kurtas',
        slug: 'anarkali-and-angrakha-kurtas',
        description: 'Sweeping 48-kali floor-length Anarkalis, Banarasi zari yokes, and Jaipuri side-tie Angrakhas crafted in pure silks.',
        image_url: '/images/emerald_anarkali_kurta.jpg',
        mobile_image_url: '',
        display_order: 3
      },
      {
        id: 'cat_bandhgala_kurtas',
        name: 'Royal Bandhgala & Jacket Kurta Sets',
        slug: 'bandhgala-and-jacket-kurtas',
        description: 'Structured short kurta bandhgalas, metallic brocade Nehru jackets, and raw silk achkan kurta sets.',
        image_url: '/images/midnight_bandhgala_kurta.jpg',
        mobile_image_url: '',
        display_order: 4
      },
      {
        id: 'cat_bridal_lehengas',
        name: 'Imperial Bridal & Festive Couture',
        slug: 'bridal-and-festive-couture',
        description: 'Heirloom velvet kurti lehenga sets, Zardozi dupattas, and grand wedding ensembles from the Jaipur atelier.',
        image_url: '/images/kurta_chanderi_sharara.jpg',
        mobile_image_url: '',
        display_order: 5
      },
      {
        id: 'cat_heritage_accessories',
        name: 'Heritage Accessories & Safas',
        slug: 'heritage-accessories',
        description: 'Jaipuri royal safas, hand-woven chanderi stoles, gilded crest buttons, and handcrafted accessories.',
        image_url: '/images/kurta_jaipur_angrakha.jpg',
        mobile_image_url: '',
        display_order: 6
      }
    ];

    const now = new Date().toISOString();
    for (const cat of categories) {
      db.run(
        `INSERT INTO categories (id, name, slug, description, image_url, mobile_image_url, is_active, created_at, updated_at, display_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [cat.id, cat.name, cat.slug, cat.description, cat.image_url, cat.mobile_image_url, 1, now, now, cat.display_order]
      );
    }
  }

  // Check products
  const prodRes = db.exec(`SELECT COUNT(*) as count FROM products;`);
  const prodCount = prodRes.length > 0 && prodRes[0].values.length > 0 ? (prodRes[0].values[0][0] as number) : 0;

  if (prodCount === 0) {
    const products = [
      {
        id: 'prod_raw_silk_kurta_set',
        title: 'The Maharaja Ivory Raw Silk Kurta Pajama Set',
        slug: 'maharaja-ivory-raw-silk-kurta-pajama-set',
        category_id: 'cat_mens_kurtas',
        category_name: "Royal Men's Kurta Sets",
        price: 38000,
        discount_price: 32500,
        stock: 14,
        fabric: '100% Pure Handloom Matka Raw Silk',
        embroidery: 'Antique Gold Marodi & Dabka Work on Mandarin Collar & Cuffs',
        color: 'Warm Ivory Cream & Antique Gold',
        sizes_json: JSON.stringify(['36 (S)', '38 (M)', '40 (L)', '42 (XL)', '44 (XXL)', 'Custom Bespoke Fit']),
        description: "An imperial men's kurta tailored from heavyweight pure raw silk hand-loomed in Varanasi. Features signature 24K gold-plated Jaipur buttons, concealed side pockets, and fine gold dabka threadwork on the collar. Paired with a tailored modal silk churidar.",
        care_instructions: 'Strictly Specialist Dry Clean Only. Preserve in the complimentary heirloom muslin box.',
        images_json: JSON.stringify([
          '/images/mens_raw_silk_kurta.jpg',
          '/images/hero_royal_kurtas.jpg'
        ]),
        rating: 4.96,
        review_count: 42,
        is_featured: 1,
        is_new_arrival: 1,
        created_at: new Date().toISOString()
      },
      {
        id: 'prod_chikankari_mukaish_kurta',
        title: 'The Noor-e-Lucknow Blush Chikankari Kurta Set',
        slug: 'noor-e-lucknow-blush-chikankari-kurta-set',
        category_id: 'cat_womens_kurtas',
        category_name: "Designer Women's Kurta Sets",
        price: 42000,
        discount_price: 36900,
        stock: 12,
        fabric: 'Pure Viscose Georgette with Pure Organza Scalloped Dupatta',
        embroidery: 'Lucknowi Shadow Work, Bakhiya, Phanda & 24K Gold Mukaish Badla',
        color: 'Jaipur Powder Blush Pink & Soft Gold',
        sizes_json: JSON.stringify(['XS (32)', 'S (34)', 'M (36)', 'L (38)', 'XL (40)', 'XXL (42)', 'Custom Tailoring']),
        description: 'Mastercrafted by hereditary Chikankari artisans with over 120 hours of needlecraft. Dotted with hand-applied 24K pure gold mukaish dots. Includes matching straight trousers with bottom lace detailing and a 2.5-meter organza dupatta with scalloped borders.',
        care_instructions: 'Dry Clean Only. Steam iron on reverse.',
        images_json: JSON.stringify([
          '/images/women_chikankari_kurta.jpg',
          '/images/kurta_chanderi_sharara.jpg'
        ]),
        rating: 4.98,
        review_count: 38,
        is_featured: 1,
        is_new_arrival: 1,
        created_at: new Date().toISOString()
      },
      {
        id: 'prod_midnight_bandhgala_kurta',
        title: 'The Marwar Midnight Bandhgala Kurta Ensemble',
        slug: 'marwar-midnight-bandhgala-kurta-ensemble',
        category_id: 'cat_bandhgala_kurtas',
        category_name: 'Royal Bandhgala & Jacket Kurta Sets',
        price: 54000,
        discount_price: 48000,
        stock: 9,
        fabric: 'High-Density Raw Silk & Structured Wool Blend',
        embroidery: 'Tonal Resham & Hand-Set Jaipur Crest Metallic Buttons',
        color: 'Midnight Royal Charcoal & Dark Gunmetal',
        sizes_json: JSON.stringify(['38 (M)', '40 (L)', '42 (XL)', '44 (XXL)']),
        description: 'A sharp contemporary royal silhouette fusing traditional achkan cuts with modern tailoring. Features high collar bandhgala construction, crest buttons cast in brass, and matching slim trousers.',
        care_instructions: 'Professional Dry Clean Only.',
        images_json: JSON.stringify([
          '/images/midnight_bandhgala_kurta.jpg',
          '/images/kurta_nehru_jacket_set.jpg'
        ]),
        rating: 4.91,
        review_count: 27,
        is_featured: 1,
        is_new_arrival: 0,
        created_at: new Date().toISOString()
      },
      {
        id: 'prod_emerald_anarkali_kurta',
        title: 'The Begum Emerald Zari Flared Anarkali Kurta Set',
        slug: 'begum-emerald-zari-flared-anarkali-kurta-set',
        category_id: 'cat_anarkali_kurtas',
        category_name: 'Flared Anarkali & Angrakha Kurtas',
        price: 58000,
        discount_price: 51000,
        stock: 10,
        fabric: 'Pure Silk Georgette & Banarasi Weave Zari Yoke',
        embroidery: 'Real Gold Kadhwa Zari, Gota Patti Vines & Pearl Borders',
        color: 'Royal Emerald Green & Imperial Gold',
        sizes_json: JSON.stringify(['XS (32)', 'S (34)', 'M (36)', 'L (38)', 'XL (40)', 'XXL (42)']),
        description: 'A sweeping 48-kali flared Anarkali kurta suit inspired by Mughal court paintings. Features an intricately woven Banarasi zari yoke, heavy border flare, matched with tailored pants and a sheer gold border dupatta.',
        care_instructions: 'Dry clean only. Store in tissue-lined box.',
        images_json: JSON.stringify([
          '/images/emerald_anarkali_kurta.jpg',
          '/images/women_chikankari_kurta.jpg'
        ]),
        rating: 4.94,
        review_count: 31,
        is_featured: 1,
        is_new_arrival: 1,
        created_at: new Date().toISOString()
      },
      {
        id: 'prod_jaipur_angrakha_kurta',
        title: 'The Chaksu Saffron Hand-Embroidered Angrakha Kurta',
        slug: 'chaksu-saffron-hand-embroidered-angrakha-kurta',
        category_id: 'cat_mens_kurtas',
        category_name: "Royal Men's Kurta Sets",
        price: 34000,
        discount_price: 29900,
        stock: 15,
        fabric: '100% Pure Mulberry Silk',
        embroidery: 'Jaipuri Gota Dori & Asymmetric Handcrafted Side Ties',
        color: 'Royal Saffron Haldi & Burnished Gold',
        sizes_json: JSON.stringify(['36 (S)', '38 (M)', '40 (L)', '42 (XL)', '44 (XXL)']),
        description: 'Archival Rajput court style Angrakha kurta featuring a crossover diagonal flap with handcrafted silk potli button ties, tailored in lustrous Jaipur silk with matching ivory churidar.',
        care_instructions: 'Gentle Dry Clean Only.',
        images_json: JSON.stringify([
          '/images/kurta_jaipur_angrakha.jpg',
          '/images/hero_royal_kurtas.jpg'
        ]),
        rating: 4.88,
        review_count: 19,
        is_featured: 0,
        is_new_arrival: 1,
        created_at: new Date().toISOString()
      },
      {
        id: 'prod_chanderi_sharara_kurta',
        title: 'The Jodhpur Gota Patti Chanderi Kurta & Sharara Set',
        slug: 'jodhpur-gota-patti-chanderi-kurta-sharara-set',
        category_id: 'cat_womens_kurtas',
        category_name: "Designer Women's Kurta Sets",
        price: 46000,
        discount_price: 39500,
        stock: 11,
        fabric: '100% Pure Chanderi Silk & Modal Satin Lining',
        embroidery: 'Authentic Jaipur Hand Gota Patti, Sequin Floral Vines & Pearl Finishing',
        color: 'Pristine Ivory Silk & Warm Champagne Gold',
        sizes_json: JSON.stringify(['XS (32)', 'S (34)', 'M (36)', 'L (38)', 'XL (40)']),
        description: 'A timeless three-piece couture kurta set featuring a straight-cut Chanderi silk kurta with all-over Gota work, tiered flared sharara pants, and a scalloped dupatta.',
        care_instructions: 'Dry Clean Only. Gentle steam pressing.',
        images_json: JSON.stringify([
          '/images/kurta_chanderi_sharara.jpg',
          '/images/women_chikankari_kurta.jpg'
        ]),
        rating: 4.93,
        review_count: 25,
        is_featured: 1,
        is_new_arrival: 0,
        created_at: new Date().toISOString()
      },
      {
        id: 'prod_nehru_jacket_kurta_set',
        title: 'The Cobalt Brocade Nehru Jacket & Silk Kurta Set',
        slug: 'cobalt-brocade-nehru-jacket-silk-kurta-set',
        category_id: 'cat_bandhgala_kurtas',
        category_name: 'Royal Bandhgala & Jacket Kurta Sets',
        price: 49000,
        discount_price: 43000,
        stock: 8,
        fabric: 'Pure Raw Silk Kurta with Banarasi Brocade Waistcoat Jacket',
        embroidery: 'Metallic Gold Brocade Weave & Enamel Buttons',
        color: 'Royal Cobalt Blue & Antique Gold',
        sizes_json: JSON.stringify(['38 (M)', '40 (L)', '42 (XL)', '44 (XXL)']),
        description: 'Three-piece royal ensemble comprising a solid royal cobalt silk kurta, ivory churidar, and an intricately textured gold brocade Nehru jacket with breast pocket for custom silk pochette.',
        care_instructions: 'Dry Clean Only.',
        images_json: JSON.stringify([
          '/images/kurta_nehru_jacket_set.jpg',
          '/images/mens_raw_silk_kurta.jpg'
        ]),
        rating: 4.89,
        review_count: 18,
        is_featured: 0,
        is_new_arrival: 1,
        created_at: new Date().toISOString()
      },
      {
        id: 'prod_padmavati_kurta_lehenga',
        title: 'The Padmavati Velvet Kurti & Kalidar Lehenga Ensemble',
        slug: 'padmavati-velvet-kurti-kalidar-lehenga-ensemble',
        category_id: 'cat_bridal_lehengas',
        category_name: 'Imperial Bridal & Festive Couture',
        price: 85000,
        discount_price: 76000,
        stock: 7,
        fabric: 'Pure Silk Velvet & Tissue Organza',
        embroidery: 'Jaipuri Zardozi, Piton Work & Real Gold Zari',
        color: 'Deep Imperial Crimson & Gilded Gold',
        sizes_json: JSON.stringify(['Custom Bridal Fit', 'XS (32)', 'S (34)', 'M (36)', 'L (38)', 'XL (40)']),
        description: 'A majestic long kurti lehenga set crafted in rich velvet with authentic hand Zardozi craft, paired with a kalidar flared skirt and double organza dupatta.',
        care_instructions: 'Dry clean only. Preserve in the royal heirloom trunk.',
        images_json: JSON.stringify([
          '/images/hero_royal_kurtas.jpg',
          '/images/emerald_anarkali_kurta.jpg'
        ]),
        rating: 4.97,
        review_count: 36,
        is_featured: 1,
        is_new_arrival: 0,
        created_at: new Date().toISOString()
      }
    ];

    for (const prod of products) {
      db.run(
        `INSERT INTO products (id, title, slug, category_id, category_name, price, discount_price, stock, fabric, embroidery, color, sizes_json, description, care_instructions, images_json, rating, review_count, is_featured, is_new_arrival, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          prod.id,
          prod.title,
          prod.slug,
          prod.category_id,
          prod.category_name,
          prod.price,
          prod.discount_price,
          prod.stock,
          prod.fabric,
          prod.embroidery,
          prod.color,
          prod.sizes_json,
          prod.description,
          prod.care_instructions,
          prod.images_json,
          prod.rating,
          prod.review_count,
          prod.is_featured,
          prod.is_new_arrival,
          prod.created_at
        ]
      );

      // Create inventory records for each size
      const sizes: string[] = JSON.parse(prod.sizes_json);
      sizes.forEach((sz, idx) => {
        db.run(
          `INSERT INTO inventory (id, product_id, sku, size, stock_quantity, low_stock_threshold, last_restocked_at)
           VALUES (?, ?, ?, ?, ?, ?, ?);`,
          [`inv_${prod.id}_${idx}`, prod.id, `RYL-${prod.id.substring(5, 10).toUpperCase()}-${idx + 1}`, sz, 6, 2, new Date().toISOString()]
        );
      });

      // Add a couple of verified reviews
      db.run(
        `INSERT INTO reviews (id, product_id, user_name, rating, comment, verified_purchase, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?);`,
        [`rev_${prod.id}_1`, prod.id, 'Ananya Singhania', 5, 'The craftsmanship is beyond perfection. The hand Zardozi embroidery catches light so regally. The packaging came in an heirloom trunk!', 1, '2026-08-01T14:20:00.000Z']
      );
      db.run(
        `INSERT INTO reviews (id, product_id, user_name, rating, comment, verified_purchase, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?);`,
        [`rev_${prod.id}_2`, prod.id, 'Rohit & Radhika Mehra', 5, 'Ordered for our Jaipur destination wedding. Delivered right on schedule with custom sizing precision. Outstanding concierge assistance via WhatsApp.', 1, '2026-08-02T10:15:00.000Z']
      );
    }
  }

  // The supplied boutique photography is catalog data, not UI data. Each image
  // is associated with a regular database product so the admin remains the
  // sole place to manage its price, description, stock, badges, and imagery.
  const suppliedCatalog = [
    ['Teal Maroon Heritage Kurta Set', 'Teal & Maroon', 'Resham accent work', 'royals-garment-01.jpeg'],
    ['Ivory Floral Embroidered Anarkali Set', 'Ivory & Rose', 'Floral thread embroidery', 'royals-garment-02.jpeg'],
    ['Olive Rose Garden Kurta Set', 'Olive & Pink', 'Floral thread embroidery', 'royals-garment-03.jpeg'],
    ['Teal Mustard Dupatta Kurta Set', 'Teal & Mustard', 'Geometric motif embroidery', 'royals-garment-04.jpeg'],
    ['Forest Green Mirror Work Kurta', 'Forest Green', 'Mirror and block-print yoke', 'royals-garment-05.jpeg'],
    ['Black Maroon Printed Kurta Set', 'Black & Maroon', 'Printed border detailing', 'royals-garment-06.jpeg'],
    ['Magenta Floral Dupatta Kurta Set', 'Magenta', 'All-over floral print', 'royals-garment-07.jpeg'],
    ['Wine Ajrakh Dupatta Kurta Set', 'Wine', 'Ajrakh-inspired yoke and dupatta', 'royals-garment-08.jpeg'],
    ['Rust Brown Embroidered Kurta Set', 'Rust Brown', 'Mirror and leaf embroidery', 'royals-garment-09.jpeg'],
    ['Mustard Teal Printed Kurta Set', 'Teal & Mustard', 'Paisley print', 'royals-garment-10.jpeg'],
    ['Plum Diamond Motif Kurta Set', 'Plum', 'Diamond thread embroidery', 'royals-garment-11.jpeg'],
    ['Crimson Black Dupatta Kurta Set', 'Crimson & Black', 'Contrast border print', 'royals-garment-12.jpeg'],
    ['Navy Floral Tiered Kurta', 'Navy Blue', 'Floral print', 'royals-garment-13.jpeg'],
    ['Midnight Floral Kurta Set', 'Midnight Blue', 'Floral yoke and border embroidery', 'royals-garment-14.jpeg'],
    ['Black Mustard Block Print Kurta Set', 'Black & Mustard', 'Hand block print', 'royals-garment-15.jpeg'],
    ['Olive Rust Yoke Kurta Set', 'Olive & Rust', 'Geometric yoke embroidery', 'royals-garment-16.jpeg'],
    ['Ivory Garden Embroidered Anarkali', 'Ivory & Berry', 'Floral embroidery', 'royals-garment-17.jpeg'],
    ['Ivory Garden Embroidered Anarkali Detail', 'Ivory & Berry', 'Floral embroidery', 'royals-garment-18.jpeg'],
    ['White Multi-Floral Kurta Set', 'White, Pink & Mustard', 'Floral applique work', 'royals-garment-19.jpeg'],
    ['Navy Mustard Border Kurta Set', 'Navy & Mustard', 'Embroidered neckline', 'royals-garment-20.jpeg'],
    ['Turquoise Maroon Kurta Set', 'Turquoise & Maroon', 'Sun motif embroidery', 'royals-garment-21.jpeg']
  ];
  const suppliedNow = new Date().toISOString();
  suppliedCatalog.forEach(([title, color, embroidery, image], index) => {
    const id = `prod_boutique_${String(index + 1).padStart(2, '0')}`;
    db.run(
      `INSERT OR IGNORE INTO products (
        id, title, slug, category_id, category_name, price, discount_price, stock, fabric, embroidery, color,
        sizes_json, description, care_instructions, images_json, rating, review_count, is_featured, is_new_arrival,
        display_order, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        id, title, `boutique-${index + 1}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`,
        'cat_womens_kurtas', "Designer Women's Kurta Sets", 599 + ((index % 5) * 100), null, 10,
        'Comfortable blended cotton', embroidery, color, JSON.stringify(['S', 'M', 'L', 'XL', 'XXL']),
        `${title}, selected for the ROYALS Jaipur boutique collection.`, 'Gentle hand wash or dry clean as preferred.',
        JSON.stringify([`/images/catalog/${image}`]), 4.8, 0, index < 8 ? 1 : 0, index < 6 ? 1 : 0,
        100 + index, suppliedNow, suppliedNow
      ]
    );
  });

  // Run only once for existing databases. It preserves all products while
  // bringing the initial catalogue price band to the requested ₹500–₹1000.
  db.run('CREATE TABLE IF NOT EXISTS app_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
  const priceMigration = db.exec("SELECT id FROM app_migrations WHERE id = 'catalog_price_band_20260807'");
  if (!priceMigration[0]?.values.length) {
    const existingProducts = db.exec('SELECT id FROM products ORDER BY display_order ASC, created_at ASC')[0]?.values || [];
    existingProducts.forEach((row: any[], index: number) => {
      db.run('UPDATE products SET price = ?, discount_price = NULL, updated_at = ? WHERE id = ?', [500 + ((index % 6) * 100), suppliedNow, row[0]]);
    });
    db.run("INSERT INTO app_migrations (id, applied_at) VALUES ('catalog_price_band_20260807', ?)", [suppliedNow]);
  }

  // ── Catalog images migration ──────────────────────────────────────────────
  // Runs once. Creates product rows 22–76 and links all 76 garment images
  // from /uploads/<productId>/garment-XX.jpeg into product_images.
  // Idempotent: guarded by app_migrations key 'catalog_images_v2_20260807'.
  const catalogImgMigration = db.exec("SELECT id FROM app_migrations WHERE id = 'catalog_images_v2_20260807'");
  if (!catalogImgMigration[0]?.values.length) {
    const catalogEntries: [number, string, string, string, string][] = [
      [1,'Teal Maroon Heritage Kurta Set','Teal & Maroon','Resham accent work','cat_womens_kurtas'],
      [2,'Ivory Floral Embroidered Anarkali Set','Ivory & Rose','Floral thread embroidery','cat_anarkali_kurtas'],
      [3,'Olive Rose Garden Kurta Set','Olive & Pink','Floral thread embroidery','cat_womens_kurtas'],
      [4,'Teal Mustard Dupatta Kurta Set','Teal & Mustard','Geometric motif embroidery','cat_womens_kurtas'],
      [5,'Forest Green Mirror Work Kurta','Forest Green','Mirror and block-print yoke','cat_womens_kurtas'],
      [6,'Black Maroon Printed Kurta Set','Black & Maroon','Printed border detailing','cat_womens_kurtas'],
      [7,'Magenta Floral Dupatta Kurta Set','Magenta','All-over floral print','cat_womens_kurtas'],
      [8,'Wine Ajrakh Dupatta Kurta Set','Wine','Ajrakh-inspired yoke and dupatta','cat_womens_kurtas'],
      [9,'Rust Brown Embroidered Kurta Set','Rust Brown','Mirror and leaf embroidery','cat_womens_kurtas'],
      [10,'Mustard Teal Printed Kurta Set','Teal & Mustard','Paisley print','cat_womens_kurtas'],
      [11,'Plum Diamond Motif Kurta Set','Plum','Diamond thread embroidery','cat_womens_kurtas'],
      [12,'Crimson Black Dupatta Kurta Set','Crimson & Black','Contrast border print','cat_womens_kurtas'],
      [13,'Navy Floral Tiered Kurta','Navy Blue','Floral print','cat_anarkali_kurtas'],
      [14,'Midnight Floral Kurta Set','Midnight Blue','Floral yoke and border embroidery','cat_womens_kurtas'],
      [15,'Black Mustard Block Print Kurta Set','Black & Mustard','Hand block print','cat_womens_kurtas'],
      [16,'Olive Rust Yoke Kurta Set','Olive & Rust','Geometric yoke embroidery','cat_womens_kurtas'],
      [17,'Ivory Garden Embroidered Anarkali','Ivory & Berry','Floral embroidery','cat_anarkali_kurtas'],
      [18,'Ivory Garden Embroidered Anarkali Detail','Ivory & Berry','Floral embroidery','cat_anarkali_kurtas'],
      [19,'White Multi-Floral Kurta Set','White & Multicolor','Floral applique work','cat_womens_kurtas'],
      [20,'Navy Mustard Border Kurta Set','Navy & Mustard','Embroidered neckline','cat_womens_kurtas'],
      [21,'Turquoise Maroon Kurta Set','Turquoise & Maroon','Sun motif embroidery','cat_womens_kurtas'],
      [22,'Lime Yellow Dupatta Kurta Set','Lime Yellow','Minimal geometric print','cat_womens_kurtas'],
      [23,'Peach Floral Block Print Kurta Set','Peach & Orange','Block print floral','cat_womens_kurtas'],
      [24,'Sky Blue Embroidered Kurta Set','Sky Blue','Yoke embroidery with sequins','cat_womens_kurtas'],
      [25,'Purple Ikat Kurta Set','Purple','Ikat weave','cat_womens_kurtas'],
      [26,'Maroon Heritage Block Print Set','Maroon','Heritage block print','cat_womens_kurtas'],
      [27,'Dark Teal Geometric Kurta Set','Dark Teal','Geometric woven motifs','cat_womens_kurtas'],
      [28,'Dusty Pink Rose Kurta Set','Dusty Pink','Rose embroidery','cat_womens_kurtas'],
      [29,'Crimson Floral Anarkali Set','Crimson','Floral embroidery','cat_anarkali_kurtas'],
      [30,'Bottle Green Zari Kurta Set','Bottle Green','Zari border work','cat_womens_kurtas'],
      [31,'Coral Orange Embroidered Set','Coral Orange','Neck and sleeve embroidery','cat_womens_kurtas'],
      [32,'Lavender Chikankari Kurta Set','Lavender','Chikankari thread work','cat_womens_kurtas'],
      [33,'Khaki Floral Kurta Set','Khaki','Floral motif embroidery','cat_womens_kurtas'],
      [34,'Olive Ikat Dupatta Set','Olive','Ikat pattern','cat_womens_kurtas'],
      [35,'Navy Banarasi Anarkali Set','Navy Blue','Banarasi weave','cat_anarkali_kurtas'],
      [36,'Coral Ajrakh Kurta Set','Coral','Ajrakh block print','cat_womens_kurtas'],
      [37,'Dark Brown Floral Embroidered Set','Dark Brown','Floral embroidery','cat_womens_kurtas'],
      [38,'Teal Gold Paisley Kurta Set','Teal & Gold','Paisley block print','cat_womens_kurtas'],
      [39,'Wine Mirror Work Anarkali Set','Wine','Mirror work','cat_anarkali_kurtas'],
      [40,'Indigo Bandhani Kurta Set','Indigo','Bandhani tie-dye','cat_womens_kurtas'],
      [41,'Forest Green Zari Anarkali','Forest Green','Zari embroidery','cat_anarkali_kurtas'],
      [42,'Mauve Palazzo Kurta Set','Mauve','Gota patti trim','cat_womens_kurtas'],
      [43,'Rust Ikat Dupatta Set','Rust','Ikat weave','cat_womens_kurtas'],
      [44,'Pink Chikankari Anarkali','Pink','Chikankari thread work','cat_anarkali_kurtas'],
      [45,'Plum Gold Brocade Kurta Set','Plum & Gold','Brocade weave','cat_womens_kurtas'],
      [46,'Maroon Mukaish Kurta Set','Maroon','Mukaish badla work','cat_womens_kurtas'],
      [47,'Teal Embroidered Cotton Set','Teal','Cotton thread embroidery','cat_womens_kurtas'],
      [48,'Olive Cotton Floral Set','Olive','Floral print','cat_womens_kurtas'],
      [49,'Navy Sequin Kurta Set','Navy Blue','Sequin work neckline','cat_womens_kurtas'],
      [50,'Dark Green Woven Kurta Set','Dark Green','Woven geometric border','cat_womens_kurtas'],
      [51,'Burgundy Anarkali Lehenga','Burgundy','Zardozi & sequin work','cat_anarkali_kurtas'],
      [52,'Pastel Pink Floral Anarkali','Pastel Pink','Floral embroidery','cat_anarkali_kurtas'],
      [53,'Teal Floral Block Print Set','Teal','Block print','cat_womens_kurtas'],
      [54,'Brown Gold Motif Kurta Set','Brown & Gold','Woven motif border','cat_womens_kurtas'],
      [55,'Purple Phulkari Dupatta Set','Purple','Phulkari embroidery','cat_womens_kurtas'],
      [56,'Sage Green Kurta Set','Sage Green','Minimal embroidery','cat_womens_kurtas'],
      [57,'Red Bandhani Kurta Set','Red','Bandhani tie-dye','cat_womens_kurtas'],
      [58,'Midnight Blue Floral Set','Midnight Blue','Floral block print','cat_womens_kurtas'],
      [59,'Black Ajrakh Printed Set','Black','Ajrakh block print','cat_womens_kurtas'],
      [60,'Coral Embroidered Anarkali','Coral','Thread embroidery','cat_anarkali_kurtas'],
      [61,'Maroon Woven Cotton Set','Maroon','Woven cotton motif','cat_womens_kurtas'],
      [62,'Peacock Blue Kurta Set','Peacock Blue','Peacock motif embroidery','cat_womens_kurtas'],
      [63,'Ivory Resham Kurta Set','Ivory','Resham thread embroidery','cat_womens_kurtas'],
      [64,'Emerald Cotton Kurta Set','Emerald','Geometric print','cat_womens_kurtas'],
      [65,'Mustard Kalamkari Kurta Set','Mustard','Kalamkari print','cat_womens_kurtas'],
      [66,'Fuschia Mirror Dupatta Set','Fuschia','Mirror work','cat_womens_kurtas'],
      [67,'Beige Gota Kurta Set','Beige','Gota patti trim','cat_womens_kurtas'],
      [68,'Rose Pink Anarkali Lehenga','Rose Pink','Zardozi embroidery','cat_anarkali_kurtas'],
      [69,'Dark Red Heritage Kurta Set','Dark Red','Heritage block print','cat_womens_kurtas'],
      [70,'Olive Yellow Ikat Kurta Set','Olive Yellow','Ikat weave','cat_womens_kurtas'],
      [71,'Light Purple Embroidered Set','Light Purple','Thread embroidery','cat_womens_kurtas'],
      [72,'Black Gold Printed Set','Black & Gold','Gold foil print','cat_womens_kurtas'],
      [73,'Brick Red Floral Kurta Set','Brick Red','Floral print','cat_womens_kurtas'],
      [74,'Deep Blue Bandhani Set','Deep Blue','Bandhani tie-dye','cat_womens_kurtas'],
      [75,'Sage Floral Embroidered Set','Sage Green','Floral embroidery','cat_womens_kurtas'],
      [76,'Teal Paisley Embroidered Set','Teal','Paisley embroidery','cat_womens_kurtas'],
    ];

    for (const [num, title, color, embroidery, categoryId] of catalogEntries) {
      const garmentNum = String(num).padStart(2, '0');
      const productId = `prod_boutique_${garmentNum}`;
      const uploadUrl = `/uploads/${productId}/garment-${garmentNum}.jpeg`;
      const price = 500 + ((num % 6) * 100);
      const displayOrder = 100 + num;
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + `-${garmentNum}`;

      // Ensure product row exists (INSERT OR IGNORE = safe if already seeded)
      db.run(
        `INSERT OR IGNORE INTO products (
          id, title, slug, category_id, category_name, price, discount_price, stock,
          fabric, embroidery, color, sizes_json, description, care_instructions,
          images_json, rating, review_count, is_featured, is_new_arrival,
          display_order, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, NULL, 10, ?, ?, ?, ?, ?, ?, ?, 4.8, 0, ?, ?, ?, ?, ?)`,
        [
          productId, title, slug, categoryId, "Designer Women's Kurta Sets",
          price, 'Comfortable blended cotton', embroidery, color,
          JSON.stringify(['S', 'M', 'L', 'XL', 'XXL']),
          `${title}, curated for the ROYALS Jaipur boutique collection.`,
          'Gentle hand wash or dry clean as preferred.',
          JSON.stringify([uploadUrl]),
          num <= 8 ? 1 : 0, num <= 6 ? 1 : 0,
          displayOrder, suppliedNow, suppliedNow
        ]
      );

      // Update any existing boutique product to point to /uploads/ URL
      db.run(
        'UPDATE products SET images_json = ?, updated_at = ? WHERE id = ?',
        [JSON.stringify([uploadUrl]), suppliedNow, productId]
      );

      // Upsert into product_images (INSERT OR REPLACE is idempotent)
      const imgId = `pimg_boutique_${garmentNum}_seed`;
      db.run(
        `INSERT OR REPLACE INTO product_images
           (id, product_id, image_url, display_order, is_cover, view_type, alt_text, created_at, updated_at)
         VALUES (?, ?, ?, 0, 1, 'gallery', ?, ?, ?)`,
        [imgId, productId, uploadUrl, title, suppliedNow, suppliedNow]
      );
    }

    db.run("INSERT OR IGNORE INTO app_migrations (id, applied_at) VALUES ('catalog_images_v2_20260807', ?)", [suppliedNow]);
    console.log('ROYALS: Catalog images migration applied (76 garments seeded into product_images).');
  }

  // Check Coupons
  const coupRes = db.exec(`SELECT COUNT(*) as count FROM coupons;`);
  const coupCount = coupRes.length > 0 && coupRes[0].values.length > 0 ? (coupRes[0].values[0][0] as number) : 0;

  if (coupCount === 0) {
    const coupons = [
      { id: 'coup_1', code: 'ROYAL10', discount_type: 'percentage', discount_value: 10, min_spend: 25000, max_discount: 15000, is_active: 1, usage_count: 142, expiry_date: '2026-12-31' },
      { id: 'coup_2', code: 'HERITAGE20', discount_type: 'percentage', discount_value: 20, min_spend: 50000, max_discount: 30000, is_active: 1, usage_count: 89, expiry_date: '2026-12-31' },
      { id: 'coup_3', code: 'FIRSTROYAL', discount_type: 'flat', discount_value: 5000, min_spend: 30000, max_discount: 5000, is_active: 1, usage_count: 310, expiry_date: '2026-12-31' },
      { id: 'coup_4', code: 'JAIPUR15', discount_type: 'percentage', discount_value: 15, min_spend: 40000, max_discount: 20000, is_active: 1, usage_count: 64, expiry_date: '2026-12-31' }
    ];

    for (const c of coupons) {
      db.run(
        `INSERT INTO coupons (id, code, discount_type, discount_value, min_spend, max_discount, is_active, usage_count, expiry_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [c.id, c.code, c.discount_type, c.discount_value, c.min_spend, c.max_discount, c.is_active, c.usage_count, c.expiry_date]
      );
    }
  }

  // Create initial demo live order with complete history so order tracking is immediately testable and functional
  const ordRes = db.exec(`SELECT COUNT(*) as count FROM orders;`);
  const ordCount = ordRes.length > 0 && ordRes[0].values.length > 0 ? (ordRes[0].values[0][0] as number) : 0;

  if (ordCount === 0) {
    const orderId = 'ord_demo_89421';
    const orderNumber = 'RYL-2026-89421';
    const trackingId = 'TRK-RYL-77492';
    const estimatedDate = '12 Aug 2026';

    const address = {
      fullName: 'Princess Gayatri',
      phone: '8000461784',
      addressLine1: 'Suite 402, Royal Heritage Haveli',
      addressLine2: 'Road No. 6, Chaksu',
      landmark: 'Near Pink City Gateway',
      city: 'Jaipur',
      state: 'Rajasthan',
      pincode: '303901'
    };

    db.run(
      `INSERT INTO orders (id, order_number, tracking_id, user_id, customer_name, customer_email, customer_phone, shipping_address_json, subtotal, gst_amount, discount_amount, delivery_fee, grand_total, coupon_code, payment_method, payment_status, order_status, courier_name, estimated_delivery_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        orderId,
        orderNumber,
        trackingId,
        'usr_1',
        'Princess Gayatri',
        'customer@royals.com',
        '8000461784',
        JSON.stringify(address),
        165000,
        19800, // 12% GST
        16500, // ROYAL10
        0,     // Complimentary Insured
        168300,
        'ROYAL10',
        'UPI (PhonePe)',
        'PAID',
        'Preparing',
        'Blue Dart Apex Luxury',
        estimatedDate,
        '2026-08-04T08:15:00.000Z',
        '2026-08-04T10:42:00.000Z'
      ]
    );

    db.run(
      `INSERT INTO order_items (id, order_id, product_id, product_title, product_image, size, color, quantity, unit_price, total_price)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        'item_1',
        orderId,
        'prod_raw_silk_kurta_set',
        'The Maharaja Ivory Raw Silk Kurta Pajama Set',
        '/images/mens_raw_silk_kurta.jpg',
        '38 (M)',
        'Warm Ivory Cream & Antique Gold',
        1,
        32500,
        32500
      ]
    );

    db.run(
      `INSERT INTO payments (id, order_id, payment_method, transaction_id, gateway_ref, amount, status, paid_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        'pay_1',
        orderId,
        'UPI (PhonePe)',
        'TXN-RYL-9832104',
        'UPI-REF-08412948',
        168300,
        'SUCCESS',
        '2026-08-04T08:16:30.000Z'
      ]
    );

    // Initial order status history
    db.run(
      `INSERT INTO order_status_history (id, order_id, status, notes, updated_by, date_str, time_str, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      ['hist_1', orderId, 'Order Placed', 'Order placed successfully by customer via ROYALS portal', 'Customer', '04 Aug 2026', '08:15 AM', '2026-08-04T08:15:00.000Z']
    );

    db.run(
      `INSERT INTO order_status_history (id, order_id, status, notes, updated_by, date_str, time_str, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      ['hist_2', orderId, 'Payment Confirmed', 'Payment of ₹1,68,300 received via PhonePe UPI (Ref: UPI-REF-08412948)', 'Payment Gateway', '04 Aug 2026', '08:16 AM', '2026-08-04T08:16:30.000Z']
    );

    db.run(
      `INSERT INTO order_status_history (id, order_id, status, notes, updated_by, date_str, time_str, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      ['hist_3', orderId, 'Preparing', 'Master artisans at Jaipur Atelier commenced custom fitting and finishing quality check', 'Atelier Director', '04 Aug 2026', '10:42 AM', '2026-08-04T10:42:00.000Z']
    );

    // Notifications
    db.run(
      `INSERT INTO notifications (id, user_id, order_id, title, message, type, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        'notif_1',
        'usr_1',
        orderId,
        'Payment Confirmed',
        'Your payment for Order #RYL-2026-89421 of ₹1,68,300 is confirmed. Master artisans have begun preparing your couture piece.',
        'payment_success',
        0,
        '2026-08-04T08:16:30.000Z'
      ]
    );

    db.run(
      `INSERT INTO notifications (id, user_id, order_id, title, message, type, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        'notif_2',
        'usr_1',
        orderId,
        'Preparing at Atelier',
        'Your Order #RYL-2026-89421 is now in the Preparing stage under master artisan supervision.',
        'order_update',
        0,
        '2026-08-04T10:42:00.000Z'
      ]
    );
  }

  // ── Seed default banners (runs once, idempotent via app_migrations) ───────
  // Uses the three existing hero images from /images/ as the initial banners.
  // Admins can upload real images later via the banner manager.
  db.run('CREATE TABLE IF NOT EXISTS app_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
  const bannerSeedDone = db.exec("SELECT id FROM app_migrations WHERE id = 'banner_seed_v1_20260808'");
  if (!bannerSeedDone[0]?.values.length) {
    const bannerNow = new Date().toISOString();
    const defaultBanners = [
      {
        id: 'banner_001',
        title: 'THE IMPERIAL KURTA ATELIER',
        subtitle: 'HERITAGE COUTURE 2026',
        description: 'Handcrafted in pure handloom raw silk, Chanderi, and organza with antique Jaipur Zardozi, Chikankari, and real 24K gold mukaish work.',
        image_url: '/images/hero_royal_kurtas_1785856586452.jpg',
        mobile_image_url: '',
        button_text: 'Explore Royal Kurtas',
        button_link: '',
        tag: 'Haute Couture Kurtas',
        category_id: 'cat_mens_kurtas',
        display_order: 0,
        is_active: 1
      },
      {
        id: 'banner_002',
        title: 'LUCKNOWI CHIKANKARI & MUKAISH',
        subtitle: "DESIGNER WOMEN'S KURTA SETS",
        description: 'Ethereal pastel georgettes, scalloped organza dupattas, and intricate hand needlecraft tailored for festive grandeur.',
        image_url: '/images/women_chikankari_kurta_1785856609497.jpg',
        mobile_image_url: '',
        button_text: "Explore Women's Kurtas",
        button_link: '',
        tag: "Women's Couture",
        category_id: 'cat_womens_kurtas',
        display_order: 1,
        is_active: 1
      },
      {
        id: 'banner_003',
        title: 'THE MAHARAJA RAW SILK SETS',
        subtitle: "REGAL MEN'S ETHNIC COUTURE",
        description: 'Pure handloom raw silk kurta pajama sets and structured Bandhgalas with handcrafted 24K gold plated Jaipur crest buttons.',
        image_url: '/images/mens_raw_silk_kurta_1785856598401.jpg',
        mobile_image_url: '',
        button_text: "Explore Men's Silk Kurtas",
        button_link: '',
        tag: "Men's Silk Kurtas",
        category_id: 'cat_bandhgala_kurtas',
        display_order: 2,
        is_active: 1
      }
    ];
    for (const b of defaultBanners) {
      db.run(
        `INSERT OR IGNORE INTO banners
           (id, title, subtitle, description, image_url, mobile_image_url, button_text, button_link, tag, category_id, display_order, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [b.id, b.title, b.subtitle, b.description, b.image_url, b.mobile_image_url, b.button_text, b.button_link, b.tag, b.category_id, b.display_order, b.is_active, bannerNow, bannerNow]
      );
    }
    db.run("INSERT OR IGNORE INTO app_migrations (id, applied_at) VALUES ('banner_seed_v1_20260808', ?)", [bannerNow]);
    console.log('ROYALS: Default banners seeded.');
  }

  // ── Seed editorial strip cards ────────────────────────────────────────
  // Five curated cards using existing uploaded garment images. The admin can
  // update these via the admin panel. Guarded by app_migrations so they only
  // insert once on a fresh DB.
  db.run('CREATE TABLE IF NOT EXISTS app_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
  const editorialSeedDone = db.exec("SELECT id FROM app_migrations WHERE id = 'editorial_seed_v1_20260808'");
  if (!editorialSeedDone[0]?.values.length) {
    const edNow = new Date().toISOString();
    const editorialCards = [
      { id: 'ed_01', image_url: '/uploads/prod_boutique_25/garment-25.jpeg', label: 'New Arrivals',      subtitle: 'Fresh Styles Every Week',          category_id: 'cat_womens_kurtas',   display_order: 0 },
      { id: 'ed_02', image_url: '/uploads/prod_boutique_41/garment-41.jpeg', label: 'Festive Couture',   subtitle: 'Celebrate in Royal Style',         category_id: 'cat_anarkali_kurtas', display_order: 1 },
      { id: 'ed_03', image_url: '/uploads/prod_boutique_51/garment-51.jpeg', label: 'Bridal Collection', subtitle: 'Your Wedding, Our Masterpiece',     category_id: 'cat_bridal_lehengas', display_order: 2 },
      { id: 'ed_04', image_url: '/uploads/prod_boutique_60/garment-60.jpeg', label: 'Trending Now',      subtitle: 'Most Loved This Season',           category_id: 'cat_womens_kurtas',   display_order: 3 },
      { id: 'ed_05', image_url: '/uploads/prod_boutique_36/garment-36.jpeg', label: 'Best Sellers',      subtitle: 'Timeless Jaipur Classics',         category_id: 'cat_womens_kurtas',   display_order: 4 },
    ];
    for (const card of editorialCards) {
      db.run(
        `INSERT OR IGNORE INTO editorial_strips
           (id, image_url, label, subtitle, category_id, display_order, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        [card.id, card.image_url, card.label, card.subtitle, card.category_id, card.display_order, edNow, edNow]
      );
    }
    db.run("INSERT OR IGNORE INTO app_migrations (id, applied_at) VALUES ('editorial_seed_v1_20260808', ?)", [edNow]);
    console.log('ROYALS: Editorial strip cards seeded.');
  }

  // ── Fix image path migration: remove timestamp suffixes ────────────────
  // Previously, image files had timestamp suffixes in their names
  // (e.g. hero_royal_kurtas_1785856586452.jpg) but all code referenced them
  // without the suffix. The files have been renamed on disk; this migration
  // ensures the DB rows also use the clean paths.
  db.run('CREATE TABLE IF NOT EXISTS app_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
  const imgPathFixDone = db.exec("SELECT id FROM app_migrations WHERE id = 'image_path_fix_v1_20260808'");
  if (!imgPathFixDone[0]?.values.length) {
    const fixNow = new Date().toISOString();

    // Fix category image_url
    const catPathFixes: [string, string][] = [
      ['cat_mens_kurtas',          '/images/mens_raw_silk_kurta.jpg'],
      ['cat_womens_kurtas',        '/images/women_chikankari_kurta.jpg'],
      ['cat_anarkali_kurtas',      '/images/emerald_anarkali_kurta.jpg'],
      ['cat_bandhgala_kurtas',     '/images/midnight_bandhgala_kurta.jpg'],
      ['cat_bridal_lehengas',      '/images/kurta_chanderi_sharara.jpg'],
      ['cat_heritage_accessories', '/images/kurta_jaipur_angrakha.jpg']
    ];
    for (const [id, url] of catPathFixes) {
      db.run('UPDATE categories SET image_url = ? WHERE id = ?', [url, id]);
    }

    // Fix 8 hero product images_json
    const prodPathFixes: [string, string[]][] = [
      ['prod_raw_silk_kurta_set',       ['/images/mens_raw_silk_kurta.jpg',      '/images/hero_royal_kurtas.jpg']],
      ['prod_chikankari_mukaish_kurta', ['/images/women_chikankari_kurta.jpg',   '/images/kurta_chanderi_sharara.jpg']],
      ['prod_midnight_bandhgala_kurta', ['/images/midnight_bandhgala_kurta.jpg', '/images/kurta_nehru_jacket_set.jpg']],
      ['prod_emerald_anarkali_kurta',   ['/images/emerald_anarkali_kurta.jpg',   '/images/women_chikankari_kurta.jpg']],
      ['prod_jaipur_angrakha_kurta',    ['/images/kurta_jaipur_angrakha.jpg',    '/images/hero_royal_kurtas.jpg']],
      ['prod_chanderi_sharara_kurta',   ['/images/kurta_chanderi_sharara.jpg',   '/images/women_chikankari_kurta.jpg']],
      ['prod_nehru_jacket_kurta_set',   ['/images/kurta_nehru_jacket_set.jpg',   '/images/mens_raw_silk_kurta.jpg']],
      ['prod_padmavati_kurta_lehenga',  ['/images/hero_royal_kurtas.jpg',        '/images/emerald_anarkali_kurta.jpg']]
    ];
    for (const [id, imgs] of prodPathFixes) {
      db.run('UPDATE products SET images_json = ?, updated_at = ? WHERE id = ?',
        [JSON.stringify(imgs), fixNow, id]);
      imgs.forEach((url, idx) => {
        const imgId = `pimg_hero_${id}_${idx}`;
        db.run(
          `INSERT OR REPLACE INTO product_images
             (id, product_id, image_url, display_order, is_cover, view_type, alt_text, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'gallery', NULL, ?, ?)`,
          [imgId, id, url, idx, idx === 0 ? 1 : 0, fixNow, fixNow]
        );
      });
    }

    db.run("INSERT OR IGNORE INTO app_migrations (id, applied_at) VALUES ('image_path_fix_v1_20260808', ?)", [fixNow]);
    console.log('ROYALS: Image path fix migration applied.');
  }
}
