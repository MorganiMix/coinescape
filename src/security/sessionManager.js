import crypto from 'crypto';
import { clearCredentials } from './encryptionService.js';
import { logOperation } from './auditLogger.js';

/**
 * User Authentication and Session Management
 * Implements password-based authentication with session timeout
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.6, 9.7
 */

const SESSION_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

// In-memory session storage
let currentSession = null;
let credentialCache = new Map();
let sessionTimeoutTimer = null;

/**
 * Session data structure
 */
class Session {
  constructor(userId, password) {
    this.sessionId = crypto.randomBytes(32).toString('hex');
    this.userId = userId;
    this.password = password; // Stored in memory for credential decryption
    this.createdAt = Date.now();
    this.lastActivity = Date.now();
    this.isActive = true;
  }

  /**
   * Updates the last activity timestamp
   */
  updateActivity() {
    this.lastActivity = Date.now();
  }

  /**
   * Checks if the session has timed out
   * @returns {boolean} True if session has timed out
   */
  isTimedOut() {
    const elapsed = Date.now() - this.lastActivity;
    return elapsed >= SESSION_TIMEOUT_MS;
  }

  /**
   * Gets the remaining time before timeout
   * @returns {number} Milliseconds until timeout
   */
  getRemainingTime() {
    const elapsed = Date.now() - this.lastActivity;
    return Math.max(0, SESSION_TIMEOUT_MS - elapsed);
  }
}

/**
 * Authenticates a user with password
 * @param {string} userId - User identifier
 * @param {string} password - User password
 * @returns {Object} Authentication result
 */
function authenticate(userId, password) {
  if (!userId || typeof userId !== 'string') {
    logOperation('AUTHENTICATION', userId, { reason: 'Invalid user ID' }, 'FAILED');
    return {
      success: false,
      error: 'User ID must be a non-empty string',
    };
  }

  if (!password || typeof password !== 'string') {
    logOperation('AUTHENTICATION', userId, { reason: 'Invalid password' }, 'FAILED');
    return {
      success: false,
      error: 'Password must be a non-empty string',
    };
  }

  // Validate password strength
  if (!isStrongPassword(password)) {
    logOperation('AUTHENTICATION', userId, { reason: 'Weak password' }, 'FAILED');
    return {
      success: false,
      error: 'Password does not meet strength requirements',
    };
  }

  // End any existing session
  if (currentSession) {
    endSession();
  }

  // Create new session
  currentSession = new Session(userId, password);

  // Start session timeout timer
  startSessionTimeout();

  logOperation('AUTHENTICATION', userId, {}, 'SUCCESS');

  return {
    success: true,
    sessionId: currentSession.sessionId,
    expiresIn: SESSION_TIMEOUT_MS,
  };
}

/**
 * Validates password strength
 * @param {string} password - Password to validate
 * @returns {boolean} True if password is strong enough
 */
function isStrongPassword(password) {
  // Minimum 8 characters
  if (password.length < 8) {
    return false;
  }

  // At least one uppercase letter
  if (!/[A-Z]/.test(password)) {
    return false;
  }

  // At least one lowercase letter
  if (!/[a-z]/.test(password)) {
    return false;
  }

  // At least one digit
  if (!/[0-9]/.test(password)) {
    return false;
  }

  return true;
}

/**
 * Validates the current user session
 * @returns {boolean} True if session is valid and active
 */
function validateUserSession() {
  if (!currentSession) {
    return false;
  }

  if (!currentSession.isActive) {
    return false;
  }

  if (currentSession.isTimedOut()) {
    endSession();
    logOperation('SESSION_TIMEOUT', currentSession.userId, {}, 'SUCCESS');
    return false;
  }

  // Update last activity
  currentSession.updateActivity();

  // Reset timeout timer
  startSessionTimeout();

  return true;
}

/**
 * Gets the current session
 * @returns {Session|null} Current session or null
 */
function getCurrentSession() {
  if (!validateUserSession()) {
    return null;
  }
  return currentSession;
}

/**
 * Gets the user password from the current session
 * @returns {string|null} User password or null
 */
function getSessionPassword() {
  if (!validateUserSession()) {
    return null;
  }
  return currentSession.password;
}

/**
 * Starts the session timeout timer
 */
function startSessionTimeout() {
  // Clear existing timer
  if (sessionTimeoutTimer) {
    clearTimeout(sessionTimeoutTimer);
  }

  // Set new timer
  sessionTimeoutTimer = setTimeout(() => {
    if (currentSession && currentSession.isTimedOut()) {
      endSession();
      logOperation('SESSION_TIMEOUT', currentSession.userId, {}, 'SUCCESS');
    }
  }, SESSION_TIMEOUT_MS);
}

/**
 * Ends the current session and clears credentials from memory
 */
function endSession() {
  if (!currentSession) {
    return;
  }

  const userId = currentSession.userId;

  // Clear session timeout timer
  if (sessionTimeoutTimer) {
    clearTimeout(sessionTimeoutTimer);
    sessionTimeoutTimer = null;
  }

  // Clear password from memory
  if (currentSession.password) {
    currentSession.password = '\0'.repeat(currentSession.password.length);
    delete currentSession.password;
  }

  // Mark session as inactive
  currentSession.isActive = false;

  // Clear credential cache
  clearCredentialCache();

  // Clear session reference
  currentSession = null;

  logOperation('SESSION_END', userId, {}, 'SUCCESS');
}

/**
 * Caches decrypted credentials in memory during session
 * @param {string} exchangeId - Exchange identifier
 * @param {Object} credentials - Decrypted credentials
 */
function cacheCredentials(exchangeId, credentials) {
  if (!validateUserSession()) {
    throw new Error('No active session');
  }

  credentialCache.set(exchangeId, credentials);
}

/**
 * Retrieves cached credentials
 * @param {string} exchangeId - Exchange identifier
 * @returns {Object|null} Cached credentials or null
 */
function getCachedCredentials(exchangeId) {
  if (!validateUserSession()) {
    return null;
  }

  return credentialCache.get(exchangeId) || null;
}

/**
 * Clears all cached credentials from memory
 */
function clearCredentialCache() {
  for (const [exchangeId, credentials] of credentialCache.entries()) {
    clearCredentials(credentials);
  }
  credentialCache.clear();
}

/**
 * Requires re-authentication (for sensitive operations)
 * @param {string} password - Password to verify
 * @returns {boolean} True if password matches current session
 */
function requireReAuthentication(password) {
  if (!currentSession) {
    return false;
  }

  if (!validateUserSession()) {
    return false;
  }

  return currentSession.password === password;
}

/**
 * Gets session information
 * @returns {Object|null} Session info or null
 */
function getSessionInfo() {
  if (!validateUserSession()) {
    return null;
  }

  return {
    sessionId: currentSession.sessionId,
    userId: currentSession.userId,
    createdAt: new Date(currentSession.createdAt).toISOString(),
    lastActivity: new Date(currentSession.lastActivity).toISOString(),
    remainingTime: currentSession.getRemainingTime(),
    isActive: currentSession.isActive,
  };
}

export {
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
  // Export constants for testing
  SESSION_TIMEOUT_MS,
};
