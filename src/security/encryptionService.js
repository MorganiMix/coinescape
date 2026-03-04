import crypto from 'crypto';

/**
 * Encryption Service for API Credentials
 * Implements AES-256-GCM encryption with PBKDF2 key derivation
 * Requirements: 8.1, 8.2, 8.3, 8.4
 */

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32; // 256 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const PBKDF2_ITERATIONS = 100000;
const PBKDF2_DIGEST = 'sha256';

/**
 * Derives an encryption key from a password using PBKDF2
 * @param {string} password - User password
 * @param {Buffer} salt - Salt for key derivation
 * @returns {Buffer} Derived encryption key
 */
function deriveKey(password, salt) {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }
  if (!Buffer.isBuffer(salt) || salt.length !== SALT_LENGTH) {
    throw new Error(`Salt must be a Buffer of length ${SALT_LENGTH}`);
  }

  return crypto.pbkdf2Sync(
    password,
    salt,
    PBKDF2_ITERATIONS,
    KEY_LENGTH,
    PBKDF2_DIGEST
  );
}

/**
 * Encrypts data using AES-256-GCM
 * @param {string} plaintext - Data to encrypt
 * @param {Buffer} key - Encryption key
 * @returns {Object} Object containing iv, authTag, and encrypted data
 */
function encrypt(plaintext, key) {
  if (!plaintext || typeof plaintext !== 'string') {
    throw new Error('Plaintext must be a non-empty string');
  }
  if (!Buffer.isBuffer(key) || key.length !== KEY_LENGTH) {
    throw new Error(`Key must be a Buffer of length ${KEY_LENGTH}`);
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return {
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    encrypted: encrypted,
  };
}

/**
 * Decrypts data using AES-256-GCM
 * @param {Object} encryptedData - Object containing iv, authTag, and encrypted data
 * @param {Buffer} key - Decryption key
 * @returns {string} Decrypted plaintext
 */
function decrypt(encryptedData, key) {
  if (!encryptedData || typeof encryptedData !== 'object') {
    throw new Error('Encrypted data must be an object');
  }
  if (!encryptedData.iv || !encryptedData.authTag || !encryptedData.encrypted) {
    throw new Error('Encrypted data must contain iv, authTag, and encrypted fields');
  }
  if (!Buffer.isBuffer(key) || key.length !== KEY_LENGTH) {
    throw new Error(`Key must be a Buffer of length ${KEY_LENGTH}`);
  }

  const iv = Buffer.from(encryptedData.iv, 'hex');
  const authTag = Buffer.from(encryptedData.authTag, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Encrypts API credentials using password-based encryption
 * @param {Object} credentials - API credentials to encrypt
 * @param {string} password - User password for key derivation
 * @returns {Object} Encrypted credentials with salt
 */
function encryptCredentials(credentials, password) {
  if (!credentials || typeof credentials !== 'object') {
    throw new Error('Credentials must be an object');
  }
  if (!credentials.apiSecret) {
    throw new Error('Credentials must contain apiSecret');
  }
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }

  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = deriveKey(password, salt);

  const encryptedSecret = encrypt(credentials.apiSecret, key);
  
  const result = {
    exchangeId: credentials.exchangeId,
    apiKey: credentials.apiKey, // API key is not encrypted (used as identifier)
    apiSecret: encryptedSecret,
    salt: salt.toString('hex'),
    permissions: credentials.permissions,
    createdAt: credentials.createdAt || new Date().toISOString(),
  };

  // Encrypt passphrase if present
  if (credentials.passphrase) {
    result.passphrase = encrypt(credentials.passphrase, key);
  }

  if (credentials.expiresAt) {
    result.expiresAt = credentials.expiresAt;
  }

  return result;
}

/**
 * Decrypts API credentials using password-based decryption
 * @param {Object} encryptedCredentials - Encrypted credentials with salt
 * @param {string} password - User password for key derivation
 * @returns {Object} Decrypted credentials
 */
function decryptCredentials(encryptedCredentials, password) {
  if (!encryptedCredentials || typeof encryptedCredentials !== 'object') {
    throw new Error('Encrypted credentials must be an object');
  }
  if (!encryptedCredentials.apiSecret || !encryptedCredentials.salt) {
    throw new Error('Encrypted credentials must contain apiSecret and salt');
  }
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }

  const salt = Buffer.from(encryptedCredentials.salt, 'hex');
  const key = deriveKey(password, salt);

  const decryptedSecret = decrypt(encryptedCredentials.apiSecret, key);

  const result = {
    exchangeId: encryptedCredentials.exchangeId,
    apiKey: encryptedCredentials.apiKey,
    apiSecret: decryptedSecret,
    permissions: encryptedCredentials.permissions,
    createdAt: encryptedCredentials.createdAt,
  };

  // Decrypt passphrase if present
  if (encryptedCredentials.passphrase) {
    result.passphrase = decrypt(encryptedCredentials.passphrase, key);
  }

  if (encryptedCredentials.expiresAt) {
    result.expiresAt = encryptedCredentials.expiresAt;
  }

  return result;
}

/**
 * Securely clears sensitive data from memory
 * @param {Object} credentials - Credentials object to clear
 */
function clearCredentials(credentials) {
  if (!credentials || typeof credentials !== 'object') {
    return;
  }

  // Overwrite sensitive fields with zeros
  if (credentials.apiSecret) {
    credentials.apiSecret = '\0'.repeat(credentials.apiSecret.length);
    delete credentials.apiSecret;
  }
  if (credentials.passphrase) {
    credentials.passphrase = '\0'.repeat(credentials.passphrase.length);
    delete credentials.passphrase;
  }
}

export {
  encryptCredentials,
  decryptCredentials,
  clearCredentials,
  deriveKey,
  encrypt,
  decrypt,
  // Export constants for testing
  PBKDF2_ITERATIONS,
  KEY_LENGTH,
  SALT_LENGTH,
};
