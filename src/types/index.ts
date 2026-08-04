export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  image_url: string;
  display_order: number;
}

export interface Review {
  id: string;
  product_id: string;
  user_name: string;
  rating: number;
  comment: string;
  verified_purchase: number;
  created_at: string;
}

export interface InventoryItem {
  id: string;
  product_id: string;
  sku: string;
  size: string;
  stock_quantity: number;
  low_stock_threshold: number;
  last_restocked_at?: string;
  product_title?: string;
  category_name?: string;
  price?: number;
  images?: string[];
}

export interface Product {
  id: string;
  title: string;
  slug: string;
  category_id: string;
  category_name: string;
  price: number;
  discount_price?: number | null;
  stock: number;
  fabric: string;
  embroidery: string;
  color: string;
  sizes: string[];
  description: string;
  care_instructions?: string;
  images: string[];
  rating: number;
  review_count: number;
  is_featured: boolean;
  is_new_arrival: boolean;
  created_at: string;
  reviews?: Review[];
  inventory?: InventoryItem[];
}

export interface CartItem {
  id: string;
  productId: string;
  title: string;
  image: string;
  price: number;
  originalPrice?: number;
  size: string;
  color: string;
  quantity: number;
  fabric?: string;
}

export interface ShippingAddress {
  fullName: string;
  phone: string;
  email?: string;
  addressLine1: string;
  addressLine2?: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  isDefault?: boolean;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_title: string;
  product_image: string;
  size: string;
  color: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface OrderStatusHistory {
  id: string;
  order_id: string;
  status: string;
  notes?: string;
  updated_by: string;
  date_str: string;
  time_str: string;
  created_at: string;
}

export interface PaymentInfo {
  id: string;
  order_id: string;
  payment_method: string;
  transaction_id: string;
  gateway_ref?: string;
  amount: number;
  status: string;
  paid_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  tracking_id: string;
  user_id?: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  shipping_address: ShippingAddress;
  subtotal: number;
  gst_amount: number;
  discount_amount: number;
  delivery_fee: number;
  grand_total: number;
  coupon_code?: string | null;
  payment_method: string;
  payment_status: 'PAID' | 'PENDING' | 'REFUNDED';
  order_status: 'Order Placed' | 'Payment Confirmed' | 'Preparing' | 'Packed' | 'Shipped' | 'Out for Delivery' | 'Delivered' | 'Cancelled';
  courier_name: string;
  estimated_delivery_date: string;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
  payment?: PaymentInfo | null;
  status_history: OrderStatusHistory[];
}

export interface TimelineMilestone {
  status: string;
  label: string;
  description: string;
  date: string | null;
  time: string | null;
  isCompleted: boolean;
  isCurrent: boolean;
  updatedBy?: string;
  state?: 'Pending';
}

export interface TrackingData {
  orderId: string;
  orderNumber: string;
  trackingId: string;
  currentStatus: string;
  courierName: string;
  estimatedDelivery: string;
  orderDate: string;
  customerName: string;
  shippingAddress: ShippingAddress;
  items: OrderItem[];
  grandTotal: number;
  timeline: TimelineMilestone[];
  rawHistory: OrderStatusHistory[];
  supportWhatsAppUrl: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
}

export interface Address {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  address_line1: string;
  address_line2?: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  is_default: number;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id?: string;
  order_id?: string;
  title: string;
  message: string;
  type: string;
  is_read: number;
  created_at: string;
}

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  name: string;
  role: string;
  last_login?: string;
}

export interface Coupon {
  id: string;
  code: string;
  discount_type: 'percentage' | 'flat';
  discount_value: number;
  min_spend: number;
  max_discount?: number | null;
  is_active: number;
  usage_count: number;
  expiry_date: string;
}

export interface AdminStats {
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  customersCount: number;
  productsCount: number;
  lowStockCount: number;
  statusCounts: Record<string, number>;
  recentOrders: Order[];
}

export interface StoreInfo {
  brandName: string;
  tagline: string;
  phone: string;
  displayPhone: string;
  whatsappUrl: string;
  address: {
    road: string;
    district: string;
    city: string;
    state: string;
    country: string;
    pincode: string;
    formatted: string;
  };
  businessHours: {
    weekdays: string;
    sundays: string;
    timezone: string;
  };
  gstin: string;
  stateCode: string;
}
