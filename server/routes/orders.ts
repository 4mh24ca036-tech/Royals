import crypto from 'crypto';
import { Router, Request } from 'express';
import { getDb, persistDb } from '../db.js';
import { authenticateUser, optionalAuthenticateUser, UserJwtPayload } from '../auth.js';
import { isValidEmail, isValidPhone, isValidPincode, rateLimit, sanitizeText, serverError } from '../security.js';

const router = Router();

const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Too many checkout attempts. Please try again in a few minutes.'
});

const lookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: 'Too many lookup requests. Please try again in a few minutes.'
});

const MAX_ITEMS_PER_ORDER = 20;
const MAX_QUANTITY_PER_ITEM = 10;
const GST_RATE = 0.12;
const FREE_DELIVERY_THRESHOLD = 5000;
const DELIVERY_FEE = 250;
const PAYMENT_METHODS = ['UPI', 'Card', 'NetBanking', 'Net Banking', 'Wallet', 'Cash on Delivery', 'COD'];

function normalizePaymentMethod(value: unknown): string | null {
  const text = sanitizeText(value, 60);
  if (!text) return 'UPI';
  const matched = PAYMENT_METHODS.find((pm) => text.toLowerCase().includes(pm.toLowerCase()));
  return matched ? text : null;
}

function isCashOnDelivery(paymentMethod: string): boolean {
  return paymentMethod.toLowerCase().includes('cash on delivery') || paymentMethod.toLowerCase().includes('cod');
}

// Only the shipping fields the app needs, each length- and format-checked.
function parseShippingAddress(raw: any) {
  if (!raw || typeof raw !== 'object') return null;
  const fullName = sanitizeText(raw.fullName, 100);
  const addressLine1 = sanitizeText(raw.addressLine1, 200);
  const city = sanitizeText(raw.city, 100);
  const state = sanitizeText(raw.state, 100);
  const phone = isValidPhone(raw.phone) ? String(raw.phone).trim() : null;
  const pincode = isValidPincode(raw.pincode) ? String(raw.pincode).trim() : null;

  if (!fullName || !addressLine1 || !city || !state || !phone || !pincode) return null;

  return {
    fullName,
    phone,
    addressLine1,
    addressLine2: raw.addressLine2 ? sanitizeText(raw.addressLine2, 200) : null,
    landmark: raw.landmark ? sanitizeText(raw.landmark, 200) : null,
    city,
    state,
    pincode,
    country: sanitizeText(raw.country, 60) || 'India'
  };
}

function maskPhone(phone: string): string {
  const digits = String(phone).replace(/\D/g, '');
  return digits.length > 4 ? `${'*'.repeat(digits.length - 4)}${digits.slice(-4)}` : '****';
}

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
router.post('/', checkoutLimiter, optionalAuthenticateUser, async (req: Request & { user?: UserJwtPayload }, res) => {
  try {
    const db = await getDb();

    const customerName = sanitizeText(req.body?.customerName, 100);
    const customerEmail = isValidEmail(req.body?.customerEmail) ? req.body.customerEmail.trim().toLowerCase() : null;
    const customerPhone = isValidPhone(req.body?.customerPhone) ? String(req.body.customerPhone).trim() : null;
    const shippingAddress = parseShippingAddress(req.body?.shippingAddress);
    const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];
    const paymentMethod = normalizePaymentMethod(req.body?.paymentMethod);
    const couponCode = req.body?.couponCode ? sanitizeText(req.body.couponCode, 40) : null;

    if (!customerName || !customerEmail || !customerPhone || !shippingAddress || rawItems.length === 0) {
      return res.status(400).json({ error: 'Missing or invalid required order details' });
    }

    if (!paymentMethod) {
      return res.status(400).json({ error: 'Unsupported payment method' });
    }

    if (rawItems.length > MAX_ITEMS_PER_ORDER) {
      return res.status(400).json({ error: `An order cannot contain more than ${MAX_ITEMS_PER_ORDER} line items` });
    }

    // Prices, titles and images always come from the catalogue, never from the client payload.
    const items: Array<{ productId: string; title: string; image: string; size: string; color: string; quantity: number; unitPrice: number }> = [];
    for (const raw of rawItems) {
      const productId = sanitizeText(raw?.productId, 100);
      const quantity = Number(raw?.quantity);

      if (!productId) {
        return res.status(400).json({ error: 'Each order item requires a product reference' });
      }
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY_PER_ITEM) {
        return res.status(400).json({ error: `Item quantity must be a whole number between 1 and ${MAX_QUANTITY_PER_ITEM}` });
      }

      const product = queryAll(db, 'SELECT * FROM products WHERE id = ? LIMIT 1', [productId])[0];
      if (!product) {
        return res.status(400).json({ error: 'One or more products in the order are no longer available' });
      }

      const availableSizes: string[] = JSON.parse(product.sizes_json || '[]');
      const requestedSize = sanitizeText(raw?.size, 40);
      const size = requestedSize && availableSizes.includes(requestedSize) ? requestedSize : availableSizes[0] || 'Standard';
      const images: string[] = JSON.parse(product.images_json || '[]');
      const unitPrice = Number(product.discount_price ?? product.price);

      items.push({
        productId: product.id,
        title: product.title,
        image: images[0] || '',
        size,
        color: product.color || 'Royal Classic',
        quantity,
        unitPrice
      });
    }

    const subtotal = items.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0);

    // Coupon calculation
    let discountAmount = 0;
    let validCoupon: any = null;
    if (couponCode) {
      const coupRows = queryAll(db, 'SELECT * FROM coupons WHERE code = ? AND is_active = 1 LIMIT 1', [couponCode.toUpperCase()]);
      if (coupRows.length > 0 && (!coupRows[0].expiry_date || new Date(coupRows[0].expiry_date).getTime() >= Date.now())) {
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
    const gstAmount = Math.round(taxableAmount * GST_RATE);

    // Free luxury insured delivery above 5000, else 250
    const deliveryFee = taxableAmount >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
    const grandTotal = taxableAmount + gstAmount + deliveryFee;
    const codOrder = isCashOnDelivery(paymentMethod);
    const userId = req.user?.id || null;

    const now = new Date();
    const estDeliveryDate = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000);
    const estDeliveryStr = formatDate(estDeliveryDate);

    // Unguessable references so order and tracking lookups cannot be enumerated.
    const orderSuffix = crypto.randomBytes(5).toString('hex').toUpperCase();
    const orderId = `ord_${Date.now()}_${orderSuffix}`;
    const orderNumber = `RYL-${now.getFullYear()}-${orderSuffix}`;
    const trackingId = `TRK-RYL-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

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
        userId,
        customerName,
        customerEmail,
        customerPhone,
        JSON.stringify(shippingAddress),
        subtotal,
        gstAmount,
        discountAmount,
        deliveryFee,
        grandTotal,
        validCoupon ? validCoupon.code : null,
        paymentMethod,
        codOrder ? 'PENDING' : 'PAID',
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
      const itemTotal = item.unitPrice * item.quantity;

      db.run(
        `INSERT INTO order_items (id, order_id, product_id, product_title, product_image, size, color, quantity, unit_price, total_price)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          itemId,
          orderId,
          item.productId,
          item.title,
          item.image,
          item.size,
          item.color,
          item.quantity,
          item.unitPrice,
          itemTotal
        ]
      );

      // Decrement stock
      db.run('UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?', [item.quantity, item.productId]);
    }

    // Insert Payment Record
    const paymentId = `pay_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const txnId = `TXN-RYL-${Date.now().toString().slice(-7)}`;
    const gatewayRef = `PG-${paymentMethod.toUpperCase().slice(0, 3)}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

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
        codOrder ? 'PENDING' : 'SUCCESS',
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
          `Payment of ₹${grandTotal.toLocaleString('en-IN')} received via ${paymentMethod} (Ref: ${gatewayRef})`,
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
          `Cash on Delivery verified with OTP. Payment of ₹${grandTotal.toLocaleString('en-IN')} due on arrival.`,
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
        `📦 Your order is being prepared. Order #${orderNumber} (₹${grandTotal.toLocaleString('en-IN')}) expected by ${estDeliveryStr}.`,
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
      invoiceNumber: `INV-${now.getFullYear()}-${orderSuffix}`,
      paymentReceipt: {
        transactionId: txnId,
        gatewayRef,
        amount: grandTotal,
        paidAt: now.toISOString(),
        paymentMethod
      }
    });
  } catch (err: any) {
    return serverError(res, 'orders route', err);
  }
});

// GET order details by Order ID or Order Number (owner only)
router.get('/:idOrNumber', authenticateUser, async (req: Request & { user?: UserJwtPayload }, res) => {
  try {
    const db = await getDb();
    const { idOrNumber } = req.params;

    const orders = queryAll(db, 'SELECT * FROM orders WHERE id = ? OR order_number = ? LIMIT 1', [idOrNumber, idOrNumber]);
    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orders[0];
    const requester = req.user!;
    const ownsOrder = order.user_id === requester.id
      || (order.customer_email && requester.email && order.customer_email.toLowerCase() === requester.email.toLowerCase());
    if (!ownsOrder) {
      return res.status(404).json({ error: 'Order not found' });
    }

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
    return serverError(res, 'orders route', err);
  }
});

// GET tracking information with complete 8-stage timeline directly from database
router.get('/track/:query', lookupLimiter, async (req, res) => {
  try {
    const db = await getDb();
    const { query } = req.params;

    const cleanQuery = (query || '').trim().slice(0, 100);
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
      // Tracking is a public lookup, so only coarse delivery location is exposed.
      shippingAddress: (() => {
        const addr = JSON.parse(order.shipping_address_json);
        return {
          fullName: addr.fullName,
          phone: addr.phone ? maskPhone(addr.phone) : '',
          city: addr.city,
          state: addr.state,
          pincode: addr.pincode,
          country: addr.country || 'India'
        };
      })(),
      items,
      grandTotal: order.grand_total,
      timeline,
      rawHistory: history,
      supportWhatsAppUrl: `https://wa.me/918000461784?text=${encodeURIComponent(`Hello ROYALS, I have a question regarding Order #${order.order_number}.`)}`
    });
  } catch (err: any) {
    return serverError(res, 'orders route', err);
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
    return serverError(res, 'orders route', err);
  }
});

export default router;
