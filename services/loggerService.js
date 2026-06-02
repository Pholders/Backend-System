/**
 * Logger Service
 * Centralized logging for the application
 */

const fs = require('fs');
const path = require('path');

class Logger {
  constructor() {
    this.logsDir = path.join(__dirname, '../logs');
    this.ensureLogsDirectory();
  }

  ensureLogsDirectory() {
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  getTimestamp() {
    return new Date().toISOString();
  }

  getLogFile(type = 'app') {
    const date = new Date().toISOString().split('T')[0];
    return path.join(this.logsDir, `${type}-${date}.log`);
  }

  write(level, message, data = {}) {
    const timestamp = this.getTimestamp();
    const logEntry = {
      timestamp,
      level,
      message,
      ...data
    };

    const logLine = JSON.stringify(logEntry) + '\n';

    // Console output
    this.consoleLog(level, message, data);

    // File logging
    if (process.env.LOG_TO_FILE === 'true' || process.env.NODE_ENV === 'production') {
      try {
        const logFile = this.getLogFile('app');
        fs.appendFileSync(logFile, logLine);
      } catch (error) {
        console.error('Failed to write to log file:', error.message);
      }
    }
  }

  consoleLog(level, message, data) {
    const timestamp = this.getTimestamp();
    const prefix = `[${timestamp}] [${level}]`;

    switch (level) {
      case 'ERROR':
        console.error(`❌ ${prefix}`, message, data);
        break;
      case 'WARN':
        console.warn(`⚠️  ${prefix}`, message, data);
        break;
      case 'INFO':
        console.log(`ℹ️  ${prefix}`, message, data);
        break;
      case 'DEBUG':
        if (process.env.DEBUG === 'true') {
          console.log(`🔍 ${prefix}`, message, data);
        }
        break;
      case 'SUCCESS':
        console.log(`✅ ${prefix}`, message, data);
        break;
      default:
        console.log(`${prefix}`, message, data);
    }
  }

  info(message, data = {}) {
    this.write('INFO', message, data);
  }

  error(message, error = null, data = {}) {
    const errorData = {
      ...data,
      ...(error ? {
        errorMessage: error.message,
        errorStack: error.stack,
        errorCode: error.code
      } : {})
    };
    this.write('ERROR', message, errorData);
  }

  warn(message, data = {}) {
    this.write('WARN', message, data);
  }

  debug(message, data = {}) {
    this.write('DEBUG', message, data);
  }

  success(message, data = {}) {
    this.write('SUCCESS', message, data);
  }

  /**
   * Log HTTP request
   */
  logRequest(req, res = null) {
    const duration = res ? res.getHeader('X-Response-Time') : 'N/A';
    this.info('HTTP Request', {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      statusCode: res?.statusCode,
      duration
    });
  }

  /**
   * Log security event
   */
  logSecurity(event, details = {}) {
    this.warn(`🔒 Security Event: ${event}`, {
      event,
      ...details,
      timestamp: this.getTimestamp()
    });
  }

  /**
   * Log database operation
   */
  logDatabase(operation, query = null, duration = null, error = null) {
    const level = error ? 'ERROR' : 'DEBUG';
    this.write(level, `Database: ${operation}`, {
      operation,
      query: query && process.env.DEBUG === 'true' ? query : undefined,
      duration,
      error: error ? error.message : undefined
    });
  }

  /**
   * Log external API call
   */
  logExternalApi(service, method, url, statusCode = null, duration = null, error = null) {
    const level = error || (statusCode && statusCode >= 400) ? 'WARN' : 'DEBUG';
    this.write(level, `External API: ${service}`, {
      service,
      method,
      url,
      statusCode,
      duration,
      error: error ? error.message : undefined
    });
  }

  /**
   * Get logs for a specific date
   */
  getLogs(date = null, type = 'app', lines = 100) {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const logFile = path.join(this.logsDir, `${type}-${targetDate}.log`);

    if (!fs.existsSync(logFile)) {
      return [];
    }

    try {
      const content = fs.readFileSync(logFile, 'utf-8');
      return content
        .split('\n')
        .filter(line => line.trim())
        .slice(-lines)
        .map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return { raw: line };
          }
        });
    } catch (error) {
      console.error('Error reading logs:', error.message);
      return [];
    }
  }

  /**
   * Clear old logs (older than days)
   */
  clearOldLogs(daysOld = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    try {
      const files = fs.readdirSync(this.logsDir);
      let deletedCount = 0;

      files.forEach(file => {
        const filePath = path.join(this.logsDir, file);
        const fileStats = fs.statSync(filePath);

        if (fileStats.mtime < cutoffDate) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      });

      if (deletedCount > 0) {
        this.info(`Cleaned up ${deletedCount} old log files`);
      }
    } catch (error) {
      this.error('Error clearing old logs', error);
    }
  }
}

// Export singleton instance
module.exports = new Logger();
