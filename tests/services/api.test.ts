import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {api} from '../../src/services/api';

const store = new Map<string, string>();

const localStorageStub = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key),
  clear: () => store.clear()
};

let fetchMock: ReturnType<typeof vi.fn>;

function respondWith(body: unknown, init: {ok?: boolean; status?: number} = {}) {
  fetchMock.mockResolvedValue({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body
  });
}

function lastCall() {
  const [url, options] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
  return {url, options, headers: new Headers(options?.headers)};
}

beforeEach(() => {
  store.clear();
  vi.stubGlobal('localStorage', localStorageStub);
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  respondWith({});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('customer request helper', () => {
  it('prefixes /api, defaults to JSON and returns the parsed body', async () => {
    respondWith({brandName: 'ROYALS'});

    await expect(api.getStoreInfo()).resolves.toEqual({brandName: 'ROYALS'});
    const {url, headers} = lastCall();
    expect(url).toBe('/api/store-info');
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it('attaches the stored customer token as a bearer header', async () => {
    store.set('royals_user_token', 'user-token');

    await api.getProfile();

    expect(lastCall().headers.get('Authorization')).toBe('Bearer user-token');
  });

  it('omits the Authorization header when no customer is signed in', async () => {
    await api.getProfile();
    expect(lastCall().headers.has('Authorization')).toBe(false);
  });

  it('surfaces the server error message', async () => {
    respondWith({error: 'Invalid email or password'}, {ok: false, status: 401});

    await expect(api.customerLogin({email: 'a@b.com', password: 'nope'})).rejects.toThrow(
      'Invalid email or password'
    );
  });

  it('falls back to a generic message when the error body has no message', async () => {
    respondWith({}, {ok: false, status: 500});

    await expect(api.getProfile()).rejects.toThrow('An unexpected error occurred');
  });
});

describe('admin request helper', () => {
  it('attaches the stored admin token', async () => {
    store.set('royals_admin_token', 'admin-token');
    store.set('royals_user_token', 'user-token');

    await api.getAdminStats();

    expect(lastCall().headers.get('Authorization')).toBe('Bearer admin-token');
  });

  it('reports admin-specific fallback errors', async () => {
    respondWith({}, {ok: false, status: 403});

    await expect(api.getAdminStats()).rejects.toThrow('An unexpected error occurred in Admin request');
  });
});

describe('product queries', () => {
  it('requests products without filters as an empty query string', async () => {
    respondWith([]);
    await api.getProducts();
    expect(lastCall().url).toBe('/api/products?');
  });

  it('serialises every supported filter', async () => {
    respondWith([]);

    await api.getProducts({
      category: 'cat_mens_kurtas',
      search: 'raw silk',
      minPrice: 10000,
      maxPrice: 50000,
      fabric: 'Chanderi',
      color: 'Emerald',
      sort: 'price-asc',
      featured: true,
      newArrival: true
    });

    const params = new URLSearchParams(lastCall().url.split('?')[1]);
    expect(Object.fromEntries(params)).toEqual({
      category: 'cat_mens_kurtas',
      search: 'raw silk',
      minPrice: '10000',
      maxPrice: '50000',
      fabric: 'Chanderi',
      color: 'Emerald',
      sort: 'price-asc',
      featured: 'true',
      newArrival: 'true'
    });
  });

  it('omits falsy filters, including a zero minimum price', async () => {
    respondWith([]);
    await api.getProducts({minPrice: 0, featured: false, search: ''});
    expect(lastCall().url).toBe('/api/products?');
  });

  it('fetches a single product by id or slug', async () => {
    respondWith({id: 'prod_1'});
    await api.getProductByIdOrSlug('maharaja-ivory-raw-silk-kurta-pajama-set');
    expect(lastCall().url).toBe('/api/products/maharaja-ivory-raw-silk-kurta-pajama-set');
  });

  it('posts a review as JSON', async () => {
    respondWith({id: 'rev_1'});
    await api.submitProductReview('prod_1', {userName: 'Meera', rating: 5, comment: 'Exquisite'});

    const {url, options} = lastCall();
    expect(url).toBe('/api/products/prod_1/reviews');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body as string)).toEqual({userName: 'Meera', rating: 5, comment: 'Exquisite'});
  });
});

describe('order queries', () => {
  it('posts the checkout payload', async () => {
    respondWith({order: {}});
    const payload = {
      customerName: 'Princess Gayatri',
      customerEmail: 'customer@royals.com',
      customerPhone: '8000461784',
      shippingAddress: {city: 'Jaipur'},
      items: [{productId: 'prod_1', quantity: 1, price: 1000}],
      paymentMethod: 'UPI'
    };

    await api.createOrder(payload);

    const {url, options} = lastCall();
    expect(url).toBe('/api/orders');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body as string)).toEqual(payload);
  });

  it('url-encodes the tracking reference', async () => {
    respondWith({});
    await api.trackOrder('RYL 2026/89421');
    expect(lastCall().url).toBe('/api/orders/track/RYL%202026%2F89421');
  });

  it('validates a coupon against a subtotal', async () => {
    respondWith({valid: true});
    await api.validateCoupon('ROYAL10', 40000);

    const {url, options} = lastCall();
    expect(url).toBe('/api/auth/coupons/validate');
    expect(JSON.parse(options.body as string)).toEqual({code: 'ROYAL10', subtotal: 40000});
  });
});

describe('admin mutations', () => {
  it('builds the admin order filter query', async () => {
    respondWith([]);
    await api.getAdminOrders({status: 'Shipped', search: '89421'});
    expect(lastCall().url).toBe('/api/admin/orders?status=Shipped&search=89421');

    await api.getAdminOrders();
    expect(lastCall().url).toBe('/api/admin/orders?');
  });

  it('patches an order status', async () => {
    respondWith({success: true});
    await api.updateOrderStatus('ord_1', {status: 'Shipped', trackingId: 'TRK-RYL-1'});

    const {url, options} = lastCall();
    expect(url).toBe('/api/admin/orders/ord_1/status');
    expect(options.method).toBe('PATCH');
    expect(JSON.parse(options.body as string)).toEqual({status: 'Shipped', trackingId: 'TRK-RYL-1'});
  });

  it('patches an estimated delivery date', async () => {
    respondWith({success: true});
    await api.updateEstimatedDeliveryDate('ord_1', {estimatedDeliveryDate: '20 Aug 2026'});
    expect(lastCall().url).toBe('/api/admin/orders/ord_1/delivery-date');
  });

  it.each([
    ['createProduct', () => api.createProduct({title: 'Kurta'}), '/api/admin/products', 'POST'],
    ['updateProduct', () => api.updateProduct('prod_1', {title: 'Kurta'}), '/api/admin/products/prod_1', 'PUT'],
    ['deleteProduct', () => api.deleteProduct('prod_1'), '/api/admin/products/prod_1', 'DELETE'],
    ['toggleAdminCoupon', () => api.toggleAdminCoupon('coup_1'), '/api/admin/coupons/coup_1/toggle', 'PATCH']
  ])('routes %s correctly', async (_name, call, expectedUrl, expectedMethod) => {
    respondWith({});
    await (call as () => Promise<unknown>)();

    const {url, options} = lastCall();
    expect(url).toBe(expectedUrl);
    expect(options.method).toBe(expectedMethod);
  });

  it('sends the restock quantity', async () => {
    respondWith({});
    await api.restockInventory('inv_1', 12);
    expect(JSON.parse(lastCall().options.body as string)).toEqual({quantity: 12});
  });

  it.each([
    ['getCategories', () => api.getCategories(), '/api/products/categories'],
    ['getOrder', () => api.getOrder('RYL-2026-89421'), '/api/orders/RYL-2026-89421'],
    ['getUserOrders', () => api.getUserOrders(), '/api/orders/user/my-orders'],
    ['getAdminAnalytics', () => api.getAdminAnalytics(), '/api/admin/analytics'],
    ['getAdminCustomers', () => api.getAdminCustomers(), '/api/admin/customers'],
    ['getAdminCoupons', () => api.getAdminCoupons(), '/api/admin/coupons'],
    ['getAdminInventory', () => api.getAdminInventory(), '/api/admin/inventory']
  ])('routes the %s read to its endpoint', async (_name, call, expectedUrl) => {
    respondWith([]);
    await (call as () => Promise<unknown>)();
    expect(lastCall().url).toBe(expectedUrl);
  });

  it.each([
    ['adminLogin', () => api.adminLogin({username: 'admin', password: 'Royals@2026'}), '/api/admin/login'],
    ['createAdminCoupon', () => api.createAdminCoupon({code: 'MONSOON25'}), '/api/admin/coupons'],
    ['customerRegister', () => api.customerRegister({name: 'Ira', email: 'ira@royals.com', password: 'x'}), '/api/auth/register'],
    ['addAddress', () => api.addAddress({city: 'Jaipur'}), '/api/auth/addresses']
  ])('posts %s to its endpoint', async (_name, call, expectedUrl) => {
    respondWith({});
    await (call as () => Promise<unknown>)();

    const {url, options} = lastCall();
    expect(url).toBe(expectedUrl);
    expect(options.method).toBe('POST');
    expect(options.body).toBeTypeOf('string');
  });

  it('deletes an address and marks a notification read', async () => {
    respondWith([]);
    await api.deleteAddress('addr_1');
    expect(lastCall()).toMatchObject({url: '/api/auth/addresses/addr_1'});
    expect(lastCall().options.method).toBe('DELETE');

    respondWith({message: 'ok'});
    await api.markNotificationRead('notif_1');
    expect(lastCall().url).toBe('/api/auth/notifications/notif_1/read');
    expect(lastCall().options.method).toBe('PATCH');
  });
});
