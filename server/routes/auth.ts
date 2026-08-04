import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getDb, persistDb } from '../db.js';
import { generateUserToken, authenticateUser } from '../auth.js';
import { queryAll } from '../dbUtils.js';
import { asyncHandler, HttpError } from '../errors.js';

const router = Router();

// CUSTOMER REGISTER
router.post(
  '/register',
  asyncHandler(async (req: Request, res: Response) => {
    const db = await getDb();
    const { name, email, phone, password } = req.body;

    if (!name || !email || !password) {
      throw new HttpError(400, 'Name, email, and password are required');
    }

    const existing = queryAll(db, 'SELECT id FROM users WHERE email = ? LIMIT 1', [email.toLowerCase()]);
    if (existing.length > 0) {
      throw new HttpError(409, 'An account with this email address already exists');
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
  })
);

// CUSTOMER LOGIN
router.post(
  '/login',
  asyncHandler(async (req: Request, res: Response) => {
    const db = await getDb();
    const { email, password } = req.body;

    if (!email || !password) {
      throw new HttpError(400, 'Email and password are required');
    }

    const users = queryAll(db, 'SELECT * FROM users WHERE email = ? LIMIT 1', [email.toLowerCase()]);
    if (users.length === 0) {
      throw new HttpError(401, 'Invalid email or password');
    }

    const user = users[0];
    const match = bcrypt.compareSync(password, user.password_hash);
    if (!match) {
      throw new HttpError(401, 'Invalid email or password');
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
  })
);

// GET CURRENT USER PROFILE
router.get(
  '/me',
  authenticateUser,
  asyncHandler(async (req: any, res: Response) => {
    const db = await getDb();
    const userId = req.user.id;

    const users = queryAll(db, 'SELECT id, name, email, phone, role, created_at FROM users WHERE id = ? LIMIT 1', [userId]);
    if (users.length === 0) {
      throw new HttpError(404, 'User not found');
    }

    const user = users[0];
    const addresses = queryAll(db, 'SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC', [userId]);
    const notifications = queryAll(db, 'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20', [userId]);

    res.json({
      user,
      addresses,
      notifications
    });
  })
);

// ADD ADDRESS
router.post(
  '/addresses',
  authenticateUser,
  asyncHandler(async (req: any, res: Response) => {
    const db = await getDb();
    const userId = req.user.id;
    const { fullName, phone, addressLine1, addressLine2, landmark, city, state, pincode, isDefault } = req.body;

    if (!fullName || !phone || !addressLine1 || !city || !state || !pincode) {
      throw new HttpError(400, 'Missing required address fields');
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
  })
);

// DELETE ADDRESS
router.delete(
  '/addresses/:id',
  authenticateUser,
  asyncHandler(async (req: any, res: Response) => {
    const db = await getDb();
    const userId = req.user.id;
    const { id } = req.params;

    const owned = queryAll(db, 'SELECT id FROM addresses WHERE id = ? AND user_id = ? LIMIT 1', [id, userId]);
    if (owned.length === 0) {
      throw new HttpError(404, 'Address not found');
    }

    db.run('DELETE FROM addresses WHERE id = ? AND user_id = ?', [id, userId]);
    persistDb();

    const addresses = queryAll(db, 'SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC', [userId]);
    res.json(addresses);
  })
);

// MARK NOTIFICATION READ
router.patch(
  '/notifications/:id/read',
  authenticateUser,
  asyncHandler(async (req: any, res: Response) => {
    const db = await getDb();
    const userId = req.user.id;
    const { id } = req.params;

    const owned = queryAll(db, 'SELECT id FROM notifications WHERE id = ? AND user_id = ? LIMIT 1', [id, userId]);
    if (owned.length === 0) {
      throw new HttpError(404, 'Notification not found');
    }

    db.run('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [id, userId]);
    persistDb();

    res.json({ message: 'Notification marked as read' });
  })
);

// VALIDATE COUPON
router.post(
  '/coupons/validate',
  asyncHandler(async (req: Request, res: Response) => {
    const db = await getDb();
    const { code, subtotal } = req.body;

    if (!code) {
      throw new HttpError(400, 'Coupon code is required');
    }

    const coupons = queryAll(db, 'SELECT * FROM coupons WHERE code = ? AND is_active = 1 LIMIT 1', [code.toUpperCase().trim()]);
    if (coupons.length === 0) {
      throw new HttpError(400, 'Invalid or expired coupon code');
    }

    const coupon = coupons[0];
    const subtotalNum = Number(subtotal || 0);

    if (subtotalNum < coupon.min_spend) {
      throw new HttpError(
        400,
        `Coupon ${coupon.code} requires a minimum purchase of ₹${coupon.min_spend.toLocaleString('en-IN')}`
      );
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
  })
);

export default router;
