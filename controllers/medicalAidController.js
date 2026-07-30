const fs = require('fs');
const path = require('path');
const { query } = require('../config/db');
const AuditLog = require('../models/AuditLog');
const { encrypt, decryptAndMask } = require('../utils/encryption');
const { sign: signUrl, verify: verifyUrl } = require('../utils/signedUrl');

const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads');
const CARD_DIR = path.join(UPLOAD_ROOT, 'medical-aid');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function buildSchemeResponse(row) {
  if (!row) return null;
  return {
    id: row.id,
    scheme_name: row.scheme_name,
    plan_name: row.plan_name,
    member_number: row.member_number_encrypted ? decryptAndMask(row.member_number_encrypted) : null,
    dependent_code: row.dependent_code_encrypted ? decryptAndMask(row.dependent_code_encrypted, 2) : null,
    is_principal_member: !!row.is_principal_member,
    principal_member_name: row.principal_member_name,
    principal_member_id: row.principal_member_id_encrypted ? decryptAndMask(row.principal_member_id_encrypted) : null,
    effective_date: row.effective_date,
    expiry_date: row.expiry_date,
    has_card_front: !!row.card_front_path,
    has_card_back: !!row.card_back_path,
    updated_at: row.updated_at
  };
}

function relativeFromAbsolute(absPath) {
  // Storage path stored relative to uploads/ for portability
  return path.relative(UPLOAD_ROOT, absPath).split(path.sep).join('/');
}

function absoluteFromRelative(relPath) {
  return path.join(UPLOAD_ROOT, relPath);
}

// SCHEME

/** GET /api/profile/medical-aid */
async function getScheme(req, res) {
  try {
    const patientId = req.user.id;
    const result = await query(
      'SELECT * FROM medical_aid_schemes WHERE patient_id = $1',
      [patientId]
    );
    res.json({ success: true, scheme: buildSchemeResponse(result.rows[0]) });
  } catch (error) {
    console.error('getScheme error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch medical aid scheme' });
  }
}

/** PUT /api/profile/medical-aid */
async function updateScheme(req, res) {
  try {
    const patientId = req.user.id;
    const patientEmail = req.user.email;
    const {
      scheme_name, plan_name,
      member_number, dependent_code,
      is_principal_member, principal_member_name, principal_member_id,
      effective_date, expiry_date
    } = req.body;

    if (scheme_name !== undefined && (!scheme_name || !String(scheme_name).trim())) {
      return res.status(400).json({ success: false, message: 'scheme_name cannot be empty' });
    }

    const memberEnc    = member_number !== undefined ? (member_number ? encrypt(String(member_number)) : null) : undefined;
    const dependentEnc = dependent_code !== undefined ? (dependent_code ? encrypt(String(dependent_code)) : null) : undefined;
    const principalEnc = principal_member_id !== undefined ? (principal_member_id ? encrypt(String(principal_member_id)) : null) : undefined;

    const existing = await query('SELECT id FROM medical_aid_schemes WHERE patient_id = $1', [patientId]);

    let row;
    if (!existing.rows.length) {
      if (!scheme_name) {
        return res.status(400).json({ success: false, message: 'scheme_name is required to create a record' });
      }
      const inserted = await query(
        `INSERT INTO medical_aid_schemes
           (patient_id, scheme_name, plan_name, member_number_encrypted,
            dependent_code_encrypted, is_principal_member, principal_member_name,
            principal_member_id_encrypted, effective_date, expiry_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING *`,
        [
          patientId,
          scheme_name,
          plan_name || null,
          memberEnc || null,
          dependentEnc || null,
          typeof is_principal_member === 'boolean' ? is_principal_member : true,
          principal_member_name || null,
          principalEnc || null,
          effective_date || null,
          expiry_date || null
        ]
      );
      row = inserted.rows[0];
    } else {
      const fields = [];
      const values = [];
      let i = 1;
      const push = (col, val) => {
        if (val === undefined) return;
        fields.push(`${col} = $${i++}`);
        values.push(val);
      };
      push('scheme_name', scheme_name);
      push('plan_name', plan_name);
      push('member_number_encrypted', memberEnc);
      push('dependent_code_encrypted', dependentEnc);
      push('is_principal_member', typeof is_principal_member === 'boolean' ? is_principal_member : undefined);
      push('principal_member_name', principal_member_name);
      push('principal_member_id_encrypted', principalEnc);
      push('effective_date', effective_date);
      push('expiry_date', expiry_date);

      if (!fields.length) {
        return res.status(400).json({ success: false, message: 'No updatable fields supplied' });
      }
      fields.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(patientId);
      const updated = await query(
        `UPDATE medical_aid_schemes SET ${fields.join(', ')} WHERE patient_id = $${i} RETURNING *`,
        values
      );
      row = updated.rows[0];
    }

    await AuditLog.logSecurityEvent(req, patientId, 'patient', patientEmail, 'medical_aid_updated', 'success');

    res.json({ success: true, message: 'Medical aid scheme saved', scheme: buildSchemeResponse(row) });
  } catch (error) {
    console.error('updateScheme error:', error);
    res.status(500).json({ success: false, message: 'Failed to update medical aid scheme' });
  }
}

// CARD UPLOAD

/** PUT /api/profile/medical-aid/card
 *  Multipart fields: front (image), back (image, optional). At least one required.
 */
async function uploadCard(req, res) {
  try {
    const patientId = req.user.id;
    const patientEmail = req.user.email;
    const files = req.files || {};
    const front = files.front?.[0];
    const back = files.back?.[0];

    if (!front && !back) {
      return res.status(400).json({ success: false, message: 'front and/or back image is required' });
    }

    // Make sure a scheme row exists before storing card paths
    const existing = await query('SELECT id FROM medical_aid_schemes WHERE patient_id = $1', [patientId]);
    if (!existing.rows.length) {
      return res.status(400).json({
        success: false,
        message: 'Create your medical aid scheme record first (PUT /api/profile/medical-aid)'
      });
    }

    ensureDir(CARD_DIR);

    const writeFile = (file, side) => {
      const ext = (path.extname(file.originalname) || '.jpg').toLowerCase();
      const filename = `patient_${patientId}_${side}_${Date.now()}${ext}`;
      const abs = path.join(CARD_DIR, filename);
      fs.writeFileSync(abs, file.buffer);
      return relativeFromAbsolute(abs);
    };

    const fields = [];
    const values = [];
    let i = 1;
    if (front) {
      fields.push(`card_front_path = $${i++}`);
      values.push(writeFile(front, 'front'));
    }
    if (back) {
      fields.push(`card_back_path = $${i++}`);
      values.push(writeFile(back, 'back'));
    }
    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(patientId);

    const updated = await query(
      `UPDATE medical_aid_schemes SET ${fields.join(', ')}
        WHERE patient_id = $${i} RETURNING *`,
      values
    );

    await AuditLog.logSecurityEvent(req, patientId, 'patient', patientEmail, 'medical_aid_card_uploaded', 'success');

    res.json({
      success: true,
      message: 'Medical aid card uploaded',
      scheme: buildSchemeResponse(updated.rows[0])
    });
  } catch (error) {
    console.error('uploadCard error:', error);
    res.status(500).json({ success: false, message: 'Failed to upload card' });
  }
}

/** GET /api/profile/medical-aid/card/:side/url   (side = front|back)
 *  Returns a short-lived signed URL the client can fetch.
 */
async function getCardSignedUrl(req, res) {
  try {
    const patientId = req.user.id;
    const side = req.params.side;
    if (!['front', 'back'].includes(side)) {
      return res.status(400).json({ success: false, message: 'side must be front or back' });
    }
    const col = side === 'front' ? 'card_front_path' : 'card_back_path';
    const result = await query(
      `SELECT ${col} AS p FROM medical_aid_schemes WHERE patient_id = $1`,
      [patientId]
    );
    const relPath = result.rows[0]?.p;
    if (!relPath) {
      return res.status(404).json({ success: false, message: 'Card image not found' });
    }
    const token = signUrl({ userId: patientId, path: relPath, kind: 'medical_aid_card', ttlSeconds: 600 });
    const base = `${req.protocol}://${req.get('host')}`;
    res.json({
      success: true,
      url: `${base}/api/profile/medical-aid/files/download?token=${token}`,
      expires_in: 600
    });
  } catch (error) {
    console.error('getCardSignedUrl error:', error);
    res.status(500).json({ success: false, message: 'Failed to sign card URL' });
  }
}


// CLAIMS 

/** GET /api/profile/medical-aid/claims?status=&limit=&offset= */
async function listClaims(req, res) {
  try {
    const patientId = req.user.id;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const status = req.query.status;

    const params = [patientId];
    let where = 'WHERE patient_id = $1';
    if (status) {
      params.push(status);
      where += ` AND status = $${params.length}`;
    }
    params.push(limit, offset);
    const result = await query(
      `SELECT id, claim_number, service_date, submitted_date, provider_name,
              service_description, amount_claimed, amount_paid, amount_outstanding,
              status, created_at
         FROM medical_aid_claims
         ${where}
         ORDER BY service_date DESC NULLS LAST, created_at DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({ success: true, claims: result.rows, total: result.rows.length, limit, offset });
  } catch (error) {
    console.error('listClaims error:', error);
    res.status(500).json({ success: false, message: 'Failed to list claims' });
  }
}

/** GET /api/profile/medical-aid/claims/:id */
async function getClaim(req, res) {
  try {
    const patientId = req.user.id;
    const result = await query(
      `SELECT * FROM medical_aid_claims WHERE id = $1 AND patient_id = $2`,
      [req.params.id, patientId]
    );
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Claim not found' });
    }
    const claim = result.rows[0];
    const response = { ...claim };
    if (claim.document_path) {
      response.document_url = `${req.protocol}://${req.get('host')}/api/profile/medical-aid/files/download?token=${signUrl({
        userId: patientId, path: claim.document_path, kind: 'claim', ttlSeconds: 600
      })}`;
      response.document_url_expires_in = 600;
    }
    delete response.document_path;
    res.json({ success: true, claim: response });
  } catch (error) {
    console.error('getClaim error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch claim' });
  }
}

// INVOICES

/** GET /api/profile/medical-aid/invoices?status=&limit=&offset= */
async function listInvoices(req, res) {
  try {
    const patientId = req.user.id;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const status = req.query.status;

    const params = [patientId];
    let where = 'WHERE patient_id = $1';
    if (status) {
      params.push(status);
      where += ` AND status = $${params.length}`;
    }
    params.push(limit, offset);
    const result = await query(
      `SELECT id, invoice_number, issued_date, due_date, provider_name,
              description, subtotal, tax, total, amount_paid, currency, status, created_at
         FROM invoices
         ${where}
         ORDER BY issued_date DESC NULLS LAST, created_at DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ success: true, invoices: result.rows, total: result.rows.length, limit, offset });
  } catch (error) {
    console.error('listInvoices error:', error);
    res.status(500).json({ success: false, message: 'Failed to list invoices' });
  }
}

/** GET /api/profile/medical-aid/invoices/:id */
async function getInvoice(req, res) {
  try {
    const patientId = req.user.id;
    const result = await query(
      `SELECT * FROM invoices WHERE id = $1 AND patient_id = $2`,
      [req.params.id, patientId]
    );
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    const invoice = result.rows[0];
    const response = { ...invoice };
    if (invoice.document_path) {
      response.document_url = `${req.protocol}://${req.get('host')}/api/profile/medical-aid/files/download?token=${signUrl({
        userId: patientId, path: invoice.document_path, kind: 'invoice', ttlSeconds: 600
      })}`;
      response.document_url_expires_in = 600;
    }
    delete response.document_path;
    res.json({ success: true, invoice: response });
  } catch (error) {
    console.error('getInvoice error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch invoice' });
  }
}

// SIGNED FILE DOWNLOAD  

/** GET /api/profile/medical-aid/files/download?token=... */
async function downloadFile(req, res) {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ success: false, message: 'token is required' });

    const payload = verifyUrl(token);
    if (!payload) {
      return res.status(401).json({ success: false, message: 'Invalid or expired link' });
    }

    // Ownership re-check against the appropriate table for the token's kind
    const userId = parseInt(payload.sub, 10);
    let ownershipOk = false;
    if (payload.kind === 'medical_aid_card') {
      const r = await query(
        `SELECT 1 FROM medical_aid_schemes
          WHERE patient_id = $1 AND ($2 IN (card_front_path, card_back_path))`,
        [userId, payload.path]
      );
      ownershipOk = r.rows.length > 0;
    } else if (payload.kind === 'claim') {
      const r = await query(
        `SELECT 1 FROM medical_aid_claims WHERE patient_id = $1 AND document_path = $2`,
        [userId, payload.path]
      );
      ownershipOk = r.rows.length > 0;
    } else if (payload.kind === 'invoice') {
      const r = await query(
        `SELECT 1 FROM invoices WHERE patient_id = $1 AND document_path = $2`,
        [userId, payload.path]
      );
      ownershipOk = r.rows.length > 0;
    }
    if (!ownershipOk) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const abs = absoluteFromRelative(payload.path);
    // Path-traversal guard
    if (!abs.startsWith(UPLOAD_ROOT)) {
      return res.status(400).json({ success: false, message: 'Invalid path' });
    }
    if (!fs.existsSync(abs)) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }

    // Best-effort audit (no req.user here)
    try {
      const fakeReq = { ...req, user: { id: userId, email: null } };
      await AuditLog.logSecurityEvent(
        fakeReq, userId, 'patient', null,
        'medical_aid_document_downloaded', 'success',
        `kind=${payload.kind}`
      );
    } catch (_) { /* swallow */ }

    res.download(abs);
  } catch (error) {
    console.error('downloadFile error:', error);
    res.status(500).json({ success: false, message: 'Failed to download file' });
  }
}

module.exports = {
  getScheme,
  updateScheme,
  uploadCard,
  getCardSignedUrl,
  listClaims,
  getClaim,
  listInvoices,
  getInvoice,
  downloadFile
};
