// A patient types their own readings in, so this checks that each value is
// physically possible, not that it is healthy. The limits are deliberately
// wide: a reading outside a healthy range is still a real reading worth
// keeping, and judging it is the doctor's job (the SRS keeps acute alerts out
// of scope). What gets rejected is a typo, like a heart rate of 9999.

const LIMITS = {
  systolic_bp: { min: 50, max: 260, label: 'Systolic blood pressure', unit: 'mmHg', integer: true },
  diastolic_bp: { min: 30, max: 160, label: 'Diastolic blood pressure', unit: 'mmHg', integer: true },
  heart_rate: { min: 25, max: 250, label: 'Heart rate', unit: 'bpm', integer: true },
  weight_kg: { min: 1, max: 350, label: 'Weight', unit: 'kg' },
  height_cm: { min: 40, max: 250, label: 'Height', unit: 'cm' },
  blood_glucose: { min: 1, max: 40, label: 'Blood glucose', unit: 'mmol/L' },
  oxygen_saturation: { min: 50, max: 100, label: 'Oxygen saturation', unit: '%' },
  temperature_c: { min: 30, max: 45, label: 'Temperature', unit: '°C' },
};

// Height alone is not a measurement worth a row: it only feeds BMI.
const MEASUREMENTS = [
  'systolic_bp', 'diastolic_bp', 'heart_rate', 'weight_kg',
  'blood_glucose', 'oxygen_saturation', 'temperature_c',
];

const NOTES_MAX = 500;
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
const OLDEST_MS = 366 * 24 * 60 * 60 * 1000;

function isBlank(v) {
  return v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
}

function computeBmi(weightKg, heightCm) {
  if (weightKg == null || heightCm == null) return null;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 100) / 100;
}

/**
 * Checks a request body for POST /phr/vitals.
 * Returns { errors: string[], values } where values holds only the fields that
 * were sent, as numbers, plus measured_at as a Date and notes as a string.
 * Any `bmi` in the body is ignored; the caller works it out with computeBmi.
 */
function validateVitals(body, now = new Date()) {
  const errors = [];
  const values = {};
  const input = body || {};

  for (const [field, rule] of Object.entries(LIMITS)) {
    const raw = input[field];
    if (isBlank(raw)) continue;
    const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
    if (!Number.isFinite(n)) {
      errors.push(`${rule.label} must be a number.`);
      continue;
    }
    if (rule.integer && !Number.isInteger(n)) {
      errors.push(`${rule.label} must be a whole number.`);
      continue;
    }
    if (n < rule.min || n > rule.max) {
      errors.push(`${rule.label} must be between ${rule.min} and ${rule.max} ${rule.unit}.`);
      continue;
    }
    values[field] = n;
  }

  const hasSys = !isBlank(input.systolic_bp);
  const hasDia = !isBlank(input.diastolic_bp);
  if (hasSys !== hasDia) {
    errors.push('Blood pressure needs both numbers: systolic (top) and diastolic (bottom).');
  } else if (values.systolic_bp != null && values.diastolic_bp != null
             && values.diastolic_bp >= values.systolic_bp) {
    errors.push('The top blood pressure number (systolic) must be higher than the bottom one (diastolic).');
  }

  if (!MEASUREMENTS.some((f) => !isBlank(input[f]))) {
    errors.push('Enter at least one reading.');
  }

  if (!isBlank(input.measured_at)) {
    const at = new Date(input.measured_at);
    if (Number.isNaN(at.getTime())) {
      errors.push('The time of the reading is not a valid date.');
    } else if (at.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) {
      errors.push('The time of the reading cannot be in the future.');
    } else if (at.getTime() < now.getTime() - OLDEST_MS) {
      errors.push('Readings older than a year cannot be logged.');
    } else {
      values.measured_at = at;
    }
  }

  if (!isBlank(input.notes)) {
    const notes = String(input.notes).trim();
    if (notes.length > NOTES_MAX) {
      errors.push(`Notes must be ${NOTES_MAX} characters or fewer.`);
    } else {
      values.notes = notes;
    }
  }

  return { errors, values };
}

module.exports = { validateVitals, computeBmi, LIMITS };
