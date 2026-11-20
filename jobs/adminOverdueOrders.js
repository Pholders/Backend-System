/**
 * Tells the admins about orders that have gone overdue (see
 * config/orderTracking.js for the limits). Runs on start and then every
 * 15 minutes. Notifications are deduplicated per order and status spell, so
 * an order that stays overdue is announced once, not every run.
 */

const AdminRecords = require('../models/AdminRecords');
const adminNotifications = require('../services/adminNotifications');

const INTERVAL_MINUTES = 15;
let intervalId = null;
let running = false;

async function runOnce() {
  if (running) return 0; // a slow run must not overlap the next
  running = true;
  try {
    const rows = await AdminRecords.overdueOrders();
    let created = 0;
    for (const row of rows) {
      if (await adminNotifications.orderOverdue(row)) created += 1;
    }
    if (created) console.log(`🔔 ${created} overdue order notification(s) for admins`);
    return created;
  } catch (error) {
    console.error('Admin overdue orders job failed:', error.message);
    return 0;
  } finally {
    running = false;
  }
}

function start() {
  if (intervalId) return;
  runOnce();
  intervalId = setInterval(runOnce, INTERVAL_MINUTES * 60 * 1000);
  console.log(`✅ Admin overdue orders job started (every ${INTERVAL_MINUTES} minutes)`);
}

function stop() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

module.exports = { start, stop, runOnce };
