export const STORAGE_KEYS = {
  userToken: 'royals_user_token',
  adminToken: 'royals_admin_token',
  adminUser: 'royals_admin_user',
  cartItems: 'royals_cart_items',
  appliedCoupon: 'royals_applied_coupon',
  wishlist: 'royals_wishlist'
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

export function readStorage(key: StorageKey): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: StorageKey, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    console.error(`Failed to persist ${key}:`, err);
  }
}

export function removeStorage(...keys: StorageKey[]): void {
  try {
    keys.forEach((key) => localStorage.removeItem(key));
  } catch {
    // storage unavailable
  }
}

export function readJson<T>(key: StorageKey, fallback: T): T {
  const raw = readStorage(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(key: StorageKey, value: unknown): void {
  writeStorage(key, JSON.stringify(value));
}
