import dotenv from 'dotenv';
// Load environment variables first
dotenv.config();

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import authRoutes from './routes/auth.routes';
import { errorHandler } from './middleware/error.middleware';
import { db } from './config/database';

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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

export default app;
