import jwt from 'jsonwebtoken';
import request from 'supertest';
import {beforeAll, describe, expect, it} from 'vitest';
import {generateAdminToken} from '../../../server/auth';
import {getDb} from '../../../server/db';
import adminRouter from '../../../server/routes/admin';
import {createTestApp} from '../../helpers/app';

const app = createTestApp('/api/admin', adminRouter);

const adminToken = generateAdminToken({
  id: 'adm_1',
  username: 'admin',
  email: 'admin@royals.com',
  name: 'Atelier Director',
  role: 'super_admin'
});

const auth = (req: request.Test) => req.set('Authorization', `Bearer ${adminToken}`);

beforeAll(async () => {
  await getDb();
});

describe('POST /api/admin/login', () => {
  it('requires both username and password', async () => {
    const res = await request(app).post('/api/admin/login').send({username: 'admin'});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Username and Password are required');
  });

  it('logs in the seeded admin, records last_login and issues an admin token', async () => {
    const res = await request(app).post('/api/admin/login').send({username: 'admin', password: 'Royals@2026'});

    expect(res.status).toBe(200);
    expect(res.body.admin).toMatchObject({id: 'adm_1', username: 'admin', role: 'super_admin'});
    expect(res.body.admin.last_login).toBeTruthy();

    const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET as string) as any;
    expect(decoded).toMatchObject({username: 'admin', role: 'super_admin'});

    const db = await getDb();
    const lastLogin = db.exec("SELECT last_login FROM admin_users WHERE id = 'adm_1'")[0].values[0][0];
    expect(lastLogin).toBe(res.body.admin.last_login);
  });

  it('accepts the admin email as the username', async () => {
    const res = await request(app).post('/api/admin/login').send({username: 'admin@royals.com', password: 'Royals@2026'});
    expect(res.status).toBe(200);
  });

  it('rejects an unknown administrator', async () => {
    const res = await request(app).post('/api/admin/login').send({username: 'intruder', password: 'Royals@2026'});
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid admin credentials');
  });

  it('rejects a wrong password', async () => {
    const res = await request(app).post('/api/admin/login').send({username: 'admin', password: 'wrong'});
    expect(res.status).toBe(401);
    expect(res.body.error).toContain('Check username and password');
  });
});

describe('admin authorisation', () => {
  it.each([
    ['get', '/api/admin/stats'],
    ['get', '/api/admin/orders'],
    ['get', '/api/admin/analytics'],
    ['get', '/api/admin/customers'],
    ['get', '/api/admin/coupons'],
    ['get', '/api/admin/inventory']
  ])('rejects unauthenticated %s %s', async (method, path) => {
    const res = await (request(app) as any)[method](path);
    expect(res.status).toBe(401);
  });
});

describe('GET /api/admin/stats', () => {
  it('aggregates revenue, counts and the canonical status distribution', async () => {
    const res = await auth(request(app).get('/api/admin/stats'));

    expect(res.status).toBe(200);
    expect(res.body.totalOrders).toBeGreaterThan(0);
    expect(res.body.totalRevenue).toBeGreaterThan(0);
    expect(res.body.avgOrderValue).toBe(Math.round(res.body.totalRevenue / res.body.totalOrders));
    expect(res.body.customersCount).toBe(res.body.totalCustomers);
    expect(res.body.productsCount).toBe(res.body.totalProducts);
    expect(Object.keys(res.body.statusCounts)).toEqual([
      'Order Placed',
      'Payment Confirmed',
      'Preparing Order',
      'Packed',
      'Shipped',
      'Out For Delivery',
      'Delivered',
      'Cancelled'
    ]);
    // The seeded order stores the legacy 'Preparing' alias.
    expect(res.body.statusCounts['Preparing Order']).toBeGreaterThan(0);
    expect(res.body.recentOrders.length).toBeLessThanOrEqual(10);
    expect(res.body.recentOrders[0].shipping_address.city).toBe('Jaipur');
  });

  it('counts only paid orders towards revenue', async () => {
    const db = await getDb();
    const before = await auth(request(app).get('/api/admin/stats'));

    db.run(
      `INSERT INTO orders (id, order_number, tracking_id, user_id, customer_name, customer_email, customer_phone,
        shipping_address_json, subtotal, gst_amount, discount_amount, delivery_fee, grand_total, coupon_code,
        payment_method, payment_status, order_status, courier_name, estimated_delivery_date, created_at, updated_at)
       VALUES ('ord_unpaid', 'RYL-2026-00001', 'TRK-RYL-00001', 'usr_1', 'Patron', 'patron@royals.com', '9000000002',
        '{"city":"Jaipur"}', 10000, 1200, 0, 0, 11200, NULL, 'Cash on Delivery', 'PENDING', 'Order Placed',
        'Blue Dart Apex Luxury', '20 Aug 2026', '2026-08-05T00:00:00.000Z', '2026-08-05T00:00:00.000Z');`
    );

    const after = await auth(request(app).get('/api/admin/stats'));
    expect(after.body.totalOrders).toBe(before.body.totalOrders + 1);
    expect(after.body.totalRevenue).toBe(before.body.totalRevenue);
    expect(after.body.statusCounts['Order Placed']).toBe(before.body.statusCounts['Order Placed'] + 1);
  });
});

describe('GET /api/admin/orders', () => {
  it('returns orders enriched with items, payment and history', async () => {
    const res = await auth(request(app).get('/api/admin/orders'));

    expect(res.status).toBe(200);
    const demo = res.body.find((o: any) => o.id === 'ord_demo_89421');
    expect(demo.items.length).toBeGreaterThan(0);
    expect(demo.payment.transaction_id).toBe('TXN-RYL-9832104');
    expect(demo.status_history.length).toBeGreaterThan(0);
  });

  it('treats the legacy "Preparing" status as "Preparing Order" when filtering', async () => {
    const res = await auth(request(app).get('/api/admin/orders?status=Preparing Order'));
    expect(res.body.some((o: any) => o.id === 'ord_demo_89421')).toBe(true);
  });

  it('ignores the "all" status filter', async () => {
    const all = await auth(request(app).get('/api/admin/orders?status=all'));
    const unfiltered = await auth(request(app).get('/api/admin/orders'));
    expect(all.body).toHaveLength(unfiltered.body.length);
  });

  it('filters by an exact status', async () => {
    const res = await auth(request(app).get('/api/admin/orders?status=Order Placed'));
    expect(res.body.every((o: any) => o.order_status === 'Order Placed')).toBe(true);
  });

  it('searches across order number, tracking id and customer fields', async () => {
    const byNumber = await auth(request(app).get('/api/admin/orders?search=89421'));
    expect(byNumber.body.some((o: any) => o.id === 'ord_demo_89421')).toBe(true);

    const byCustomer = await auth(request(app).get('/api/admin/orders?search=Gayatri'));
    expect(byCustomer.body.length).toBeGreaterThan(0);

    const noMatch = await auth(request(app).get('/api/admin/orders?search=zzzz-nothing'));
    expect(noMatch.body).toEqual([]);
  });
});

describe('PATCH /api/admin/orders/:id/status', () => {
  it('rejects an invalid status', async () => {
    const res = await auth(request(app).patch('/api/admin/orders/ord_demo_89421/status')).send({status: 'Teleported'});
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid status');
  });

  it('returns 404 for an unknown order', async () => {
    const res = await auth(request(app).patch('/api/admin/orders/ord_nope/status')).send({status: 'Packed'});
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Order not found');
  });

  it('appends history without overwriting, stamps the server time and notifies the customer', async () => {
    const before = await auth(request(app).get('/api/admin/orders?search=89421'));
    const historyBefore = before.body[0].status_history.length;

    const res = await auth(request(app).patch('/api/admin/orders/ord_demo_89421/status')).send({status: 'Packed'});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.order.order_status).toBe('Packed');
    expect(res.body.order.status_history).toHaveLength(historyBefore + 1);
    expect(res.body.serverTimestamp.date).toMatch(/^\d{2} [A-Z][a-z]{2} \d{4}$/);
    expect(res.body.serverTimestamp.time).toMatch(/^\d{2}:\d{2} (AM|PM)$/);

    const packed = res.body.order.status_history.at(-1);
    expect(packed).toMatchObject({status: 'Packed', updated_by: 'Atelier Director'});
    expect(packed.notes).toContain('sealed in tamper-proof royal packaging');

    const db = await getDb();
    const notification = db.exec(
      "SELECT title, message, type FROM notifications WHERE order_id = 'ord_demo_89421' ORDER BY created_at DESC LIMIT 1"
    )[0].values[0];
    expect(notification[0]).toBe('Order Packed & Inspected');
    expect(notification[1]).toContain('RYL-2026-89421');
    expect(notification[2]).toBe('order_update');
  });

  it('normalises legacy status aliases', async () => {
    const res = await auth(request(app).patch('/api/admin/orders/ord_demo_89421/status')).send({status: 'Out for Delivery'});
    expect(res.body.order.order_status).toBe('Out For Delivery');
  });

  it('updates courier and tracking details and uses custom notes', async () => {
    const res = await auth(request(app).patch('/api/admin/orders/RYL-2026-89421/status')).send({
      status: 'Shipped',
      notes: 'Handed to courier at Jaipur hub',
      courierName: 'DHL Luxury Express',
      trackingId: 'TRK-RYL-55555',
      estimatedDeliveryDate: '15 Aug 2026'
    });

    expect(res.body.order).toMatchObject({
      courier_name: 'DHL Luxury Express',
      tracking_id: 'TRK-RYL-55555',
      estimated_delivery_date: '15 Aug 2026'
    });
    expect(res.body.order.status_history.at(-1).notes).toBe('Handed to courier at Jaipur hub');
  });

  it('flags delivery notifications with a dedicated type', async () => {
    await auth(request(app).patch('/api/admin/orders/ord_demo_89421/status')).send({status: 'Delivered'});

    const db = await getDb();
    const type = db.exec(
      "SELECT type FROM notifications WHERE order_id = 'ord_demo_89421' ORDER BY created_at DESC LIMIT 1"
    )[0].values[0][0];
    expect(type).toBe('delivery_success');
  });
});

describe('PATCH /api/admin/orders/:id/delivery-date', () => {
  it('requires a date', async () => {
    const res = await auth(request(app).patch('/api/admin/orders/ord_demo_89421/delivery-date')).send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Estimated delivery date is required');
  });

  it('returns 404 for an unknown order', async () => {
    const res = await auth(request(app).patch('/api/admin/orders/ord_nope/delivery-date')).send({
      estimatedDeliveryDate: '20 Aug 2026'
    });
    expect(res.status).toBe(404);
  });

  it('updates the date, logs it against the current status and notifies the customer', async () => {
    const res = await auth(request(app).patch('/api/admin/orders/ord_demo_89421/delivery-date')).send({
      estimatedDeliveryDate: '22 Aug 2026'
    });

    expect(res.status).toBe(200);
    expect(res.body.order.estimated_delivery_date).toBe('22 Aug 2026');
    const entry = res.body.order.status_history.at(-1);
    expect(entry.status).toBe(res.body.order.order_status);
    expect(entry.notes).toBe('Estimated delivery date updated to 22 Aug 2026');

    const db = await getDb();
    const notification = db.exec(
      "SELECT title, type FROM notifications WHERE order_id = 'ord_demo_89421' ORDER BY created_at DESC LIMIT 1"
    )[0].values[0];
    expect(notification[0]).toBe('Estimated Delivery Date Updated');
    expect(notification[1]).toBe('delivery_date_updated');
  });
});

describe('GET /api/admin/analytics', () => {
  it('breaks revenue down by payment method and top products', async () => {
    const res = await auth(request(app).get('/api/admin/analytics'));

    expect(res.status).toBe(200);
    expect(res.body.totalCatalogProducts).toBeGreaterThan(0);
    expect(res.body.avgOrderValue).toBe(Math.round(res.body.totalRevenue / res.body.totalOrders));
    expect(res.body.paymentMethods['UPI (PhonePe)'].count).toBeGreaterThan(0);
    expect(res.body.topProducts.length).toBeGreaterThan(0);
    expect(res.body.topProducts.length).toBeLessThanOrEqual(5);
    const revenues = res.body.topProducts.map((p: any) => p.revenue);
    expect(revenues).toEqual([...revenues].sort((a: number, b: number) => b - a));
  });
});

describe('product management', () => {
  it('requires title, category and price', async () => {
    const res = await auth(request(app).post('/api/admin/products')).send({title: 'Nameless'});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Title, category, and price are required');
  });

  it('creates a product with a slug, defaults and per-size inventory', async () => {
    const res = await auth(request(app).post('/api/admin/products')).send({
      title: 'The Udaipur Ivory Silk Kurta!',
      category_id: 'cat_mens_kurtas',
      price: 21000,
      sizes: ['S', 'M']
    });

    expect(res.status).toBe(201);
    expect(res.body.slug).toMatch(/^the-udaipur-ivory-silk-kurta-\d{4}$/);

    const db = await getDb();
    const product = db.exec(
      'SELECT category_name, fabric, rating, review_count, is_featured, stock FROM products WHERE id = ?',
      [res.body.id]
    )[0].values[0];
    expect(product).toEqual(['Haute Couture', 'Pure Handloom Silk', 5, 0, 0, 10]);

    const inventory = db.exec('SELECT size FROM inventory WHERE product_id = ?', [res.body.id])[0].values.flat();
    expect(inventory).toEqual(['S', 'M']);
  });

  it('updates only the supplied fields', async () => {
    const created = await auth(request(app).post('/api/admin/products')).send({
      title: 'Editable Kurta',
      category_id: 'cat_mens_kurtas',
      price: 15000,
      discount_price: 12000
    });

    const res = await auth(request(app).put(`/api/admin/products/${created.body.id}`)).send({
      title: 'Renamed Kurta',
      is_featured: true
    });

    expect(res.status).toBe(200);
    const db = await getDb();
    const row = db.exec('SELECT title, price, is_featured FROM products WHERE id = ?', [created.body.id])[0].values[0];
    expect(row).toEqual(['Renamed Kurta', 15000, 1]);
  });

  it('clears the discount price when it is not part of the update', async () => {
    const created = await auth(request(app).post('/api/admin/products')).send({
      title: 'Discounted Kurta',
      category_id: 'cat_mens_kurtas',
      price: 15000,
      discount_price: 12000
    });

    await auth(request(app).put(`/api/admin/products/${created.body.id}`)).send({title: 'Discounted Kurta II'});

    const db = await getDb();
    const discount = db.exec('SELECT discount_price FROM products WHERE id = ?', [created.body.id])[0].values[0][0];
    expect(discount).toBeNull();
  });

  it('deletes the product together with its inventory', async () => {
    const created = await auth(request(app).post('/api/admin/products')).send({
      title: 'Doomed Kurta',
      category_id: 'cat_mens_kurtas',
      price: 9000
    });

    const res = await auth(request(app).delete(`/api/admin/products/${created.body.id}`));
    expect(res.status).toBe(200);

    const db = await getDb();
    expect(db.exec('SELECT id FROM products WHERE id = ?', [created.body.id])).toEqual([]);
    expect(db.exec('SELECT id FROM inventory WHERE product_id = ?', [created.body.id])).toEqual([]);
  });
});

describe('GET /api/admin/customers', () => {
  it('enriches customers with order totals and hides password hashes', async () => {
    const res = await auth(request(app).get('/api/admin/customers'));

    expect(res.status).toBe(200);
    const demo = res.body.find((c: any) => c.id === 'usr_1');
    expect(demo.password_hash).toBeUndefined();
    expect(demo.totalOrders).toBeGreaterThan(0);
    expect(demo.totalSpent).toBeGreaterThan(0);
  });
});

describe('coupons', () => {
  it('requires code, type and value', async () => {
    const res = await auth(request(app).post('/api/admin/coupons')).send({code: 'HALFOFF'});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Code, discount type, and discount value are required');
  });

  it('creates an active coupon with an upper-cased code and defaults', async () => {
    const res = await auth(request(app).post('/api/admin/coupons')).send({
      code: 'monsoon25',
      discount_type: 'percentage',
      discount_value: 25
    });

    expect(res.status).toBe(201);
    const list = await auth(request(app).get('/api/admin/coupons'));
    const created = list.body.find((c: any) => c.id === res.body.id);
    expect(created).toMatchObject({
      code: 'MONSOON25',
      min_spend: 0,
      max_discount: null,
      is_active: 1,
      usage_count: 0,
      expiry_date: '2026-12-31'
    });
  });

  it('toggles a coupon between active and inactive', async () => {
    const created = await auth(request(app).post('/api/admin/coupons')).send({
      code: 'toggleme',
      discount_type: 'flat',
      discount_value: 1000
    });

    const activeState = async () => {
      const list = await auth(request(app).get('/api/admin/coupons'));
      return list.body.find((c: any) => c.id === created.body.id).is_active;
    };

    expect(await activeState()).toBe(1);
    await auth(request(app).patch(`/api/admin/coupons/${created.body.id}/toggle`));
    expect(await activeState()).toBe(0);
    await auth(request(app).patch(`/api/admin/coupons/${created.body.id}/toggle`));
    expect(await activeState()).toBe(1);
  });

  it('orders coupons by usage', async () => {
    const res = await auth(request(app).get('/api/admin/coupons'));
    const usage = res.body.map((c: any) => c.usage_count);
    expect(usage).toEqual([...usage].sort((a: number, b: number) => b - a));
  });
});

describe('inventory', () => {
  it('joins inventory with product data and surfaces the scarcest stock first', async () => {
    const res = await auth(request(app).get('/api/admin/inventory'));

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].product_title).toBeTruthy();
    expect(Array.isArray(res.body[0].images)).toBe(true);
    const quantities = res.body.map((i: any) => i.stock_quantity);
    expect(quantities).toEqual([...quantities].sort((a: number, b: number) => a - b));
  });

  it('restocks the inventory row and the parent product', async () => {
    const db = await getDb();
    const invId = 'inv_prod_raw_silk_kurta_set_0';
    const productStock = () =>
      db.exec("SELECT stock FROM products WHERE id = 'prod_raw_silk_kurta_set'")[0].values[0][0] as number;
    const invStock = () => db.exec('SELECT stock_quantity FROM inventory WHERE id = ?', [invId])[0].values[0][0] as number;

    const productBefore = productStock();
    const invBefore = invStock();

    const res = await auth(request(app).patch(`/api/admin/inventory/${invId}/restock`)).send({quantity: 7});

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Restocked by +7 units successfully');
    expect(invStock()).toBe(invBefore + 7);
    expect(productStock()).toBe(productBefore + 7);
  });

  it('defaults the restock quantity to 10', async () => {
    const db = await getDb();
    const invId = 'inv_prod_raw_silk_kurta_set_1';
    const invStock = () => db.exec('SELECT stock_quantity FROM inventory WHERE id = ?', [invId])[0].values[0][0] as number;
    const before = invStock();

    const res = await auth(request(app).patch(`/api/admin/inventory/${invId}/restock`)).send({});

    expect(res.body.message).toBe('Restocked by +10 units successfully');
    expect(invStock()).toBe(before + 10);
  });
});
