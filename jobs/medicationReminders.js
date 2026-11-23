/**
 * Medication reminders and adherence. Runs on start and then every 5 minutes:
 *   1. creates the upcoming dose rows from each active medication's schedule,
 *   2. sets medications whose course has ended to past,
 *   3. marks doses nobody logged within 2 hours as missed (updating adherence),
 *   4. sends one reminder per dose, reminder_time_window minutes before it.
 * See services/medicationDoseService.js for the rules.
 *
 * Uses a plain interval rather than node-cron, which is not installed.
 */

const doses = require('../services/medicationDoseService');
const notificationService = require('../services/notificationService');

const INTERVAL_MINUTES = 5;
let intervalId = null;
let running = false;

async function runOnce() {
  if (running) return null; // a slow run must not overlap the next
  running = true;
  try {
    const { created, missed, completed } = await doses.refreshDoses();
    const reminders = await doses.sendDueReminders(undefined, notificationService.sendToPatient);
    if (missed || completed || reminders.claimed) {
      console.log(
        `💊 Medication doses: ${created} created, ${missed} missed, ${completed} courses completed, ` +
        `${reminders.sent}/${reminders.claimed} reminders sent, ${reminders.failed} failed`
      );
    }
    return { created, missed, completed, ...reminders };
  } catch (error) {
    console.error('Medication reminders job failed:', error.message);
    return null;
  } finally {
    running = false;
  }
}

function start() {
  if (intervalId) return;
  runOnce();
  intervalId = setInterval(runOnce, INTERVAL_MINUTES * 60 * 1000);
  console.log(`✅ Medication reminders job started (every ${INTERVAL_MINUTES} minutes)`);
}

function stop() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

module.exports = { start, stop, runOnce };
