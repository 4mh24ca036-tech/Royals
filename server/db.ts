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
        display_order: 1
      },
      {
        id: 'cat_womens_kurtas',
        name: "Designer Women's Kurta Sets",
        slug: 'womens-kurta-sets',
        description: 'Lucknowi Chikankari tunics, Gota Patti sharara sets, and pure georgette kurtas adorned with 24K gold mukaish work.',
        image_url: '/images/women_chikankari_kurta.jpg',
        display_order: 2
      },
      {
        id: 'cat_anarkali_kurtas',
        name: 'Flared Anarkali & Angrakha Kurtas',
        slug: 'anarkali-and-angrakha-kurtas',
        description: 'Sweeping 48-kali floor-length Anarkalis, Banarasi zari yokes, and Jaipuri side-tie Angrakhas crafted in pure silks.',
        image_url: '/images/emerald_anarkali_kurta.jpg',
        display_order: 3
      },
      {
        id: 'cat_bandhgala_kurtas',
        name: 'Royal Bandhgala & Jacket Kurta Sets',
        slug: 'bandhgala-and-jacket-kurtas',
        description: 'Structured short kurta bandhgalas, metallic brocade Nehru jackets, and raw silk achkan kurta sets.',
        image_url: '/images/midnight_bandhgala_kurta.jpg',
        display_order: 4
      },
      {
        id: 'cat_bridal_lehengas',
        name: 'Imperial Bridal & Festive Couture',
        slug: 'bridal-and-festive-couture',
        description: 'Heirloom velvet kurti lehenga sets, Zardozi dupattas, and grand wedding ensembles from the Jaipur atelier.',
        image_url: '/images/kurta_chanderi_sharara.jpg',
        display_order: 5
      },
      {
        id: 'cat_heritage_accessories',
        name: 'Heritage Accessories & Safas',
        slug: 'heritage-accessories',
        description: 'Jaipuri royal safas, hand-woven chanderi stoles, gilded crest buttons, and handcrafted accessories.',
        image_url: '/images/kurta_jaipur_angrakha.jpg',
        display_order: 6
      }
    ];

    for (const cat of categories) {
      db.run(
        `INSERT INTO categories (id, name, slug, description, image_url, display_order)
         VALUES (?, ?, ?, ?, ?, ?);`,
        [cat.id, cat.name, cat.slug, cat.description, cat.image_url, cat.display_order]
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
}
