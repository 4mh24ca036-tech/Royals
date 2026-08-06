import { Router, Request } from 'express';
import { getDb, persistDb } from '../db.js';
import { authenticateUser, UserJwtPayload } from '../auth.js';

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

function formatDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

function formatTime(date: Date): string {
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
}

// CREATE NEW ORDER (Checkout)
router.post('/', async (req, res) => {
  try {
    const db = await getDb();
    const {
      customerName,
      customerEmail,
      customerPhone,
      shippingAddress,
      items,
      paymentMethod,
      couponCode,
      userId
    } = req.body;

    if (!customerName || !customerEmail || !customerPhone || !shippingAddress || !items || items.length === 0) {
      return res.status(400).json({ error: 'Missing required order details' });
    }

    // Calculate subtotal
    let subtotal = 0;
    for (const it of items) {
      subtotal += Number(it.price) * Number(it.quantity);
    }

    // Coupon calculation
    let discountAmount = 0;
    let validCoupon: any = null;
    if (couponCode) {
      const coupRows = queryAll(db, 'SELECT * FROM coupons WHERE code = ? AND is_active = 1 LIMIT 1', [couponCode.toUpperCase()]);
      if (coupRows.length > 0) {
        validCoupon = coupRows[0];
        if (subtotal >= validCoupon.min_spend) {
          if (validCoupon.discount_type === 'percentage') {
            discountAmount = (subtotal * validCoupon.discount_value) / 100;
            if (validCoupon.max_discount && discountAmount > validCoupon.max_discount) {
              discountAmount = validCoupon.max_discount;
            }
          } else {
            discountAmount = Math.min(subtotal, validCoupon.discount_value);
          }
          // Increment coupon usage
          db.run('UPDATE coupons SET usage_count = usage_count + 1 WHERE id = ?', [validCoupon.id]);
        }
      }
    }

    // GST (12% luxury ethnic apparel)
    const taxableAmount = Math.max(0, subtotal - discountAmount);
    const gstAmount = Math.round(taxableAmount * 0.12);

    // Free luxury insured delivery above 5000, else 250
    const deliveryFee = taxableAmount >= 5000 ? 0 : 250;
    const grandTotal = taxableAmount + gstAmount + deliveryFee;

    const now = new Date();
    const estDeliveryDate = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000);
    const estDeliveryStr = formatDate(estDeliveryDate);

    const randomSuffix = Math.floor(10000 + Math.random() * 90000);
    const orderId = `ord_${Date.now()}_${randomSuffix}`;
    const orderNumber = `RYL-2026-${randomSuffix}`;
    const trackingId = `TRK-RYL-${Math.floor(10000 + Math.random() * 90000)}`;

    const dateStr = formatDate(now);
    const timeStr = formatTime(now);

    // Insert Order
    db.run(
      `INSERT INTO orders (
        id, order_number, tracking_id, user_id, customer_name, customer_email, customer_phone,
        shipping_address_json, subtotal, gst_amount, discount_amount, delivery_fee, grand_total,
        coupon_code, payment_method, payment_status, order_status, courier_name, estimated_delivery_date,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        orderId,
        orderNumber,
        trackingId,
        userId || 'guest_user',
        customerName,
        customerEmail,
        customerPhone,
        JSON.stringify(shippingAddress),
        subtotal,
        gstAmount,
        discountAmount,
        deliveryFee,
        grandTotal,
        couponCode || null,
        paymentMethod || 'Manual Verification',
        'PENDING',
        'Awaiting Payment Verification',
        'Blue Dart Apex Luxury',
        estDeliveryStr,
        now.toISOString(),
        now.toISOString()
      ]
    );

    // Insert Order Items and decrement inventory
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const itemId = `item_${orderId}_${i + 1}`;
      const itemTotal = Number(item.price) * Number(item.quantity);

      db.run(
        `INSERT INTO order_items (id, order_id, product_id, product_title, product_image, size, color, quantity, unit_price, total_price)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          itemId,
          orderId,
          item.productId,
          item.title,
          item.image,
          item.size || 'Standard',
          item.color || 'Royal Classic',
          Number(item.quantity),
          Number(item.price),
          itemTotal
        ]
      );

      // Decrement stock
      db.run('UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?', [Number(item.quantity), item.productId]);
    }

    // Insert Payment Record
    const paymentId = `pay_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const txnId = `TXN-RYL-${Date.now().toString().slice(-7)}`;
    const gatewayRef = `GW-REF-${Math.floor(100000 + Math.random() * 900000)}`;

    db.run(
      `INSERT INTO payments (id, order_id, payment_method, transaction_id, gateway_ref, amount, status, paid_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        paymentId,
        orderId,
        paymentMethod || 'Manual Verification',
        txnId,
        gatewayRef,
        grandTotal,
        'PENDING',
        now.toISOString()
      ]
    );

    // Insert Order Status History: Stage 1 - Awaiting Payment Verification
    db.run(
      `INSERT INTO order_status_history (id, order_id, status, notes, updated_by, date_str, time_str, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        `hist_${orderId}_1`,
        orderId,
        'Awaiting Payment Verification',
        `Order ${orderNumber} registered. Awaiting receipt and payment verification via WhatsApp.`,
        'Customer',
        dateStr,
        timeStr,
        now.toISOString()
      ]
    );

    // Create Customer Notification
    db.run(
      `INSERT INTO notifications (id, user_id, order_id, title, message, type, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        `notif_${orderId}_created`,
        userId || 'guest_user',
        orderId,
        'Order Awaiting Verification',
        `📦 Order #${orderNumber} registered. Awaiting receipt & payment verification. Expected delivery by ${estDeliveryStr} post verification.`,
        'order_placed',
        0,
        now.toISOString()
      ]
    );

    persistDb();

    // Fetch full created order with related tables
    const createdOrder = queryAll(db, 'SELECT * FROM orders WHERE id = ?', [orderId])[0];
    const orderItems = queryAll(db, 'SELECT * FROM order_items WHERE order_id = ?', [orderId]);
    const payment = queryAll(db, 'SELECT * FROM payments WHERE order_id = ?', [orderId])[0];
    const statusHistory = queryAll(db, 'SELECT * FROM order_status_history WHERE order_id = ? ORDER BY created_at ASC', [orderId]);

    res.status(201).json({
      order: {
        ...createdOrder,
        shipping_address: JSON.parse(createdOrder.shipping_address_json),
        items: orderItems,
        payment,
        status_history: statusHistory
      },
      invoiceNumber: `INV-2026-${randomSuffix}`,
      paymentReceipt: {
        transactionId: txnId,
        gatewayRef,
        amount: grandTotal,
        paidAt: now.toISOString(),
        paymentMethod
      }
    });
  } catch (err: any) {
    console.error('Error creating order:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET order details by Order ID or Order Number
router.get('/:idOrNumber', async (req, res) => {
  try {
    const db = await getDb();
    const { idOrNumber } = req.params;

    const orders = queryAll(db, 'SELECT * FROM orders WHERE id = ? OR order_number = ? LIMIT 1', [idOrNumber, idOrNumber]);
    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orders[0];
    const items = queryAll(db, 'SELECT * FROM order_items WHERE order_id = ?', [order.id]);
    const payments = queryAll(db, 'SELECT * FROM payments WHERE order_id = ?', [order.id]);
    const history = queryAll(db, 'SELECT * FROM order_status_history WHERE order_id = ? ORDER BY created_at ASC', [order.id]);

    res.json({
      ...order,
      shipping_address: JSON.parse(order.shipping_address_json),
      items,
      payment: payments[0] || null,
      status_history: history
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET tracking information with complete 8-stage timeline directly from database
router.get('/track/:query', async (req, res) => {
  try {
    const db = await getDb();
    const { query } = req.params;

    const cleanQuery = query.trim();
    const orders = queryAll(
      db,
      'SELECT * FROM orders WHERE tracking_id = ? OR order_number = ? OR id = ? LIMIT 1',
      [cleanQuery, cleanQuery, cleanQuery]
    );

    if (orders.length === 0) {
      return res.status(404).json({ error: 'No order found matching tracking reference or order number.' });
    }

    const order = orders[0];
    const items = queryAll(db, 'SELECT * FROM order_items WHERE order_id = ?', [order.id]);
    const history = queryAll(db, 'SELECT * FROM order_status_history WHERE order_id = ? ORDER BY created_at ASC', [order.id]);

    // Define standard 6 sequential non-cancelled stages
    const standardStages = [
      { key: 'Awaiting Payment Verification', aliases: ['Awaiting Payment Verification'], label: 'Awaiting Payment Verification', desc: 'Order registered. Awaiting receipt & payment verification.' },
      { key: 'Preparing Order', aliases: ['Preparing Order', 'Preparing'], label: 'Preparing Order', desc: 'Artisan hand-finishing, custom sizing & embroidery check' },
      { key: 'Packed', aliases: ['Packed'], label: 'Packed', desc: 'Inspected and securely sealed in heirloom velvet packaging' },
      { key: 'Shipped', aliases: ['Shipped'], label: 'Shipped', desc: 'Dispatched via premium insured courier' },
      { key: 'Out For Delivery', aliases: ['Out For Delivery', 'Out for Delivery'], label: 'Out For Delivery', desc: 'Out for verified doorstep delivery with courier' },
      { key: 'Delivered', aliases: ['Delivered'], label: 'Delivered', desc: 'Delivered to recipient with signature confirmation' }
    ];

    // Build timeline stages
    const isCancelled = order.order_status === 'Cancelled';
    const historyMap = new Map<string, any>();
    history.forEach((h: any) => {
      historyMap.set(h.status, h);
    });

    const timeline = standardStages.map((stage) => {
      // Find matching history entry
      let hist = null;
      for (const alias of stage.aliases) {
        if (historyMap.has(alias)) {
          hist = historyMap.get(alias);
          break;
        }
      }

      const isCurrentStatus = stage.aliases.includes(order.order_status);

      if (hist) {
        return {
          status: stage.key,
          label: stage.label,
          description: hist.notes || stage.desc,
          date: hist.date_str,
          time: hist.time_str,
          isCompleted: true,
          isCurrent: isCurrentStatus,
          updatedBy: hist.updated_by
        };
      } else {
        return {
          status: stage.key,
          label: stage.label,
          description: stage.desc,
          date: null,
          time: null,
          isCompleted: false,
          isCurrent: false,
          state: 'Pending'
        };
      }
    });

    if (isCancelled) {
      const cancelHist = historyMap.get('Cancelled');
      timeline.push({
        status: 'Cancelled',
        label: 'Order Cancelled',
        description: cancelHist?.notes || 'Order has been cancelled.',
        date: cancelHist?.date_str || formatDate(new Date()),
        time: cancelHist?.time_str || formatTime(new Date()),
        isCompleted: true,
        isCurrent: true,
        updatedBy: cancelHist?.updated_by || 'Admin'
      });
    }

    res.json({
      orderId: order.id,
      orderNumber: order.order_number,
      trackingId: order.tracking_id,
      currentStatus: order.order_status,
      courierName: order.courier_name || 'Blue Dart Apex Luxury',
      estimatedDelivery: order.estimated_delivery_date,
      orderDate: formatDate(new Date(order.created_at)),
      customerName: order.customer_name,
      shippingAddress: JSON.parse(order.shipping_address_json),
      items,
      grandTotal: order.grand_total,
      timeline,
      rawHistory: history,
      supportWhatsAppUrl: `https://wa.me/918000461784?text=${encodeURIComponent(`Hello ROYALS, I have a question regarding Order #${order.order_number}.`)}`
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET User Orders
router.get('/user/my-orders', authenticateUser, async (req: any, res) => {
  try {
    const db = await getDb();
    const userId = req.user.id;

    const orders = queryAll(db, 'SELECT * FROM orders WHERE user_id = ? OR customer_email = ? ORDER BY created_at DESC', [userId, req.user.email]);

    const enriched = orders.map((ord: any) => {
      const items = queryAll(db, 'SELECT * FROM order_items WHERE order_id = ?', [ord.id]);
      const history = queryAll(db, 'SELECT * FROM order_status_history WHERE order_id = ? ORDER BY created_at ASC', [ord.id]);
      return {
        ...ord,
        shipping_address: JSON.parse(ord.shipping_address_json),
        items,
        status_history: history
      };
    });

    res.json(enriched);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
