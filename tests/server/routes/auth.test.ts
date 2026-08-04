import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import {beforeAll, describe, expect, it} from 'vitest';
import {generateUserToken} from '../../../server/auth';
import {getDb} from '../../../server/db';
import authRouter from '../../../server/routes/auth';
import {createTestApp} from '../../helpers/app';

const app = createTestApp('/api/auth', authRouter);

beforeAll(async () => {
  await getDb();
});

describe('POST /api/auth/register', () => {
  it('rejects a registration missing required fields', async () => {
    const res = await request(app).post('/api/auth/register').send({email: 'a@b.com'});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Name, email, and password are required');
  });

  it('creates the account, hashes the password and issues a token', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Rajkumari Ira',
      email: 'Ira@Royals.com',
      phone: '9000000001',
      password: 'Secret@123'
    });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({
      name: 'Rajkumari Ira',
      email: 'ira@royals.com',
      phone: '9000000001',
      role: 'customer'
    });

    const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET as string) as any;
    expect(decoded).toMatchObject({email: 'ira@royals.com', role: 'customer'});

    const db = await getDb();
    const stored = db.exec('SELECT password_hash FROM users WHERE email = ?', ['ira@royals.com']);
    const hash = stored[0].values[0][0] as string;
    expect(hash).not.toBe('Secret@123');
    expect(bcrypt.compareSync('Secret@123', hash)).toBe(true);
  });

  it('creates a welcome notification for the new patron', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Kunwar Devraj',
      email: 'devraj@royals.com',
      password: 'Secret@123'
    });

    const profile = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${res.body.token}`);
    expect(profile.body.notifications[0]).toMatchObject({
      title: 'Welcome to ROYALS Haute Couture',
      type: 'welcome',
      is_read: 0
    });
  });

  it('falls back to the atelier phone number when none is supplied', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Thakur Vikram',
      email: 'vikram@royals.com',
      password: 'Secret@123'
    });
    expect(res.body.user.phone).toBe('8000461784');
  });

  it('rejects a duplicate email regardless of casing', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Impostor',
      email: 'IRA@royals.com',
      password: 'Secret@123'
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('An account with this email address already exists');
  });
});

describe('POST /api/auth/login', () => {
  it('rejects missing credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({email: 'customer@royals.com'});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Email and password are required');
  });

  it('logs in the seeded demo patron', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({email: 'Customer@Royals.com', password: 'Customer@123'});

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({id: 'usr_1', email: 'customer@royals.com'});
    expect(res.body.token).toBeTruthy();
  });

  it('does not disclose whether the email or the password was wrong', async () => {
    const unknown = await request(app).post('/api/auth/login').send({email: 'ghost@royals.com', password: 'x'});
    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({email: 'customer@royals.com', password: 'wrong'});

    expect(unknown.status).toBe(401);
    expect(wrongPassword.status).toBe(401);
    expect(unknown.body.error).toBe('Invalid email or password');
    expect(wrongPassword.body.error).toBe('Invalid email or password');
  });
});

describe('GET /api/auth/me', () => {
  it('requires a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns the profile with addresses and notifications, without the password hash', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({email: 'customer@royals.com', password: 'Customer@123'});

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${login.body.token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe('usr_1');
    expect(res.body.user.password_hash).toBeUndefined();
    expect(res.body.addresses.length).toBeGreaterThan(0);
    expect(Array.isArray(res.body.notifications)).toBe(true);
  });

  it('returns 404 when the token refers to a deleted user', async () => {
    const token = generateUserToken({id: 'usr_gone', email: 'gone@royals.com', name: 'Gone', role: 'customer'});
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('User not found');
  });
});

describe('addresses', () => {
  const token = generateUserToken({id: 'usr_1', email: 'customer@royals.com', name: 'Princess Gayatri', role: 'customer'});

  const address = {
    fullName: 'Princess Gayatri',
    phone: '8000461784',
    addressLine1: 'Villa 12, Amber Road',
    city: 'Jaipur',
    state: 'Rajasthan',
    pincode: '302002'
  };

  it('rejects an address missing mandatory fields', async () => {
    const res = await request(app)
      .post('/api/auth/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send({fullName: 'Princess Gayatri'});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Missing required address fields');
  });

  it('adds an address and returns the full list', async () => {
    const res = await request(app).post('/api/auth/addresses').set('Authorization', `Bearer ${token}`).send(address);

    expect(res.status).toBe(201);
    const added = res.body.find((a: any) => a.address_line1 === 'Villa 12, Amber Road');
    expect(added).toMatchObject({city: 'Jaipur', is_default: 0, address_line2: null, landmark: null});
  });

  it('demotes the previous default when a new default is added', async () => {
    const res = await request(app)
      .post('/api/auth/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send({...address, addressLine1: 'Palace Wing 3', isDefault: true});

    const defaults = res.body.filter((a: any) => a.is_default === 1);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].address_line1).toBe('Palace Wing 3');
    expect(res.body[0].is_default).toBe(1);
  });

  it('deletes only the requesting user’s address', async () => {
    const list = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    const target = list.body.addresses.find((a: any) => a.address_line1 === 'Villa 12, Amber Road');

    const res = await request(app)
      .delete(`/api/auth/addresses/${target.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.some((a: any) => a.id === target.id)).toBe(false);
  });

  it('leaves addresses owned by another user untouched', async () => {
    const otherToken = generateUserToken({id: 'usr_other', email: 'other@royals.com', name: 'Other', role: 'customer'});
    const res = await request(app).delete('/api/auth/addresses/addr_1').set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(200);
    const owner = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(owner.body.addresses.some((a: any) => a.id === 'addr_1')).toBe(true);
  });
});

describe('PATCH /api/auth/notifications/:id/read', () => {
  it('marks the notification as read for its owner', async () => {
    const token = generateUserToken({id: 'usr_1', email: 'customer@royals.com', name: 'Princess Gayatri', role: 'customer'});

    const res = await request(app).patch('/api/auth/notifications/notif_1/read').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Notification marked as read');

    const profile = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    const notification = profile.body.notifications.find((n: any) => n.id === 'notif_1');
    expect(notification.is_read).toBe(1);
  });

  it('does not mark notifications belonging to another user', async () => {
    const otherToken = generateUserToken({id: 'usr_other', email: 'other@royals.com', name: 'Other', role: 'customer'});
    await request(app).patch('/api/auth/notifications/notif_2/read').set('Authorization', `Bearer ${otherToken}`);

    const db = await getDb();
    const read = db.exec("SELECT is_read FROM notifications WHERE id = 'notif_2'")[0].values[0][0];
    expect(read).toBe(0);
  });
});

describe('POST /api/auth/coupons/validate', () => {
  it('requires a coupon code', async () => {
    const res = await request(app).post('/api/auth/coupons/validate').send({subtotal: 50000});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Coupon code is required');
  });

  it('rejects an unknown code', async () => {
    const res = await request(app).post('/api/auth/coupons/validate').send({code: 'NOPE', subtotal: 50000});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid or expired coupon code');
  });

  it('computes a percentage discount, normalising the code', async () => {
    const res = await request(app).post('/api/auth/coupons/validate').send({code: '  royal10 ', subtotal: 40000});

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      valid: true,
      code: 'ROYAL10',
      discountType: 'percentage',
      discountValue: 10,
      discountAmount: 4000
    });
    expect(res.body.message).toContain('ROYAL10');
  });

  it('caps a percentage discount at max_discount', async () => {
    const res = await request(app).post('/api/auth/coupons/validate').send({code: 'HERITAGE20', subtotal: 500000});
    expect(res.body.discountAmount).toBe(30000);
  });

  it('never discounts more than the subtotal for a flat coupon', async () => {
    const res = await request(app).post('/api/auth/coupons/validate').send({code: 'FIRSTROYAL', subtotal: 30000});
    expect(res.body.discountAmount).toBe(5000);
  });

  it('rejects a coupon below its minimum spend', async () => {
    const res = await request(app).post('/api/auth/coupons/validate').send({code: 'ROYAL10', subtotal: 1000});
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('minimum purchase');
  });

  it('treats a missing subtotal as zero', async () => {
    const res = await request(app).post('/api/auth/coupons/validate').send({code: 'ROYAL10'});
    expect(res.status).toBe(400);
  });

  it('rejects a deactivated coupon', async () => {
    const db = await getDb();
    db.run("UPDATE coupons SET is_active = 0 WHERE code = 'JAIPUR15'");

    const res = await request(app).post('/api/auth/coupons/validate').send({code: 'JAIPUR15', subtotal: 60000});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid or expired coupon code');

    db.run("UPDATE coupons SET is_active = 1 WHERE code = 'JAIPUR15'");
  });
});
