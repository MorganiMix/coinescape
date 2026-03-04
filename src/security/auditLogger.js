import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * Audit Logging System
 * Implements HMAC-signed append-only audit logs with rotation
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9
 */

const STORAGE_DIR = path.join(process.cwd(), 'config');
const AUDIT_LOG_FILE = path.join(STORAGE_DIR, 'audit.log');
const AUDIT_LOG_ARCHIVE_DIR = path.join(STORAGE_DIR, 'audit-archive');

const MAX_LOG_ENTRIES = 10000;
const MAX_LOG_SIZE_BYTES = 100 * 1024 * 1024; // 100MB

const HMAC_ALGORITHM = 'sha256';

// HMAC key should be derived from user password or stored securely
// For now, we'll use a session-based key
let hmacKey = null;

/**
 * Initializes the audit logger with an HMAC key
 * @param {string} key - HMAC key (should be derived from user password)
 */
function initializeAuditLogger(key) {
  if (!key || typeof key !== 'string') {
    throw new Error('HMAC key must be a non-empty string');
  }
  hmacKey = key;
  ensureStorageDirectory();
}

/**
 * Ensures the storage directories exist
 */
function ensureStorageDirectory() {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true, mode: 0o700 });
  }
  if (!fs.existsSync(AUDIT_LOG_ARCHIVE_DIR)) {
    fs.mkdirSync(AUDIT_LOG_ARCHIVE_DIR, { recursive: true, mode: 0o700 });
  }
}

/**
 * Generates HMAC signature for a log entry
 * @param {Object} entry - Log entry to sign
 * @returns {string} HMAC signature
 */
function signLogEntry(entry) {
  if (!hmacKey) {
    throw new Error('Audit logger not initialized. Call initializeAuditLogger() first.');
  }

  const data = JSON.stringify({
    timestamp: entry.timestamp,
    operation: entry.operation,
    userId: entry.userId,
    details: entry.details,
    result: entry.result,
  });

  const hmac = crypto.createHmac(HMAC_ALGORITHM, hmacKey);
  hmac.update(data);
  return hmac.digest('hex');
}

/**
 * Verifies HMAC signature of a log entry
 * @param {Object} entry - Log entry to verify
 * @returns {boolean} True if signature is valid
 */
function verifyLogEntry(entry) {
  if (!hmacKey) {
    throw new Error('Audit logger not initialized. Call initializeAuditLogger() first.');
  }

  if (!entry.signature) {
    return false;
  }

  const expectedSignature = signLogEntry(entry);
  return entry.signature === expectedSignature;
}

/**
 * Creates an audit log entry
 * @param {string} operation - Operation type
 * @param {string} userId - User identifier
 * @param {Object} details - Operation details
 * @param {string} result - Operation result (SUCCESS, FAILED, etc.)
 * @returns {Object} Audit entry
 */
function createAuditEntry(operation, userId, details, result) {
  const entry = {
    timestamp: new Date().toISOString(),
    operation,
    userId: userId || 'system',
    details: details || {},
    result: result || 'UNKNOWN',
  };

  entry.signature = signLogEntry(entry);

  return entry;
}

/**
 * Appends an audit entry to the log file
 * @param {Object} entry - Audit entry to append
 * @returns {boolean} Success status
 */
function appendLogEntry(entry) {
  if (!hmacKey) {
    throw new Error('Audit logger not initialized. Call initializeAuditLogger() first.');
  }

  ensureStorageDirectory();

  // Check if rotation is needed
  if (shouldRotateLog()) {
    rotateLog();
  }

  // Append entry to log file
  const logLine = JSON.stringify(entry) + '\n';
  fs.appendFileSync(AUDIT_LOG_FILE, logLine, { mode: 0o600 });

  return true;
}

/**
 * Logs an operation to the audit trail
 * @param {string} operation - Operation type
 * @param {string} userId - User identifier
 * @param {Object} details - Operation details
 * @param {string} result - Operation result
 * @returns {boolean} Success status
 */
function logOperation(operation, userId, details, result) {
  const entry = createAuditEntry(operation, userId, details, result);
  return appendLogEntry(entry);
}

/**
 * Checks if log rotation is needed
 * @returns {boolean} True if rotation is needed
 */
function shouldRotateLog() {
  if (!fs.existsSync(AUDIT_LOG_FILE)) {
    return false;
  }

  const stats = fs.statSync(AUDIT_LOG_FILE);
  
  // Check size limit
  if (stats.size >= MAX_LOG_SIZE_BYTES) {
    return true;
  }

  // Check entry count
  const entryCount = countLogEntries();
  if (entryCount >= MAX_LOG_ENTRIES) {
    return true;
  }

  return false;
}

/**
 * Counts the number of entries in the current log file
 * @returns {number} Number of log entries
 */
function countLogEntries() {
  if (!fs.existsSync(AUDIT_LOG_FILE)) {
    return 0;
  }

  const data = fs.readFileSync(AUDIT_LOG_FILE, 'utf8');
  const lines = data.split('\n').filter(line => line.trim() !== '');
  return lines.length;
}

/**
 * Rotates the audit log file
 */
function rotateLog() {
  if (!fs.existsSync(AUDIT_LOG_FILE)) {
    return;
  }

  ensureStorageDirectory();

  // Create archive filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const archiveFile = path.join(AUDIT_LOG_ARCHIVE_DIR, `audit-${timestamp}.log`);

  // Move current log to archive
  fs.renameSync(AUDIT_LOG_FILE, archiveFile);

  // Log rotation event in new log file
  logOperation('LOG_ROTATION', 'system', { archiveFile }, 'SUCCESS');
}

/**
 * Retrieves audit log entries with optional filtering
 * @param {Object} filters - Filter criteria
 * @returns {Object[]} Array of audit entries
 */
function getAuditTrail(filters = {}) {
  const entries = [];

  // Read current log file
  if (fs.existsSync(AUDIT_LOG_FILE)) {
    const data = fs.readFileSync(AUDIT_LOG_FILE, 'utf8');
    const lines = data.split('\n').filter(line => line.trim() !== '');
    
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (matchesFilters(entry, filters)) {
          entries.push(entry);
        }
      } catch (error) {
        // Skip malformed entries
      }
    }
  }

  return entries;
}

/**
 * Checks if an entry matches the filter criteria
 * @param {Object} entry - Log entry
 * @param {Object} filters - Filter criteria
 * @returns {boolean} True if entry matches filters
 */
function matchesFilters(entry, filters) {
  if (filters.operation && entry.operation !== filters.operation) {
    return false;
  }

  if (filters.userId && entry.userId !== filters.userId) {
    return false;
  }

  if (filters.result && entry.result !== filters.result) {
    return false;
  }

  if (filters.startDate) {
    const entryDate = new Date(entry.timestamp);
    const startDate = new Date(filters.startDate);
    if (entryDate < startDate) {
      return false;
    }
  }

  if (filters.endDate) {
    const entryDate = new Date(entry.timestamp);
    const endDate = new Date(filters.endDate);
    if (entryDate > endDate) {
      return false;
    }
  }

  return true;
}

/**
 * Verifies the integrity of the audit log
 * @returns {Object} Verification result
 */
function verifyAuditLog() {
  if (!hmacKey) {
    throw new Error('Audit logger not initialized. Call initializeAuditLogger() first.');
  }

  const result = {
    totalEntries: 0,
    validEntries: 0,
    invalidEntries: 0,
    tamperedEntries: [],
  };

  if (!fs.existsSync(AUDIT_LOG_FILE)) {
    return result;
  }

  const data = fs.readFileSync(AUDIT_LOG_FILE, 'utf8');
  const lines = data.split('\n').filter(line => line.trim() !== '');

  for (let i = 0; i < lines.length; i++) {
    try {
      const entry = JSON.parse(lines[i]);
      result.totalEntries++;

      if (verifyLogEntry(entry)) {
        result.validEntries++;
      } else {
        result.invalidEntries++;
        result.tamperedEntries.push({
          lineNumber: i + 1,
          timestamp: entry.timestamp,
          operation: entry.operation,
        });
      }
    } catch (error) {
      result.invalidEntries++;
      result.tamperedEntries.push({
        lineNumber: i + 1,
        error: 'Malformed entry',
      });
    }
  }

  return result;
}

/**
 * Gets the current audit log size
 * @returns {Object} Log size information
 */
function getLogSize() {
  const result = {
    entries: 0,
    sizeBytes: 0,
    sizeMB: 0,
  };

  if (fs.existsSync(AUDIT_LOG_FILE)) {
    const stats = fs.statSync(AUDIT_LOG_FILE);
    result.sizeBytes = stats.size;
    result.sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    result.entries = countLogEntries();
  }

  return result;
}

export {
  initializeAuditLogger,
  logOperation,
  getAuditTrail,
  verifyAuditLog,
  getLogSize,
  createAuditEntry,
  signLogEntry,
  verifyLogEntry,
  // Export constants for testing
  MAX_LOG_ENTRIES,
  MAX_LOG_SIZE_BYTES,
};
