import fs from 'fs';
import path from 'path';
import { encryptCredentials, decryptCredentials } from './encryptionService.js';

/**
 * Secure Credential Storage Interface
 * Manages encrypted storage of API credentials
 * Requirements: 8.3, 8.7
 */

const STORAGE_DIR = path.join(process.cwd(), 'config');
const CREDENTIALS_FILE = path.join(STORAGE_DIR, 'credentials.json');

/**
 * Ensures the storage directory exists
 */
function ensureStorageDirectory() {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true, mode: 0o700 });
  }
}

/**
 * Stores encrypted credentials for an exchange
 * @param {string} exchangeId - Exchange identifier
 * @param {Object} credentials - API credentials to store
 * @param {string} password - User password for encryption
 * @returns {boolean} Success status
 */
function storeCredentials(exchangeId, credentials, password) {
  if (!exchangeId || typeof exchangeId !== 'string') {
    throw new Error('Exchange ID must be a non-empty string');
  }
  if (!credentials || typeof credentials !== 'object') {
    throw new Error('Credentials must be an object');
  }
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }

  ensureStorageDirectory();

  // Encrypt credentials
  const encryptedCredentials = encryptCredentials(
    { ...credentials, exchangeId },
    password
  );

  // Load existing credentials
  let allCredentials = {};
  if (fs.existsSync(CREDENTIALS_FILE)) {
    try {
      const data = fs.readFileSync(CREDENTIALS_FILE, 'utf8');
      allCredentials = JSON.parse(data);
    } catch (error) {
      // If file is corrupted, start fresh
      allCredentials = {};
    }
  }

  // Store encrypted credentials
  allCredentials[exchangeId] = encryptedCredentials;

  // Write to file with restricted permissions
  fs.writeFileSync(
    CREDENTIALS_FILE,
    JSON.stringify(allCredentials, null, 2),
    { mode: 0o600 }
  );

  return true;
}

/**
 * Retrieves and decrypts credentials for an exchange
 * @param {string} exchangeId - Exchange identifier
 * @param {string} password - User password for decryption
 * @returns {Object|null} Decrypted credentials or null if not found
 */
function retrieveCredentials(exchangeId, password) {
  if (!exchangeId || typeof exchangeId !== 'string') {
    throw new Error('Exchange ID must be a non-empty string');
  }
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }

  if (!fs.existsSync(CREDENTIALS_FILE)) {
    return null;
  }

  try {
    const data = fs.readFileSync(CREDENTIALS_FILE, 'utf8');
    const allCredentials = JSON.parse(data);

    if (!allCredentials[exchangeId]) {
      return null;
    }

    // Decrypt and return credentials
    return decryptCredentials(allCredentials[exchangeId], password);
  } catch (error) {
    throw new Error(`Failed to retrieve credentials: ${error.message}`);
  }
}

/**
 * Deletes stored credentials for an exchange
 * @param {string} exchangeId - Exchange identifier
 * @returns {boolean} Success status
 */
function deleteCredentials(exchangeId) {
  if (!exchangeId || typeof exchangeId !== 'string') {
    throw new Error('Exchange ID must be a non-empty string');
  }

  if (!fs.existsSync(CREDENTIALS_FILE)) {
    return true; // Already deleted
  }

  try {
    const data = fs.readFileSync(CREDENTIALS_FILE, 'utf8');
    const allCredentials = JSON.parse(data);

    if (allCredentials[exchangeId]) {
      delete allCredentials[exchangeId];

      // Write updated credentials back to file
      fs.writeFileSync(
        CREDENTIALS_FILE,
        JSON.stringify(allCredentials, null, 2),
        { mode: 0o600 }
      );
    }

    return true;
  } catch (error) {
    throw new Error(`Failed to delete credentials: ${error.message}`);
  }
}

/**
 * Lists all stored exchange IDs (without decrypting credentials)
 * @returns {string[]} Array of exchange IDs
 */
function listStoredExchanges() {
  if (!fs.existsSync(CREDENTIALS_FILE)) {
    return [];
  }

  try {
    const data = fs.readFileSync(CREDENTIALS_FILE, 'utf8');
    const allCredentials = JSON.parse(data);
    return Object.keys(allCredentials);
  } catch (error) {
    return [];
  }
}

/**
 * Checks if credentials exist for an exchange
 * @param {string} exchangeId - Exchange identifier
 * @returns {boolean} True if credentials exist
 */
function hasCredentials(exchangeId) {
  if (!exchangeId || typeof exchangeId !== 'string') {
    return false;
  }

  if (!fs.existsSync(CREDENTIALS_FILE)) {
    return false;
  }

  try {
    const data = fs.readFileSync(CREDENTIALS_FILE, 'utf8');
    const allCredentials = JSON.parse(data);
    return !!allCredentials[exchangeId];
  } catch (error) {
    return false;
  }
}

export {
  storeCredentials,
  retrieveCredentials,
  deleteCredentials,
  listStoredExchanges,
  hasCredentials,
};
