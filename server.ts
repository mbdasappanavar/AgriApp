import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { initializeSchema } from './server/db/schema';
import { seedDatabase } from './server/db/seed';

import authRoutes from './server/routes/auth';
import userRoutes from './server/routes/users';
import storeRoutes from './server/routes/stores';
import productRoutes from './server/routes/products';
import customerRoutes from './server/routes/customers';
import purchaseRoutes from './server/routes/purchases';
import posRoutes from './server/routes/pos';
import salesRoutes from './server/routes/sales';
import inventoryRoutes from './server/routes/inventory';
import cashRoutes from './server/routes/cash';
import expenseRoutes from './server/routes/expenses';
import gstRoutes from './server/routes/gst';
import reportRoutes from './server/routes/reports';
import auditRoutes from './server/routes/audit';
import backupRoutes from './server/routes/backup';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Body parser
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));

  // Initialize DB and Seed
  await initializeSchema();
  await seedDatabase();

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api', storeRoutes);
  app.use('/api/products', productRoutes);
  app.use('/api', customerRoutes);
  app.use('/api/purchases', purchaseRoutes);
  app.use('/api/pos', posRoutes);
  app.use('/api/sales', salesRoutes);
  app.use('/api/inventory', inventoryRoutes);
  app.use('/api/cash', cashRoutes);
  app.use('/api/expenses', expenseRoutes);
  app.use('/api/gst', gstRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api', auditRoutes);
  app.use('/api', backupRoutes);

  // Healthcheck endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', system: 'Agri Retail Management System', timestamp: new Date().toISOString() });
  });

  // Catch-all 404 for API endpoints (prevents falling through to Vite HTML middleware)
  app.use('/api/*', (req, res) => {
    res.status(404).json({ error: `API route not found: ${req.originalUrl}` });
  });

  // Global API error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Unhandled server error:", err);
    if (req.originalUrl.startsWith('/api')) {
      return res.status(500).json({ error: err.message || 'Internal server error' });
    }
    next(err);
  });

  // Vite middleware for development / Static files serving for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(`🌾 Agri Retail Management System backend running on http://0.0.0.0:${PORT}`);
    console.log(`=======================================================`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
