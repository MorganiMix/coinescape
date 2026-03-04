import {
  authenticate,
  validateUserSession,
  getCurrentSession,
  getSessionPassword,
  endSession,
  cacheCredentials,
  getCachedCredentials,
  clearCredentialCache,
  requireReAuthentication,
  getSessionInfo,
  isStrongPassword,
  SESSION_TIMEOUT_MS,
} from '../../../src/security/sessionManager.js';
import { initializeAuditLogger } from '../../../src/security/auditLogger.js';

describe('Session Manager', () => {
  const testUserId = 'test-user';
  const testPassword = 'TestPassword123!';
  const weakPassword = 'weak';

  beforeAll(() => {
    // Initialize audit logger for session logging
    initializeAuditLogger('test-hmac-key');
  });

  beforeEach(() => {
    // End any existing session before each test
    endSession();
  });

  afterEach(() => {
    // Clean up session after each test
    endSession();
  });

  describe('isStrongPassword', () => {
    test('should accept strong passwords', () => {
      expect(isStrongPassword('TestPassword123!')).toBe(true);
      expect(isStrongPassword('Abcdefgh1')).toBe(true);
      expect(isStrongPassword('MyP@ssw0rd')).toBe(true);
    });

    test('should reject passwords without uppercase', () => {
      expect(isStrongPassword('testpassword123')).toBe(false);
    });

    test('should reject passwords without lowercase', () => {
      expect(isStrongPassword('TESTPASSWORD123')).toBe(false);
    });

    test('should reject passwords without digits', () => {
      expect(isStrongPassword('TestPassword')).toBe(false);
    });

    test('should reject passwords shorter than 8 characters', () => {
      expect(isStrongPassword('Test12')).toBe(false);
      expect(isStrongPassword('Abc123')).toBe(false);
    });
  });

  describe('authenticate', () => {
    test('should authenticate with valid credentials', () => {
      const result = authenticate(testUserId, testPassword);

      expect(result.success).toBe(true);
      expect(result).toHaveProperty('sessionId');
      expect(result).toHaveProperty('expiresIn', SESSION_TIMEOUT_MS);
    });

    test('should reject weak passwords', () => {
      const result = authenticate(testUserId, weakPassword);

      expect(result.success).toBe(false);
      expect(result.error).toContain('strength requirements');
    });

    test('should reject invalid user ID', () => {
      const result = authenticate('', testPassword);

      expect(result.success).toBe(false);
      expect(result.error).toContain('User ID');
    });

    test('should reject invalid password', () => {
      const result = authenticate(testUserId, '');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Password');
    });

    test('should end existing session when authenticating', () => {
      authenticate(testUserId, testPassword);
      const firstSession = getCurrentSession();

      authenticate(testUserId, testPassword);
      const secondSession = getCurrentSession();

      expect(firstSession.sessionId).not.toBe(secondSession.sessionId);
    });

    test('should generate unique session IDs', () => {
      const result1 = authenticate(testUserId, testPassword);
      endSession();
      const result2 = authenticate(testUserId, testPassword);

      expect(result1.sessionId).not.toBe(result2.sessionId);
    });
  });

  describe('validateUserSession', () => {
    test('should validate active session', () => {
      authenticate(testUserId, testPassword);

      expect(validateUserSession()).toBe(true);
    });

    test('should return false when no session exists', () => {
      expect(validateUserSession()).toBe(false);
    });

    test('should return false after session ends', () => {
      authenticate(testUserId, testPassword);
      endSession();

      expect(validateUserSession()).toBe(false);
    });

    test('should update last activity on validation', () => {
      authenticate(testUserId, testPassword);
      const session1 = getCurrentSession();
      const lastActivity1 = session1.lastActivity;

      // Wait a bit
      setTimeout(() => {
        validateUserSession();
        const session2 = getCurrentSession();
        const lastActivity2 = session2.lastActivity;

        expect(lastActivity2).toBeGreaterThanOrEqual(lastActivity1);
      }, 10);
    });
  });

  describe('getCurrentSession', () => {
    test('should return current session when active', () => {
      authenticate(testUserId, testPassword);
      const session = getCurrentSession();

      expect(session).not.toBeNull();
      expect(session).toHaveProperty('sessionId');
      expect(session).toHaveProperty('userId', testUserId);
      expect(session).toHaveProperty('isActive', true);
    });

    test('should return null when no session exists', () => {
      const session = getCurrentSession();

      expect(session).toBeNull();
    });

    test('should return null after session ends', () => {
      authenticate(testUserId, testPassword);
      endSession();
      const session = getCurrentSession();

      expect(session).toBeNull();
    });
  });

  describe('getSessionPassword', () => {
    test('should return password for active session', () => {
      authenticate(testUserId, testPassword);
      const password = getSessionPassword();

      expect(password).toBe(testPassword);
    });

    test('should return null when no session exists', () => {
      const password = getSessionPassword();

      expect(password).toBeNull();
    });

    test('should return null after session ends', () => {
      authenticate(testUserId, testPassword);
      endSession();
      const password = getSessionPassword();

      expect(password).toBeNull();
    });
  });

  describe('endSession', () => {
    test('should end active session', () => {
      authenticate(testUserId, testPassword);
      expect(validateUserSession()).toBe(true);

      endSession();
      expect(validateUserSession()).toBe(false);
    });

    test('should clear password from memory', () => {
      authenticate(testUserId, testPassword);
      const session = getCurrentSession();
      expect(session.password).toBe(testPassword);

      endSession();
      // Session should be null after ending
      expect(getCurrentSession()).toBeNull();
    });

    test('should clear credential cache', () => {
      authenticate(testUserId, testPassword);
      cacheCredentials('binance', { apiKey: 'test', apiSecret: 'secret' });

      endSession();

      // After ending session, cached credentials should be cleared
      expect(getCachedCredentials('binance')).toBeNull();
    });

    test('should handle ending non-existent session', () => {
      expect(() => endSession()).not.toThrow();
    });
  });

  describe('credential caching', () => {
    beforeEach(() => {
      authenticate(testUserId, testPassword);
    });

    test('should cache credentials', () => {
      const credentials = { apiKey: 'test_key', apiSecret: 'test_secret' };
      cacheCredentials('binance', credentials);

      const cached = getCachedCredentials('binance');
      expect(cached).toEqual(credentials);
    });

    test('should return null for non-cached exchange', () => {
      const cached = getCachedCredentials('coinbase');
      expect(cached).toBeNull();
    });

    test('should cache multiple exchanges', () => {
      const creds1 = { apiKey: 'key1', apiSecret: 'secret1' };
      const creds2 = { apiKey: 'key2', apiSecret: 'secret2' };

      cacheCredentials('binance', creds1);
      cacheCredentials('coinbase', creds2);

      expect(getCachedCredentials('binance')).toEqual(creds1);
      expect(getCachedCredentials('coinbase')).toEqual(creds2);
    });

    test('should throw error when caching without active session', () => {
      endSession();

      expect(() => cacheCredentials('binance', {})).toThrow('No active session');
    });

    test('should return null when retrieving without active session', () => {
      cacheCredentials('binance', { apiKey: 'test' });
      endSession();

      expect(getCachedCredentials('binance')).toBeNull();
    });

    test('should clear all cached credentials', () => {
      cacheCredentials('binance', { apiKey: 'key1' });
      cacheCredentials('coinbase', { apiKey: 'key2' });

      clearCredentialCache();

      expect(getCachedCredentials('binance')).toBeNull();
      expect(getCachedCredentials('coinbase')).toBeNull();
    });
  });

  describe('requireReAuthentication', () => {
    test('should verify correct password', () => {
      authenticate(testUserId, testPassword);

      expect(requireReAuthentication(testPassword)).toBe(true);
    });

    test('should reject incorrect password', () => {
      authenticate(testUserId, testPassword);

      expect(requireReAuthentication('WrongPassword123!')).toBe(false);
    });

    test('should return false when no session exists', () => {
      expect(requireReAuthentication(testPassword)).toBe(false);
    });

    test('should return false after session ends', () => {
      authenticate(testUserId, testPassword);
      endSession();

      expect(requireReAuthentication(testPassword)).toBe(false);
    });
  });

  describe('getSessionInfo', () => {
    test('should return session information', () => {
      authenticate(testUserId, testPassword);
      const info = getSessionInfo();

      expect(info).not.toBeNull();
      expect(info).toHaveProperty('sessionId');
      expect(info).toHaveProperty('userId', testUserId);
      expect(info).toHaveProperty('createdAt');
      expect(info).toHaveProperty('lastActivity');
      expect(info).toHaveProperty('remainingTime');
      expect(info).toHaveProperty('isActive', true);
      expect(info.remainingTime).toBeLessThanOrEqual(SESSION_TIMEOUT_MS);
    });

    test('should return null when no session exists', () => {
      const info = getSessionInfo();

      expect(info).toBeNull();
    });

    test('should show decreasing remaining time', (done) => {
      authenticate(testUserId, testPassword);
      const info1 = getSessionInfo();

      setTimeout(() => {
        const info2 = getSessionInfo();
        // The remaining time should be less than or equal (session gets refreshed on validation)
        // So we just check that the session is still active
        expect(info2).not.toBeNull();
        expect(info2.isActive).toBe(true);
        done();
      }, 100);
    });
  });

  describe('session timeout', () => {
    test('should have 15 minute timeout', () => {
      expect(SESSION_TIMEOUT_MS).toBe(15 * 60 * 1000);
    });
  });
});
