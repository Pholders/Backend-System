const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
require('dotenv').config();
const { pool } = require('./config/db');
const cache = require('./services/cacheService');
const AppointmentCleanupService = require('./services/appointmentCleanupService');
const ReminderSchedulerService = require('./services/reminderSchedulerService');
const ComplianceTrackingService = require('./services/complianceTrackingService');
const logger = require('./services/loggerService');
const ResponseFormatter = require('./utils/responseFormatter');
const realtimeService = require('./services/realtimeService');

// Import centralized middleware
const {
  errorHandler,
  notFoundHandler,
  requestLogger,
  asyncHandler
} = require('./middleware/errorHandler');

// Import routes
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const prescriptionRoutes = require('./routes/prescriptionRoutes');
const medicationRoutes = require('./routes/medicationRoutes');
const medicalHistoryRoutes = require('./routes/medicalHistoryRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const orderRoutes = require('./routes/orderRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const profileRoutes = require('./routes/profileRoutes');
const legalRoutes = require('./routes/legalRoutes');
const supportRoutes = require('./routes/supportRoutes');
const checklistRoutes = require('./routes/checklistRoutes');
const { initializeDatabase } = require('./config/initDb');

// Import Passport config
require('./config/passport');

// Import Swagger config
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./config/swagger');

// Import scheduled notification triggers
const notificationTriggers = require('./jobs/notificationTriggers');
const adminOverdueOrders = require('./jobs/adminOverdueOrders');
const medicationReminders = require('./jobs/medicationReminders');

const app = express();
const PORT = process.env.PORT || 3000;

// Render terminates TLS at its proxy and forwards plain HTTP, so without this
// req.protocol reads "http". Every URL built from it — doctor profile images,
// patient avatars, medical aid download links — then comes out as http:// on
// a host that only serves HTTPS. The browser refuses to load it as a
// subresource, and the 301 to HTTPS it gets instead never helps.
//
// One proxy sits in front of the app, hence 1. This also makes req.ip the
// real client address rather than the proxy's, which the audit log and the
// checklist rate limit both want.
app.set('trust proxy', 1);

// ============================================================================
// MIDDLEWARE CONFIGURATION
// ============================================================================

// The phase 1 testing checklist: the page and the results it records.
//
// The page is served from here rather than published as a Claude artifact,
// because an artifact runs under a CSP that blocks fetch to any other host,
// so it could never reach these endpoints. Served from the app, the page is
// same-origin, needs no account, and works for anyone holding the link.
//
// Both are mounted ahead of the global CORS policy and body parser, so the
// checklist keeps its own: the API router still allows any origin, which
// leaves the door open for a page hosted elsewhere later.
app.get('/checklist', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'checklist.html'));
});
app.use('/api/checklist', checklistRoutes);

// CORS configuration
// FRONTEND_URL and CORS_ORIGINS may each hold a comma-separated list, so the
// main app and the admin panel (often on separate domains) can both be let in.
// Trailing slashes are dropped because a browser's Origin header never has one.
const normalizeOrigin = (o) => o.trim().replace(/\/+$/, '');
const allowedOrigins = [process.env.FRONTEND_URL, process.env.CORS_ORIGINS]
  .filter(Boolean)
  .flatMap((v) => v.split(','))
  .map(normalizeOrigin)
  .filter(Boolean);

// Shared by the REST API and Socket.IO so both let in the same sites.
const checkOrigin = (origin, callback) => {
  if (!origin) {
    return callback(null, true);
  }

  const isLocalhost =
    origin.startsWith('http://localhost:') ||
    origin.startsWith('http://127.0.0.1:');

  const isProductionOrigin =
    allowedOrigins.includes(origin);

  if (isLocalhost || isProductionOrigin) {
    return callback(null, true);
  }

  console.warn(`CORS blocked: ${origin} (allowed: ${allowedOrigins.join(', ') || 'none'})`);
  return callback(new Error(`CORS blocked: ${origin}`));
};

app.use(cors({
  origin: checkOrigin,

  credentials: true,

  methods: [
    'GET',
    'HEAD',
    'PUT',
    'PATCH',
    'POST',
    'DELETE',
    'OPTIONS'
  ],

  allowedHeaders: [
    'Content-Type',
    'Authorization'
  ]
}));

// Body parsing
app.use(express.json({
  limit: '10mb',
  // Stripe signs the exact bytes it sent, so keep them for webhook verification
  verify: (req, res, buf) => {
    if (req.originalUrl.startsWith('/api/') && req.originalUrl.includes('/payments/webhook/stripe')) {
      req.rawBody = buf;
    }
  }
}));
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

// Swagger UI middleware
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs));

// ============================================================================
// API ROUTES
// ============================================================================

// Admin records (orders, payments, support, reviews, alerts...). Paths it
// doesn't match fall through to the admin routes in userRoutes.
app.use('/api/users/admin', adminRoutes);
app.use('/api/users', userRoutes);
app.use('/api/auth', userRoutes);
app.use('/api', bookingRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/medications', medicationRoutes);
app.use('/api/medical-history', medicalHistoryRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/inventory', inventoryRoutes);

// These three were written but never mounted, so every route in them 404'd.
// The prefixes are the ones their own controllers document. Most visibly this
// is what lets a patient record their medical aid at all — without it
// medical_aid_schemes could never be written, and a doctor search filtered by
// cover could never match anybody.
app.use('/api/profile', profileRoutes);
app.use('/api/legal', legalRoutes);
app.use('/api/support', supportRoutes);

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
    // Create raw HTTP server so Socket.IO can attach.
    const httpServer = http.createServer(app);

    // Initialize Socket.IO BEFORE listen so it's ready when clients connect.
    realtimeService.init(httpServer, {
      corsOrigin: checkOrigin,
    });

    // Bind the port FIRST. Render's port scan gives up if nothing is
    // listening in time, and the migrations below can take a while (or wait
    // on a table lock still held by the previous instance during a deploy).
    // Listening first keeps the deploy alive while they run; the tables
    // already exist in production, so early requests are served as normal.
    await new Promise((resolve, reject) => {
      httpServer.once('error', reject);
      httpServer.listen(PORT, resolve);
    });
    console.log(`🔌 Listening on port ${PORT}, running startup tasks...`);

    console.log('🔄 Startup: database initialization...');
    await initializeDatabase();

    console.log('🔄 Startup: Redis cache...');
    await cache.initialize();

    // Start appointment cleanup service (auto-cancel expired pending payments)
    // Runs every 15 minutes, cancels payments pending for more than 30 minutes
    AppointmentCleanupService.start(15, 30);

    // Initialize appointment reminder scheduler
    // Checks for due reminders every 5 minutes and sends notifications
    ReminderSchedulerService.initialize();

    // Initialize compliance tracking service
    // Monitors pharmacy performance and auto-suspends non-compliant agreements
    await ComplianceTrackingService.initialize();

    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`🌐 CORS allows localhost plus: ${allowedOrigins.join(', ') || 'none'}`);
    console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
    console.log(`📍 Cache stats: http://localhost:${PORT}/api/cache-stats`);
    console.log(`📍 Database test: http://localhost:${PORT}/api/test-db`);
    console.log(`📍 User signup: http://localhost:${PORT}/api/users/signup`);
    console.log(`📍 User login: http://localhost:${PORT}/api/users/login`);
    console.log(`📖 API Docs: http://localhost:${PORT}/api-docs`);
    console.log(`📍 Notifications: http://localhost:${PORT}/api/notifications`);
    console.log(`📍 Orders: http://localhost:${PORT}/api/orders`);
    console.log(`📍 Inventory: http://localhost:${PORT}/api/inventory`);
    console.log(`📍 Socket.IO: ws://localhost:${PORT}/socket.io/`);

    // Day-before appointment reminders (every 15 minutes, sent from 08:00).
    try {
      notificationTriggers.start();
    } catch (err) {
      console.error('Failed to start notification triggers:', err.message);
    }

    // Tell the admins about orders that have gone overdue (every 15 minutes).
    adminOverdueOrders.start();

    // Medication dose reminders, missed doses and adherence (every 5 minutes).
    medicationReminders.start();
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  
  // Stop reminder scheduler
  ReminderSchedulerService.stop();
  adminOverdueOrders.stop();
  medicationReminders.stop();
  notificationTriggers.stop();
  
  pool.end(() => {
    console.log('Database pool closed');
  });
});
