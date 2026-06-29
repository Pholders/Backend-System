const { query } = require('../config/db');
const AuditLog = require('../models/AuditLog');
const { encrypt, decryptAndMask } = require('../utils/encryption');

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

function buildDoctorPublic(d) {
  return {
    doctor_id: d.id,
    first_name: d.first_name,
    last_name: d.last_name,
    full_name: `${d.first_name || ''} ${d.last_name || ''}`.trim(),
    email: d.email,
    phone: d.phone,
    hpcsa_number: d.hpcsa_number,
    specialization: d.specialization,
    clinic_name: d.clinic_name,
    city: d.city,
    province: d.province
  };
}

function buildPharmacyPublic(p) {
  return {
    pharmacy_id: p.id,
    pharmacy_name: p.pharmacy_name,
    email: p.email,
    phone: p.phone,
    license_number: p.license_number,
    city: p.city,
    province: p.province,
    address: p.address,
    is_24_hours: p.is_24_hours,
    delivery_available: p.delivery_available
  };
}

// ===================================================================
// CONNECTED DOCTORS  (Tasks 17-19)
// ===================================================================

/** GET /api/profile/linked-services/doctors */
async function listConnectedDoctors(req, res) {
  try {
    const patientId = req.user.id;
    const result = await query(
      `SELECT cd.id AS connection_id, cd.status, cd.note,
              cd.linked_at, cd.created_at,
              d.*
         FROM connected_doctors cd
         JOIN doctors d ON d.id = cd.doctor_id
        WHERE cd.patient_id = $1 AND cd.status != 'removed'
        ORDER BY cd.linked_at DESC`,
      [patientId]
    );

    const doctors = result.rows.map((row) => ({
      connection_id: row.connection_id,
      status: row.status,
      note: row.note,
      linked_at: row.linked_at,
      ...buildDoctorPublic(row)
    }));

    res.json({ success: true, doctors, total: doctors.length });
  } catch (error) {
    console.error('listConnectedDoctors error:', error);
    res.status(500).json({ success: false, message: 'Failed to list connected doctors' });
  }
}

/** POST /api/profile/linked-services/doctors
 *  Body: { doctor_id? , hpcsa_number?, note? }
 */
async function linkDoctor(req, res) {
  try {
    const patientId = req.user.id;
    const patientEmail = req.user.email;
    const { doctor_id, hpcsa_number, note } = req.body;

    if (!doctor_id && !hpcsa_number) {
      return res.status(400).json({
        success: false,
        message: 'Provide doctor_id or hpcsa_number'
      });
    }

    const doctorRow = doctor_id
      ? await query('SELECT * FROM doctors WHERE id = $1', [doctor_id])
      : await query('SELECT * FROM doctors WHERE hpcsa_number = $1', [hpcsa_number]);

    if (!doctorRow.rows.length) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }
    const doctor = doctorRow.rows[0];

    if (doctor.status && doctor.status !== 'active') {
      return res.status(400).json({ success: false, message: 'Doctor account is not active' });
    }

    // Upsert: re-activate if previously removed
    const upsert = await query(
      `INSERT INTO connected_doctors (patient_id, doctor_id, note)
       VALUES ($1, $2, $3)
       ON CONFLICT (patient_id, doctor_id)
       DO UPDATE SET status = 'active', note = COALESCE(EXCLUDED.note, connected_doctors.note),
                     linked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [patientId, doctor.id, note || null]
    );

    await AuditLog.logSecurityEvent(
      req, patientId, 'patient', patientEmail,
      'doctor_linked', 'success', `doctor_id=${doctor.id}`
    );

    res.status(201).json({
      success: true,
      message: 'Doctor linked successfully',
      connection: {
        connection_id: upsert.rows[0].id,
        status: upsert.rows[0].status,
        linked_at: upsert.rows[0].linked_at,
        ...buildDoctorPublic(doctor)
      }
    });
  } catch (error) {
    console.error('linkDoctor error:', error);
    res.status(500).json({ success: false, message: 'Failed to link doctor' });
  }
}

/** DELETE /api/profile/linked-services/doctors/:connectionId */
async function unlinkDoctor(req, res) {
  try {
    const patientId = req.user.id;
    const patientEmail = req.user.email;
    const { connectionId } = req.params;

    const result = await query(
      `UPDATE connected_doctors
          SET status = 'removed', updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND patient_id = $2
        RETURNING id, doctor_id`,
      [connectionId, patientId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Connection not found' });
    }

    await AuditLog.logSecurityEvent(
      req, patientId, 'patient', patientEmail,
      'doctor_unlinked', 'success', `doctor_id=${result.rows[0].doctor_id}`
    );

    res.json({ success: true, message: 'Doctor unlinked' });
  } catch (error) {
    console.error('unlinkDoctor error:', error);
    res.status(500).json({ success: false, message: 'Failed to unlink doctor' });
  }
}

// ===================================================================
// CONNECTED PHARMACIES  (Tasks 20-22)
// ===================================================================

/** GET /api/profile/linked-services/pharmacies */
async function listConnectedPharmacies(req, res) {
  try {
    const patientId = req.user.id;
    const result = await query(
      `SELECT cp.id AS connection_id, cp.status, cp.note, cp.linked_at, cp.created_at,
              p.*
         FROM connected_pharmacies cp
         JOIN pharmacies p ON p.id = cp.pharmacy_id
        WHERE cp.patient_id = $1 AND cp.status != 'removed'
        ORDER BY cp.linked_at DESC`,
      [patientId]
    );

    const pharmacies = result.rows.map((row) => ({
      connection_id: row.connection_id,
      status: row.status,
      note: row.note,
      linked_at: row.linked_at,
      ...buildPharmacyPublic(row)
    }));

    res.json({ success: true, pharmacies, total: pharmacies.length });
  } catch (error) {
    console.error('listConnectedPharmacies error:', error);
    res.status(500).json({ success: false, message: 'Failed to list connected pharmacies' });
  }
}

/** POST /api/profile/linked-services/pharmacies
 *  Body: { pharmacy_id?, license_number?, note? }
 */
async function linkPharmacy(req, res) {
  try {
    const patientId = req.user.id;
    const patientEmail = req.user.email;
    const { pharmacy_id, license_number, note } = req.body;

    if (!pharmacy_id && !license_number) {
      return res.status(400).json({
        success: false,
        message: 'Provide pharmacy_id or license_number'
      });
    }

    const pharmacyRow = pharmacy_id
      ? await query('SELECT * FROM pharmacies WHERE id = $1', [pharmacy_id])
      : await query('SELECT * FROM pharmacies WHERE license_number = $1', [license_number]);

    if (!pharmacyRow.rows.length) {
      return res.status(404).json({ success: false, message: 'Pharmacy not found' });
    }
    const pharmacy = pharmacyRow.rows[0];

    if (pharmacy.status && pharmacy.status !== 'active') {
      return res.status(400).json({ success: false, message: 'Pharmacy account is not active' });
    }

    const upsert = await query(
      `INSERT INTO connected_pharmacies (patient_id, pharmacy_id, note)
       VALUES ($1, $2, $3)
       ON CONFLICT (patient_id, pharmacy_id)
       DO UPDATE SET status = 'active', note = COALESCE(EXCLUDED.note, connected_pharmacies.note),
                     linked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [patientId, pharmacy.id, note || null]
    );

    await AuditLog.logSecurityEvent(
      req, patientId, 'patient', patientEmail,
      'pharmacy_linked', 'success', `pharmacy_id=${pharmacy.id}`
    );

    res.status(201).json({
      success: true,
      message: 'Pharmacy linked successfully',
      connection: {
        connection_id: upsert.rows[0].id,
        status: upsert.rows[0].status,
        linked_at: upsert.rows[0].linked_at,
        ...buildPharmacyPublic(pharmacy)
      }
    });
  } catch (error) {
    console.error('linkPharmacy error:', error);
    res.status(500).json({ success: false, message: 'Failed to link pharmacy' });
  }
}

/** DELETE /api/profile/linked-services/pharmacies/:connectionId */
async function unlinkPharmacy(req, res) {
  try {
    const patientId = req.user.id;
    const patientEmail = req.user.email;
    const { connectionId } = req.params;

    const result = await query(
      `UPDATE connected_pharmacies
          SET status = 'removed', updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND patient_id = $2
        RETURNING id, pharmacy_id`,
      [connectionId, patientId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Connection not found' });
    }

    await AuditLog.logSecurityEvent(
      req, patientId, 'patient', patientEmail,
      'pharmacy_unlinked', 'success', `pharmacy_id=${result.rows[0].pharmacy_id}`
    );

    res.json({ success: true, message: 'Pharmacy unlinked' });
  } catch (error) {
    console.error('unlinkPharmacy error:', error);
    res.status(500).json({ success: false, message: 'Failed to unlink pharmacy' });
  }
}

// ===================================================================
// FAMILY DEPENDENTS  (Tasks 23-24)
// ===================================================================

const ALLOWED_RELATIONSHIPS = [
  'child', 'spouse', 'parent', 'sibling', 'guardian', 'other'
];

function shapeDependent(row) {
  return {
    id: row.id,
    first_name: row.first_name,
    last_name: row.last_name,
    full_name: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
    date_of_birth: row.date_of_birth,
    gender: row.gender,
    relationship: row.relationship,
    id_number: row.id_number_encrypted ? decryptAndMask(row.id_number_encrypted) : null,
    phone: row.phone,
    linked_patient_id: row.linked_patient_id,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

/** GET /api/profile/linked-services/dependents */
async function listDependents(req, res) {
  try {
    const patientId = req.user.id;
    const result = await query(
      `SELECT * FROM family_dependents
        WHERE patient_id = $1
        ORDER BY created_at DESC`,
      [patientId]
    );
    res.json({
      success: true,
      dependents: result.rows.map(shapeDependent),
      total: result.rows.length
    });
  } catch (error) {
    console.error('listDependents error:', error);
    res.status(500).json({ success: false, message: 'Failed to list dependents' });
  }
}

/** POST /api/profile/linked-services/dependents
 *  Body: { first_name, last_name, relationship, date_of_birth?, gender?, id_number?, phone?, linked_patient_id?, notes? }
 */
async function addDependent(req, res) {
  try {
    const patientId = req.user.id;
    const patientEmail = req.user.email;
    const {
      first_name, last_name, relationship,
      date_of_birth, gender, id_number, phone, linked_patient_id, notes
    } = req.body;

    if (!first_name || !last_name || !relationship) {
      return res.status(400).json({
        success: false,
        message: 'first_name, last_name and relationship are required'
      });
    }
    if (!ALLOWED_RELATIONSHIPS.includes(String(relationship).toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `relationship must be one of: ${ALLOWED_RELATIONSHIPS.join(', ')}`
      });
    }
    if (date_of_birth && Number.isNaN(Date.parse(date_of_birth))) {
      return res.status(400).json({ success: false, message: 'Invalid date_of_birth' });
    }

    let id_number_encrypted = null;
    if (id_number) id_number_encrypted = encrypt(String(id_number));

    let resolvedLinkedPatientId = null;
    if (linked_patient_id) {
      const check = await query('SELECT id FROM patients WHERE id = $1', [linked_patient_id]);
      if (!check.rows.length) {
        return res.status(404).json({ success: false, message: 'linked_patient_id not found' });
      }
      resolvedLinkedPatientId = linked_patient_id;
    }

    const inserted = await query(
      `INSERT INTO family_dependents
         (patient_id, first_name, last_name, date_of_birth, gender,
          relationship, id_number_encrypted, phone, linked_patient_id, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        patientId,
        String(first_name).trim(),
        String(last_name).trim(),
        date_of_birth || null,
        gender || null,
        String(relationship).toLowerCase(),
        id_number_encrypted,
        phone || null,
        resolvedLinkedPatientId,
        notes || null
      ]
    );

    await AuditLog.logSecurityEvent(
      req, patientId, 'patient', patientEmail,
      'dependent_added', 'success', `dependent_id=${inserted.rows[0].id}`
    );

    res.status(201).json({
      success: true,
      message: 'Dependent added',
      dependent: shapeDependent(inserted.rows[0])
    });
  } catch (error) {
    console.error('addDependent error:', error);
    res.status(500).json({ success: false, message: 'Failed to add dependent' });
  }
}

/** PUT /api/profile/linked-services/dependents/:id */
async function updateDependent(req, res) {
  try {
    const patientId = req.user.id;
    const patientEmail = req.user.email;
    const dependentId = req.params.id;
    const allowed = ['first_name', 'last_name', 'date_of_birth', 'gender', 'relationship', 'phone', 'notes'];

    const fields = [];
    const values = [];
    let i = 1;

    for (const k of allowed) {
      if (req.body[k] !== undefined) {
        if (k === 'relationship' &&
            !ALLOWED_RELATIONSHIPS.includes(String(req.body[k]).toLowerCase())) {
          return res.status(400).json({
            success: false,
            message: `relationship must be one of: ${ALLOWED_RELATIONSHIPS.join(', ')}`
          });
        }
        fields.push(`${k} = $${i++}`);
        values.push(k === 'relationship' ? String(req.body[k]).toLowerCase() : req.body[k]);
      }
    }

    if (req.body.id_number !== undefined) {
      fields.push(`id_number_encrypted = $${i++}`);
      values.push(req.body.id_number ? encrypt(String(req.body.id_number)) : null);
    }

    if (!fields.length) {
      return res.status(400).json({ success: false, message: 'No updatable fields supplied' });
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(dependentId, patientId);

    const result = await query(
      `UPDATE family_dependents
          SET ${fields.join(', ')}
        WHERE id = $${i++} AND patient_id = $${i}
        RETURNING *`,
      values
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Dependent not found' });
    }

    await AuditLog.logSecurityEvent(
      req, patientId, 'patient', patientEmail,
      'dependent_updated', 'success', `dependent_id=${dependentId}`
    );

    res.json({ success: true, message: 'Dependent updated', dependent: shapeDependent(result.rows[0]) });
  } catch (error) {
    console.error('updateDependent error:', error);
    res.status(500).json({ success: false, message: 'Failed to update dependent' });
  }
}

/** DELETE /api/profile/linked-services/dependents/:id */
async function removeDependent(req, res) {
  try {
    const patientId = req.user.id;
    const patientEmail = req.user.email;
    const dependentId = req.params.id;

    const result = await query(
      `DELETE FROM family_dependents
        WHERE id = $1 AND patient_id = $2
        RETURNING id`,
      [dependentId, patientId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Dependent not found' });
    }

    await AuditLog.logSecurityEvent(
      req, patientId, 'patient', patientEmail,
      'dependent_removed', 'success', `dependent_id=${dependentId}`
    );

    res.json({ success: true, message: 'Dependent removed' });
  } catch (error) {
    console.error('removeDependent error:', error);
    res.status(500).json({ success: false, message: 'Failed to remove dependent' });
  }
}

module.exports = {
  listConnectedDoctors,
  linkDoctor,
  unlinkDoctor,
  listConnectedPharmacies,
  linkPharmacy,
  unlinkPharmacy,
  listDependents,
  addDependent,
  updateDependent,
  removeDependent
};
