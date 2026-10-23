const { query } = require('../config/db');

function validationError(res, fields) {
  return res.status(400).json({
    error: {
      code: 'VALIDATION_ERROR',
      message: 'The request contains invalid fields.',
      fields
    }
  });
}

function isDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const today = () => new Date().toISOString().slice(0, 10);

// pg turns a DATE into a Date at local midnight, which toISOString() can
// shift to the previous day. Reading the local parts gives back the stored day.
function dateOnly(value) {
  if (!(value instanceof Date)) return value ?? null;
  const pad = (n) => String(n).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

/**
 * Reads a trimmed string field into `values`, recording a problem in
 * `fields` when it is missing (and required) or too long.
 */
function readString(body, name, maxLength, { required = false } = {}, values, fields) {
  const raw = body[name];
  if (raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '')) {
    if (required) fields[name] = `Must be a non-empty string of at most ${maxLength} characters.`;
    else values[name] = null;
    return;
  }
  if (typeof raw !== 'string' || raw.trim().length > maxLength) {
    fields[name] = `Must be ${required ? 'a non-empty' : 'null or a'} string of at most ${maxLength} characters.`;
    return;
  }
  values[name] = raw.trim();
}

function readPastDate(body, name, values, fields) {
  const raw = body[name];
  if (raw === undefined || raw === null || raw === '') {
    values[name] = null;
  } else if (!isDate(raw)) {
    fields[name] = 'Must be null or an ISO 8601 date in YYYY-MM-DD format.';
  } else if (raw > today()) {
    fields[name] = 'Must not be after today.';
  } else {
    values[name] = raw;
  }
}

function readChoice(body, name, choices, fallback, values, fields) {
  const raw = body[name];
  if (raw === undefined || raw === null || raw === '') {
    if (fallback === undefined) fields[name] = `Must be one of: ${choices.join(', ')}.`;
    else values[name] = fallback;
    return;
  }
  const value = typeof raw === 'string' ? raw.trim().toLowerCase() : raw;
  if (!choices.includes(value)) {
    fields[name] = `Must be one of: ${choices.join(', ')}.`;
    return;
  }
  values[name] = value;
}

// The existing tables store these capitalised; the API speaks lowercase.
const capitalise = (value) => value && value.charAt(0).toUpperCase() + value.slice(1);
const ALLERGEN_TYPES = ['medication', 'food', 'environmental', 'other'];

/**
 * One entry per section of the patient's medical history: the table it lives
 * in, how a request body becomes a row, and how a row is returned. Responses
 * use the same field names a client sends, not the table's column names.
 */
const SECTIONS = {
  conditions: {
    table: 'patient_medical_conditions',
    label: 'Condition',
    order: 'date_diagnosed DESC NULLS LAST, created_at DESC',
    read(body) {
      const values = {};
      const fields = {};
      readString(body, 'name', 200, { required: true }, values, fields);
      readChoice(body, 'status', ['chronic', 'acute', 'resolved', 'remission'], 'chronic', values, fields);
      readChoice(body, 'severity', ['mild', 'moderate', 'severe'], null, values, fields);
      readPastDate(body, 'diagnosed_date', values, fields);
      readString(body, 'diagnosed_by', 200, {}, values, fields);
      readString(body, 'notes', 2000, {}, values, fields);
      return {
        fields,
        columns: {
          condition_name: values.name,
          status: values.status,
          severity: capitalise(values.severity),
          date_diagnosed: values.diagnosed_date,
          treating_specialist: values.diagnosed_by,
          notes: values.notes
        }
      };
    },
    respond: (row) => ({
      id: row.id,
      name: row.condition_name,
      // Rows written before the app's statuses existed say 'active'.
      status: row.status === 'active' ? 'chronic' : row.status,
      severity: row.severity ? row.severity.toLowerCase() : null,
      diagnosed_date: dateOnly(row.date_diagnosed),
      diagnosed_by: row.treating_specialist,
      notes: row.notes,
      created_at: row.created_at
    })
  },

  allergies: {
    table: 'patient_allergies',
    label: 'Allergy',
    // Inactive allergies were retired by other tools; they are not shown.
    where: 'is_active IS NOT FALSE',
    order: 'created_at DESC',
    read(body) {
      const values = {};
      const fields = {};
      readString(body, 'name', 200, { required: true }, values, fields);
      readChoice(body, 'severity', ['mild', 'moderate', 'severe', 'life-threatening'], undefined, values, fields);
      readString(body, 'reaction', 500, {}, values, fields);
      readChoice(body, 'allergen_type', ALLERGEN_TYPES, 'other', values, fields);
      readPastDate(body, 'identified_date', values, fields);
      readString(body, 'notes', 2000, {}, values, fields);
      return {
        fields,
        columns: {
          allergen: values.name,
          severity: values.severity === 'life-threatening' ? 'Life-threatening' : capitalise(values.severity),
          reaction_description: values.reaction,
          allergen_type: capitalise(values.allergen_type),
          date_identified: values.identified_date,
          notes: values.notes
        }
      };
    },
    respond: (row) => ({
      id: row.id,
      name: row.allergen,
      severity: row.severity ? row.severity.toLowerCase() : null,
      reaction: row.reaction_description,
      allergen_type: row.allergen_type ? row.allergen_type.toLowerCase() : null,
      identified_date: dateOnly(row.date_identified),
      notes: row.notes,
      created_at: row.created_at
    })
  },

  surgeries: {
    table: 'patient_surgeries',
    label: 'Surgery',
    order: 'surgery_date DESC NULLS LAST, created_at DESC',
    read(body) {
      const values = {};
      const fields = {};
      readString(body, 'name', 200, { required: true }, values, fields);
      readPastDate(body, 'date', values, fields);
      readString(body, 'hospital', 200, {}, values, fields);
      readString(body, 'notes', 2000, {}, values, fields);
      return {
        fields,
        columns: {
          procedure_name: values.name,
          surgery_date: values.date,
          hospital: values.hospital,
          notes: values.notes
        }
      };
    },
    respond: (row) => ({
      id: row.id,
      name: row.procedure_name,
      date: dateOnly(row.surgery_date),
      hospital: row.hospital,
      notes: row.notes,
      created_at: row.created_at
    })
  },

  'family-history': {
    table: 'patient_family_history',
    label: 'Family history entry',
    key: 'family_history',
    order: 'created_at DESC',
    read(body) {
      const values = {};
      const fields = {};
      readString(body, 'relative', 100, { required: true }, values, fields);
      readString(body, 'condition', 200, { required: true }, values, fields);
      readString(body, 'notes', 2000, {}, values, fields);
      return {
        fields,
        columns: {
          relative: values.relative,
          condition_name: values.condition,
          notes: values.notes
        }
      };
    },
    respond: (row) => ({
      id: row.id,
      relative: row.relative,
      condition: row.condition_name,
      notes: row.notes,
      created_at: row.created_at
    })
  }
};

function sectionOr404(req, res) {
  const section = SECTIONS[req.params.section];
  if (!section) {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `Unknown section. Use one of: ${Object.keys(SECTIONS).join(', ')}.`
      }
    });
  }
  return section;
}

async function listSection(section, patientId) {
  const where = section.where ? ` AND ${section.where}` : '';
  const result = await query(
    `SELECT * FROM ${section.table} WHERE patient_id = $1${where} ORDER BY ${section.order}`,
    [patientId]
  );
  return result.rows.map(section.respond);
}

class MedicalHistoryController {
  /**
   * GET /api/medical-history — every section at once.
   */
  static async getAll(req, res) {
    try {
      const entries = await Promise.all(
        Object.entries(SECTIONS).map(async ([name, section]) =>
          [section.key || name, await listSection(section, req.user.id)])
      );
      return res.json({ data: Object.fromEntries(entries) });
    } catch (error) {
      console.error('Error loading medical history:', error);
      return res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Unable to load medical history.' }
      });
    }
  }

  /**
   * GET /api/medical-history/:section
   */
  static async list(req, res) {
    const section = sectionOr404(req, res);
    if (!section) return undefined;
    try {
      return res.json({ data: await listSection(section, req.user.id) });
    } catch (error) {
      console.error(`Error listing ${req.params.section}:`, error);
      return res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Unable to load medical history.' }
      });
    }
  }

  /**
   * POST /api/medical-history/:section
   */
  static async create(req, res) {
    const section = sectionOr404(req, res);
    if (!section) return undefined;

    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return validationError(res, { body: 'Must be a JSON object.' });
    }
    const { fields, columns } = section.read(req.body);
    if (Object.keys(fields).length > 0) return validationError(res, fields);

    // Column names come from SECTIONS, never from the request.
    const names = ['patient_id', ...Object.keys(columns)];
    const values = [req.user.id, ...Object.values(columns)];
    const placeholders = values.map((_, index) => `$${index + 1}`);

    try {
      const result = await query(
        `INSERT INTO ${section.table} (${names.join(', ')})
         VALUES (${placeholders.join(', ')})
         RETURNING *`,
        values
      );
      return res.status(201).json({ data: section.respond(result.rows[0]) });
    } catch (error) {
      console.error(`Error adding to ${req.params.section}:`, error);
      return res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: `Unable to save ${section.label.toLowerCase()}.` }
      });
    }
  }

  /**
   * DELETE /api/medical-history/:section/:id — only the patient's own rows.
   */
  static async remove(req, res) {
    const section = sectionOr404(req, res);
    if (!section) return undefined;

    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return validationError(res, { id: 'Must be a positive integer.' });
    }

    try {
      const result = await query(
        `DELETE FROM ${section.table} WHERE id = $1 AND patient_id = $2 RETURNING id`,
        [id, req.user.id]
      );
      if (result.rowCount === 0) {
        return res.status(404).json({
          error: { code: 'NOT_FOUND', message: `${section.label} not found.` }
        });
      }
      return res.status(204).end();
    } catch (error) {
      console.error(`Error deleting from ${req.params.section}:`, error);
      return res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: `Unable to delete ${section.label.toLowerCase()}.` }
      });
    }
  }
}

module.exports = MedicalHistoryController;
