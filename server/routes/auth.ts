/**
 * server/routes/auth.ts
 *
 * Customer authentication, profile, addresses, notifications, coupon validation.
 * All data from Supabase PostgreSQL. No SQLite dependency.
 */

import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getDb, persistDb } from '../db.js';
import { generateUserToken, authenticateUser } from '../auth.js';

const router = Router();

// ── CUSTOMER REGISTER ─────────────────────────────────────────────────────
router.post('/register', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { name, email, phone, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    const normalizedEmail = email.toLowerCase();

    // Check if email already exists
    const { data: existing } = await db
      .from('users')
      .select('*')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existing) {
      if (!bcrypt.compareSync(password, existing.password_hash)) {
        return res.status(401).json({
          error: 'This email is already registered. Please enter the password for this ROYALS account.'
        });
      }
      const token = generateUserToken({
        id: existing.id,
        email: existing.email,
        name: existing.name,
        role: existing.role
      });
      return res.json({
        token,
        user: {
          id: existing.id,
          name: existing.name,
          email: existing.email,
          phone: existing.phone,
          role: existing.role
        },
        existingAccount: true
      });
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);
    const id = `usr_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const now = new Date().toISOString();

    const { error: insertErr } = await db.from('users').insert({
      id,
      name,
      email: normalizedEmail,
      phone: phone || null,
      password_hash: passwordHash,
      role: 'customer',
      created_at: now,
      updated_at: now
    });

    if (insertErr) throw insertErr;

    // Welcome notification
    await db.from('notifications').insert({
      id: `notif_welcome_${id}`,
      user_id: id,
      order_id: null,
      title: 'Welcome to ROYALS Haute Couture',
      message: 'Welcome to ROYALS. Enjoy exclusive access to bespoke master artisan ethnic couture and priority styling.',
      type: 'welcome',
      is_read: false,
      created_at: now
    });

    const token = generateUserToken({ id, email: normalizedEmail, name, role: 'customer' });

    res.status(201).json({
      token,
      user: {
        id,
        name,
        email: normalizedEmail,
        phone: phone || null,
        role: 'customer'
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── CUSTOMER LOGIN ────────────────────────────────────────────────────────
router.post('/login', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { data: user } = await db
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!bcrypt.compareSync(password, user.password_hash)) {
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

// ── GET CURRENT USER PROFILE ──────────────────────────────────────────────
router.get('/me', authenticateUser, async (req: any, res: Response) => {
  try {
    const db = getDb();
    const userId = req.user.id;

    const [userResult, addressesResult, notificationsResult] = await Promise.all([
      db.from('users')
        .select('id, name, email, phone, role, created_at')
        .eq('id', userId)
        .maybeSingle(),
      db.from('addresses')
        .select('*')
        .eq('user_id', userId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false }),
      db.from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20)
    ]);

    if (!userResult.data) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: userResult.data,
      addresses: addressesResult.data ?? [],
      notifications: notificationsResult.data ?? []
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── ADD ADDRESS ───────────────────────────────────────────────────────────
router.post('/addresses', authenticateUser, async (req: any, res: Response) => {
  try {
    const db = getDb();
    const userId = req.user.id;
    const { fullName, phone, addressLine1, addressLine2, landmark, city, state, pincode, isDefault } = req.body;

    if (!fullName || !phone || !addressLine1 || !city || !state || !pincode) {
      return res.status(400).json({ error: 'Missing required address fields' });
    }

    const id = `addr_${Date.now()}`;
    const now = new Date().toISOString();

    if (isDefault) {
      await db
        .from('addresses')
        .update({ is_default: false })
        .eq('user_id', userId);
    }

    const { error: insertErr } = await db.from('addresses').insert({
      id,
      user_id: userId,
      full_name: fullName,
      phone,
      address_line1: addressLine1,
      address_line2: addressLine2 || null,
      landmark: landmark || null,
      city,
      state,
      pincode,
      is_default: Boolean(isDefault),
      created_at: now
    });

    if (insertErr) throw insertErr;

    const { data: addresses } = await db
      .from('addresses')
      .select('*')
      .eq('user_id', userId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    res.status(201).json(addresses ?? []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE ADDRESS ────────────────────────────────────────────────────────
router.delete('/addresses/:id', authenticateUser, async (req: any, res: Response) => {
  try {
    const db = getDb();
    const userId = req.user.id;
    const { id } = req.params;

    const { error } = await db
      .from('addresses')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;

    const { data: addresses } = await db
      .from('addresses')
      .select('*')
      .eq('user_id', userId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    res.json(addresses ?? []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── MARK NOTIFICATION READ ────────────────────────────────────────────────
router.patch('/notifications/:id/read', authenticateUser, async (req: any, res: Response) => {
  try {
    const db = getDb();
    const userId = req.user.id;
    const { id } = req.params;

    const { error } = await db
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;

    res.json({ message: 'Notification marked as read' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── VALIDATE COUPON ───────────────────────────────────────────────────────
router.post('/coupons/validate', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { code, subtotal } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Coupon code is required' });
    }

    const { data: coupon } = await db
      .from('coupons')
      .select('*')
      .eq('code', code.toUpperCase().trim())
      .eq('is_active', true)
      .maybeSingle();

    if (!coupon) {
      return res.status(400).json({ error: 'Invalid or expired coupon code' });
    }

    const subtotalNum = Number(subtotal || 0);

    if (subtotalNum < Number(coupon.min_spend)) {
      return res.status(400).json({
        error: `Coupon ${coupon.code} requires a minimum purchase of ₹${Number(coupon.min_spend).toLocaleString('en-IN')}`
      });
    }

    let discountAmount = 0;
    if (coupon.discount_type === 'percentage') {
      discountAmount = (subtotalNum * Number(coupon.discount_value)) / 100;
      if (coupon.max_discount && discountAmount > Number(coupon.max_discount)) {
        discountAmount = Number(coupon.max_discount);
      }
    } else {
      discountAmount = Math.min(subtotalNum, Number(coupon.discount_value));
    }

    res.json({
      valid: true,
      code: coupon.code,
      discountType: coupon.discount_type,
      discountValue: Number(coupon.discount_value),
      discountAmount: Math.round(discountAmount),
      message: `Coupon ${coupon.code} applied! Saved ₹${Math.round(discountAmount).toLocaleString('en-IN')}`
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
