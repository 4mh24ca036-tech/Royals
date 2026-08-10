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

// Helper for fetch with token
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  // Attach customer token if available
  const userToken = localStorage.getItem('royals_user_token');
  if (userToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${userToken}`);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'An unexpected error occurred');
  }

  return data as T;
}

// Helper for admin request with admin token
async function adminRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const adminToken = localStorage.getItem('royals_admin_token');
  if (adminToken) {
    headers.set('Authorization', `Bearer ${adminToken}`);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'An unexpected error occurred in Admin request');
  }

  return data as T;
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
  updateProductImages: (id: string, images: string[]) =>
    adminRequest<{ message: string; images: string[] }>(`/admin/products/${id}/images`, {
      method: 'PATCH',
      body: JSON.stringify({ images })
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
    }),

  // ── Product Image Management ──────────────────────────────────────────
  getProductImages: (productId: string) =>
    request<any[]>(`/images/product/${productId}`),

  uploadProductImages: (productId: string, files: File[]) => {
    const form = new FormData();
    files.forEach((f) => form.append('images', f));
    return adminRequest<{ success: boolean; message: string; images: any[] }>(
      `/images/upload/${productId}`,
      { method: 'POST', body: form }
    );
  },

  deleteProductImage: (imageId: string) =>
    adminRequest<{ success: boolean; message: string }>(`/images/${imageId}`, {
      method: 'DELETE'
    }),

  setProductImageCover: (imageId: string) =>
    adminRequest<{ success: boolean; message: string; images: any[] }>(
      `/images/${imageId}/cover`,
      { method: 'PATCH' }
    ),

  reorderProductImages: (productId: string, order: string[]) =>
    adminRequest<{ success: boolean; message: string; images: any[] }>(
      `/images/reorder/${productId}`,
      { method: 'PATCH', body: JSON.stringify({ order }) }
    ),

  replaceProductImage: (imageId: string, file: File) => {
    const form = new FormData();
    form.append('image', file);
    return adminRequest<{ success: boolean; message: string; image: any }>(
      `/images/${imageId}`,
      { method: 'PATCH', body: form }
    );
  },

  // ── Banner Management ─────────────────────────────────────────────────────
  // Public: fetches only active banners (used by HeroCarousel)
  getBanners: () => request<any[]>('/banners'),

  // Admin: fetches all banners including inactive
  getAdminBanners: () => adminRequest<any[]>('/banners/all'),

  createBanner: (formData: FormData) =>
    adminRequest<{ success: boolean; banner: any }>('/banners', {
      method: 'POST',
      body: formData
    }),

  updateBanner: (id: string, formData: FormData) =>
    adminRequest<{ success: boolean; banner: any }>(`/banners/${id}`, {
      method: 'PUT',
      body: formData
    }),

  toggleBanner: (id: string) =>
    adminRequest<{ success: boolean; is_active: boolean; message: string }>(`/banners/${id}/toggle`, {
      method: 'PATCH'
    }),

  reorderBanners: (order: string[]) =>
    adminRequest<{ success: boolean; banners: any[] }>('/banners/reorder', {
      method: 'PATCH',
      body: JSON.stringify({ order })
    }),

  deleteBanner: (id: string) =>
    adminRequest<{ success: boolean; message: string }>(`/banners/${id}`, {
      method: 'DELETE'
    }),

  // ── Category Management ─────────────────────────────────────────────────────
  // Admin: fetches all categories including inactive
  getAdminCategories: () => adminRequest<any[]>('/categories/all'),

  createCategory: (formData: FormData) =>
    adminRequest<{ success: boolean; category: any }>('/categories', {
      method: 'POST',
      body: formData
    }),

  updateCategory: (id: string, formData: FormData) =>
    adminRequest<{ success: boolean; category: any }>(`/categories/${id}`, {
      method: 'PUT',
      body: formData
    }),

  toggleCategory: (id: string) =>
    adminRequest<{ success: boolean; category: any }>(`/categories/${id}/toggle`, {
      method: 'PATCH'
    }),

  reorderCategories: (order: string[]) =>
    adminRequest<{ success: boolean; categories: any[] }>('/categories/reorder', {
      method: 'PATCH',
      body: JSON.stringify({ order })
    }),

  deleteCategory: (id: string) =>
    adminRequest<{ success: boolean; message: string }>(`/categories/${id}`, {
      method: 'DELETE'
    })
};
