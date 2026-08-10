/**
 * server/routes/orders.ts
 *
 * Order creation, tracking, and user order history.
 * All data from Supabase PostgreSQL. No SQLite dependency.
 */

import { Router } from 'express';
import { getDb, persistDb } from '../db.js';
import { authenticateUser } from '../auth.js';

const router = Router();

function formatDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${day} ${monthNames[date.getMonth()]} ${date.getFullYear()}`;
}

function formatTime(date: Date): string {
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
}

// ── POST /api/orders  (Checkout) ──────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const db = getDb();
    const {
      customerName, customerEmail, customerPhone,
      shippingAddress, items, paymentMethod, couponCode, userId
    } = req.body;

    if (!customerName || !customerEmail || !customerPhone || !shippingAddress || !items?.length) {
      return res.status(400).json({ error: 'Missing required order details' });
    }

    // Resolve user_id
    let finalUserId = userId;
    if (!finalUserId || finalUserId === 'guest_user') {
      const { data: existingUser } = await db
        .from('users')
        .select('id')
        .eq('email', customerEmail.toLowerCase())
        .maybeSingle();
      finalUserId = existingUser?.id ?? 'guest_user';
    }

    // Calculate subtotal
    let subtotal = 0;
    for (const it of items) {
      subtotal += Number(it.price) * Number(it.quantity);
    }

    // Coupon
    let discountAmount = 0;
    let validCoupon: any = null;
    if (couponCode) {
      const { data: couponRow } = await db
        .from('coupons')
        .select('*')
        .eq('code', couponCode.toUpperCase())
        .eq('is_active', true)
        .maybeSingle();

      if (couponRow && subtotal >= Number(couponRow.min_spend)) {
        validCoupon = couponRow;
        if (couponRow.discount_type === 'percentage') {
          discountAmount = (subtotal * Number(couponRow.discount_value)) / 100;
          if (couponRow.max_discount && discountAmount > Number(couponRow.max_discount)) {
            discountAmount = Number(couponRow.max_discount);
          }
        } else {
          discountAmount = Math.min(subtotal, Number(couponRow.discount_value));
        }
        // Increment usage count
        await db
          .from('coupons')
          .update({ usage_count: couponRow.usage_count + 1 })
          .eq('id', couponRow.id);
      }
    }

    // GST (12%) and delivery
    const taxableAmount = Math.max(0, subtotal - discountAmount);
    const gstAmount = Math.round(taxableAmount * 0.12);
    const deliveryFee = taxableAmount >= 5000 ? 0 : 250;
    const grandTotal = taxableAmount + gstAmount + deliveryFee;

    const now = new Date();
    const estDelivery = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000);
    const estDeliveryStr = formatDate(estDelivery);
    const randomSuffix = Math.floor(10000 + Math.random() * 90000);
    const orderId = `ord_${Date.now()}_${randomSuffix}`;
    const orderNumber = `RYL-2026-${randomSuffix}`;
    const trackingId = `TRK-RYL-${Math.floor(10000 + Math.random() * 90000)}`;
    const dateStr = formatDate(now);
    const timeStr = formatTime(now);

    // Insert order
    const { error: orderErr } = await db.from('orders').insert({
      id: orderId,
      order_number: orderNumber,
      tracking_id: trackingId,
      user_id: finalUserId !== 'guest_user' ? finalUserId : null,
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone,
      shipping_address_json: JSON.stringify(shippingAddress),
      subtotal,
      gst_amount: gstAmount,
      discount_amount: discountAmount,
      delivery_fee: deliveryFee,
      grand_total: grandTotal,
      coupon_code: couponCode || null,
      payment_method: paymentMethod || 'UPI',
      payment_status: 'PENDING',
      order_status: 'Awaiting Payment Verification',
      courier_name: 'Blue Dart Apex Luxury',
      estimated_delivery_date: estDeliveryStr,
      created_at: now.toISOString(),
      updated_at: now.toISOString()
    });

    if (orderErr) throw orderErr;

    // Insert order items + decrement stock
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const itemId = `item_${orderId}_${i + 1}`;
      const itemTotal = Number(item.price) * Number(item.quantity);

      const { error: itemErr } = await db.from('order_items').insert({
        id: itemId,
        order_id: orderId,
        product_id: item.productId,
        product_title: item.title,
        product_image: item.image,
        product_description: item.description || null,
        size: item.size || 'Standard',
        color: item.color || 'Royal Classic',
        quantity: Number(item.quantity),
        unit_price: Number(item.price),
        total_price: itemTotal
      });

      if (itemErr) throw itemErr;

      // Decrement stock
      const { data: currentProduct } = await db
        .from('products')
        .select('stock')
        .eq('id', item.productId)
        .maybeSingle();

      if (currentProduct) {
        const newStock = Math.max(0, Number(currentProduct.stock) - Number(item.quantity));
        await db.from('products').update({ stock: newStock }).eq('id', item.productId);
      }
    }

    // Insert payment record
    const paymentId = `pay_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const txnId = `TXN-RYL-${Date.now().toString().slice(-7)}`;
    const gatewayRef = `PG-${(paymentMethod || 'UPI').toUpperCase().slice(0, 3)}-${Math.floor(10000000 + Math.random() * 90000000)}`;

    await db.from('payments').insert({
      id: paymentId,
      order_id: orderId,
      payment_method: paymentMethod,
      transaction_id: txnId,
      gateway_ref: gatewayRef,
      amount: grandTotal,
      status: 'PENDING',
      paid_at: now.toISOString()
    });

    // Insert initial status history
    await db.from('order_status_history').insert({
      id: `hist_${orderId}_1`,
      order_id: orderId,
      status: 'Awaiting Payment Verification',
      notes: `Order ${orderNumber} placed by ${customerName}. Payment verification pending via WhatsApp.`,
      updated_by: 'Customer',
      date_str: dateStr,
      time_str: timeStr,
      created_at: now.toISOString()
    });

    // Customer notification
    await db.from('notifications').insert({
      id: `notif_${orderId}_created`,
      user_id: finalUserId !== 'guest_user' ? finalUserId : null,
      order_id: orderId,
      title: 'Order Placed - Awaiting Payment Verification',
      message: `📦 Order #${orderNumber} placed successfully (₹${grandTotal.toLocaleString('en-IN')}). Please send payment screenshot via WhatsApp for verification. Expected delivery: ${estDeliveryStr}.`,
      type: 'order_placed',
      is_read: false,
      created_at: now.toISOString()
    });

    // Fetch full created order
    const [orderResult, orderItemsResult, paymentResult, historyResult] = await Promise.all([
      db.from('orders').select('*').eq('id', orderId).single(),
      db.from('order_items').select('*').eq('order_id', orderId),
      db.from('payments').select('*').eq('order_id', orderId).limit(1),
      db.from('order_status_history').select('*').eq('order_id', orderId).order('created_at', { ascending: true })
    ]);

    const createdOrder = orderResult.data!;

    res.status(201).json({
      order: {
        ...createdOrder,
        shipping_address: JSON.parse(createdOrder.shipping_address_json),
        items: orderItemsResult.data ?? [],
        payment: paymentResult.data?.[0] ?? null,
        status_history: historyResult.data ?? []
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

// ── GET /api/orders/user/my-orders ────────────────────────────────────────
// Must be registered before /:idOrNumber to avoid route conflict
router.get('/user/my-orders', authenticateUser, async (req: any, res) => {
  try {
    const db = getDb();
    const userId = req.user.id;

    const { data: orders, error } = await db
      .from('orders')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const enriched = await Promise.all((orders ?? []).map(async (ord: any) => {
      const [itemsResult, historyResult] = await Promise.all([
        db.from('order_items').select('*').eq('order_id', ord.id),
        db.from('order_status_history').select('*').eq('order_id', ord.id).order('created_at', { ascending: true })
      ]);
      return {
        ...ord,
        shipping_address: JSON.parse(ord.shipping_address_json),
        items: itemsResult.data ?? [],
        status_history: historyResult.data ?? []
      };
    }));

    res.json(enriched);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/orders/track/:query ──────────────────────────────────────────
router.get('/track/:query', async (req, res) => {
  try {
    const db = getDb();
    const cleanQuery = req.params.query.trim();

    // Try tracking_id, order_number, id
    let order: any = null;
    for (const field of ['tracking_id', 'order_number', 'id']) {
      const { data } = await db
        .from('orders')
        .select('*')
        .eq(field, cleanQuery)
        .maybeSingle();
      if (data) { order = data; break; }
    }

    if (!order) {
      return res.status(404).json({ error: 'No order found matching tracking reference or order number.' });
    }

    const [itemsResult, historyResult] = await Promise.all([
      db.from('order_items').select('*').eq('order_id', order.id),
      db.from('order_status_history').select('*').eq('order_id', order.id).order('created_at', { ascending: true })
    ]);

    const history = historyResult.data ?? [];
    const historyMap = new Map(history.map((h: any) => [h.status, h]));
    const isCancelled = order.order_status === 'Cancelled';

    const standardStages = [
      { key: 'Order Placed', aliases: ['Order Placed'], label: 'Order Placed', desc: 'Order verified & recorded in Lucknow Atelier' },
      { key: 'Payment Confirmed', aliases: ['Payment Confirmed'], label: 'Payment Confirmed', desc: 'Payment settlement verified' },
      { key: 'Preparing Order', aliases: ['Preparing Order', 'Preparing'], label: 'Preparing Order', desc: 'Artisan hand-finishing, custom sizing & embroidery check' },
      { key: 'Packed', aliases: ['Packed'], label: 'Packed', desc: 'Inspected and securely sealed in heirloom velvet packaging' },
      { key: 'Shipped', aliases: ['Shipped'], label: 'Shipped', desc: 'Dispatched via premium insured courier' },
      { key: 'Out For Delivery', aliases: ['Out For Delivery', 'Out for Delivery'], label: 'Out For Delivery', desc: 'Out for verified doorstep delivery with courier' },
      { key: 'Delivered', aliases: ['Delivered'], label: 'Delivered', desc: 'Delivered to recipient with signature confirmation' }
    ];

    const timeline = standardStages.map((stage) => {
      let hist: any = null;
      for (const alias of stage.aliases) {
        if (historyMap.has(alias)) { hist = historyMap.get(alias); break; }
      }
      const isCurrent = stage.aliases.includes(order.order_status);
      if (hist) {
        return {
          status: stage.key, label: stage.label,
          description: hist.notes || stage.desc,
          date: hist.date_str, time: hist.time_str,
          isCompleted: true, isCurrent, updatedBy: hist.updated_by
        };
      }
      return {
        status: stage.key, label: stage.label,
        description: stage.desc, date: null, time: null,
        isCompleted: false, isCurrent: false, state: 'Pending'
      };
    });

    if (isCancelled) {
      const cancelHist: any = historyMap.get('Cancelled');
      timeline.push({
        status: 'Cancelled', label: 'Order Cancelled',
        description: cancelHist?.notes || 'Order has been cancelled.',
        date: cancelHist?.date_str || formatDate(new Date()),
        time: cancelHist?.time_str || formatTime(new Date()),
        isCompleted: true, isCurrent: true, updatedBy: cancelHist?.updated_by || 'Admin'
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
      items: itemsResult.data ?? [],
      grandTotal: order.grand_total,
      timeline,
      rawHistory: history,
      supportWhatsAppUrl: `https://wa.me/918000461784?text=${encodeURIComponent(`Hello ROYALS, I have a question regarding Order #${order.order_number}.`)}`
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/orders/:idOrNumber ───────────────────────────────────────────
router.get('/:idOrNumber', async (req, res) => {
  try {
    const db = getDb();
    const { idOrNumber } = req.params;

    let order: any = null;
    for (const field of ['id', 'order_number']) {
      const { data } = await db
        .from('orders')
        .select('*')
        .eq(field, idOrNumber)
        .maybeSingle();
      if (data) { order = data; break; }
    }

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const [itemsResult, paymentsResult, historyResult] = await Promise.all([
      db.from('order_items').select('*').eq('order_id', order.id),
      db.from('payments').select('*').eq('order_id', order.id),
      db.from('order_status_history').select('*').eq('order_id', order.id).order('created_at', { ascending: true })
    ]);

    res.json({
      ...order,
      shipping_address: JSON.parse(order.shipping_address_json),
      items: itemsResult.data ?? [],
      payment: paymentsResult.data?.[0] ?? null,
      status_history: historyResult.data ?? []
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
