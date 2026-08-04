import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {Order} from '../../src/types';

const saved: string[] = [];
let texts: string[] = [];

// jsPDF needs a browser canvas, so the document is replaced with a recorder that
// captures the strings and file name each generator produces.
vi.mock('jspdf', () => {
  class FakeJsPdf {
    internal = {pageSize: {getWidth: () => 210, getHeight: () => 297}};
    setFont() {}
    setFontSize() {}
    setTextColor() {}
    setFillColor() {}
    setDrawColor() {}
    setLineWidth() {}
    rect() {}
    roundedRect() {}
    circle() {}
    line() {}
    text(value: string) {
      texts.push(value);
    }
    save(name: string) {
      saved.push(name);
    }
  }
  return {default: FakeJsPdf};
});

const {downloadInvoicePdf, downloadOrderSummaryPdf, downloadPaymentReceiptPdf} = await import(
  '../../src/services/pdfGenerator'
);

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'ord_demo_89421',
    order_number: 'RYL-2026-89421',
    tracking_id: 'TRK-RYL-77492',
    customer_name: 'Princess Gayatri',
    customer_email: 'customer@royals.com',
    customer_phone: '8000461784',
    shipping_address: {
      fullName: 'Princess Gayatri',
      phone: '8000461784',
      addressLine1: 'Suite 402, Royal Heritage Haveli',
      city: 'Jaipur',
      state: 'Rajasthan',
      pincode: '303901'
    },
    subtotal: 165000,
    gst_amount: 19800,
    discount_amount: 0,
    delivery_fee: 0,
    grand_total: 184800,
    payment_method: 'UPI (PhonePe)',
    payment_status: 'PAID',
    order_status: 'Preparing Order',
    courier_name: 'Blue Dart Apex Luxury',
    estimated_delivery_date: '12 Aug 2026',
    created_at: '2026-08-04T08:15:00.000Z',
    updated_at: '2026-08-04T10:42:00.000Z',
    items: [
      {
        id: 'item_1',
        product_id: 'prod_raw_silk_kurta_set',
        product_title: 'The Maharaja Ivory Raw Silk Kurta Pajama Set',
        product_image: '/images/mens_raw_silk_kurta.jpg',
        size: '38 (M)',
        color: 'Warm Ivory Cream',
        quantity: 1,
        unit_price: 165000,
        total_price: 165000
      }
    ],
    ...overrides
  } as Order;
}

const joined = () => texts.join('\n');

beforeEach(() => {
  texts = [];
  saved.length = 0;
});

describe('downloadInvoicePdf', () => {
  it('names the file and derives the invoice number from the order number', () => {
    downloadInvoicePdf(makeOrder());

    expect(saved).toEqual(['ROYALS_Invoice_RYL-2026-89421.pdf']);
    expect(texts).toContain('Invoice No: INV-2026-89421');
    expect(texts).toContain('Order No: #RYL-2026-89421');
  });

  it('renders customer, dispatch and GST details', () => {
    downloadInvoicePdf(makeOrder());

    expect(texts).toContain('Phone: 8000461784');
    expect(texts).toContain('Email: customer@royals.com');
    expect(texts).toContain('Tracking ID: TRK-RYL-77492');
    expect(texts).toContain('Courier: Blue Dart Apex Luxury');
    expect(texts).toContain('Est. Delivery: 12 Aug 2026');
    expect(texts).toContain('Jaipur, Rajasthan - 303901');
    expect(joined()).toContain('GST (12% Apparel Tax)');
  });

  it('formats amounts in the Indian numbering system', () => {
    downloadInvoicePdf(makeOrder());

    expect(texts).toContain('₹1,65,000');
    expect(texts).toContain('₹1,84,800');
  });

  it('shows complimentary delivery when no fee was charged and the amount otherwise', () => {
    downloadInvoicePdf(makeOrder());
    expect(texts).toContain('FREE (Complimentary)');

    texts = [];
    downloadInvoicePdf(makeOrder({delivery_fee: 250}));
    expect(texts).not.toContain('FREE (Complimentary)');
    expect(texts).toContain('₹250');
  });

  it('only prints a discount line when a discount applied', () => {
    downloadInvoicePdf(makeOrder());
    expect(joined()).not.toContain('Discount');

    texts = [];
    downloadInvoicePdf(makeOrder({discount_amount: 16500, coupon_code: 'ROYAL10'}));
    expect(texts).toContain('Discount (ROYAL10):');
    expect(texts).toContain('- ₹16,500');
  });

  it('labels an unnamed discount as a promo', () => {
    downloadInvoicePdf(makeOrder({discount_amount: 500, coupon_code: null as any}));
    expect(texts).toContain('Discount (Promo):');
  });

  it('truncates long product titles in the line-item table', () => {
    const longTitle = 'The Exceedingly Long Ceremonial Kurta Title That Will Not Fit In The Column';
    downloadInvoicePdf(
      makeOrder({items: [{...makeOrder().items[0], product_title: longTitle}]} as Partial<Order>)
    );

    expect(texts).toContain(`${longTitle.slice(0, 38)}...`);
    expect(texts).not.toContain(longTitle);
  });

  it('adds a row for every ordered item', () => {
    const item = makeOrder().items[0];
    downloadInvoicePdf(
      makeOrder({
        items: [item, {...item, id: 'item_2', size: '40 (L)', quantity: 2, total_price: 330000}]
      } as Partial<Order>)
    );

    expect(texts).toContain('38 (M)');
    expect(texts).toContain('40 (L)');
    expect(texts).toContain('₹3,30,000');
  });
});

describe('downloadPaymentReceiptPdf', () => {
  it('names the file and confirms the settled amount', () => {
    downloadPaymentReceiptPdf(makeOrder());

    expect(saved).toEqual(['ROYALS_PaymentReceipt_RYL-2026-89421.pdf']);
    expect(texts).toContain('Payment Confirmed');
    expect(texts).toContain('₹1,84,800');
  });

  it('uses the recorded payment references when present', () => {
    downloadPaymentReceiptPdf(
      makeOrder({payment: {transaction_id: 'TXN-RYL-9832104', gateway_ref: 'UPI-REF-08412948'}} as Partial<Order>)
    );

    expect(texts).toContain('TXN-RYL-9832104');
    expect(texts).toContain('UPI-REF-08412948');
  });

  it('falls back to derived references when the payment row is missing', () => {
    downloadPaymentReceiptPdf(makeOrder());

    expect(texts).toContain('TXN-RYL-89421');
    expect(texts).toContain('PG-SETTLED-SUCCESS');
  });
});

describe('downloadOrderSummaryPdf', () => {
  it('names the file and renders the consignment dossier', () => {
    downloadOrderSummaryPdf(makeOrder());

    expect(saved).toEqual(['ROYALS_OrderSummary_RYL-2026-89421.pdf']);
    expect(texts).toContain('Order Number: #RYL-2026-89421');
    expect(texts).toContain('Tracking Reference: TRK-RYL-77492');
    expect(texts).toContain('Current Status: Preparing Order');
    expect(texts).toContain('Suite 402, Royal Heritage Haveli, Jaipur, Rajasthan - 303901');
  });

  it('numbers each enclosed ensemble with its specification', () => {
    const item = makeOrder().items[0];
    downloadOrderSummaryPdf(
      makeOrder({items: [item, {...item, id: 'item_2', product_title: 'Chikankari Kurta Set'}]} as Partial<Order>)
    );

    expect(texts).toContain('1. The Maharaja Ivory Raw Silk Kurta Pajama Set');
    expect(texts).toContain('2. Chikankari Kurta Set');
    expect(texts).toContain('Size: 38 (M) | Color: Warm Ivory Cream | Quantity: 1');
  });

  it('defaults the courier when the order has none', () => {
    downloadOrderSummaryPdf(makeOrder({courier_name: undefined as any}));
    expect(texts).toContain('Courier Partner: Blue Dart Apex Luxury');
  });

  it('links the WhatsApp concierge for the order', () => {
    downloadOrderSummaryPdf(makeOrder());
    expect(joined()).toContain('https://wa.me/918000461784?text=Hello%20ROYALS%2C%20Order%20%23RYL-2026-89421');
  });
});
