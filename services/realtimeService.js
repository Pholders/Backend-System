/**
 * Realtime Service (Socket.IO)
 *
 * Provides a single chokepoint for emitting real-time events to authenticated
 * patient and pharmacy clients. Use Firebase Cloud Messaging for background
 * push notifications and this service for foreground/in-app live updates.
 *
 * Rooms:
 *   - patient:<id>   private to one patient
 *   - pharmacy:<id>  private to one pharmacy
 *
 * Auth handshake:
 *   Clients connect with `auth: { token }` (the same 7-day session token used
 *   for REST). We verify the JWT and check the session row, then join the
 *   appropriate room.
 *
 * Events emitted:
 *   - patient room:   'order:placed', 'order:updated', 'order:cancelled'
 *   - pharmacy room:  'order:incoming', 'order:cancelled'
 *
 * If Socket.IO is not initialized (e.g. tests, init failure) all emit helpers
 * become silent no-ops — they never throw.
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Session = require('../models/Session');

let io = null;

/**
 * Initialize Socket.IO on the given HTTP server. Call once at startup.
 */
function init(httpServer, { corsOrigin } = {}) {
  // Lazy-require so the project still boots if socket.io isn't installed.
  let Server;
  try {
    // eslint-disable-next-line global-require
    ({ Server } = require('socket.io'));
  } catch (err) {
    console.warn('⚠️  socket.io not installed — realtime updates disabled. Run `npm install socket.io`.');
    return null;
  }

  io = new Server(httpServer, {
    cors: {
      origin: corsOrigin || process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true,
    },
  });

  // Auth handshake — runs once per connection.
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth && socket.handshake.auth.token;
      if (!token) return next(new Error('No token provided'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Validate the session is still active (mirrors authMiddleware).
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const session = await Session.findByTokenHash(tokenHash);
      if (!session) return next(new Error('Session expired or revoked'));

      socket.user = decoded;
      return next();
    } catch (err) {
      return next(new Error(`Auth failed: ${err.message}`));
    }
  });

  io.on('connection', (socket) => {
    const { id, role } = socket.user || {};
    if (!id || !role) {
      socket.disconnect(true);
      return;
    }

    if (role === 'patient') {
      socket.join(`patient:${id}`);
    } else if (role === 'pharmacy') {
      socket.join(`pharmacy:${id}`);
    } else {
      // Other roles (admin, doctor) — connect but no room. They can be added later.
    }

    socket.emit('connected', { role, id });

    socket.on('disconnect', () => {
      // No-op for now. Hook for presence tracking later.
    });
  });

  console.log('✅ Socket.IO initialized');
  return io;
}

function getIO() {
  return io;
}

// ---- emit helpers (silent if io not initialized) ----

function emitToPatient(patientId, event, payload) {
  if (!io || !patientId) return;
  io.to(`patient:${patientId}`).emit(event, payload);
}

function emitToPharmacy(pharmacyId, event, payload) {
  if (!io || !pharmacyId) return;
  io.to(`pharmacy:${pharmacyId}`).emit(event, payload);
}

/**
 * Convenience: order events. Always pushes to both patient and pharmacy rooms.
 */
function emitOrderEvent(event, { order, ...extra }) {
  if (!order) return;
  const payload = { order, ...extra, emittedAt: new Date().toISOString() };
  emitToPatient(order.patient_id, event, payload);
  emitToPharmacy(order.pharmacy_id, event, payload);
}

module.exports = {
  init,
  getIO,
  emitToPatient,
  emitToPharmacy,
  emitOrderEvent,
};
