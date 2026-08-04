import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { getDb } from './server/db.js';
import productsRouter from './server/routes/products.js';
import ordersRouter from './server/routes/orders.js';
import adminRouter from './server/routes/admin.js';
import authRouter from './server/routes/auth.js';
import { apiNotFoundHandler, errorHandler } from './server/errors.js';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Body parser
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Initialize and verify database on boot. A broken database means every request
  // would fail, so refuse to start rather than serving a degraded API.
  await getDb();
  console.log('ROYALS SQLite Relational Database Initialized & Synced');

  // Store information API endpoint
  app.get('/api/store-info', (req, res) => {
    res.json({
      brandName: 'ROYALS',
      tagline: 'Haute Couture & Heritage Indian Ethnic Wear',
      phone: '8000461784',
      displayPhone: '+91 8000461784',
      whatsappUrl: 'https://wa.me/918000461784',
      address: {
        road: 'Road No. 6',
        district: 'District Chaksu',
        city: 'Jaipur',
        state: 'Rajasthan',
        country: 'India',
        pincode: '303901',
        formatted: 'Road No. 6, District Chaksu, Jaipur, Rajasthan, India'
      },
      businessHours: {
        weekdays: '10:00 AM - 8:30 PM IST',
        sundays: '11:00 AM - 7:00 PM IST',
        timezone: 'Asia/Kolkata (IST)'
      },
      gstin: '08AAACR8942K1Z5',
      stateCode: '08 - Rajasthan'
    });
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'ROYALS Luxury Couture API', timestamp: new Date().toISOString() });
  });

  // API Routes
  app.use('/api/products', productsRouter);
  app.use('/api/orders', ordersRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/auth', authRouter);

  // Unknown API routes must not fall through to the SPA handler
  app.use('/api', apiNotFoundHandler);

  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
      res.sendFile(path.join(distPath, 'index.html'), (err) => {
        if (err) next(err);
      });
    });
  }

  app.use(errorHandler);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ROYALS Luxury Fashion server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start ROYALS server:', err);
  process.exit(1);
});
