import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getDb, persistDb } from '../db.js';
import { generateUserToken, authenticateUser } from '../auth.js';
import { isValidEmail, isValidPhone, isValidPincode, rateLimit, sanitizeText, serverError } from '../security.js';

const router = Router();

const credentialsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many authentication attempts. Please try again in a few minutes.'
});

const couponLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  message: 'Too many coupon attempts. Please try again in a few minutes.'
});

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

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
router.post('/register', credentialsLimiter, async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const name = sanitizeText(req.body?.name, 100);
    const email = isValidEmail(req.body?.email) ? req.body.email.trim().toLowerCase() : null;
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const phone = req.body?.phone === undefined || req.body?.phone === null || req.body?.phone === ''
      ? null
      : isValidPhone(req.body.phone) ? String(req.body.phone).trim() : undefined;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'A valid name, email address, and password are required' });
    }

    if (phone === undefined) {
      return res.status(400).json({ error: 'Phone number format is invalid' });
    }

    if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `Password must be between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters` });
    }

    const existing = queryAll(db, 'SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'An account with this email address already exists' });
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);
    const id = `usr_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const now = new Date().toISOString();

    db.run(
      `INSERT INTO users (id, name, email, phone, password_hash, role, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'customer', ?, ?);`,
      [id, name, email, phone, passwordHash, now, now]
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

    const token = generateUserToken({ id, email, name, role: 'customer' });

    res.status(201).json({
      token,
      user: {
        id,
        name,
        email,
        phone,
        role: 'customer'
      }
    });
  } catch (err: any) {
    return serverError(res, 'auth route', err);
  }
});

// CUSTOMER LOGIN
router.post('/login', credentialsLimiter, async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : null;
    const password = typeof req.body?.password === 'string' ? req.body.password : null;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const users = queryAll(db, 'SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
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
    return serverError(res, 'auth route', err);
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
    return serverError(res, 'auth route', err);
  }
});

// ADD ADDRESS
router.post('/addresses', authenticateUser, async (req: any, res: Response) => {
  try {
    const db = await getDb();
    const userId = req.user.id;
    const { addressLine2, landmark, isDefault } = req.body;
    const fullName = sanitizeText(req.body?.fullName, 100);
    const addressLine1 = sanitizeText(req.body?.addressLine1, 200);
    const city = sanitizeText(req.body?.city, 100);
    const state = sanitizeText(req.body?.state, 100);
    const phone = isValidPhone(req.body?.phone) ? String(req.body.phone).trim() : null;
    const pincode = isValidPincode(req.body?.pincode) ? String(req.body.pincode).trim() : null;

    if (!fullName || !phone || !addressLine1 || !city || !state || !pincode) {
      return res.status(400).json({ error: 'Missing or invalid required address fields' });
    }

    const line2 = addressLine2 ? sanitizeText(addressLine2, 200) : null;
    const landmarkText = landmark ? sanitizeText(landmark, 200) : null;

    const id = `addr_${Date.now()}`;
    const now = new Date().toISOString();

    if (isDefault) {
      db.run('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [userId]);
    }

    db.run(
      `INSERT INTO addresses (id, user_id, full_name, phone, address_line1, address_line2, landmark, city, state, pincode, is_default, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [id, userId, fullName, phone, addressLine1, line2, landmarkText, city, state, pincode, isDefault ? 1 : 0, now]
    );

    persistDb();

    const addresses = queryAll(db, 'SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC', [userId]);
    res.status(201).json(addresses);
  } catch (err: any) {
    return serverError(res, 'auth route', err);
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
    return serverError(res, 'auth route', err);
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
    return serverError(res, 'auth route', err);
  }
});

// VALIDATE COUPON
router.post('/coupons/validate', couponLimiter, async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const code = sanitizeText(req.body?.code, 40);
    const subtotal = req.body?.subtotal;

    if (!code) {
      return res.status(400).json({ error: 'Coupon code is required' });
    }

    const coupons = queryAll(db, 'SELECT * FROM coupons WHERE code = ? AND is_active = 1 LIMIT 1', [code.toUpperCase()]);
    if (coupons.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired coupon code' });
    }

    const coupon = coupons[0];
    if (coupon.expiry_date && new Date(coupon.expiry_date).getTime() < Date.now()) {
      return res.status(400).json({ error: 'Invalid or expired coupon code' });
    }

    const subtotalNum = Number.isFinite(Number(subtotal)) ? Math.max(0, Number(subtotal)) : 0;

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
    return serverError(res, 'auth route', err);
  }
});

export default router;
