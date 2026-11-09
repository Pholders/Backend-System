// The doctor records vitals at a consultation. This checks that each value is
// physically possible, not that it is healthy. The limits are deliberately
// wide: a reading outside a healthy range is still a real reading worth
// keeping, and judging it is the doctor's job (the SRS keeps acute alerts out
// of scope). What gets rejected is a typo, like a heart rate of 9999.

/**
 * Every vital a doctor can record, in the order the form shows them. The
 * first three are what a consultation records as a rule (blood pressure,
 * pulse, weight), so the form always shows them; the rest are added when
 * measured. This list is served at GET /phr/vitals/kinds, so a vital added
 * here (with its column on health_vitals) reaches the doctor's form without
 * changing the portal. BMI is not recorded: it is worked out from weight and
 * height.
 */
const VITAL_KINDS = [
  {
    key: 'blood_pressure', label: 'Blood pressure', unit: 'mmHg', default: true,
    fields: [
      { key: 'systolic_bp', label: 'Systolic (top)', min: 50, max: 260, integer: true },
      { key: 'diastolic_bp', label: 'Diastolic (bottom)', min: 30, max: 160, integer: true },
    ],
  },
  {
    key: 'heart_rate', label: 'Pulse', unit: 'bpm', default: true,
    fields: [{ key: 'heart_rate', label: 'Pulse (heart rate)', min: 25, max: 250, integer: true }],
  },
  {
    key: 'weight_kg', label: 'Weight', unit: 'kg', default: true,
    fields: [{ key: 'weight_kg', label: 'Weight', min: 1, max: 350 }],
  },
  {
    key: 'height_cm', label: 'Height', unit: 'cm', default: false,
    fields: [{ key: 'height_cm', label: 'Height', min: 40, max: 250 }],
  },
  {
    key: 'temperature_c', label: 'Temperature', unit: '°C', default: false,
    fields: [{ key: 'temperature_c', label: 'Temperature', min: 30, max: 45 }],
  },
  {
    key: 'oxygen_saturation', label: 'Oxygen saturation', unit: '%', default: false,
    fields: [{ key: 'oxygen_saturation', label: 'Oxygen saturation', min: 50, max: 100 }],
  },
  {
    key: 'blood_glucose', label: 'Blood glucose', unit: 'mmol/L', default: false,
    fields: [{ key: 'blood_glucose', label: 'Blood glucose', min: 1, max: 40 }],
  },
];

// The column rules, one per field, as validateVitals checks them.
const LIMITS = Object.fromEntries(
  VITAL_KINDS.flatMap((kind) => kind.fields.map((f) => [f.key, {
    min: f.min,
    max: f.max,
    label: kind.fields.length > 1 ? `${kind.label}, ${f.label.toLowerCase()}` : f.label,
    unit: kind.unit,
    integer: Boolean(f.integer),
  }]))
);

// Height counts on its own now: with a weight on record it gives a BMI.
const MEASUREMENTS = Object.keys(LIMITS);

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

module.exports = { validateVitals, computeBmi, LIMITS, VITAL_KINDS };
