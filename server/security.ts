import { Request, Response, NextFunction } from 'express';

interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
}

interface Bucket {
  count: number;
  resetAt: number;
}

// In-process fixed-window limiter. Sufficient for the single-node deployment of this app;
// a shared store would be required if the API is ever scaled horizontally.
export function rateLimit({ windowMs, max, message }: RateLimitOptions) {
  const buckets = new Map<string, Bucket>();

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = req.ip || 'unknown';

    for (const [bucketKey, bucket] of buckets) {
      if (bucket.resetAt <= now) {
        buckets.delete(bucketKey);
      }
    }

    const existing = buckets.get(key);
    if (!existing || existing.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    existing.count++;
    if (existing.count > max) {
      res.setHeader('Retry-After', Math.ceil((existing.resetAt - now) / 1000));
      return res.status(429).json({ error: message || 'Too many requests. Please try again later.' });
    }

    next();
  };
}

export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
  next();
}

// Logs the underlying failure server-side and returns an opaque message so internal
// details (SQL text, file paths, stack traces) never reach API clients.
export function serverError(res: Response, context: string, err: unknown) {
  console.error(`[${context}]`, err);
  return res.status(500).json({ error: 'An internal error occurred. Please try again later.' });
}

export function sanitizeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) return null;
  return trimmed;
}

export function isValidEmail(value: unknown): value is string {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim()) && value.length <= 254;
}

export function isValidPhone(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9+\-\s()]{7,20}$/.test(value.trim());
}

export function isValidPincode(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9]{4,10}$/.test(value.trim());
}
