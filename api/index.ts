/**
 * api/index.ts
 *
 * Vercel serverless entry point.
 *
 * Vercel routes every /api/* request here via vercel.json.
 * We export the Express app as the default handler — no app.listen() call.
 * The same Express router logic that works in local dev works on Vercel,
 * just invoked by the Vercel runtime instead of Node's http.createServer.
 */

// Load .env for local development.
// On Vercel, environment variables are injected by the platform — this is a no-op.
import { config as loadEnv } from 'dotenv';
loadEnv();

import express from 'express';
import multer from 'multer';
import productsRouter from '../server/routes/products.js';
import ordersRouter from '../server/routes/orders.js';
import adminRouter from '../server/routes/admin.js';
import authRouter from '../server/routes/auth.js';
import imagesRouter from '../server/routes/images.js';
import bannersRouter from '../server/routes/banners.js';
import categoriesRouter from '../server/routes/categories.js';

const app = express();

// ── Body parsers ─────────────────────────────────────────────────────────
// Generous JSON limit for base64 previews; Cloudinary handles actual binaries.
app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true, limit: '12mb' }));

// ── CORS — allow the Vercel frontend origin ───────────────────────────────
app.use((req, res, next) => {
  const origin = req.headers.origin as string | undefined;
  // Allow same-origin requests and any *.vercel.app subdomain
  if (!origin || origin.includes('.vercel.app') || origin.includes('localhost')) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

// ── Health check ─────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'ROYALS Luxury Couture API',
    database: 'Supabase PostgreSQL',
    storage: 'Cloudinary',
    timestamp: new Date().toISOString()
  });
});

// ── Store info ────────────────────────────────────────────────────────────
app.get('/api/store-info', (_req, res) => {
  res.json({
    brandName: 'Lucknow Chikan Emporium',
    tagline: 'Heritage Chikankari & Luxury Indian Ethnic Wear',
    phone: '8000461784',
    displayPhone: '+91 8000461784',
    whatsappUrl: 'https://wa.me/918000461784',
    address: {
      road: '6, Lal Ji Tandon Marg (Khun Khun Ji Road)',
      district: 'Opposite Munnu Lal Dharamshala, Near Domino\'s Pizza',
      city: 'Lucknow',
      state: 'Uttar Pradesh',
      country: 'India',
      pincode: '226003',
      formatted: '6, Lal Ji Tandon Marg (Khun Khun Ji Road), Opposite Munnu Lal Dharamshala, Near Domino\'s Pizza, Chowk, Lucknow, Uttar Pradesh – 226003, India'
    },
    businessHours: {
      weekdays: '10:00 AM - 8:30 PM IST',
      sundays: '11:00 AM - 7:00 PM IST',
      timezone: 'Asia/Kolkata (IST)'
    },
    gstin: '09AAACR8942K1Z3',
    stateCode: '09 - Uttar Pradesh'
  });
});

// ── API Routes ────────────────────────────────────────────────────────────
app.use('/api/products', productsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/admin', adminRouter);
app.use('/api/auth', authRouter);
app.use('/api/images', imagesRouter);
app.use('/api/banners', bannersRouter);
app.use('/api/categories', categoriesRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'IMAGE_TOO_LARGE', message: 'Image exceeds the maximum allowed size of 4 MB.' });
    }
    return res.status(400).json({ error: 'MULTIPART_UPLOAD_ERROR', message: err.message });
  }
  if (err instanceof Error && (err.message.includes('Only JPEG') || err.message.includes('multipart'))) {
    return res.status(400).json({ error: 'INVALID_IMAGE_UPLOAD', message: err.message });
  }
  next(err);
});

// ── 404 fallback for unmatched /api/* ─────────────────────────────────────
app.use('/api/*', (_req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Export the Express app as a Vercel serverless handler.
// Vercel calls this function directly — never app.listen().
export default app;
