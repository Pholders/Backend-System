const path = require('path');
const { randomUUID } = require('crypto');
const { query, pool } = require('../config/db');
const storage = require('../services/storage');
const doses = require('../services/medicationDoseService');

const ALLOWED_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'application/pdf'
]);

const ATTACHMENT_TYPES = new Set(['medication_photo', 'prescription']);
const FILE_EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'application/pdf': '.pdf'
};

function validationError(res, fields) {
  return res.status(400).json({
    error: {
      code: 'VALIDATION_ERROR',
      message: 'The request contains invalid fields.',
      fields
    }
  });
}

function validationFields(body) {
  const fields = {};
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { body: 'Must be a JSON object.' };
  }
  const requiredStrings = [
    ['name', 150],
    ['type', 100],
    ['dosage', 250],
    ['prescribed_by', 150],
    ['indication', 500],
    ['supply_unit', 50]
  ];

  for (const [field, maxLength] of requiredStrings) {
    if (typeof body[field] !== 'string' || body[field].trim().length === 0 || body[field].trim().length > maxLength) {
      fields[field] = `Must be a non-empty string of at most ${maxLength} characters.`;
    }
  }

  if (body.notes !== undefined && body.notes !== null &&
      (typeof body.notes !== 'string' || body.notes.length > 2000)) {
    fields.notes = 'Must be null or a string of at most 2000 characters.';
  }

  if (!Array.isArray(body.schedule) || body.schedule.length === 0) {
    fields.schedule = 'Must contain at least one time.';
  } else {
    body.schedule.forEach((time, index) => {
      if (typeof time !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) {
        fields[`schedule[${index}]`] = 'Must be in HH:mm format.';
      }
    });
  }

  const isDate = (value) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  };

  for (const field of ['start_date', 'end_date', 'issued_date']) {
    if (!isDate(body[field])) fields[field] = 'Must be an ISO 8601 date in YYYY-MM-DD format.';
  }
  if (body.next_refill_date !== undefined && body.next_refill_date !== null && !isDate(body.next_refill_date)) {
    fields.next_refill_date = 'Must be null or an ISO 8601 date in YYYY-MM-DD format.';
  }

  if (isDate(body.start_date) && isDate(body.end_date) && body.end_date < body.start_date) {
    fields.end_date = 'Must be on or after start_date.';
  }
  if (isDate(body.issued_date) && body.issued_date > new Date().toISOString().slice(0, 10)) {
    fields.issued_date = 'Must not be after today.';
  }
  if (isDate(body.issued_date) && isDate(body.next_refill_date) && body.next_refill_date < body.issued_date) {
    fields.next_refill_date = 'Must be on or after issued_date.';
  }

  if (!['active', 'critical', 'past'].includes(body.status)) {
    fields.status = 'Must be active, critical, or past.';
  }
  if (!Number.isInteger(body.refills_remaining) || body.refills_remaining < 0) {
    fields.refills_remaining = 'Must be an integer greater than or equal to 0.';
  }
  if (Object.prototype.hasOwnProperty.call(body, 'adherence_percent')) {
    fields.adherence_percent = 'Must not be supplied when creating a medication.';
  }

  return fields;
}

function medicationResponse(row) {
  const { prescribed_frequency: _frequency, ...rest } = row;
  const response = {
    ...rest,
    schedule: Array.isArray(row.schedule) ? row.schedule : JSON.parse(row.schedule),
    attachments: row.attachments || []
  };
  if (Object.prototype.hasOwnProperty.call(row, 'schedule_editable')) {
    response.doses_per_day = doses.dosesPerDay(row);
  }
  return response;
}

/**
 * A patient's medications as GET /api/medications returns them, or just one
 * when medicationId is given. `db` defaults to the pool.
 */
async function fetchMedications(db = { query }, patientId, medicationId = null) {
  const result = await db.query(
    `SELECT m.*,
      COALESCE(
        json_agg(
          json_build_object(
            'id', ma.id,
            'type', ma.type,
            'file_name', ma.file_name,
            'content_type', ma.content_type,
            'url', '/api/medications/' || m.id || '/attachments/' || ma.id,
            'created_at', ma.created_at
          )
          ORDER BY ma.created_at
        ) FILTER (WHERE ma.id IS NOT NULL),
        '[]'::json
      ) AS attachments,
      (SELECT COUNT(*)::int FROM medication_doses d
        WHERE d.medication_id = m.id AND d.status <> 'pending') AS adherence_doses_counted,
      ${doses.SCHEDULE_EDITABLE_SQL('m', '$3', '$4')} AS schedule_editable,
      pi.frequency AS prescribed_frequency
    FROM medications m
    LEFT JOIN medication_attachments ma ON ma.medication_id = m.id
    LEFT JOIN prescription_items pi ON pi.id = m.prescription_item_id
    WHERE m.patient_id = $1
      AND ($2::varchar IS NULL OR m.id = $2)
    GROUP BY m.id, pi.frequency
    ORDER BY m.start_date DESC, m.created_at DESC`,
    [patientId, medicationId, doses.ZONE, doses.TRACKED_STATUSES]
  );
  return result.rows.map(medicationResponse);
}

class MedicationController {
  static async create(req, res) {
    const fields = validationFields(req.body);
    if (Object.keys(fields).length > 0) return validationError(res, fields);

    const body = req.body;
    const id = `med_${randomUUID().replace(/-/g, '')}`;
    const schedule = [...new Set(body.schedule)].sort();

    try {
      const result = await query(
        `INSERT INTO medications (
          id, patient_id, name, type, dosage, schedule, start_date, end_date, status,
          adherence_percent, prescribed_by, issued_date, indication, refills_remaining,
          supply_unit, next_refill_date, notes
        ) VALUES (
          $1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, 0, $10, $11, $12, $13, $14, $15, $16
        ) RETURNING *`,
        [
          id, req.user.id, body.name.trim(), body.type.trim(), body.dosage.trim(),
          JSON.stringify(schedule), body.start_date, body.end_date, body.status,
          body.prescribed_by.trim(), body.issued_date, body.indication.trim(),
          body.refills_remaining, body.supply_unit.trim(), body.next_refill_date || null,
          body.notes === undefined || body.notes === null ? null : body.notes.trim()
        ]
      );

      return res.status(201).json({ data: medicationResponse(result.rows[0]) });
    } catch (error) {
      console.error('Error creating medication:', error);
      return res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Unable to create medication.' }
      });
    }
  }

  static async uploadAttachment(req, res) {
    if (!req.file) return validationError(res, { file: 'A file is required.' });
    if (!ATTACHMENT_TYPES.has(req.body && req.body.type)) {
      return validationError(res, { type: 'Must be medication_photo or prescription.' });
    }
    if (!ALLOWED_CONTENT_TYPES.has(req.file.mimetype)) {
      return res.status(415).json({
        error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Only JPEG, PNG, and PDF files are allowed.' }
      });
    }

    const { medicationId } = req.params;
    try {
      const medication = await query(
        'SELECT patient_id FROM medications WHERE id = $1',
        [medicationId]
      );
      if (!medication.rows.length) {
        return res.status(404).json({
          error: { code: 'NOT_FOUND', message: 'Medication not found.' }
        });
      }
      if (medication.rows[0].patient_id !== req.user.id) {
        return res.status(403).json({
          error: { code: 'FORBIDDEN', message: 'You do not have access to this medication.' }
        });
      }

      const id = `medatt_${randomUUID().replace(/-/g, '')}`;
      const fileName = path.basename(req.file.originalname).replace(/[\r\n]/g, '').slice(0, 255);
      const storageKey = await storage.put(
        req.file,
        `medication-attachments/${medicationId}`,
        `${id}${FILE_EXTENSIONS[req.file.mimetype]}`
      );

      try {
        const result = await query(
          `INSERT INTO medication_attachments
            (id, medication_id, type, file_name, content_type, storage_key)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, type, file_name, content_type, created_at`,
          [id, medicationId, req.body.type, fileName || 'attachment', req.file.mimetype, storageKey]
        );
        const attachment = result.rows[0];
        attachment.url = `/api/medications/${medicationId}/attachments/${attachment.id}`;
        return res.status(201).json({ data: attachment });
      } catch (error) {
        await storage.remove(storageKey);
        throw error;
      }
    } catch (error) {
      console.error('Error uploading medication attachment:', error);
      return res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Unable to upload medication attachment.' }
      });
    }
  }

  static async getAttachment(req, res) {
    try {
      const medication = await query(
        'SELECT patient_id FROM medications WHERE id = $1',
        [req.params.medicationId]
      );
      if (!medication.rows.length) {
        return res.status(404).json({
          error: { code: 'NOT_FOUND', message: 'Medication not found.' }
        });
      }
      if (medication.rows[0].patient_id !== req.user.id) {
        return res.status(403).json({
          error: { code: 'FORBIDDEN', message: 'You do not have access to this medication.' }
        });
      }

      const result = await query(
        `SELECT ma.file_name, ma.content_type, ma.storage_key
         FROM medication_attachments ma
         INNER JOIN medications m ON m.id = ma.medication_id
         WHERE ma.id = $1 AND ma.medication_id = $2 AND m.patient_id = $3`,
        [req.params.attachmentId, req.params.medicationId, req.user.id]
      );
      if (!result.rows.length) {
        return res.status(404).json({
          error: { code: 'NOT_FOUND', message: 'Medication attachment not found.' }
        });
      }

      const attachment = result.rows[0];
      const file = await storage.get(attachment.storage_key);
      res.setHeader('Content-Type', attachment.content_type || file.contentType);
      res.setHeader('Content-Disposition', `inline; filename="${attachment.file_name}"`);
      res.setHeader('Cache-Control', 'private, no-store');
      return res.send(file.buffer);
    } catch (error) {
      if (error.code === 'STORAGE_NOT_FOUND') {
        return res.status(404).json({
          error: { code: 'NOT_FOUND', message: 'Medication attachment not found.' }
        });
      }
      console.error('Error retrieving medication attachment:', error);
      return res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Unable to retrieve medication attachment.' }
      });
    }
  }

  static async list(req, res) {
    try {
      const rows = await fetchMedications(undefined, req.user.id);
      return res.json({ data: rows });
    } catch (error) {
      console.error('Error listing medications:', error);
      return res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Unable to retrieve medications.' }
      });
    }
  }

  // PATCH /api/medications/:medicationId/schedule   body: { schedule: ["07:30", "19:30"] }
  static async updateSchedule(req, res) {
    const schedule = req.body && req.body.schedule;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await doses.changeSchedule(client, {
        patientId: req.user.id,
        medicationId: req.params.medicationId,
        schedule,
      });
      const [medication] = await fetchMedications(client, req.user.id, req.params.medicationId);
      await client.query('COMMIT');
      return res.json({ data: medication });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      if (error instanceof doses.DoseError) {
        if (error.fields) return validationError(res, error.fields);
        return res.status(error.status).json({ error: { code: error.code, message: error.message } });
      }
      console.error('Error changing medication schedule:', error);
      return res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Unable to change the medication times.' }
      });
    } finally {
      client.release();
    }
  }

  // GET /api/medications/doses?date=YYYY-MM-DD (default: today, South African time)
  static async listDoses(req, res) {
    const day = req.query.date === undefined ? doses.localDate() : req.query.date;
    if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
        Number.isNaN(new Date(`${day}T00:00:00.000Z`).getTime()) ||
        new Date(`${day}T00:00:00.000Z`).toISOString().slice(0, 10) !== day) {
      return validationError(res, { date: 'Must be an ISO 8601 date in YYYY-MM-DD format.' });
    }

    try {
      await doses.refreshDoses(undefined, { patientId: req.user.id });
      const rows = await doses.listDosesForDay(undefined, req.user.id, day);
      return res.json({ data: { date: day, time_zone: doses.ZONE, doses: rows } });
    } catch (error) {
      console.error('Error listing medication doses:', error);
      return res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Unable to retrieve medication doses.' }
      });
    }
  }

  // POST /api/medications/doses/:doseId/taken   body: { taken_at? }
  // POST /api/medications/doses/:doseId/skipped
  static logDose(status) {
    return async (req, res) => {
      if (!/^\d{1,18}$/.test(req.params.doseId)) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Dose not found.' } });
      }
      const takenAt = req.body && req.body.taken_at;
      if (takenAt !== undefined && takenAt !== null && typeof takenAt !== 'string') {
        return validationError(res, { taken_at: 'Must be an ISO 8601 date-time.' });
      }

      try {
        const dose = await doses.recordDose(undefined, {
          patientId: req.user.id,
          doseId: req.params.doseId,
          status,
          takenAt: takenAt || null,
        });
        return res.json({ data: dose });
      } catch (error) {
        if (error instanceof doses.DoseError) {
          return res.status(error.status).json({ error: { code: error.code, message: error.message } });
        }
        console.error('Error logging medication dose:', error);
        return res.status(500).json({
          error: { code: 'INTERNAL_ERROR', message: 'Unable to log the dose.' }
        });
      }
    };
  }
}

module.exports = MedicationController;
module.exports.fetchMedications = fetchMedications;
