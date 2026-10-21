const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { query } = require('../config/db');
const storage = require('./storage');

/**
 * Secure File Upload Service
 * Handles uploads for medical reports, policies, etc.
 */

class FileUploadService {
  constructor() {
    this.allowedMimeTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/jpg',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    this.maxFileSize = 10 * 1024 * 1024; // 10MB
    this.allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx', '.txt'];

    // Where these files live inside the store. The storage driver owns the
    // rest of the path, so this is a prefix and not a directory on disk.
    this.folder = 'patient-files';
  }

  /**
   * Rows written before file storage moved behind a driver hold an absolute
   * path on the machine that took the upload. Those files are gone on an
   * ephemeral host, but a developer's local ones still work, so read them
   * where they are instead of failing.
   */
  static isLegacyPath(stored) {
    return !storage.isSafeKey(stored);
  }

  /**
   * The bytes behind a stored file, from the configured store or, for an
   * old row, from the absolute path it was written to.
   */
  async readBytes(stored) {
    if (FileUploadService.isLegacyPath(stored)) {
      if (!fs.existsSync(stored)) {
        throw new Error('File not found on disk');
      }
      return fs.readFileSync(stored);
    }
    try {
      const object = await storage.get(stored);
      return object.buffer;
    } catch (error) {
      if (error.code === 'STORAGE_NOT_FOUND') {
        throw new Error('File not found on disk');
      }
      throw error;
    }
  }

  /**
   * Create file metadata table
   */
  static async createFilesTable() {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS patient_files (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_type VARCHAR(50),
        file_size INTEGER,
        file_path TEXT NOT NULL,
        file_hash VARCHAR(64),
        category VARCHAR(100) CHECK (category IN (
          'Medical Report', 'Lab Result', 'Prescription', 'Insurance Document',
          'Hospital Record', 'Test Image', 'Policy Document', 'Other'
        )),
        description TEXT,
        tags TEXT[],
        uploaded_by INTEGER,
        upload_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_encrypted BOOLEAN DEFAULT true,
        virus_scanned BOOLEAN DEFAULT false,
        access_log TEXT[],
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
        FOREIGN KEY (uploaded_by) REFERENCES patients(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_patient_files_patient_id ON patient_files(patient_id);
      CREATE INDEX IF NOT EXISTS idx_patient_files_category ON patient_files(category);
      CREATE INDEX IF NOT EXISTS idx_patient_files_upload_timestamp ON patient_files(upload_timestamp);
    `;

    try {
      await query(createTableQuery);
      console.log('✅ Patient files table created successfully');
    } catch (error) {
      console.error('❌ Error creating patient files table:', error);
      throw error;
    }
  }

  /**
   * Validate file before upload
   */
  validateFile(file) {
    const errors = [];

    if (!file) {
      errors.push('No file provided');
      return { valid: false, errors };
    }

    // Check file size
    if (file.size > this.maxFileSize) {
      errors.push(`File size exceeds maximum limit of 10MB. Uploaded: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
    }

    // Check MIME type
    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      errors.push(`File type not allowed. Allowed types: ${this.allowedMimeTypes.join(', ')}`);
    }

    // Check file extension
    const ext = path.extname(file.originalname).toLowerCase();
    if (!this.allowedExtensions.includes(ext)) {
      errors.push(`File extension not allowed. Allowed: ${this.allowedExtensions.join(', ')}`);
    }

    // Check for dangerous content (basic check)
    if (this.containsDangerousContent(file.originalname)) {
      errors.push('File name contains suspicious patterns');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Check for dangerous content in filename
   */
  containsDangerousContent(filename) {
    const dangerousPatterns = [
      /\.\./,           // Directory traversal
      /[<>:"|?*]/,      // Invalid characters
      /exec/i,          // Executable patterns
      /script/i,        // Script patterns
      /\.exe/i,         // Executable extension
      /\.bat/i          // Batch file
    ];

    return dangerousPatterns.some(pattern => pattern.test(filename));
  }

  /**
   * Generate secure filename
   */
  generateSecureFilename(originalFilename) {
    const ext = path.extname(originalFilename);
    const random = crypto.randomBytes(8).toString('hex');
    const timestamp = Date.now();
    return `${timestamp}_${random}${ext}`;
  }

  /**
   * Calculate file hash (SHA256) over the bytes themselves, so it works the
   * same whether they came off a disk or out of a bucket.
   */
  calculateFileHash(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Upload file securely
   */
  async uploadFile(patientId, file, category, description = null, tags = []) {
    try {
      // Validate file
      const validation = this.validateFile(file);
      if (!validation.valid) {
        throw new Error(`File validation failed: ${validation.errors.join(', ')}`);
      }

      // Generate secure filename
      const secureFilename = this.generateSecureFilename(file.originalname);

      // Hand the bytes to whichever store is configured. What comes back is
      // a key, not a path -- the only thing worth keeping, because it stays
      // valid if the driver changes underneath.
      const storageKey = await storage.put(
        file,
        `${this.folder}/patient_${patientId}`,
        secureFilename
      );

      const fileHash = this.calculateFileHash(file.buffer);

      // Store metadata in database
      const insertQuery = `
        INSERT INTO patient_files (
          patient_id, file_name, file_type, file_size, file_path, 
          file_hash, category, description, tags, uploaded_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;

      const result = await query(insertQuery, [
        patientId,
        file.originalname,
        file.mimetype,
        file.size,
        storageKey,
        fileHash,
        category,
        description,
        JSON.stringify(tags),
        patientId
      ]);

      return {
        success: true,
        file: result.rows[0],
        message: 'File uploaded successfully'
      };

    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  }

  /**
   * Retrieve file securely
   */
  async getFile(fileId, patientId) {
    try {
      const selectQuery = `
        SELECT * FROM patient_files
        WHERE id = $1 AND patient_id = $2
      `;

      const result = await query(selectQuery, [fileId, patientId]);

      if (result.rows.length === 0) {
        throw new Error('File not found or access denied');
      }

      const fileRecord = result.rows[0];
      const fileBuffer = await this.readBytes(fileRecord.file_path);

      // Log access
      await this.logFileAccess(fileId, patientId);

      return {
        buffer: fileBuffer,
        mimetype: fileRecord.file_type,
        filename: fileRecord.file_name,
        metadata: fileRecord
      };

    } catch (error) {
      console.error('Error retrieving file:', error);
      throw error;
    }
  }

  /**
   * Log file access
   */
  async logFileAccess(fileId, accessedBy) {
    try {
      const updateQuery = `
        UPDATE patient_files
        SET access_log = array_append(
          COALESCE(access_log, ARRAY[]::text[]),
          $1
        )
        WHERE id = $2
      `;

      const logEntry = JSON.stringify({
        timestamp: new Date().toISOString(),
        userId: accessedBy
      });

      await query(updateQuery, [logEntry, fileId]);
    } catch (error) {
      console.error('Error logging file access:', error);
      // Don't throw - logging failure shouldn't break file retrieval
    }
  }

  /**
   * Delete file
   */
  async deleteFile(fileId, patientId) {
    try {
      const selectQuery = `
        SELECT file_path FROM patient_files
        WHERE id = $1 AND patient_id = $2
      `;

      const result = await query(selectQuery, [fileId, patientId]);

      if (result.rows.length === 0) {
        throw new Error('File not found or access denied');
      }

      const stored = result.rows[0].file_path;

      // Delete from database
      await query('DELETE FROM patient_files WHERE id = $1', [fileId]);

      // Then the bytes. The metadata row is what grants access, so losing it
      // first is the safe order: an orphaned object is a tidiness problem,
      // an orphaned row would be a reachable file nobody can account for.
      if (FileUploadService.isLegacyPath(stored)) {
        try {
          if (fs.existsSync(stored)) fs.unlinkSync(stored);
        } catch (_) {
          // Best effort on a path from the old scheme.
        }
      } else {
        await storage.remove(stored);
      }

      return { success: true, message: 'File deleted successfully' };

    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  }

  /**
   * List patient's files
   */
  async listPatientFiles(patientId, category = null) {
    try {
      let selectQuery = `
        SELECT id, file_name, file_type, file_size, category, description, 
               upload_timestamp, created_at
        FROM patient_files
        WHERE patient_id = $1
      `;

      const params = [patientId];

      if (category) {
        selectQuery += ` AND category = $2`;
        params.push(category);
      }

      selectQuery += ` ORDER BY upload_timestamp DESC`;

      const result = await query(selectQuery, params);
      return result.rows;

    } catch (error) {
      console.error('Error listing patient files:', error);
      throw error;
    }
  }

  /**
   * Verify file integrity
   */
  async verifyFileIntegrity(fileId, patientId) {
    try {
      const selectQuery = `
        SELECT file_path, file_hash FROM patient_files
        WHERE id = $1 AND patient_id = $2
      `;

      const result = await query(selectQuery, [fileId, patientId]);

      if (result.rows.length === 0) {
        throw new Error('File not found');
      }

      const { file_path, file_hash } = result.rows[0];

      // Calculate current hash
      const currentHash = this.calculateFileHash(await this.readBytes(file_path));

      const isIntact = currentHash === file_hash;

      return {
        isIntact,
        storedHash: file_hash,
        currentHash,
        message: isIntact ? 'File integrity verified' : 'File integrity check failed'
      };

    } catch (error) {
      console.error('Error verifying file integrity:', error);
      throw error;
    }
  }
}

module.exports = new FileUploadService();
