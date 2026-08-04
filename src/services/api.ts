import {
  Product,
  Category,
  Order,
  TrackingData,
  User,
  Address,
  Notification,
  AdminUser,
  AdminStats,
  Coupon,
  InventoryItem,
  StoreInfo
} from '../types';
import { STORAGE_KEYS, StorageKey, readStorage } from '../utils/storage';

const API_BASE = '/api';

async function apiFetch<T>(
  endpoint: string,
  options: RequestInit,
  tokenKey: StorageKey,
  errorFallback: string
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const token = readStorage(tokenKey);
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || errorFallback);
  }

  return data as T;
}

// Customer-scoped request
function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  return apiFetch<T>(endpoint, options, STORAGE_KEYS.userToken, 'An unexpected error occurred');
}

// Admin-scoped request
function adminRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  return apiFetch<T>(endpoint, options, STORAGE_KEYS.adminToken, 'An unexpected error occurred in Admin request');
}

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== false && value !== '') {
      query.append(key, String(value));
    }
  });
  return query.toString();
}

export const api = {
  // Store info
  getStoreInfo: () => request<StoreInfo>('/store-info'),

  // Products & Categories
  getCategories: () => request<Category[]>('/products/categories'),
  getProducts: (params: {
    category?: string;
    search?: string;
    minPrice?: number;
    maxPrice?: number;
    fabric?: string;
    color?: string;
    sort?: string;
    featured?: boolean;
    newArrival?: boolean;
  } = {}) => request<Product[]>(`/products?${buildQuery(params)}`),
  getProductByIdOrSlug: (idOrSlug: string) => request<Product>(`/products/${idOrSlug}`),
  submitProductReview: (productId: string, data: { userName: string; rating: number; comment: string }) =>
    request<any>(`/products/${productId}/reviews`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  // Orders & Tracking
  createOrder: (orderPayload: {
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    shippingAddress: any;
    items: any[];
    paymentMethod: string;
    couponCode?: string | null;
    userId?: string;
  }) =>
    request<{ order: Order; invoiceNumber: string; paymentReceipt: any }>('/orders', {
      method: 'POST',
      body: JSON.stringify(orderPayload)
    }),
  getOrder: (idOrNumber: string) => request<Order>(`/orders/${idOrNumber}`),
  trackOrder: (trackingIdOrNumber: string) => request<TrackingData>(`/orders/track/${encodeURIComponent(trackingIdOrNumber)}`),
  getUserOrders: () => request<Order[]>('/orders/user/my-orders'),

  // Coupons
  validateCoupon: (code: string, subtotal: number) =>
    request<{ valid: boolean; code: string; discountType: string; discountValue: number; discountAmount: number; message: string }>(
      '/auth/coupons/validate',
      {
        method: 'POST',
        body: JSON.stringify({ code, subtotal })
      }
    ),

  // Customer Auth & Profile
  customerRegister: (userData: { name: string; email: string; phone?: string; password: string }) =>
    request<{ token: string; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    }),
  customerLogin: (credentials: { email: string; password: string }) =>
    request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    }),
  getProfile: () =>
    request<{ user: User; addresses: Address[]; notifications: Notification[] }>('/auth/me'),
  addAddress: (addressData: any) =>
    request<Address[]>('/auth/addresses', {
      method: 'POST',
      body: JSON.stringify(addressData)
    }),
  deleteAddress: (id: string) =>
    request<Address[]>(`/auth/addresses/${id}`, {
      method: 'DELETE'
    }),
  markNotificationRead: (id: string) =>
    request<{ message: string }>(`/auth/notifications/${id}/read`, {
      method: 'PATCH'
    }),

  // Admin APIs
  adminLogin: (credentials: { username: string; password: string }) =>
    adminRequest<{ token: string; admin: AdminUser }>('/admin/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    }),
  getAdminStats: () => adminRequest<AdminStats>('/admin/stats'),
  getAdminOrders: (params: { status?: string; search?: string } = {}) =>
    adminRequest<Order[]>(`/admin/orders?${buildQuery(params)}`),
  updateOrderStatus: (orderId: string, data: { status: string; notes?: string; courierName?: string; trackingId?: string; estimatedDeliveryDate?: string }) =>
    adminRequest<{ success: boolean; message: string; serverTimestamp: any; order: Order }>(
      `/admin/orders/${orderId}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify(data)
      }
    ),
  updateEstimatedDeliveryDate: (orderId: string, data: { estimatedDeliveryDate: string; notes?: string }) =>
    adminRequest<{ success: boolean; message: string; order: Order }>(
      `/admin/orders/${orderId}/delivery-date`,
      {
        method: 'PATCH',
        body: JSON.stringify(data)
      }
    ),
  getAdminAnalytics: () =>
    adminRequest<{
      totalRevenue: number;
      totalOrders: number;
      avgOrderValue: number;
      paymentMethods: Record<string, { count: number; total: number }>;
      topProducts: Array<{ id: string; title: string; count: number; revenue: number; image: string }>;
      statusCounts: Record<string, number>;
      totalCatalogProducts: number;
    }>('/admin/analytics'),
  createProduct: (productData: any) =>
    adminRequest<{ id: string; slug: string; message: string }>('/admin/products', {
      method: 'POST',
      body: JSON.stringify(productData)
    }),
  updateProduct: (id: string, productData: any) =>
    adminRequest<{ message: string }>(`/admin/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(productData)
    }),
  deleteProduct: (id: string) =>
    adminRequest<{ message: string }>(`/admin/products/${id}`, {
      method: 'DELETE'
    }),
  getAdminCustomers: () => adminRequest<any[]>('/admin/customers'),
  getAdminCoupons: () => adminRequest<Coupon[]>('/admin/coupons'),
  createAdminCoupon: (couponData: any) =>
    adminRequest<{ id: string; message: string }>('/admin/coupons', {
      method: 'POST',
      body: JSON.stringify(couponData)
    }),
  toggleAdminCoupon: (id: string) =>
    adminRequest<{ message: string }>(`/admin/coupons/${id}/toggle`, {
      method: 'PATCH'
    }),
  getAdminInventory: () => adminRequest<InventoryItem[]>('/admin/inventory'),
  restockInventory: (id: string, quantity: number) =>
    adminRequest<{ message: string }>(`/admin/inventory/${id}/restock`, {
      method: 'PATCH',
      body: JSON.stringify({ quantity })
    })
};
