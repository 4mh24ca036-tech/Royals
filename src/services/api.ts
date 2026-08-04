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

const API_BASE = '/api';

/**
 * Error thrown for every failed API call, carrying the HTTP status so callers can
 * distinguish "not found", "session expired" and server failures.
 */
export class ApiError extends Error {
  status: number;
  endpoint: string;

  constructor(message: string, status: number, endpoint: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.endpoint = endpoint;
  }

  /** True when the request never reached the server (offline, DNS, aborted). */
  get isNetworkError(): boolean {
    return this.status === 0;
  }
}

async function send<T>(endpoint: string, options: RequestInit, token: string | null): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  } catch (err) {
    throw new ApiError(
      `Unable to reach the ROYALS server. Check your connection and try again. (${
        err instanceof Error ? err.message : String(err)
      })`,
      0,
      endpoint
    );
  }

  const rawBody = await response.text();
  let data: any = null;
  if (rawBody) {
    try {
      data = JSON.parse(rawBody);
    } catch {
      // A non-JSON body (proxy error page, HTML fallback) must not surface as a
      // confusing JSON parse error.
      throw new ApiError(
        response.ok
          ? 'The server returned an unreadable response.'
          : `Request failed with status ${response.status}.`,
        response.ok ? 500 : response.status,
        endpoint
      );
    }
  }

  if (!response.ok) {
    throw new ApiError(data?.error || `Request failed with status ${response.status}.`, response.status, endpoint);
  }

  return data as T;
}

// Helper for fetch with customer token
function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  return send<T>(endpoint, options, localStorage.getItem('royals_user_token'));
}

// Helper for admin request with admin token
function adminRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  return send<T>(endpoint, options, localStorage.getItem('royals_admin_token'));
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
  } = {}) => {
    const query = new URLSearchParams();
    if (params.category) query.append('category', params.category);
    if (params.search) query.append('search', params.search);
    if (params.minPrice) query.append('minPrice', params.minPrice.toString());
    if (params.maxPrice) query.append('maxPrice', params.maxPrice.toString());
    if (params.fabric) query.append('fabric', params.fabric);
    if (params.color) query.append('color', params.color);
    if (params.sort) query.append('sort', params.sort);
    if (params.featured) query.append('featured', 'true');
    if (params.newArrival) query.append('newArrival', 'true');

    return request<Product[]>(`/products?${query.toString()}`);
  },
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
  getAdminOrders: (params: { status?: string; search?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.status) query.append('status', params.status);
    if (params.search) query.append('search', params.search);
    return adminRequest<Order[]>(`/admin/orders?${query.toString()}`);
  },
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
