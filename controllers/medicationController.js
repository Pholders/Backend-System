const path = require('path');
const { randomUUID } = require('crypto');
const { query } = require('../config/db');
const storage = require('../services/storage');

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
  return {
    ...row,
    schedule: Array.isArray(row.schedule) ? row.schedule : JSON.parse(row.schedule),
    attachments: row.attachments || []
  };
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
      const result = await query(
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
          ) AS attachments
        FROM medications m
        LEFT JOIN medication_attachments ma ON ma.medication_id = m.id
        WHERE m.patient_id = $1
        GROUP BY m.id
        ORDER BY m.start_date DESC, m.created_at DESC`,
        [req.user.id]
      );
      return res.json({ data: result.rows.map(medicationResponse) });
    } catch (error) {
      console.error('Error listing medications:', error);
      return res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Unable to retrieve medications.' }
      });
    }
  }
}

module.exports = MedicationController;
