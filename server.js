const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
require('dotenv').config();
const { pool } = require('./config/db');
const cache = require('./services/cacheService');
const AppointmentCleanupService = require('./services/appointmentCleanupService');
const logger = require('./services/loggerService');
const ResponseFormatter = require('./utils/responseFormatter');

// Import centralized middleware
const {
  errorHandler,
  notFoundHandler,
  requestLogger,
  asyncHandler
} = require('./middleware/errorHandler');

// Import routes
const userRoutes = require('./routes/userRoutes');
const prescriptionRoutes = require('./routes/prescriptionRoutes');
const { initializeDatabase } = require('./config/initDb');

// Import Passport config
require('./config/passport');

// Import scheduled notification triggers
const notificationTriggers = require('./jobs/notificationTriggers');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================================
// MIDDLEWARE CONFIGURATION
// ============================================================================

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging (must be early)
app.use(requestLogger);

// Session middleware (required for Passport)
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// ============================================================================
// API ROUTES
// ============================================================================

app.use('/api/users', userRoutes);
app.use('/api/prescriptions', prescriptionRoutes);

// ============================================================================
// UTILITY ENDPOINTS
// ============================================================================

// Test database connection endpoint
app.get('/api/test-db', asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT NOW()');
  logger.success('Database connection test successful');
  res.json(ResponseFormatter.success(
    { timestamp: result.rows[0].now },
    'Database connection successful'
  ));
}));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    statusCode: 200,
    message: 'Server is running',
    data: {
      status: 'OK',
      cache: cache.isAvailable() ? 'connected' : 'unavailable',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    }
  });
});

// Cache stats endpoint
app.get('/api/cache-stats', asyncHandler(async (req, res) => {
  const stats = await cache.stats();
  res.json(ResponseFormatter.success(stats, 'Cache statistics retrieved'));
}));

// System logs endpoint (admin only - for development/monitoring)
app.get('/api/system/logs', (req, res) => {
  if (process.env.NODE_ENV === 'production' && !req.user?.isAdmin) {
    return res.status(403).json(ResponseFormatter.forbidden('Access denied'));
  }

  const lines = parseInt(req.query.lines) || 100;
  const logs = logger.getLogs(null, 'app', lines);
  res.json(ResponseFormatter.success(logs, 'Logs retrieved'));
});

// ============================================================================
// 404 Handler (must be before error handler)
// ============================================================================

app.use(notFoundHandler);

// ============================================================================
// GLOBAL ERROR HANDLER (must be last)
// ============================================================================

app.use(errorHandler);

// ============================================================================
// SERVER INITIALIZATION
// ============================================================================

// Start server
async function startServer() {
  try {
    // Initialize database tables
    await initializeDatabase();

    // Initialize Redis cache
    await cache.initialize();
    
    // Start appointment cleanup service (auto-cancel expired pending payments)
    // Runs every 15 minutes, cancels payments pending for more than 30 minutes
    AppointmentCleanupService.start(15, 30);
    
    app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
      console.log(`📍 Cache stats: http://localhost:${PORT}/api/cache-stats`);
      console.log(`📍 Database test: http://localhost:${PORT}/api/test-db`);
      console.log(`📍 User signup: http://localhost:${PORT}/api/users/signup`);
      console.log(`📍 User login: http://localhost:${PORT}/api/users/login`);
      console.log(`📍 Notifications: http://localhost:${PORT}/api/notifications`);

      // Start scheduled notification triggers (medication + appointment).
      try {
        notificationTriggers.start();
      } catch (err) {
        console.error('Failed to start notification triggers:', err.message);
      }
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  pool.end(() => {
    console.log('Database pool closed');
  });
});
