// Single source of truth for order pricing rules, shared by the API server
// (authoritative order totals) and the client (cart preview).

export const GST_RATE = 0.12;
export const FREE_DELIVERY_THRESHOLD = 5000;
export const DELIVERY_FEE = 250;

export interface CouponRule {
  discount_type: string;
  discount_value: number;
  max_discount?: number | null;
  min_spend?: number | null;
}

export interface OrderTotals {
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  gstAmount: number;
  deliveryFee: number;
  grandTotal: number;
}

export function calculateCouponDiscount(coupon: CouponRule, subtotal: number): number {
  if (coupon.discount_type === 'percentage') {
    const discount = (subtotal * coupon.discount_value) / 100;
    return coupon.max_discount && discount > coupon.max_discount ? coupon.max_discount : discount;
  }
  return Math.min(subtotal, coupon.discount_value);
}

export function calculateOrderTotals(subtotal: number, discountAmount: number = 0): OrderTotals {
  if (subtotal <= 0) {
    return { subtotal: 0, discountAmount: 0, taxableAmount: 0, gstAmount: 0, deliveryFee: 0, grandTotal: 0 };
  }

  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const gstAmount = Math.round(taxableAmount * GST_RATE);
  const deliveryFee = taxableAmount >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;

  return {
    subtotal,
    discountAmount,
    taxableAmount,
    gstAmount,
    deliveryFee,
    grandTotal: taxableAmount + gstAmount + deliveryFee
  };
}

export function sumLineItems(items: Array<{ price: number | string; quantity: number | string }>): number {
  return items.reduce((sum, it) => sum + Number(it.price) * Number(it.quantity), 0);
}
