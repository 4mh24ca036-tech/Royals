import { Router, Request } from 'express';
import { getDb, persistDb } from '../db.js';
import { authenticateUser, UserJwtPayload } from '../auth.js';
import { queryAll, generateId } from '../utils/db.js';
import { formatDate, formatTime } from '../utils/datetime.js';
import { calculateCouponDiscount, calculateOrderTotals, sumLineItems } from '../../shared/pricing.js';
import { formatINR } from '../../shared/format.js';

const router = Router();

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

    const subtotal = sumLineItems(items);

    // Coupon calculation
    let discountAmount = 0;
    if (couponCode) {
      const coupRows = queryAll(db, 'SELECT * FROM coupons WHERE code = ? AND is_active = 1 LIMIT 1', [couponCode.toUpperCase()]);
      if (coupRows.length > 0) {
        const validCoupon = coupRows[0];
        if (subtotal >= validCoupon.min_spend) {
          discountAmount = calculateCouponDiscount(validCoupon, subtotal);
          db.run('UPDATE coupons SET usage_count = usage_count + 1 WHERE id = ?', [validCoupon.id]);
        }
      }
    }

    const { gstAmount, deliveryFee, grandTotal } = calculateOrderTotals(subtotal, discountAmount);

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
        paymentMethod || 'UPI',
        paymentMethod === 'Cash on Delivery' ? 'PENDING' : 'PAID',
        'Preparing Order', // Initial state upon successful payment confirmation
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
    const paymentId = generateId('pay');
    const txnId = `TXN-RYL-${Date.now().toString().slice(-7)}`;
    const gatewayRef = `PG-${paymentMethod.toUpperCase().slice(0, 3)}-${Math.floor(10000000 + Math.random() * 90000000)}`;

    db.run(
      `INSERT INTO payments (id, order_id, payment_method, transaction_id, gateway_ref, amount, status, paid_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        paymentId,
        orderId,
        paymentMethod,
        txnId,
        gatewayRef,
        grandTotal,
        paymentMethod === 'Cash on Delivery' ? 'PENDING' : 'SUCCESS',
        now.toISOString()
      ]
    );

    // Insert Order Status History: Stage 1 - Order Placed
    db.run(
      `INSERT INTO order_status_history (id, order_id, status, notes, updated_by, date_str, time_str, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        `hist_${orderId}_1`,
        orderId,
        'Order Placed',
        `Order ${orderNumber} placed by ${customerName}`,
        'Customer',
        dateStr,
        timeStr,
        now.toISOString()
      ]
    );

    // Stage 2 - Payment Confirmed (or COD Registered)
    if (paymentMethod !== 'Cash on Delivery') {
      db.run(
        `INSERT INTO order_status_history (id, order_id, status, notes, updated_by, date_str, time_str, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          `hist_${orderId}_2`,
          orderId,
          'Payment Confirmed',
          `Payment of ${formatINR(grandTotal)} received via ${paymentMethod} (Ref: ${gatewayRef})`,
          'Payment Gateway',
          dateStr,
          timeStr,
          now.toISOString()
        ]
      );
    } else {
      db.run(
        `INSERT INTO order_status_history (id, order_id, status, notes, updated_by, date_str, time_str, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          `hist_${orderId}_2`,
          orderId,
          'Payment Confirmed',
          `Cash on Delivery verified with OTP. Payment of ${formatINR(grandTotal)} due on arrival.`,
          'Cash on Delivery Desk',
          dateStr,
          timeStr,
          now.toISOString()
        ]
      );
    }

    // Stage 3 - Preparing Order
    db.run(
      `INSERT INTO order_status_history (id, order_id, status, notes, updated_by, date_str, time_str, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        `hist_${orderId}_3`,
        orderId,
        'Preparing Order',
        'Atelier Jaipur artisans assigned for handloom finishing, embroidery verification and heirloom packing.',
        'Atelier Director',
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
        'Order Confirmed & Placed',
        `📦 Your order is being prepared. Order #${orderNumber} (${formatINR(grandTotal)}) expected by ${estDeliveryStr}.`,
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

    // Define standard 7 sequential non-cancelled stages
    const standardStages = [
      { key: 'Order Placed', aliases: ['Order Placed'], label: 'Order Placed', desc: 'Order verified & recorded in Jaipur Atelier' },
      { key: 'Payment Confirmed', aliases: ['Payment Confirmed'], label: 'Payment Confirmed', desc: 'Payment settlement verified' },
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
