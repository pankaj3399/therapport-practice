import dotenv from 'dotenv';
// Load environment variables first
dotenv.config();

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import authRoutes from './routes/auth.routes';
import practitionerRoutes from './routes/practitioner.routes';
import adminRoutes from './routes/admin.routes';
import cronRoutes from './routes/cron.routes';
import { errorHandler } from './middleware/error.middleware';
import cron from 'node-cron';
import { cronController } from './controllers/cron.controller';
const app = express();
const PORT = process.env.PORT || 3000;

// Test database connection on startup
(async () => {
  try {
    const { Pool } = await import('pg');
    const testPool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
    await testPool.query('SELECT NOW()');
    await testPool.end();
    console.log('✅ Database connection verified');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
  }
})();

// Middleware
// CORS - Allow all origins for now (TODO: restrict in production)
// Note: When using origin: '*', credentials must be false
app.use(
  cors({
    origin: '*', // Allow all origins
    credentials: false, // Must be false when origin is '*'
  })
);
// Alternative: Use default CORS (allows all origins, no credentials)
// app.use(cors());

// HTTP request logger
app.use(
  morgan(
    process.env.NODE_ENV === 'production'
      ? 'combined' // Apache combined log format for production
      : 'dev' // Colored output for development
  )
);

app.use(express.json({ limit: '10mb' })); // Increased limit for base64 image uploads
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    database: 'unknown',
  };

  // Check database connection
  try {
    const { Pool } = await import('pg');
    const testPool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
    await testPool.query('SELECT NOW()');
    await testPool.end();
    health.database = 'connected';
  } catch (error) {
    health.database = 'disconnected';
    health.status = 'degraded';
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/practitioner', practitionerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/cron', cronRoutes);

// Error handling
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 CORS enabled for: all origins (*)`);
});

// Setup node-cron for Linux servers (only if not on Vercel)
// Vercel uses its own cron system via vercel.json
// Note: node-cron is optional - install with: npm install node-cron @types/node-cron
if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
  (async () => {
    try {
      // Schedule reminder processing every day at midnight
      cron.schedule('0 0 * * *', async () => {
        try {
          const result = await cronController.processRemindersInternal();
          console.log('✅ Cron job executed successfully:', {
            processed: result.processed,
            failed: result.failed,
            total: result.total,
          });
        } catch (error) {
          console.error('❌ Cron job error:', error);
        }
      });

      console.log('✅ node-cron scheduled for reminder processing (daily at midnight)');
    } catch (error) {
      console.error('❌ Failed to setup node-cron:', error);
    }
  })();
}

export default app;
