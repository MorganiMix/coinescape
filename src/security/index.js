/**
 * Security Layer Module
 * Exports all security-related functionality
 */

import * as encryptionService from './encryptionService.js';
import * as credentialStorage from './credentialStorage.js';
import * as auditLogger from './auditLogger.js';
import * as sessionManager from './sessionManager.js';

export {
  // Encryption Service
  encryptionService,
  
  // Credential Storage
  credentialStorage,
  
  // Audit Logger
  auditLogger,
  
  // Session Manager
  sessionManager,
};

// Re-export individual functions for convenience
export const {
  encryptCredentials,
  decryptCredentials,
  clearCredentials,
  deriveKey,
  encrypt,
  decrypt,
} = encryptionService;

export const {
  storeCredentials,
  retrieveCredentials,
  deleteCredentials,
  listStoredExchanges,
  hasCredentials,
} = credentialStorage;

export const {
  initializeAuditLogger,
  logOperation,
  getAuditTrail,
  verifyAuditLog,
  getLogSize,
} = auditLogger;

export const {
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
} = sessionManager;
