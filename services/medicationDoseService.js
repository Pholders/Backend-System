/**
 * Medication doses: reminders and adherence.
 *
 * Every time in a medication's `schedule` ("08:00", "20:00", ...) becomes one
 * row in medication_doses per day of the course. A dose is
 *   pending  until it is logged or goes overdue,
 *   taken    when the patient logs it,
 *   skipped  when the patient says they deliberately did not take it,
 *   missed   when nobody logged it within MISSED_AFTER_MINUTES.
 *
 * Adherence = taken / (taken + skipped + missed). Pending doses are left out,
 * so a dose that is due right now does not drag the figure down before the
 * patient has had a chance to take it.
 *
 * Schedule times are South African wall-clock time; the database runs in UTC.
 *
 * Every function takes a `db` with a pg-style `query(text, params)` (the pool
 * by default) so callers and tests can run them inside a transaction.
 */

const { pool } = require('../config/db');

const ZONE = 'Africa/Johannesburg';
const MISSED_AFTER_MINUTES = 120;     // a pending dose this overdue counts as missed
const STALE_REMINDER_MINUTES = 30;    // don't send a reminder for a dose this far past due
const EARLIEST_LOG_MINUTES = 60;      // a dose can be logged at most this long before it is due
const BACKFILL_DAYS = 7;              // after downtime, recreate at most this many days of doses
const DEFAULT_REMINDER_WINDOW = 30;   // minutes before a dose, if the patient has no preferences row
const TRACKED_STATUSES = ['active', 'critical'];
const LOGGABLE_STATUSES = ['taken', 'skipped'];

const timeFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const dateFormat = new Intl.DateTimeFormat('en-CA', { timeZone: ZONE }); // YYYY-MM-DD

// ── pure helpers ─────────────────────────────────────────────────────────

function localTime(date) {
  return timeFormat.format(new Date(date));
}

function localDate(date = new Date()) {
  return dateFormat.format(new Date(date));
}

function reminderMessage({ name, dosage, scheduled_at: scheduledAt }) {
  const dose = dosage ? ` (${String(dosage).trim().slice(0, 60)})` : '';
  return {
    title: 'Medication Reminder',
    body: `Your ${localTime(scheduledAt)} dose of ${name}${dose} is due.`,
  };
}

// ── creating and resolving doses ─────────────────────────────────────────

/**
 * Create the dose rows for active medications from BACKFILL_DAYS ago up to
 * the end of tomorrow (local time). Idempotent: existing doses are kept.
 * Doses before the medication's dose_tracking_from are never created.
 */
async function generateDoses(db = pool, { patientId = null } = {}) {
  const result = await db.query(
    `INSERT INTO medication_doses (medication_id, patient_id, scheduled_at)
     SELECT m.id, m.patient_id, slot.scheduled_at
     FROM medications m
     CROSS JOIN LATERAL jsonb_array_elements_text(
       CASE WHEN jsonb_typeof(m.schedule) = 'array' THEN m.schedule ELSE '[]'::jsonb END
     ) AS t(time_text)
     CROSS JOIN LATERAL generate_series(
       GREATEST(
         m.start_date,
         (m.dose_tracking_from AT TIME ZONE $1)::date,
         (now() AT TIME ZONE $1)::date - $2::int
       )::timestamp,
       LEAST(m.end_date, (now() AT TIME ZONE $1)::date + 1)::timestamp,
       interval '1 day'
     ) AS day(local_day)
     CROSS JOIN LATERAL (
       SELECT CASE WHEN t.time_text ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
                   THEN (day.local_day::date + t.time_text::time) AT TIME ZONE $1
              END AS scheduled_at
     ) AS slot
     WHERE m.status = ANY($3::text[])
       AND slot.scheduled_at IS NOT NULL
       AND slot.scheduled_at >= m.dose_tracking_from
       AND ($4::int IS NULL OR m.patient_id = $4)
     ON CONFLICT (medication_id, scheduled_at) DO NOTHING`,
    [ZONE, BACKFILL_DAYS, TRACKED_STATUSES, patientId]
  );
  return result.rowCount;
}

/** Recalculate medications.adherence_percent for the given medications. */
async function recalculateAdherence(db = pool, medicationIds = []) {
  const ids = [...new Set(medicationIds)];
  if (!ids.length) return 0;
  const result = await db.query(
    `UPDATE medications m
     SET adherence_percent = COALESCE(s.percent, 0)
     FROM (
       SELECT id.medication_id,
              ROUND(
                100.0 * COUNT(d.id) FILTER (WHERE d.status = 'taken')
                / NULLIF(COUNT(d.id) FILTER (WHERE d.status <> 'pending'), 0)
              )::int AS percent
       FROM unnest($1::varchar[]) AS id(medication_id)
       LEFT JOIN medication_doses d ON d.medication_id = id.medication_id
       GROUP BY id.medication_id
     ) s
     WHERE m.id = s.medication_id`,
    [ids]
  );
  return result.rowCount;
}

/** Mark overdue pending doses as missed and refresh adherence for their medications. */
async function markMissedDoses(db = pool, { patientId = null } = {}) {
  const result = await db.query(
    `UPDATE medication_doses
     SET status = 'missed', updated_at = now()
     WHERE status = 'pending'
       AND scheduled_at < now() - make_interval(mins => $1)
       AND ($2::int IS NULL OR patient_id = $2)
     RETURNING medication_id`,
    [MISSED_AFTER_MINUTES, patientId]
  );
  await recalculateAdherence(db, result.rows.map((r) => r.medication_id));
  return result.rowCount;
}

/** Bring one patient's (or everyone's) doses up to date. */
async function refreshDoses(db = pool, { patientId = null } = {}) {
  const created = await generateDoses(db, { patientId });
  const missed = await markMissedDoses(db, { patientId });
  return { created, missed };
}

// ── reminders ────────────────────────────────────────────────────────────

/**
 * Claim the doses whose reminder is due: pending, not yet reminded, and
 * inside the patient's reminder window (reminder_time_window minutes before
 * the dose). Setting reminded_at in the same statement means two job runs, or
 * two server instances, can never send the same reminder twice.
 */
async function claimDueReminders(db = pool) {
  const result = await db.query(
    `WITH due AS (
       SELECT d.id
       FROM medication_doses d
       JOIN medications m ON m.id = d.medication_id
       LEFT JOIN notification_preferences np ON np.patient_id = d.patient_id
       WHERE d.status = 'pending'
         AND d.reminded_at IS NULL
         AND m.status = ANY($3::text[])
         AND d.scheduled_at <= now() + make_interval(mins => COALESCE(np.reminder_time_window, $1))
         AND d.scheduled_at >= now() - make_interval(mins => $2)
       FOR UPDATE OF d SKIP LOCKED
     )
     UPDATE medication_doses d
     SET reminded_at = now()
     FROM due, medications m
     WHERE d.id = due.id AND m.id = d.medication_id
     RETURNING d.id, d.patient_id, d.medication_id, d.scheduled_at, m.name, m.dosage`,
    [DEFAULT_REMINDER_WINDOW, STALE_REMINDER_MINUTES, TRACKED_STATUSES]
  );
  return result.rows;
}

/** Let a reminder be retried on the next run after a failed send. */
async function releaseReminder(db = pool, doseId) {
  await db.query(
    `UPDATE medication_doses SET reminded_at = NULL WHERE id = $1 AND status = 'pending'`,
    [doseId]
  );
}

/**
 * Send every due reminder. `send` is notificationService.sendToPatient,
 * which also honours the patient's medication_reminders preference.
 */
async function sendDueReminders(db = pool, send) {
  const doses = await claimDueReminders(db);
  let sent = 0;
  let failed = 0;
  for (const dose of doses) {
    try {
      const result = await send({
        patientId: dose.patient_id,
        type: 'medication',
        ...reminderMessage(dose),
        data: {
          action: 'medication_dose',
          doseId: dose.id,
          medicationId: dose.medication_id,
          scheduledAt: new Date(dose.scheduled_at).toISOString(),
        },
      });
      if (result && result.delivered) sent += 1;
    } catch (error) {
      failed += 1;
      console.error(`Medication reminder for dose ${dose.id} failed:`, error.message);
      await releaseReminder(db, dose.id).catch(() => {});
    }
  }
  return { claimed: doses.length, sent, failed };
}

// ── patient-facing reads and writes ──────────────────────────────────────

const DOSE_COLUMNS = `
  d.id, d.medication_id, m.name AS medication_name, m.dosage,
  d.scheduled_at, d.status, d.taken_at, d.reminded_at`;

/** A patient's doses for one local calendar day (YYYY-MM-DD). */
async function listDosesForDay(db = pool, patientId, day) {
  const result = await db.query(
    `SELECT ${DOSE_COLUMNS}
     FROM medication_doses d
     JOIN medications m ON m.id = d.medication_id
     WHERE d.patient_id = $1
       AND (d.scheduled_at AT TIME ZONE $2)::date = $3::date
     ORDER BY d.scheduled_at, m.name`,
    [patientId, ZONE, day]
  );
  return result.rows;
}

class DoseError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/**
 * Log a dose as taken or skipped. A dose can be logged from an hour before it
 * is due, and a missed dose can still be logged afterwards (the patient took
 * it but forgot to say). Changing between taken and skipped is allowed.
 */
async function recordDose(db = pool, { patientId, doseId, status, takenAt = null }) {
  if (!LOGGABLE_STATUSES.includes(status)) {
    throw new DoseError(400, 'VALIDATION_ERROR', 'Status must be taken or skipped.');
  }

  const found = await db.query(
    'SELECT id, patient_id, medication_id, scheduled_at FROM medication_doses WHERE id = $1',
    [doseId]
  );
  const dose = found.rows[0];
  if (!dose) throw new DoseError(404, 'NOT_FOUND', 'Dose not found.');
  if (dose.patient_id !== patientId) {
    throw new DoseError(403, 'FORBIDDEN', 'You do not have access to this dose.');
  }

  const now = Date.now();
  const scheduled = new Date(dose.scheduled_at).getTime();
  if (scheduled - now > EARLIEST_LOG_MINUTES * 60 * 1000) {
    throw new DoseError(409, 'DOSE_NOT_DUE', `A dose can be logged at most ${EARLIEST_LOG_MINUTES} minutes before it is due.`);
  }

  let takenTime = null;
  if (status === 'taken') {
    takenTime = takenAt ? new Date(takenAt) : new Date(now);
    if (Number.isNaN(takenTime.getTime())) {
      throw new DoseError(400, 'VALIDATION_ERROR', 'taken_at must be an ISO 8601 date-time.');
    }
    if (takenTime.getTime() > now + 60 * 1000) {
      throw new DoseError(400, 'VALIDATION_ERROR', 'taken_at must not be in the future.');
    }
    if (scheduled - takenTime.getTime() > EARLIEST_LOG_MINUTES * 60 * 1000) {
      throw new DoseError(400, 'VALIDATION_ERROR', `taken_at must be at most ${EARLIEST_LOG_MINUTES} minutes before the dose was due.`);
    }
  }

  await db.query(
    `UPDATE medication_doses
     SET status = $2, taken_at = $3, updated_at = now()
     WHERE id = $1`,
    [doseId, status, takenTime]
  );
  await recalculateAdherence(db, [dose.medication_id]);

  const result = await db.query(
    `SELECT ${DOSE_COLUMNS}, m.adherence_percent
     FROM medication_doses d
     JOIN medications m ON m.id = d.medication_id
     WHERE d.id = $1`,
    [doseId]
  );
  return result.rows[0];
}

// ── changing a medication's times ────────────────────────────────────────

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const MAX_TIMES_PER_DAY = 12;

/**
 * How many times a day the medication must be taken, or null when the
 * patient may choose. A medication from a prescription keeps the prescribed
 * count, so the patient changes when they take it but not how often.
 * `row` needs prescription_item_id, schedule and prescribed_frequency.
 */
function dosesPerDay(row) {
  if (row.prescription_item_id === null || row.prescription_item_id === undefined) return null;
  if (row.prescribed_frequency) {
    // Required lazily: prescriptionMedicationService does not depend on this file
    const { scheduleFromFrequency } = require('./prescriptionMedicationService');
    return scheduleFromFrequency(row.prescribed_frequency).length;
  }
  const schedule = Array.isArray(row.schedule) ? row.schedule : JSON.parse(row.schedule || '[]');
  return schedule.length;
}

/**
 * SQL for whether the patient can still change a medication's times: it is
 * tracked and its course hasn't ended (South African date). `m` is the
 * medications alias; $tz is the parameter holding ZONE, $statuses the one
 * holding TRACKED_STATUSES.
 */
const SCHEDULE_EDITABLE_SQL = (m, tz, statuses) =>
  `(${m}.status = ANY(${statuses}::text[]) AND ${m}.end_date >= (now() AT TIME ZONE ${tz})::date)`;

/** Validate new times. Returns { schedule } sorted, or { fields } for a 400. */
function parseSchedule(value) {
  if (!Array.isArray(value) || value.length === 0) {
    return { fields: { schedule: 'Must contain at least one time.' } };
  }
  if (value.length > MAX_TIMES_PER_DAY) {
    return { fields: { schedule: `Must contain at most ${MAX_TIMES_PER_DAY} times.` } };
  }
  const fields = {};
  value.forEach((time, index) => {
    if (typeof time !== 'string' || !TIME_PATTERN.test(time)) {
      fields[`schedule[${index}]`] = 'Must be in HH:mm format.';
    }
  });
  if (Object.keys(fields).length) return { fields };
  if (new Set(value).size !== value.length) {
    return { fields: { schedule: 'Must not contain the same time twice.' } };
  }
  return { schedule: [...value].sort() };
}

/**
 * Change the times a medication is taken and rebuild its upcoming doses.
 * Run it inside a transaction.
 *
 * Doses already logged or missed are kept, so adherence does not change.
 * Pending doses from now on at times no longer in the schedule are deleted,
 * and their reminders with them (a reminder is a dose's reminded_at).
 * Pending doses at times that stay are kept, so a reminder already sent for
 * one isn't sent again. New times get doses from now on: a new time that has
 * already passed today starts tomorrow instead of turning into a missed dose.
 * That is done by moving dose_tracking_from to now, the point from which
 * generateDoses creates doses.
 *
 * @returns {Promise<{ medicationId, schedule, removed, created }>}
 */
async function changeSchedule(db = pool, { patientId, medicationId, schedule }) {
  const parsed = parseSchedule(schedule);
  if (parsed.fields) {
    const error = new DoseError(400, 'VALIDATION_ERROR', 'The request contains invalid fields.');
    error.fields = parsed.fields;
    throw error;
  }

  const found = await db.query(
    `SELECT m.id, m.patient_id, m.schedule, m.prescription_item_id,
            pi.frequency AS prescribed_frequency,
            ${SCHEDULE_EDITABLE_SQL('m', '$2', '$3')} AS schedule_editable
     FROM medications m
     LEFT JOIN prescription_items pi ON pi.id = m.prescription_item_id
     WHERE m.id = $1
     FOR UPDATE OF m`,
    [medicationId, ZONE, TRACKED_STATUSES]
  );
  const medication = found.rows[0];
  if (!medication) throw new DoseError(404, 'NOT_FOUND', 'Medication not found.');
  if (medication.patient_id !== patientId) {
    throw new DoseError(403, 'FORBIDDEN', 'You do not have access to this medication.');
  }
  if (!medication.schedule_editable) {
    throw new DoseError(409, 'MEDICATION_NOT_ACTIVE', 'Only an active medication can have its times changed.');
  }
  const required = dosesPerDay(medication);
  if (required !== null && parsed.schedule.length !== required) {
    throw new DoseError(
      422,
      'DOSES_PER_DAY_MISMATCH',
      `This medication is prescribed ${required} time${required === 1 ? '' : 's'} a day, so choose exactly ${required} time${required === 1 ? '' : 's'}.`
    );
  }

  await db.query(
    `UPDATE medications
     SET schedule = $2::jsonb, dose_tracking_from = now(), updated_at = now()
     WHERE id = $1`,
    [medicationId, JSON.stringify(parsed.schedule)]
  );

  const removed = await db.query(
    `DELETE FROM medication_doses
     WHERE medication_id = $1
       AND status = 'pending'
       AND scheduled_at >= now()
       AND NOT (to_char(scheduled_at AT TIME ZONE $2, 'HH24:MI') = ANY($3::text[]))`,
    [medicationId, ZONE, parsed.schedule]
  );
  const created = await generateDoses(db, { patientId });

  return {
    medicationId,
    schedule: parsed.schedule,
    removed: removed.rowCount,
    created,
  };
}

module.exports = {
  ZONE,
  MAX_TIMES_PER_DAY,
  TRACKED_STATUSES,
  SCHEDULE_EDITABLE_SQL,
  dosesPerDay,
  parseSchedule,
  changeSchedule,
  MISSED_AFTER_MINUTES,
  STALE_REMINDER_MINUTES,
  EARLIEST_LOG_MINUTES,
  DoseError,
  localTime,
  localDate,
  reminderMessage,
  generateDoses,
  recalculateAdherence,
  markMissedDoses,
  refreshDoses,
  claimDueReminders,
  releaseReminder,
  sendDueReminders,
  listDosesForDay,
  recordDose,
};
