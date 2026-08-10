/**
 * server.ts
 *
 * LOCAL DEVELOPMENT ONLY.
 *
 * In production, Vercel routes /api/* directly to api/index.ts and serves
 * the Vite-built SPA from dist/. This file is never executed on Vercel.
 *
 * For local development: `npm run dev` runs this file via tsx, which:
 *   - Starts an Express server with Vite middleware for HMR
 *   - Serves the same API routes that Vercel will serve in production
 *   - Connects to the same Supabase instance (reads from .env)
 */

// Load .env FIRST — before any module that reads process.env
import { config as loadEnv } from 'dotenv';
loadEnv();

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

// Import the production API app — same logic used by Vercel.
// We re-use it here so local dev is byte-for-byte identical to production.
import apiApp from './api/index.js';

async function startDevServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3031;

  // ── Mount the API (Supabase + Cloudinary) ───────────────────────────────
  // All /api/* requests go through the same handler that Vercel will call.
  app.use(apiApp);

  // ── Serve uploaded files from public/uploads (legacy local images only) ─
  // NOTE: In production on Vercel, public/uploads does NOT persist.
  // New uploads always go to Cloudinary. This only serves static
  // catalog images that were committed to the repository.
  const uploadsPath = path.join(process.cwd(), 'public', 'uploads');
  app.use('/uploads', express.static(uploadsPath, {
    maxAge: '1d',
    fallthrough: true
  }));

  // ── Vite dev middleware (HMR, fast refresh) ─────────────────────────────
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa'
  });
  app.use(vite.middlewares);

  // ── Start listening ──────────────────────────────────────────────────────
  // app.listen() is intentionally ONLY called here in the dev server.
  // It is NEVER called inside api/index.ts (the Vercel handler).
  app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('  ✦  ROYALS Dev Server');
    console.log(`  ✦  Local:   http://localhost:${PORT}`);
    console.log('  ✦  DB:      Supabase PostgreSQL');
    console.log('  ✦  Storage: Cloudinary');
    console.log('');
  });
}

startDevServer().catch((err) => {
  console.error('Failed to start ROYALS dev server:', err);
  process.exit(1);
});
