import request from 'supertest';
import {beforeAll, describe, expect, it} from 'vitest';
import {generateUserToken} from '../../../server/auth';
import {getDb} from '../../../server/db';
import ordersRouter from '../../../server/routes/orders';
import {createTestApp} from '../../helpers/app';

const app = createTestApp('/api/orders', ordersRouter);

const shippingAddress = {
  fullName: 'Princess Gayatri',
  phone: '8000461784',
  addressLine1: 'Suite 402, Royal Heritage Haveli',
  city: 'Jaipur',
  state: 'Rajasthan',
  pincode: '303901'
};

function orderPayload(overrides: Record<string, any> = {}) {
  return {
    customerName: 'Princess Gayatri',
    customerEmail: 'customer@royals.com',
    customerPhone: '8000461784',
    shippingAddress,
    items: [
      {
        productId: 'prod_raw_silk_kurta_set',
        title: 'The Maharaja Ivory Raw Silk Kurta Pajama Set',
        image: '/images/mens_raw_silk_kurta.jpg',
        size: '38 (M)',
        color: 'Warm Ivory Cream & Antique Gold',
        quantity: 1,
        price: 32500
      }
    ],
    paymentMethod: 'UPI (PhonePe)',
    ...overrides
  };
}

beforeAll(async () => {
  await getDb();
});

describe('POST /api/orders', () => {
  it('rejects a payload missing required customer details', async () => {
    const res = await request(app).post('/api/orders').send({customerName: 'Nobody'});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Missing required order details');
  });

  it('rejects an order with an empty item list', async () => {
    const res = await request(app).post('/api/orders').send(orderPayload({items: []}));
    expect(res.status).toBe(400);
  });

  it('totals the order with 12% GST and free insured delivery above ₹5,000', async () => {
    const res = await request(app).post('/api/orders').send(orderPayload());

    expect(res.status).toBe(201);
    const order = res.body.order;
    expect(order.subtotal).toBe(32500);
    expect(order.discount_amount).toBe(0);
    expect(order.gst_amount).toBe(3900);
    expect(order.delivery_fee).toBe(0);
    expect(order.grand_total).toBe(36400);
    expect(order.order_status).toBe('Preparing Order');
    expect(order.payment_status).toBe('PAID');
    expect(order.shipping_address).toEqual(shippingAddress);
    expect(res.body.invoiceNumber).toMatch(/^INV-2026-\d{5}$/);
    expect(res.body.paymentReceipt).toMatchObject({amount: 36400, paymentMethod: 'UPI (PhonePe)'});
  });

  it('charges a ₹250 delivery fee for small orders', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send(
        orderPayload({
          items: [{productId: 'prod_raw_silk_kurta_set', title: 'Pocket Square', image: '/images/x.jpg', quantity: 1, price: 1000}]
        })
      );

    const order = res.body.order;
    expect(order.subtotal).toBe(1000);
    expect(order.gst_amount).toBe(120);
    expect(order.delivery_fee).toBe(250);
    expect(order.grand_total).toBe(1370);
  });

  it('multiplies unit price by quantity across items', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send(
        orderPayload({
          items: [
            {productId: 'prod_raw_silk_kurta_set', title: 'Kurta', image: '/a.jpg', quantity: 2, price: 10000},
            {productId: 'prod_jaipur_angrakha_kurta', title: 'Angrakha', image: '/b.jpg', quantity: 3, price: 5000}
          ]
        })
      );

    expect(res.body.order.subtotal).toBe(35000);
    expect(res.body.order.items).toHaveLength(2);
    expect(res.body.order.items[0].total_price).toBe(20000);
    expect(res.body.order.items[1].total_price).toBe(15000);
  });

  it('defaults size and colour for items that omit them', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send(
        orderPayload({
          items: [{productId: 'prod_raw_silk_kurta_set', title: 'Kurta', image: '/a.jpg', quantity: 1, price: 9000}]
        })
      );

    expect(res.body.order.items[0]).toMatchObject({size: 'Standard', color: 'Royal Classic'});
  });

  it('applies a percentage coupon and taxes the discounted amount', async () => {
    const res = await request(app).post('/api/orders').send(orderPayload({couponCode: 'royal10'}));

    const order = res.body.order;
    expect(order.coupon_code).toBe('royal10');
    expect(order.discount_amount).toBe(3250);
    expect(order.gst_amount).toBe(Math.round((32500 - 3250) * 0.12));
    expect(order.grand_total).toBe(32500 - 3250 + order.gst_amount);
  });

  it('caps a percentage coupon at its max discount', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send(
        orderPayload({
          couponCode: 'HERITAGE20',
          items: [{productId: 'prod_raw_silk_kurta_set', title: 'Kurta', image: '/a.jpg', quantity: 1, price: 200000}]
        })
      );

    // 20% of 200000 is 40000, capped at the coupon's 30000 max_discount.
    expect(res.body.order.discount_amount).toBe(30000);
  });

  it('applies a flat coupon without exceeding the subtotal', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send(orderPayload({couponCode: 'FIRSTROYAL', items: [{productId: 'p', title: 'Kurta', image: '/a.jpg', quantity: 1, price: 31000}]}));

    expect(res.body.order.discount_amount).toBe(5000);
  });

  it('ignores a coupon whose minimum spend is not met', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send(orderPayload({couponCode: 'HERITAGE20', items: [{productId: 'p', title: 'Kurta', image: '/a.jpg', quantity: 1, price: 1000}]}));

    expect(res.body.order.discount_amount).toBe(0);
  });

  it('ignores an unknown coupon code', async () => {
    const res = await request(app).post('/api/orders').send(orderPayload({couponCode: 'NOT_A_COUPON'}));
    expect(res.body.order.discount_amount).toBe(0);
  });

  it('increments the coupon usage counter on a successful redemption', async () => {
    const db = await getDb();
    const usage = () => (db.exec("SELECT usage_count FROM coupons WHERE code = 'JAIPUR15'")[0].values[0][0] as number);
    const before = usage();

    await request(app)
      .post('/api/orders')
      .send(orderPayload({couponCode: 'JAIPUR15', items: [{productId: 'p', title: 'Kurta', image: '/a.jpg', quantity: 1, price: 60000}]}));

    expect(usage()).toBe(before + 1);
  });

  it('decrements product stock for each ordered item', async () => {
    const db = await getDb();
    const stock = () => (db.exec("SELECT stock FROM products WHERE id = 'prod_chanderi_sharara_kurta'")[0].values[0][0] as number);
    const before = stock();

    await request(app)
      .post('/api/orders')
      .send(
        orderPayload({
          items: [{productId: 'prod_chanderi_sharara_kurta', title: 'Sharara', image: '/a.jpg', quantity: 2, price: 39500}]
        })
      );

    expect(stock()).toBe(before - 2);
  });

  it('marks Cash on Delivery orders as pending payment', async () => {
    const res = await request(app).post('/api/orders').send(orderPayload({paymentMethod: 'Cash on Delivery'}));

    expect(res.body.order.payment_status).toBe('PENDING');
    expect(res.body.order.payment.status).toBe('PENDING');
    const codStage = res.body.order.status_history.find((h: any) => h.status === 'Payment Confirmed');
    expect(codStage.updated_by).toBe('Cash on Delivery Desk');
    expect(codStage.notes).toContain('Cash on Delivery verified with OTP');
  });

  it('records the initial three history stages and a customer notification', async () => {
    const res = await request(app).post('/api/orders').send(orderPayload());

    expect(res.body.order.status_history.map((h: any) => h.status)).toEqual([
      'Order Placed',
      'Payment Confirmed',
      'Preparing Order'
    ]);

    const db = await getDb();
    const notifications = db.exec('SELECT title FROM notifications WHERE order_id = ?', [res.body.order.id]);
    expect(notifications[0].values[0][0]).toBe('Order Confirmed & Placed');
  });

  it('attributes guest checkouts to a guest user', async () => {
    const res = await request(app).post('/api/orders').send(orderPayload());
    expect(res.body.order.user_id).toBe('guest_user');

    const withUser = await request(app).post('/api/orders').send(orderPayload({userId: 'usr_1'}));
    expect(withUser.body.order.user_id).toBe('usr_1');
  });
});

describe('GET /api/orders/:idOrNumber', () => {
  it('returns the seeded demo order by id and by order number', async () => {
    const byId = await request(app).get('/api/orders/ord_demo_89421');
    expect(byId.status).toBe(200);
    expect(byId.body.order_number).toBe('RYL-2026-89421');
    expect(byId.body.items.length).toBeGreaterThan(0);
    expect(byId.body.payment.status).toBe('SUCCESS');
    expect(byId.body.shipping_address.city).toBe('Jaipur');

    const byNumber = await request(app).get('/api/orders/RYL-2026-89421');
    expect(byNumber.body.id).toBe('ord_demo_89421');
  });

  it('returns 404 for an unknown order', async () => {
    const res = await request(app).get('/api/orders/ord_missing');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Order not found');
  });
});

describe('GET /api/orders/track/:query', () => {
  it('builds a seven-stage timeline marking reached stages complete', async () => {
    const res = await request(app).get('/api/orders/track/TRK-RYL-77492');

    expect(res.status).toBe(200);
    expect(res.body.timeline).toHaveLength(7);
    expect(res.body.currentStatus).toBe('Preparing');
    expect(res.body.courierName).toBe('Blue Dart Apex Luxury');
    expect(res.body.supportWhatsAppUrl).toContain('RYL-2026-89421');

    const completed = res.body.timeline.filter((s: any) => s.isCompleted).map((s: any) => s.status);
    expect(completed).toEqual(['Order Placed', 'Payment Confirmed', 'Preparing Order']);

    // 'Preparing' in history is an alias of the canonical 'Preparing Order' stage.
    const current = res.body.timeline.find((s: any) => s.isCurrent);
    expect(current.status).toBe('Preparing Order');

    const pending = res.body.timeline.filter((s: any) => !s.isCompleted);
    expect(pending.every((s: any) => s.date === null && s.state === 'Pending')).toBe(true);
  });

  it('accepts an order number and trims whitespace from the query', async () => {
    const res = await request(app).get('/api/orders/track/%20RYL-2026-89421%20');
    expect(res.status).toBe(200);
    expect(res.body.orderId).toBe('ord_demo_89421');
  });

  it('appends a cancellation stage for cancelled orders', async () => {
    const db = await getDb();
    db.run("UPDATE orders SET order_status = 'Cancelled' WHERE id = 'ord_demo_89421'");
    db.run(
      `INSERT INTO order_status_history (id, order_id, status, notes, updated_by, date_str, time_str, created_at)
       VALUES ('hist_cancel', 'ord_demo_89421', 'Cancelled', 'Cancelled on patron request', 'Atelier Director', '05 Aug 2026', '09:00 AM', '2026-08-05T09:00:00.000Z');`
    );

    const res = await request(app).get('/api/orders/track/ord_demo_89421');
    const last = res.body.timeline.at(-1);
    expect(last).toMatchObject({
      status: 'Cancelled',
      label: 'Order Cancelled',
      description: 'Cancelled on patron request',
      isCompleted: true,
      isCurrent: true
    });

    db.run("UPDATE orders SET order_status = 'Preparing' WHERE id = 'ord_demo_89421'");
    db.run("DELETE FROM order_status_history WHERE id = 'hist_cancel'");
  });

  it('returns 404 for an unknown tracking reference', async () => {
    const res = await request(app).get('/api/orders/track/TRK-NOPE');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('No order found matching tracking reference or order number.');
  });
});

describe('GET /api/orders/user/my-orders', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/orders/user/my-orders');
    expect(res.status).toBe(401);
  });

  it('returns orders matching the authenticated user id or email', async () => {
    const token = generateUserToken({
      id: 'usr_1',
      email: 'customer@royals.com',
      name: 'Princess Gayatri',
      role: 'customer'
    });

    const res = await request(app).get('/api/orders/user/my-orders').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.some((o: any) => o.id === 'ord_demo_89421')).toBe(true);
    expect(res.body.every((o: any) => o.shipping_address && Array.isArray(o.items))).toBe(true);
    const timestamps = res.body.map((o: any) => o.created_at);
    expect(timestamps).toEqual([...timestamps].sort().reverse());
  });

  it('returns an empty list for a user with no orders', async () => {
    const token = generateUserToken({
      id: 'usr_none',
      email: 'nobody@royals.com',
      name: 'Nobody',
      role: 'customer'
    });

    const res = await request(app).get('/api/orders/user/my-orders').set('Authorization', `Bearer ${token}`);
    expect(res.body).toEqual([]);
  });
});
