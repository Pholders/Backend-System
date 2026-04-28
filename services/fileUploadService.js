const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { query } = require('../config/db');

/**
 * Secure File Upload Service
 * Handles uploads for medical reports, policies, etc.
 */

class FileUploadService {
  constructor() {
    this.uploadsDir = path.join(__dirname, '../uploads');
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

    // Ensure uploads directory exists
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
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
   * Calculate file hash (SHA256)
   */
  calculateFileHash(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);

      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
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
      const filePath = path.join(this.uploadsDir, `patient_${patientId}`, secureFilename);

      // Create patient-specific directory
      const patientDir = path.dirname(filePath);
      if (!fs.existsSync(patientDir)) {
        fs.mkdirSync(patientDir, { recursive: true });
      }

      // Save file
      await new Promise((resolve, reject) => {
        fs.writeFile(filePath, file.buffer, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Calculate file hash
      const fileHash = await this.calculateFileHash(filePath);

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
        filePath,
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
      const filePath = fileRecord.file_path;

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        throw new Error('File not found on disk');
      }

      // Log access
      await this.logFileAccess(fileId, patientId);

      // Return file buffer
      const fileBuffer = fs.readFileSync(filePath);
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

      const filePath = result.rows[0].file_path;

      // Delete from database
      await query('DELETE FROM patient_files WHERE id = $1', [fileId]);

      // Delete from disk
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
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
      const currentHash = await this.calculateFileHash(file_path);

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
