const { randomUUID } = require('crypto');

/**
 * Prescription Medication Service
 * Turns the items of a dispensed prescription into active medications
 */

const WORD_NUMBERS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, twelve: 12, fourteen: 14, thirty: 30
};

// Fallback when neither the duration nor the quantity says how long to take it
const DEFAULT_DURATION_DAYS = 30;

const pad = (hour) => `${String(hour).padStart(2, '0')}:00`;

function toNumber(value) {
  if (/^\d+$/.test(value)) return parseInt(value, 10);
  return WORD_NUMBERS[value] || null;
}

/**
 * Derive HH:mm dose times from a free-text frequency such as
 * "twice daily", "TDS", "every 8 hours" or "at night".
 */
function scheduleFromFrequency(frequency) {
  const text = String(frequency || '').toLowerCase();

  const everyHours = text.match(/every\s+(\d+|\w+)\s*(?:hours?|hrs?|h)\b/) || text.match(/\bq(\d+)h\b/);
  if (everyHours) {
    const interval = toNumber(everyHours[1]);
    if (interval && interval >= 1 && interval <= 24) {
      const times = [];
      for (let hour = 8; hour < 8 + 24; hour += interval) times.push(pad(hour % 24));
      return [...new Set(times)].sort();
    }
  }

  let perDay = null;
  const timesMatch = text.match(/(\d+|\w+)\s*(?:x|times)\b/);
  if (timesMatch) perDay = toNumber(timesMatch[1]);
  if (!perDay) {
    if (/\b(qds|qid)\b/.test(text)) perDay = 4;
    else if (/\b(tds|tid)\b/.test(text)) perDay = 3;
    else if (/\b(bd|bid|twice)\b/.test(text)) perDay = 2;
  }

  switch (perDay) {
    case 4: return ['08:00', '12:00', '16:00', '20:00'];
    case 3: return ['08:00', '14:00', '20:00'];
    case 2: return ['08:00', '20:00'];
    default: break;
  }

  if (/\b(nocte|night|bedtime|evening)\b/.test(text)) return ['21:00'];
  return ['08:00'];
}

/**
 * Number of days to take the medication: the stated duration if there is one,
 * otherwise how long the dispensed quantity lasts at the scheduled rate.
 */
function durationDays(duration, quantity, dosesPerDay) {
  const text = String(duration || '').toLowerCase();
  const match = text.match(/(\d+|\w+)\s*(day|week|month)s?\b/);
  if (match) {
    const amount = toNumber(match[1]);
    if (amount) return amount * { day: 1, week: 7, month: 30 }[match[2]];
  }
  if (Number.isInteger(quantity) && quantity > 0 && dosesPerDay > 0) {
    return Math.max(1, Math.ceil(quantity / dosesPerDay));
  }
  return DEFAULT_DURATION_DAYS;
}

const clip = (value, max) => String(value || '').trim().slice(0, max);

/**
 * Create one active medication per item of a dispensed prescription.
 * Must run on the client of the dispensing transaction. Items that already
 * have a medication are skipped, so it is safe to call more than once.
 * @returns {Promise<Array>} the medications created
 */
async function createForDispensedPrescription(client, prescriptionId) {
  const { rows: items } = await client.query(
    `SELECT pi.*, p.patient_id, p.prescriber_name, p.diagnosis,
            COALESCE(p.signature_timestamp, p.created_at)::date AS issued_date
     FROM prescription_items pi
     INNER JOIN prescriptions p ON p.id = pi.prescription_id
     WHERE pi.prescription_id = $1
     ORDER BY pi.id`,
    [prescriptionId]
  );

  const created = [];
  for (const item of items) {
    const schedule = scheduleFromFrequency(item.frequency);
    const days = durationDays(item.duration, item.quantity, schedule.length);

    const result = await client.query(
      `INSERT INTO medications (
        id, patient_id, name, type, dosage, schedule, start_date, end_date, status,
        adherence_percent, prescribed_by, issued_date, indication, refills_remaining,
        supply_unit, next_refill_date, notes, prescription_id, prescription_item_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6::jsonb, CURRENT_DATE, CURRENT_DATE + $7::int, 'active',
        0, $8, LEAST($9::date, CURRENT_DATE), $10, 0, $11, NULL, $12, $13, $14
      )
      ON CONFLICT (prescription_item_id) WHERE prescription_item_id IS NOT NULL DO NOTHING
      RETURNING *`,
      [
        `med_${randomUUID().replace(/-/g, '')}`,
        item.patient_id,
        clip(item.medicine_name, 150),
        clip(item.dosage_form, 100),
        clip(item.dosage, 250),
        JSON.stringify(schedule),
        days,
        clip(item.prescriber_name, 150),
        item.issued_date,
        clip(item.diagnosis, 500),
        clip(item.quantity_unit || 'pills', 50),
        item.special_instructions ? clip(item.special_instructions, 2000) : null,
        prescriptionId,
        item.id
      ]
    );
    if (result.rows.length) created.push(result.rows[0]);
  }

  return created;
}

module.exports = {
  scheduleFromFrequency,
  durationDays,
  createForDispensedPrescription
};
