/**
 * PHR Controller
 * Handles Personal Health Record operations
 */

const PHR = require('../models/PHR');
const PHRAccess = require('../models/PHRAccess');
const { validateVitals, computeBmi } = require('../services/vitalsService');
const { describeAccess } = require('../services/phrAccessService');
const Doctor = require('../models/Doctor');
const notificationService = require('../services/notificationService');
const FileUploadService = require('../services/fileUploadService');

/**
 * @route GET /api/phr/complete
 * Get complete PHR for current patient
 */
exports.getCompletePHR = async (req, res) => {
  try {
    const patientId = req.user.id;

    const phr = await PHR.getCompletePHR(patientId);

    if (!phr.personalCard) {
      return res.status(404).json({
        success: false,
        message: 'Patient record not found',
      });
    }

    res.json({
      success: true,
      data: phr,
    });
  } catch (error) {
    console.error('Error fetching PHR:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching PHR',
      error: error.message,
    });
  }
};

/**
 * @route GET /api/phr/personal-card
 * Get patient personal card (name, blood type, emergency contact, medical aid)
 */
exports.getPersonalCard = async (req, res) => {
  try {
    const patientId = req.user.id;

    const personalCard = await PHR.getPersonalCard(patientId);

    if (!personalCard) {
      return res.status(404).json({
        success: false,
        message: 'Patient record not found',
      });
    }

    res.json({
      success: true,
      data: personalCard,
    });
  } catch (error) {
    console.error('Error fetching personal card:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching personal card',
      error: error.message,
    });
  }
};

/**
 * @route PUT /api/phr/personal-card
 * Update personal health details (blood type, medical aid type)
 */
exports.updatePersonalCard = async (req, res) => {
  try {
    const patientId = req.user.id;
    const { blood_type, medical_aid_type } = req.body;

    // Validate blood type
    const validBloodTypes = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'Unknown'];
    if (blood_type && !validBloodTypes.includes(blood_type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid blood type',
      });
    }

    // Validate medical aid type
    const validAidTypes = ['Government', 'Private', 'NGO', 'Self-Pay', 'Insurance', 'None', 'Other'];
    if (medical_aid_type && !validAidTypes.includes(medical_aid_type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid medical aid type',
      });
    }

    const updated = await PHR.updatePersonalHealthDetails(patientId, {
      blood_type,
      medical_aid_type,
    });

    res.json({
      success: true,
      message: 'Personal health details updated successfully',
      data: updated,
    });
  } catch (error) {
    console.error('Error updating personal card:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating personal card',
      error: error.message,
    });
  }
};

/**
 * @route GET /api/phr/medical-summary
 * Get medical summary (conditions count, allergies, etc.)
 */
exports.getMedicalSummary = async (req, res) => {
  try {
    const patientId = req.user.id;

    const summary = await PHR.getMedicalSummary(patientId);

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error('Error fetching medical summary:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching medical summary',
      error: error.message,
    });
  }
};

/**
 * @route GET /api/phr/prescriptions
 * Get active prescriptions
 */
exports.getActivePrescriptions = async (req, res) => {
  try {
    const patientId = req.user.id;

    const prescriptions = await PHR.getActivePrescriptions(patientId);

    res.json({
      success: true,
      data: prescriptions,
    });
  } catch (error) {
    console.error('Error fetching prescriptions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching prescriptions',
      error: error.message,
    });
  }
};

/**
 * @route GET /api/phr/medications
 * Get current medications
 */
exports.getCurrentMedications = async (req, res) => {
  try {
    const patientId = req.user.id;

    const medications = await PHR.getCurrentMedications(patientId);

    res.json({
      success: true,
      data: medications,
    });
  } catch (error) {
    console.error('Error fetching medications:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching medications',
      error: error.message,
    });
  }
};

/**
 * @route GET /api/phr/allergies
 * Get allergies
 */
exports.getAllergies = async (req, res) => {
  try {
    const patientId = req.user.id;

    const allergies = await PHR.getAllergies(patientId);

    res.json({
      success: true,
      data: allergies,
    });
  } catch (error) {
    console.error('Error fetching allergies:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching allergies',
      error: error.message,
    });
  }
};

/**
 * @route GET /api/phr/conditions
 * Get medical conditions
 */
exports.getMedicalConditions = async (req, res) => {
  try {
    const patientId = req.user.id;

    const conditions = await PHR.getMedicalConditions(patientId);

    res.json({
      success: true,
      data: conditions,
    });
  } catch (error) {
    console.error('Error fetching conditions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching conditions',
      error: error.message,
    });
  }
};

/**
 * @route GET /api/phr/appointments
 * Get upcoming appointments
 */
exports.getUpcomingAppointments = async (req, res) => {
  try {
    const patientId = req.user.id;

    const appointments = await PHR.getUpcomingAppointments(patientId);

    res.json({
      success: true,
      data: appointments,
    });
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching appointments',
      error: error.message,
    });
  }
};

/**
 * @route GET /api/phr/history
 * Get health history (completed appointments, past prescriptions, etc.)
 */
exports.getHealthHistory = async (req, res) => {
  try {
    const patientId = req.user.id;

    const history = await PHR.getHealthHistory(patientId);

    res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error('Error fetching health history:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching health history',
      error: error.message,
    });
  }
};

/**
 * @route GET /api/phr/vitals
 * Get recent health vitals
 */
exports.getHealthVitals = async (req, res) => {
  try {
    const patientId = req.user.id;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 30, 1), 200);

    const vitals = await PHR.getRecentHealthVitals(patientId, limit);

    res.json({
      success: true,
      data: vitals,
    });
  } catch (error) {
    console.error('Error fetching health vitals:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching health vitals',
      error: error.message,
    });
  }
};

/**
 * Whether a doctor may see a patient's health record, vitals included, and
 * record vitals for them.
 *
 * Agreed at the 28 October meeting: booking a doctor is what shares the
 * record. Any doctor with a non-cancelled appointment qualifies, with no
 * access request. An explicit PHR grant still counts too.
 */
async function doctorMaySeeRecord(patientId, doctorId) {
  return (await PHRAccess.hasAppointmentWith(patientId, doctorId))
    || PHRAccess.hasAccess(patientId, doctorId);
}

/**
 * @route POST /api/users/phr/:patientId/vitals
 * A doctor records a reading for a patient who booked them. Patients view
 * their vitals but no longer record them.
 */
exports.recordPatientVital = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const patientId = Number.parseInt(req.params.patientId, 10);
    if (!Number.isInteger(patientId)) {
      return res.status(400).json({ success: false, message: 'Invalid patient id' });
    }

    if (!(await doctorMaySeeRecord(patientId, doctorId))) {
      return res.status(403).json({
        success: false,
        message: 'You can record vitals only for patients who have booked with you',
      });
    }

    const { errors, values } = validateVitals(req.body);

    if (errors.length) {
      return res.status(400).json({
        success: false,
        message: errors[0],
        errors,
      });
    }

    if (values.weight_kg != null) {
      const height = values.height_cm ?? await PHR.getLatestHeight(patientId);
      values.bmi = computeBmi(values.weight_kg, height);
    }

    values.recorded_by_doctor_id = doctorId;
    const recorded = await PHR.recordHealthVital(patientId, values);
    await PHRAccess.logAccess(patientId, doctorId, 'record_vitals', req.ip);

    res.status(201).json({
      success: true,
      message: 'Health vital recorded successfully',
      data: recorded,
    });
  } catch (error) {
    console.error('Error recording vital:', error);
    res.status(500).json({
      success: false,
      message: 'Error recording health vital',
      error: error.message,
    });
  }
};

/**
 * @route GET /api/phr/vitals/range
 * Get health vitals for date range
 */
exports.getHealthVitalsRange = async (req, res) => {
  try {
    const patientId = req.user.id;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'startDate and endDate are required',
      });
    }

    const vitals = await PHR.getHealthVitalsRange(patientId, startDate, endDate);

    res.json({
      success: true,
      data: vitals,
    });
  } catch (error) {
    console.error('Error fetching vitals range:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching health vitals',
      error: error.message,
    });
  }
};

/**
 * @route GET /api/phr/documents
 * Get PHR documents
 */
exports.getPHRDocuments = async (req, res) => {
  try {
    const patientId = req.user.id;

    const documents = await PHR.getPHRDocuments(patientId);

    res.json({
      success: true,
      data: documents,
    });
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching PHR documents',
      error: error.message,
    });
  }
};

/**
 * @route POST /api/phr/documents
 * Upload PHR document
 */
exports.uploadDocument = async (req, res) => {
  try {
    const patientId = req.user.id;
    const { document_name, document_type, file_path, document_date, description, related_condition, notes } = req.body;

    if (!document_name || !document_type || !file_path) {
      return res.status(400).json({
        success: false,
        message: 'document_name, document_type, and file_path are required',
      });
    }

    const uploaded = await PHR.uploadDocument(patientId, {
      document_name,
      document_type,
      file_path,
      document_date,
      description,
      related_condition,
      notes,
    });

    res.status(201).json({
      success: true,
      message: 'Document uploaded successfully',
      data: uploaded,
    });
  } catch (error) {
    console.error('Error uploading document:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading document',
      error: error.message,
    });
  }
};

/**
 * ACCESS CONTROL ENDPOINTS
 */

/**
 * @route GET /api/phr/access
 * Get all doctors with access to patient PHR
 */
exports.getAccessList = async (req, res) => {
  try {
    const patientId = req.user.id;

    const accessList = await PHRAccess.getAccessList(patientId);

    res.json({
      success: true,
      data: accessList,
    });
  } catch (error) {
    console.error('Error fetching access list:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching access list',
      error: error.message,
    });
  }
};

/**
 * @route POST /api/phr/access
 * Grant doctor access to patient PHR (patient-initiated)
 */
exports.grantAccess = async (req, res) => {
  try {
    const patientId = req.user.id;
    const { doctor_id, access_type = 'view', expires_at } = req.body;

    if (!doctor_id) {
      return res.status(400).json({
        success: false,
        message: 'doctor_id is required',
      });
    }

    const granted = await PHRAccess.grantAccess(patientId, doctor_id, access_type, expires_at);

    res.status(201).json({
      success: true,
      message: 'Access granted successfully',
      data: granted,
    });
  } catch (error) {
    console.error('Error granting access:', error);
    res.status(500).json({
      success: false,
      message: 'Error granting access',
      error: error.message,
    });
  }
};

/**
 * @route DELETE /api/phr/access/:doctorId
 * Revoke doctor access to patient PHR
 */
exports.revokeAccess = async (req, res) => {
  try {
    const patientId = req.user.id;
    const doctorId = req.params.doctorId;

    const revoked = await PHRAccess.revokeAccess(patientId, doctorId);

    if (!revoked) {
      return res.status(404).json({
        success: false,
        message: 'Access record not found',
      });
    }

    res.json({
      success: true,
      message: 'Access revoked successfully',
      data: revoked,
    });
  } catch (error) {
    console.error('Error revoking access:', error);
    res.status(500).json({
      success: false,
      message: 'Error revoking access',
      error: error.message,
    });
  }
};

/**
 * @route GET /api/phr/access/requests
 * Get pending access requests for patient
 */
exports.getPendingRequests = async (req, res) => {
  try {
    const patientId = req.user.id;

    const requests = await PHRAccess.getPendingRequests(patientId);

    res.json({
      success: true,
      data: requests,
    });
  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching access requests',
      error: error.message,
    });
  }
};

/**
 * @route POST /api/phr/access/requests/:requestId/approve
 * Approve access request
 */
/**
 * The patient's own pending request, or an error response already sent.
 * Without this check any patient could answer any request by its id,
 * including one asking for someone else's record.
 */
async function ownPendingRequest(req, res) {
  const requestId = Number.parseInt(req.params.requestId, 10);
  const request = Number.isInteger(requestId) ? await PHRAccess.getRequestById(requestId) : null;
  if (!request || Number(request.patient_id) !== Number(req.user.id)) {
    res.status(404).json({ success: false, message: 'Access request not found' });
    return null;
  }
  if (request.status !== 'pending') {
    res.status(409).json({
      success: false,
      message: `This request has already been ${request.status}.`,
    });
    return null;
  }
  return request;
}

exports.approveAccessRequest = async (req, res) => {
  try {
    const request = await ownPendingRequest(req, res);
    if (!request) return;
    const { expires_at } = req.body || {};

    const approved = await PHRAccess.approveAccessRequest(request.id, expires_at);

    res.json({
      success: true,
      message: 'Access request approved',
      data: approved,
    });
  } catch (error) {
    console.error('Error approving request:', error);
    res.status(500).json({
      success: false,
      message: 'Error approving access request',
      error: error.message,
    });
  }
};

/**
 * @route POST /api/phr/access/requests/:requestId/deny
 * Deny access request
 */
exports.denyAccessRequest = async (req, res) => {
  try {
    const request = await ownPendingRequest(req, res);
    if (!request) return;
    const { reason } = req.body || {};

    const denied = await PHRAccess.denyAccessRequest(request.id, reason);

    res.json({
      success: true,
      message: 'Access request denied',
      data: denied,
    });
  } catch (error) {
    console.error('Error denying request:', error);
    res.status(500).json({
      success: false,
      message: 'Error denying access request',
      error: error.message,
    });
  }
};

/**
 * @route GET /api/phr/access-logs
 * Get access logs (audit trail)
 */
exports.getAccessLogs = async (req, res) => {
  try {
    const patientId = req.user.id;
    const { limit = 100 } = req.query;

    const logs = await PHRAccess.getAccessLogs(patientId, parseInt(limit));

    res.json({
      success: true,
      data: logs,
    });
  } catch (error) {
    console.error('Error fetching access logs:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching access logs',
      error: error.message,
    });
  }
};

/**
 * DOCTOR ENDPOINTS
 */

/**
 * @route POST /api/phr/:patientId/access-request
 * Request access to patient PHR (doctor-initiated)
 */
exports.requestAccess = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const patientId = Number.parseInt(req.params.patientId, 10);
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 500) : null;

    if (!Number.isInteger(patientId)) {
      return res.status(400).json({ success: false, message: 'Invalid patient id' });
    }
    if (!(await PHRAccess.hasAppointmentWith(patientId, doctorId))) {
      return res.status(403).json({
        success: false,
        message: 'You can only ask to see the record of a patient who has booked with you.',
      });
    }

    const grant = await PHRAccess.getActiveGrant(patientId, doctorId);
    const latest = await PHRAccess.getLatestRequest(patientId, doctorId);
    const current = describeAccess(grant, latest);
    if (current.status === 'granted' || current.status === 'pending') {
      return res.json({
        success: true,
        message: current.status === 'granted'
          ? 'You already have access to this record'
          : 'Your request is already waiting for the patient',
        data: current,
      });
    }

    const request = await PHRAccess.requestAccess(patientId, doctorId, reason || null);

    const doctor = await Doctor.findById(doctorId).catch(() => null);
    const name = doctor ? `Dr. ${doctor.first_name} ${doctor.last_name}` : 'A doctor';
    notificationService.sendToPatient({
      patientId,
      type: 'message',
      title: 'A doctor asked to see your health record',
      body: `${name} would like to see your health record, including your vitals. Open Medical Files to allow or decline.`,
      data: { kind: 'phr_access_request', requestId: request.id },
    }).catch((err) => console.error('Notification error (non-blocking):', err.message));

    res.status(201).json({
      success: true,
      message: 'Access request sent to patient',
      data: describeAccess(null, request),
    });
  } catch (error) {
    console.error('Error requesting access:', error);
    res.status(500).json({
      success: false,
      message: 'Error requesting access',
      error: error.message,
    });
  }
};

/**
 * @route GET /api/phr/:patientId/access-status
 * Where the doctor stands with this patient's record: granted, pending,
 * denied, revoked or none. See services/phrAccessService.js.
 */
exports.getAccessStatus = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const patientId = Number.parseInt(req.params.patientId, 10);
    if (!Number.isInteger(patientId)) {
      return res.status(400).json({ success: false, message: 'Invalid patient id' });
    }

    const grant = await PHRAccess.getActiveGrant(patientId, doctorId);
    const latest = grant ? null : await PHRAccess.getLatestRequest(patientId, doctorId);
    const status = describeAccess(grant, latest);
    status.canRequest = status.status !== 'granted' && status.status !== 'pending'
      && await PHRAccess.hasAppointmentWith(patientId, doctorId);

    res.json({ success: true, data: status });
  } catch (error) {
    console.error('Error fetching access status:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching access status',
      error: error.message,
    });
  }
};

/**
 * @route GET /api/phr/:patientId
 * Get patient PHR (doctor accessing with permission)
 */
exports.viewPatientPHR = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const patientId = req.params.patientId;
    const ipAddress = req.ip;

    if (!(await doctorMaySeeRecord(patientId, doctorId))) {
      return res.status(403).json({
        success: false,
        message: 'You can see the record only of patients who have booked with you',
      });
    }

    // Log access
    await PHRAccess.logAccess(patientId, doctorId, 'view', ipAddress);

    const phr = await PHR.getCompletePHR(patientId);

    res.json({
      success: true,
      data: phr,
    });
  } catch (error) {
    console.error('Error viewing patient PHR:', error);
    res.status(500).json({
      success: false,
      message: 'Error viewing patient PHR',
      error: error.message,
    });
  }
};

/**
 * @route GET /api/phr/:patientId/personal-card
 * Get patient personal card (doctor with access)
 */
exports.viewPatientPersonalCard = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const patientId = req.params.patientId;
    const ipAddress = req.ip;

    if (!(await doctorMaySeeRecord(patientId, doctorId))) {
      return res.status(403).json({
        success: false,
        message: 'You can see the record only of patients who have booked with you',
      });
    }

    // Log access
    await PHRAccess.logAccess(patientId, doctorId, 'view_personal_card', ipAddress);

    const personalCard = await PHR.getPersonalCard(patientId);

    res.json({
      success: true,
      data: personalCard,
    });
  } catch (error) {
    console.error('Error viewing personal card:', error);
    res.status(500).json({
      success: false,
      message: 'Error viewing personal card',
      error: error.message,
    });
  }
};

/**
 * @route GET /api/phr/:patientId/vitals
 * Get patient health vitals (doctor with access)
 */
exports.viewPatientVitals = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const patientId = req.params.patientId;
    const { limit = 30 } = req.query;
    const ipAddress = req.ip;

    if (!(await doctorMaySeeRecord(patientId, doctorId))) {
      return res.status(403).json({
        success: false,
        message: 'You can see vitals only for patients who have booked with you',
      });
    }

    // Log access
    await PHRAccess.logAccess(patientId, doctorId, 'view_vitals', ipAddress);

    const vitals = await PHR.getRecentHealthVitals(patientId, parseInt(limit));

    res.json({
      success: true,
      data: vitals,
    });
  } catch (error) {
    console.error('Error viewing vitals:', error);
    res.status(500).json({
      success: false,
      message: 'Error viewing patient vitals',
      error: error.message,
    });
  }
};

/**
 * @route GET /api/phr/:patientId/medications
 * Get patient medications (doctor with access)
 */
exports.viewPatientMedications = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const patientId = req.params.patientId;
    const ipAddress = req.ip;

    if (!(await doctorMaySeeRecord(patientId, doctorId))) {
      return res.status(403).json({
        success: false,
        message: 'You can see the record only of patients who have booked with you',
      });
    }

    // Log access
    await PHRAccess.logAccess(patientId, doctorId, 'view_medications', ipAddress);

    const medications = await PHR.getCurrentMedications(patientId);

    res.json({
      success: true,
      data: medications,
    });
  } catch (error) {
    console.error('Error viewing medications:', error);
    res.status(500).json({
      success: false,
      message: 'Error viewing patient medications',
      error: error.message,
    });
  }
};

/**
 * Shared guard for the doctor's read-only record views below: a non-cancelled
 * booking with the patient (or an explicit grant), as for vitals.
 */
async function guardRecordView(req, res, action) {
  const doctorId = req.user.id;
  const patientId = Number.parseInt(req.params.patientId, 10);
  if (!Number.isInteger(patientId)) {
    res.status(400).json({ success: false, message: 'Invalid patient id' });
    return null;
  }
  if (!(await doctorMaySeeRecord(patientId, doctorId))) {
    res.status(403).json({
      success: false,
      message: 'You can see the record only of patients who have booked with you',
    });
    return null;
  }
  await PHRAccess.logAccess(patientId, doctorId, action, req.ip);
  return patientId;
}

/**
 * @route GET /api/users/phr/:patientId/history
 * The patient's completed visits and prescriptions, from every doctor,
 * newest first. Read-only.
 */
exports.viewPatientHistory = async (req, res) => {
  try {
    const patientId = await guardRecordView(req, res, 'view_history');
    if (patientId == null) return;
    const history = await PHR.getHealthHistory(patientId);
    res.json({ success: true, data: history });
  } catch (error) {
    console.error('Error viewing patient history:', error);
    res.status(500).json({
      success: false,
      message: 'Error viewing patient history',
      error: error.message,
    });
  }
};

/**
 * @route GET /api/users/phr/:patientId/documents
 * The files the patient stored through /users/profile/files (the patient
 * app's documents). Metadata only; download below.
 */
exports.viewPatientDocuments = async (req, res) => {
  try {
    const patientId = await guardRecordView(req, res, 'view_documents');
    if (patientId == null) return;
    const files = await FileUploadService.listPatientFiles(patientId);
    res.json({ success: true, data: files });
  } catch (error) {
    console.error('Error viewing patient documents:', error);
    res.status(500).json({
      success: false,
      message: 'Error viewing patient documents',
      error: error.message,
    });
  }
};

/**
 * @route GET /api/users/phr/:patientId/documents/:fileId
 * Downloads one of the patient's files. getFile re-checks that the file
 * belongs to this patient.
 */
exports.downloadPatientDocument = async (req, res) => {
  try {
    const patientId = await guardRecordView(req, res, 'download_document');
    if (patientId == null) return;
    const file = await FileUploadService.getFile(req.params.fileId, patientId);
    res.contentType(file.mimetype || 'application/octet-stream');
    res.attachment(file.filename);
    res.send(file.buffer);
  } catch (error) {
    if (String(error.message).startsWith('File not found')) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }
    console.error('Error downloading patient document:', error);
    res.status(500).json({
      success: false,
      message: 'Error downloading the document',
      error: error.message,
    });
  }
};
