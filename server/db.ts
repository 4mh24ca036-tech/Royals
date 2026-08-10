/**
 * server/db.ts
 *
 * Supabase PostgreSQL client — replaces sql.js / SQLite entirely.
 *
 * Usage:
 *   import { getDb } from './db.js';
 *   const db = getDb();
 *   const { data, error } = await db.from('products').select('*');
 *
 * The service-role key is NEVER sent to the browser. It is only used
 * server-side (Vercel serverless functions / local dev via tsx).
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

export function getDb(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment variables.\n' +
      'Copy .env.example to .env and fill in your Supabase project credentials.'
    );
  }

  _client = createClient(url, key, {
    auth: {
      // Service role key — bypass RLS, server-side only
      autoRefreshToken: false,
      persistSession: false
    }
  });

  return _client;
}

/**
 * No-op compatibility shim.
 * SQLite required an explicit persistDb() after every write.
 * Supabase writes are immediately durable — this is a safe no-op.
 */
export function persistDb(): void {
  // intentionally empty — Supabase commits are immediate
}
