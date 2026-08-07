import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getDb, persistDb } from '../db.js';
import { generateUserToken, authenticateUser } from '../auth.js';

const router = Router();

function queryAll(db: any, sql: string, params: any[] = []) {
  const stmt = db.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

// CUSTOMER REGISTER
router.post('/register', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const { name, email, phone, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    const existing = queryAll(db, 'SELECT * FROM users WHERE email = ? LIMIT 1', [email.toLowerCase()]);
    if (existing.length > 0) {
      // The storefront has a single atelier-membership entry point.  An
      // existing patron can continue here without being sent to a second
      // login screen, while their password is still verified server-side.
      const user = existing[0];
      if (!bcrypt.compareSync(password, user.password_hash)) {
        return res.status(401).json({ error: 'This email is already registered. Please enter the password for this ROYALS account.' });
      }
      const token = generateUserToken({ id: user.id, email: user.email, name: user.name, role: user.role });
      return res.json({
        token,
        user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role },
        existingAccount: true
      });
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);
    const id = `usr_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const now = new Date().toISOString();

    db.run(
      `INSERT INTO users (id, name, email, phone, password_hash, role, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'customer', ?, ?);`,
      [id, name, email.toLowerCase(), phone || '8000461784', passwordHash, now, now]
    );

    // Initial welcome notification
    db.run(
      `INSERT INTO notifications (id, user_id, title, message, type, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, 0, ?);`,
      [
        `notif_welcome_${id}`,
        id,
        'Welcome to ROYALS Haute Couture',
        'Welcome to ROYALS. Enjoy exclusive access to bespoke master artisan ethnic couture and priority styling.',
        'welcome',
        now
      ]
    );

    persistDb();

    const token = generateUserToken({ id, email: email.toLowerCase(), name, role: 'customer' });

    res.status(201).json({
      token,
      user: {
        id,
        name,
        email: email.toLowerCase(),
        phone: phone || '8000461784',
        role: 'customer'
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// CUSTOMER LOGIN
router.post('/login', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const users = queryAll(db, 'SELECT * FROM users WHERE email = ? LIMIT 1', [email.toLowerCase()]);
    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = users[0];
    const match = bcrypt.compareSync(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateUserToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET CURRENT USER PROFILE
router.get('/me', authenticateUser, async (req: any, res: Response) => {
  try {
    const db = await getDb();
    const userId = req.user.id;

    const users = queryAll(db, 'SELECT id, name, email, phone, role, created_at FROM users WHERE id = ? LIMIT 1', [userId]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[0];
    const addresses = queryAll(db, 'SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC', [userId]);
    const notifications = queryAll(db, 'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20', [userId]);

    res.json({
      user,
      addresses,
      notifications
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ADD ADDRESS
router.post('/addresses', authenticateUser, async (req: any, res: Response) => {
  try {
    const db = await getDb();
    const userId = req.user.id;
    const { fullName, phone, addressLine1, addressLine2, landmark, city, state, pincode, isDefault } = req.body;

    if (!fullName || !phone || !addressLine1 || !city || !state || !pincode) {
      return res.status(400).json({ error: 'Missing required address fields' });
    }

    const id = `addr_${Date.now()}`;
    const now = new Date().toISOString();

    if (isDefault) {
      db.run('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [userId]);
    }

    db.run(
      `INSERT INTO addresses (id, user_id, full_name, phone, address_line1, address_line2, landmark, city, state, pincode, is_default, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [id, userId, fullName, phone, addressLine1, addressLine2 || null, landmark || null, city, state, pincode, isDefault ? 1 : 0, now]
    );

    persistDb();

    const addresses = queryAll(db, 'SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC', [userId]);
    res.status(201).json(addresses);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE ADDRESS
router.delete('/addresses/:id', authenticateUser, async (req: any, res: Response) => {
  try {
    const db = await getDb();
    const userId = req.user.id;
    const { id } = req.params;

    db.run('DELETE FROM addresses WHERE id = ? AND user_id = ?', [id, userId]);
    persistDb();

    const addresses = queryAll(db, 'SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC', [userId]);
    res.json(addresses);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// MARK NOTIFICATION READ
router.patch('/notifications/:id/read', authenticateUser, async (req: any, res: Response) => {
  try {
    const db = await getDb();
    const userId = req.user.id;
    const { id } = req.params;

    db.run('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [id, userId]);
    persistDb();

    res.json({ message: 'Notification marked as read' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// VALIDATE COUPON
router.post('/coupons/validate', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const { code, subtotal } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Coupon code is required' });
    }

    const coupons = queryAll(db, 'SELECT * FROM coupons WHERE code = ? AND is_active = 1 LIMIT 1', [code.toUpperCase().trim()]);
    if (coupons.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired coupon code' });
    }

    const coupon = coupons[0];
    const subtotalNum = Number(subtotal || 0);

    if (subtotalNum < coupon.min_spend) {
      return res.status(400).json({
        error: `Coupon ${coupon.code} requires a minimum purchase of ₹${coupon.min_spend.toLocaleString('en-IN')}`
      });
    }

    let discountAmount = 0;
    if (coupon.discount_type === 'percentage') {
      discountAmount = (subtotalNum * coupon.discount_value) / 100;
      if (coupon.max_discount && discountAmount > coupon.max_discount) {
        discountAmount = coupon.max_discount;
      }
    } else {
      discountAmount = Math.min(subtotalNum, coupon.discount_value);
    }

    res.json({
      valid: true,
      code: coupon.code,
      discountType: coupon.discount_type,
      discountValue: coupon.discount_value,
      discountAmount: Math.round(discountAmount),
      message: `Coupon ${coupon.code} applied! Saved ₹${Math.round(discountAmount).toLocaleString('en-IN')}`
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
