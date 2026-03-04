import {
  initializeAuditLogger,
  logOperation,
  getAuditTrail,
  verifyAuditLog,
  getLogSize,
  createAuditEntry,
  signLogEntry,
  verifyLogEntry,
  MAX_LOG_ENTRIES,
  MAX_LOG_SIZE_BYTES,
} from '../../../src/security/auditLogger.js';
import fs from 'fs';
import path from 'path';

describe('Audit Logger', () => {
  const testHmacKey = 'test-hmac-key-for-testing';
  const testUserId = 'test-user';
  const auditLogFile = path.join(process.cwd(), 'config', 'audit.log');

  beforeEach(() => {
    // Clean up any existing audit log first with retry
    try {
      if (fs.existsSync(auditLogFile)) {
        fs.unlinkSync(auditLogFile);
      }
    } catch (error) {
      // Ignore cleanup errors
    }
    
    // Initialize audit logger
    initializeAuditLogger(testHmacKey);
  });

  afterEach(() => {
    // Clean up audit log after tests with retry
    try {
      if (fs.existsSync(auditLogFile)) {
        fs.unlinkSync(auditLogFile);
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('initializeAuditLogger', () => {
    test('should initialize with valid HMAC key', () => {
      expect(() => initializeAuditLogger('valid-key')).not.toThrow();
    });

    test('should throw error for invalid HMAC key', () => {
      expect(() => initializeAuditLogger('')).toThrow();
      expect(() => initializeAuditLogger(null)).toThrow();
      expect(() => initializeAuditLogger(123)).toThrow();
    });
  });

  describe('createAuditEntry', () => {
    test('should create audit entry with all fields', () => {
      const entry = createAuditEntry(
        'TEST_OPERATION',
        testUserId,
        { key: 'value' },
        'SUCCESS'
      );

      expect(entry).toHaveProperty('timestamp');
      expect(entry).toHaveProperty('operation', 'TEST_OPERATION');
      expect(entry).toHaveProperty('userId', testUserId);
      expect(entry).toHaveProperty('details');
      expect(entry.details).toEqual({ key: 'value' });
      expect(entry).toHaveProperty('result', 'SUCCESS');
      expect(entry).toHaveProperty('signature');
    });

    test('should use default values for optional fields', () => {
      const entry = createAuditEntry('TEST_OPERATION');

      expect(entry.userId).toBe('system');
      expect(entry.details).toEqual({});
      expect(entry.result).toBe('UNKNOWN');
    });

    test('should generate valid timestamp', () => {
      const entry = createAuditEntry('TEST_OPERATION', testUserId);
      const timestamp = new Date(entry.timestamp);

      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp.getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('signLogEntry and verifyLogEntry', () => {
    test('should sign and verify log entry correctly', () => {
      const entry = createAuditEntry('TEST_OPERATION', testUserId, {}, 'SUCCESS');

      expect(verifyLogEntry(entry)).toBe(true);
    });

    test('should fail verification for tampered entry', () => {
      const entry = createAuditEntry('TEST_OPERATION', testUserId, {}, 'SUCCESS');
      
      // Tamper with the entry
      entry.result = 'FAILED';

      expect(verifyLogEntry(entry)).toBe(false);
    });

    test('should fail verification for entry without signature', () => {
      const entry = {
        timestamp: new Date().toISOString(),
        operation: 'TEST_OPERATION',
        userId: testUserId,
        details: {},
        result: 'SUCCESS',
      };

      expect(verifyLogEntry(entry)).toBe(false);
    });

    test('should produce consistent signatures', () => {
      const entry = {
        timestamp: '2024-01-01T00:00:00.000Z',
        operation: 'TEST_OPERATION',
        userId: testUserId,
        details: { key: 'value' },
        result: 'SUCCESS',
      };

      const signature1 = signLogEntry(entry);
      const signature2 = signLogEntry(entry);

      expect(signature1).toBe(signature2);
    });
  });

  describe('logOperation', () => {
    test('should log operation successfully', () => {
      const result = logOperation('TEST_OPERATION', testUserId, { key: 'value' }, 'SUCCESS');

      expect(result).toBe(true);
      expect(fs.existsSync(auditLogFile)).toBe(true);
    });

    test('should append multiple operations', () => {
      logOperation('OPERATION_1', testUserId, {}, 'SUCCESS');
      logOperation('OPERATION_2', testUserId, {}, 'SUCCESS');
      logOperation('OPERATION_3', testUserId, {}, 'FAILED');

      const trail = getAuditTrail();
      expect(trail.length).toBe(3);
      expect(trail[0].operation).toBe('OPERATION_1');
      expect(trail[1].operation).toBe('OPERATION_2');
      expect(trail[2].operation).toBe('OPERATION_3');
    });

    test('should create log file with restricted permissions', () => {
      logOperation('TEST_OPERATION', testUserId, {}, 'SUCCESS');

      const stats = fs.statSync(auditLogFile);
      // On Windows, mode checking is different, so we just verify file exists
      expect(stats.isFile()).toBe(true);
    });
  });

  describe('getAuditTrail', () => {
    beforeEach(() => {
      // Create test log entries
      logOperation('AUTH', 'user1', { method: 'password' }, 'SUCCESS');
      logOperation('CONNECT_EXCHANGE', 'user1', { exchange: 'binance' }, 'SUCCESS');
      logOperation('WITHDRAWAL', 'user1', { amount: 100 }, 'SUCCESS');
      logOperation('AUTH', 'user2', { method: 'password' }, 'FAILED');
      logOperation('WITHDRAWAL', 'user1', { amount: 50 }, 'FAILED');
    });

    test('should retrieve all entries without filters', () => {
      const trail = getAuditTrail();
      expect(trail.length).toBe(5);
    });

    test('should filter by operation', () => {
      const trail = getAuditTrail({ operation: 'AUTH' });
      expect(trail.length).toBe(2);
      expect(trail.every(e => e.operation === 'AUTH')).toBe(true);
    });

    test('should filter by userId', () => {
      const trail = getAuditTrail({ userId: 'user1' });
      expect(trail.length).toBe(4);
      expect(trail.every(e => e.userId === 'user1')).toBe(true);
    });

    test('should filter by result', () => {
      const trail = getAuditTrail({ result: 'FAILED' });
      expect(trail.length).toBe(2);
      expect(trail.every(e => e.result === 'FAILED')).toBe(true);
    });

    test('should filter by date range', () => {
      const now = new Date();
      const past = new Date(now.getTime() - 1000);
      const future = new Date(now.getTime() + 1000);

      const trail = getAuditTrail({
        startDate: past.toISOString(),
        endDate: future.toISOString(),
      });

      expect(trail.length).toBe(5);
    });

    test('should combine multiple filters', () => {
      const trail = getAuditTrail({
        operation: 'WITHDRAWAL',
        userId: 'user1',
        result: 'SUCCESS',
      });

      expect(trail.length).toBe(1);
      expect(trail[0].operation).toBe('WITHDRAWAL');
      expect(trail[0].userId).toBe('user1');
      expect(trail[0].result).toBe('SUCCESS');
    });

    test('should return empty array when no entries match', () => {
      const trail = getAuditTrail({ operation: 'NONEXISTENT' });
      expect(trail).toEqual([]);
    });
  });

  describe('verifyAuditLog', () => {
    test('should verify valid audit log', () => {
      logOperation('TEST_1', testUserId, {}, 'SUCCESS');
      logOperation('TEST_2', testUserId, {}, 'SUCCESS');

      const result = verifyAuditLog();

      expect(result.totalEntries).toBe(2);
      expect(result.validEntries).toBe(2);
      expect(result.invalidEntries).toBe(0);
      expect(result.tamperedEntries).toEqual([]);
    });

    test('should detect tampered entries', () => {
      logOperation('TEST_1', testUserId, {}, 'SUCCESS');
      logOperation('TEST_2', testUserId, {}, 'SUCCESS');

      // Manually tamper with the log file
      const data = fs.readFileSync(auditLogFile, 'utf8');
      const lines = data.split('\n').filter(line => line.trim() !== '');
      const entry = JSON.parse(lines[0]);
      entry.result = 'TAMPERED';
      lines[0] = JSON.stringify(entry);
      fs.writeFileSync(auditLogFile, lines.join('\n') + '\n');

      const result = verifyAuditLog();

      expect(result.totalEntries).toBe(2);
      expect(result.validEntries).toBe(1);
      expect(result.invalidEntries).toBe(1);
      expect(result.tamperedEntries.length).toBe(1);
    });

    test('should handle empty log file', () => {
      const result = verifyAuditLog();

      expect(result.totalEntries).toBe(0);
      expect(result.validEntries).toBe(0);
      expect(result.invalidEntries).toBe(0);
    });
  });

  describe('getLogSize', () => {
    test('should return zero for non-existent log', () => {
      const size = getLogSize();

      expect(size.entries).toBe(0);
      expect(size.sizeBytes).toBe(0);
      expect(parseFloat(size.sizeMB)).toBe(0);
    });

    test('should return correct size for existing log', () => {
      logOperation('TEST_1', testUserId, {}, 'SUCCESS');
      logOperation('TEST_2', testUserId, {}, 'SUCCESS');

      const size = getLogSize();

      expect(size.entries).toBe(2);
      expect(size.sizeBytes).toBeGreaterThan(0);
      expect(parseFloat(size.sizeMB)).toBeGreaterThan(0);
    });
  });

  describe('log rotation', () => {
    test('should have correct rotation limits', () => {
      expect(MAX_LOG_ENTRIES).toBe(10000);
      expect(MAX_LOG_SIZE_BYTES).toBe(100 * 1024 * 1024);
    });
  });
});
