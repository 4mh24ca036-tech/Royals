import jsPDF from 'jspdf';
import { Order } from '../types';

export function downloadInvoicePdf(order: Order) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const invoiceNumber = `INV-${order.order_number.replace('RYL-', '')}`;
  const pageWidth = doc.internal.pageSize.getWidth();

  // Background tint
  doc.setFillColor(250, 248, 245);
  doc.rect(0, 0, pageWidth, 297, 'F');

  // Top luxury gold banner bar
  doc.setFillColor(197, 168, 128); // #C5A880
  doc.rect(0, 0, pageWidth, 8, 'F');

  // Header Brand
  doc.setFont('times', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(26, 26, 26);
  doc.text('R O Y A L S', 14, 24);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(140, 120, 90);
  doc.text('HAUTE COUTURE & LUXURY CHIKANKARI ETHNIC ATELIER', 14, 29);

  // Store Contact Info (Right aligned)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(70, 70, 70);
  doc.text('6, Lal Ji Tandon Marg (Khun Khun Ji Road), Chowk, Lucknow, Uttar Pradesh – 226003, India', pageWidth - 14, 20, { align: 'right' });
  doc.text('Phone: +91 8000461784 | Email: concierge@lucknowchikanemporium.com', pageWidth - 14, 25, { align: 'right' });
  doc.text('GSTIN: 09AAACR8942K1Z3 | State: 09 - Uttar Pradesh', pageWidth - 14, 30, { align: 'right' });

  // Divider line
  doc.setDrawColor(216, 204, 194);
  doc.setLineWidth(0.5);
  doc.line(14, 34, pageWidth - 14, 34);

  // Invoice Title Box
  doc.setFillColor(245, 239, 235);
  doc.roundedRect(14, 38, pageWidth - 28, 20, 2, 2, 'F');

  doc.setFont('times', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(26, 26, 26);
  doc.text('TAX INVOICE', 20, 47);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(`Invoice No: ${invoiceNumber}`, 20, 53);
  doc.text(`Invoice Date: ${new Date(order.created_at).toLocaleDateString('en-GB')}`, 85, 53);
  doc.text(`Order No: #${order.order_number}`, 145, 53);

  // Customer Details & Shipping Details
  let y = 66;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(140, 120, 90);
  doc.text('BILLED & SHIPPED TO:', 14, y);
  doc.text('DISPATCH & PAYMENT DETAILS:', 110, y);

  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(30, 30, 30);
  doc.text(order.customer_name, 14, y);
  doc.text(`Payment Method: ${order.payment_method}`, 110, y);

  y += 5;
  doc.text(`Phone: ${order.customer_phone}`, 14, y);
  doc.text(`Payment Status: ${order.payment_status}`, 110, y);

  y += 5;
  doc.text(`Email: ${order.customer_email}`, 14, y);
  doc.text(`Tracking ID: ${order.tracking_id}`, 110, y);

  y += 5;
  const addr = order.shipping_address;
  doc.text(`${addr.addressLine1}${addr.addressLine2 ? ', ' + addr.addressLine2 : ''}`, 14, y);
  doc.text(`Courier: ${order.courier_name || 'Blue Dart Apex Luxury'}`, 110, y);

  y += 5;
  doc.text(`${addr.city}, ${addr.state} - ${addr.pincode}`, 14, y);
  doc.text(`Est. Delivery: ${order.estimated_delivery_date}`, 110, y);

  // Itemized Table
  y += 12;
  doc.setFillColor(36, 34, 32);
  doc.rect(14, y, pageWidth - 28, 8, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('SR', 18, y + 5.5);
  doc.text('DESCRIPTION & SPECIFICATION', 32, y + 5.5);
  doc.text('HSN', 110, y + 5.5);
  doc.text('SIZE / COLOR', 125, y + 5.5);
  doc.text('QTY', 155, y + 5.5);
  doc.text('RATE (INR)', 168, y + 5.5);
  doc.text('TOTAL (INR)', pageWidth - 18, y + 5.5, { align: 'right' });

  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(30, 30, 30);

  order.items.forEach((item, idx) => {
    const rowY = y + (idx * 10);
    if (idx % 2 === 1) {
      doc.setFillColor(245, 240, 235);
      doc.rect(14, rowY, pageWidth - 28, 10, 'F');
    }

    doc.text(String(idx + 1), 18, rowY + 6);
    
    // Truncate long title
    const shortTitle = item.product_title.length > 40 ? item.product_title.slice(0, 38) + '...' : item.product_title;
    doc.text(shortTitle, 32, rowY + 6);
    
    doc.text('6204', 110, rowY + 6);
    doc.text(`${item.size}`, 125, rowY + 6);
    doc.text(String(item.quantity), 157, rowY + 6);
    doc.text(`₹${item.unit_price.toLocaleString('en-IN')}`, 168, rowY + 6);
    doc.text(`₹${item.total_price.toLocaleString('en-IN')}`, pageWidth - 18, rowY + 6, { align: 'right' });
  });

  const tableBottomY = y + (order.items.length * 10) + 6;

  // Horizontal line
  doc.setDrawColor(216, 204, 194);
  doc.line(14, tableBottomY, pageWidth - 14, tableBottomY);

  // Financial Breakdown (Right-aligned calculation box)
  let calcY = tableBottomY + 6;
  const calcX = pageWidth - 70;
  const valX = pageWidth - 18;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);

  doc.text('Items Subtotal:', calcX, calcY);
  doc.text(`₹${order.subtotal.toLocaleString('en-IN')}`, valX, calcY, { align: 'right' });

  if (order.discount_amount > 0) {
    calcY += 6;
    doc.setTextColor(180, 50, 50);
    doc.text(`Discount (${order.coupon_code || 'Promo'}):`, calcX, calcY);
    doc.text(`- ₹${order.discount_amount.toLocaleString('en-IN')}`, valX, calcY, { align: 'right' });
    doc.setTextColor(60, 60, 60);
  }

  calcY += 6;
  doc.text('GST (12% Apparel Tax):', calcX, calcY);
  doc.text(`₹${order.gst_amount.toLocaleString('en-IN')}`, valX, calcY, { align: 'right' });

  calcY += 6;
  doc.text('Insured Delivery Charge:', calcX, calcY);
  doc.text(order.delivery_fee === 0 ? 'FREE (Complimentary)' : `₹${order.delivery_fee.toLocaleString('en-IN')}`, valX, calcY, { align: 'right' });

  calcY += 7;
  doc.setFillColor(245, 239, 235);
  doc.rect(calcX - 4, calcY - 4, pageWidth - calcX - 10, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(26, 26, 26);
  doc.text('Grand Total:', calcX, calcY + 2);
  doc.text(`₹${order.grand_total.toLocaleString('en-IN')}`, valX, calcY + 2, { align: 'right' });

  // Bank & Legal Notes (Left side)
  let notesY = tableBottomY + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(140, 120, 90);
  doc.text('TERMS & CONDITIONS:', 14, notesY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(90, 90, 90);
  notesY += 4.5;
  doc.text('1. Handcrafted luxury garments. Custom bridal orders are non-refundable.', 14, notesY);
  notesY += 4;
  doc.text('2. Subject to Lucknow jurisdiction only.', 14, notesY);
  notesY += 4;
  doc.text('3. This is a computer generated digital invoice authorized by ROYALS Atelier.', 14, notesY);

  // Authorized Signatory Seal
  doc.setDrawColor(197, 168, 128);
  doc.roundedRect(14, notesY + 8, 55, 18, 1, 1, 'D');
  doc.setFont('times', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(140, 120, 90);
  doc.text('Lucknow Chikan Emporium', 20, notesY + 15);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text('AUTHORIZED SIGNATORY', 20, notesY + 22);

  // Footer bar
  doc.setFillColor(36, 34, 32);
  doc.rect(0, 287, pageWidth, 10, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(220, 210, 200);
  doc.text('Thank you for patronizing ROYALS. For bespoke inquiries or styling assistance, call +91 8000461784.', pageWidth / 2, 293, { align: 'center' });

  // Save PDF
  doc.save(`ROYALS_Invoice_${order.order_number}.pdf`);
}

async function loadReceiptImage(source: string): Promise<string | null> {
  try {
    if (source.startsWith('data:image/')) return source;
    const response = await fetch(source.startsWith('/') ? `${window.location.origin}${source}` : source);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function downloadPaymentReceiptPdf(order: Order): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Background
  doc.setFillColor(252, 250, 247);
  doc.rect(0, 0, pageWidth, 297, 'F');

  // Gold Top Border
  doc.setFillColor(197, 168, 128);
  doc.rect(0, 0, pageWidth, 8, 'F');

  // Title
  doc.setFont('times', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(26, 26, 26);
  doc.text('R O Y A L S', pageWidth / 2, 26, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(140, 120, 90);
  doc.text('OFFICIAL PAYMENT RECEIPT & SETTLEMENT CERTIFICATE', pageWidth / 2, 32, { align: 'center' });

  // Receipt Card Box
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(216, 204, 194);
  doc.roundedRect(20, 40, pageWidth - 40, 110, 3, 3, 'FD');

  // Checkmark icon placeholder
  doc.setFillColor(46, 125, 50); // Emerald Green
  doc.circle(pageWidth / 2, 54, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('OK', pageWidth / 2, 57.5, { align: 'center' });

  doc.setFont('times', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(26, 26, 26);
  doc.text(order.payment_status === 'PAID' ? 'Payment Confirmed' : 'Payment Verification Pending', pageWidth / 2, 69, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(140, 120, 90);
  doc.text(`₹${order.grand_total.toLocaleString('en-IN')}`, pageWidth / 2, 79, { align: 'center' });

  // Receipt details table
  let rowY = 90;
  const leftX = 32;
  const rightX = pageWidth - 32;

  const address = order.shipping_address;
  const receiptRows = [
    { label: 'Order Number', value: `#${order.order_number}` },
    { label: 'Customer Name', value: order.customer_name },
    { label: 'Phone Number', value: order.customer_phone },
    { label: 'Email', value: order.customer_email },
    { label: 'Payment Method', value: order.payment_method },
    { label: 'Transaction Reference', value: order.payment?.transaction_id || 'Pending verification' },
    { label: 'Payment Gateway UTR', value: order.payment?.gateway_ref || 'Pending verification' },
    { label: 'Payment Date & Time', value: new Date(order.created_at).toLocaleString('en-GB') },
    { label: 'Current Status', value: order.order_status }
  ];

  receiptRows.forEach((r) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(r.label, leftX, rowY);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text(r.value, rightX, rowY, { align: 'right' });
    rowY += 6.5;
  });

  const addressY = 160;
  doc.setFillColor(245, 239, 235);
  doc.roundedRect(20, addressY, pageWidth - 40, 26, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(140, 120, 90);
  doc.text('SHIPPING ADDRESS', 28, addressY + 7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(45, 45, 45);
  doc.text(`${address.fullName || order.customer_name} · ${address.addressLine1}${address.addressLine2 ? `, ${address.addressLine2}` : ''}`, 28, addressY + 13);
  doc.text(`${address.city}, ${address.state} - ${address.pincode} · Estimated delivery: ${order.estimated_delivery_date}`, 28, addressY + 19);

  // Product section with stored product imagery and order snapshots.
  let itemY = 195;
  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(26, 26, 26);
  doc.text('Ordered ROYALS Creations', 20, itemY);
  itemY += 5;
  for (const item of order.items) {
    if (itemY > 250) { doc.addPage(); itemY = 24; }
    doc.setDrawColor(216, 204, 194);
    doc.roundedRect(20, itemY, pageWidth - 40, 26, 1, 1, 'D');
    const image = await loadReceiptImage(item.product_image);
    if (image) {
      try { doc.addImage(image, 'JPEG', 23, itemY + 3, 18, 20); } catch { /* a receipt remains printable if an image format is unsupported */ }
    }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(26, 26, 26);
    doc.text(item.product_title, 45, itemY + 7);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(90, 90, 90);
    const description = item.product_description || 'Hand-finished ROYALS atelier ensemble.';
    const lines = doc.splitTextToSize(description, 102);
    doc.text(lines.slice(0, 2), 45, itemY + 12);
    doc.text(`Size: ${item.size} · Qty: ${item.quantity} · ₹${item.total_price.toLocaleString('en-IN')}`, 45, itemY + 22);
    itemY += 30;
  }

  // Support Box
  doc.setFillColor(245, 239, 235);
  doc.roundedRect(20, Math.min(itemY, 254), pageWidth - 40, 28, 2, 2, 'F');

  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(26, 26, 26);
  const supportY = Math.min(itemY, 254);
  doc.text('Need Concierge Assistance?', 28, supportY + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(70, 70, 70);
  doc.text('Your order is protected under the ROYALS Verified Transit & Authenticity Guarantee.', 28, supportY + 17);
  doc.text('WhatsApp Hotline: +91 8000461784 | Lucknow Atelier', 28, supportY + 23);

  // Footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(140, 140, 140);
  doc.text('This is a computer-verified payment receipt issued by ROYALS Haute Couture E-Commerce Platform.', pageWidth / 2, 280, { align: 'center' });

  doc.save(`ROYALS_PaymentReceipt_${order.order_number}.pdf`);
}

export function downloadOrderSummaryPdf(order: Order) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Background
  doc.setFillColor(250, 248, 245);
  doc.rect(0, 0, pageWidth, 297, 'F');

  // Gold Bar
  doc.setFillColor(197, 168, 128);
  doc.rect(0, 0, pageWidth, 8, 'F');

  // Header
  doc.setFont('times', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(26, 26, 26);
  doc.text('R O Y A L S', 14, 22);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(140, 120, 90);
  doc.text('COMPLETE ORDER DOSSIER & CONSIGNMENT SUMMARY', 14, 27);

  // Order Details
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(26, 26, 26);
  doc.text(`Order Number: #${order.order_number}`, 14, 38);
  doc.text(`Tracking Reference: ${order.tracking_id}`, 110, 38);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(`Order Date: ${new Date(order.created_at).toLocaleDateString('en-GB')}`, 14, 44);
  doc.text(`Current Status: ${order.order_status}`, 110, 44);
  doc.text(`Estimated Delivery: ${order.estimated_delivery_date}`, 14, 50);
  doc.text(`Courier Partner: ${order.courier_name || 'Blue Dart Apex Luxury'}`, 110, 50);

  // Address
  doc.setFillColor(245, 239, 235);
  doc.roundedRect(14, 56, pageWidth - 28, 22, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(140, 120, 90);
  doc.text('DESTINATION ADDRESS:', 20, 64);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 30, 30);
  doc.text(`${order.customer_name} | Phone: ${order.customer_phone}`, 20, 70);
  doc.text(`${order.shipping_address.addressLine1}, ${order.shipping_address.city}, ${order.shipping_address.state} - ${order.shipping_address.pincode}`, 20, 75);

  // Items
  let itemY = 86;
  doc.setFont('times', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(26, 26, 26);
  doc.text('Enclosed Couture Ensembles:', 14, itemY);

  itemY += 6;
  order.items.forEach((item, idx) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    doc.text(`${idx + 1}. ${item.product_title}`, 16, itemY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 100, 100);
    doc.text(`Size: ${item.size} | Color: ${item.color} | Quantity: ${item.quantity}`, 20, itemY + 5);
    doc.text(`Price: ₹${item.total_price.toLocaleString('en-IN')}`, pageWidth - 20, itemY + 5, { align: 'right' });

    itemY += 12;
  });

  // Total
  itemY += 4;
  doc.setDrawColor(216, 204, 194);
  doc.line(14, itemY, pageWidth - 14, itemY);

  itemY += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(26, 26, 26);
  doc.text('Grand Total Settled:', 14, itemY);
  doc.text(`₹${order.grand_total.toLocaleString('en-IN')}`, pageWidth - 14, itemY, { align: 'right' });

  // WhatsApp Support Note
  itemY += 16;
  doc.setFillColor(235, 245, 235);
  doc.roundedRect(14, itemY, pageWidth - 28, 20, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 100, 40);
  doc.text('Direct WhatsApp Concierge:', 20, itemY + 8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(50, 50, 50);
  doc.text(`https://wa.me/918000461784?text=Hello%20ROYALS%2C%20Order%20%23${order.order_number}`, 20, itemY + 14);

  doc.save(`ROYALS_OrderSummary_${order.order_number}.pdf`);
}
