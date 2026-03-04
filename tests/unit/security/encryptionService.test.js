import {
  encryptCredentials,
  decryptCredentials,
  clearCredentials,
  deriveKey,
  encrypt,
  decrypt,
  PBKDF2_ITERATIONS,
  KEY_LENGTH,
  SALT_LENGTH,
} from '../../../src/security/encryptionService.js';
import crypto from 'crypto';

describe('Encryption Service', () => {
  const testPassword = 'TestPassword123!';
  const testCredentials = {
    exchangeId: 'binance',
    apiKey: 'test_api_key',
    apiSecret: 'test_api_secret_value',
    passphrase: 'test_passphrase',
    permissions: ['READ_BALANCE', 'WITHDRAW'],
  };

  describe('deriveKey', () => {
    test('should derive a key of correct length', () => {
      const salt = crypto.randomBytes(SALT_LENGTH);
      const key = deriveKey(testPassword, salt);

      expect(Buffer.isBuffer(key)).toBe(true);
      expect(key.length).toBe(KEY_LENGTH);
    });

    test('should derive the same key for the same password and salt', () => {
      const salt = crypto.randomBytes(SALT_LENGTH);
      const key1 = deriveKey(testPassword, salt);
      const key2 = deriveKey(testPassword, salt);

      expect(key1.equals(key2)).toBe(true);
    });

    test('should derive different keys for different passwords', () => {
      const salt = crypto.randomBytes(SALT_LENGTH);
      const key1 = deriveKey('password1', salt);
      const key2 = deriveKey('password2', salt);

      expect(key1.equals(key2)).toBe(false);
    });

    test('should derive different keys for different salts', () => {
      const salt1 = crypto.randomBytes(SALT_LENGTH);
      const salt2 = crypto.randomBytes(SALT_LENGTH);
      const key1 = deriveKey(testPassword, salt1);
      const key2 = deriveKey(testPassword, salt2);

      expect(key1.equals(key2)).toBe(false);
    });

    test('should throw error for invalid password', () => {
      const salt = crypto.randomBytes(SALT_LENGTH);
      expect(() => deriveKey('', salt)).toThrow();
      expect(() => deriveKey(null, salt)).toThrow();
      expect(() => deriveKey(123, salt)).toThrow();
    });

    test('should throw error for invalid salt', () => {
      expect(() => deriveKey(testPassword, 'not a buffer')).toThrow();
      expect(() => deriveKey(testPassword, Buffer.alloc(16))).toThrow();
    });
  });

  describe('encrypt and decrypt', () => {
    test('should encrypt and decrypt data correctly', () => {
      const plaintext = 'sensitive data';
      const salt = crypto.randomBytes(SALT_LENGTH);
      const key = deriveKey(testPassword, salt);

      const encrypted = encrypt(plaintext, key);
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('authTag');
      expect(encrypted).toHaveProperty('encrypted');

      const decrypted = decrypt(encrypted, key);
      expect(decrypted).toBe(plaintext);
    });

    test('should produce different ciphertext for same plaintext', () => {
      const plaintext = 'sensitive data';
      const salt = crypto.randomBytes(SALT_LENGTH);
      const key = deriveKey(testPassword, salt);

      const encrypted1 = encrypt(plaintext, key);
      const encrypted2 = encrypt(plaintext, key);

      // Different IVs should produce different ciphertext
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
      expect(encrypted1.encrypted).not.toBe(encrypted2.encrypted);
    });

    test('should fail to decrypt with wrong key', () => {
      const plaintext = 'sensitive data';
      const salt1 = crypto.randomBytes(SALT_LENGTH);
      const salt2 = crypto.randomBytes(SALT_LENGTH);
      const key1 = deriveKey(testPassword, salt1);
      const key2 = deriveKey(testPassword, salt2);

      const encrypted = encrypt(plaintext, key1);

      expect(() => decrypt(encrypted, key2)).toThrow();
    });

    test('should fail to decrypt tampered data', () => {
      const plaintext = 'sensitive data';
      const salt = crypto.randomBytes(SALT_LENGTH);
      const key = deriveKey(testPassword, salt);

      const encrypted = encrypt(plaintext, key);
      
      // Tamper with encrypted data
      encrypted.encrypted = encrypted.encrypted.slice(0, -2) + 'ff';

      expect(() => decrypt(encrypted, key)).toThrow();
    });

    test('should handle various input sizes', () => {
      const salt = crypto.randomBytes(SALT_LENGTH);
      const key = deriveKey(testPassword, salt);

      const testCases = [
        'a',
        'short text',
        'a'.repeat(100),
        'a'.repeat(1000),
        'special chars: !@#$%^&*()_+-=[]{}|;:,.<>?',
      ];

      for (const plaintext of testCases) {
        const encrypted = encrypt(plaintext, key);
        const decrypted = decrypt(encrypted, key);
        expect(decrypted).toBe(plaintext);
      }
    });
  });

  describe('encryptCredentials and decryptCredentials', () => {
    test('should encrypt and decrypt credentials correctly', () => {
      const encrypted = encryptCredentials(testCredentials, testPassword);

      expect(encrypted).toHaveProperty('exchangeId', testCredentials.exchangeId);
      expect(encrypted).toHaveProperty('apiKey', testCredentials.apiKey);
      expect(encrypted).toHaveProperty('apiSecret');
      expect(encrypted).toHaveProperty('passphrase');
      expect(encrypted).toHaveProperty('salt');
      expect(encrypted).toHaveProperty('permissions');
      expect(encrypted).toHaveProperty('createdAt');

      // API secret should be encrypted
      expect(typeof encrypted.apiSecret).toBe('object');
      expect(encrypted.apiSecret).toHaveProperty('iv');
      expect(encrypted.apiSecret).toHaveProperty('authTag');
      expect(encrypted.apiSecret).toHaveProperty('encrypted');

      // Decrypt and verify
      const decrypted = decryptCredentials(encrypted, testPassword);
      expect(decrypted.exchangeId).toBe(testCredentials.exchangeId);
      expect(decrypted.apiKey).toBe(testCredentials.apiKey);
      expect(decrypted.apiSecret).toBe(testCredentials.apiSecret);
      expect(decrypted.passphrase).toBe(testCredentials.passphrase);
    });

    test('should handle credentials without passphrase', () => {
      const credsWithoutPassphrase = {
        exchangeId: 'coinbase',
        apiKey: 'test_key',
        apiSecret: 'test_secret',
        permissions: ['WITHDRAW'],
      };

      const encrypted = encryptCredentials(credsWithoutPassphrase, testPassword);
      expect(encrypted).not.toHaveProperty('passphrase');

      const decrypted = decryptCredentials(encrypted, testPassword);
      expect(decrypted).not.toHaveProperty('passphrase');
      expect(decrypted.apiSecret).toBe(credsWithoutPassphrase.apiSecret);
    });

    test('should fail to decrypt with wrong password', () => {
      const encrypted = encryptCredentials(testCredentials, testPassword);

      expect(() => decryptCredentials(encrypted, 'WrongPassword123!')).toThrow();
    });

    test('should throw error for invalid credentials', () => {
      expect(() => encryptCredentials(null, testPassword)).toThrow();
      expect(() => encryptCredentials({}, testPassword)).toThrow();
      expect(() => encryptCredentials({ apiKey: 'key' }, testPassword)).toThrow();
    });

    test('should throw error for invalid password', () => {
      expect(() => encryptCredentials(testCredentials, '')).toThrow();
      expect(() => encryptCredentials(testCredentials, null)).toThrow();
    });

    test('should preserve metadata fields', () => {
      const credsWithMetadata = {
        ...testCredentials,
        createdAt: '2024-01-01T00:00:00.000Z',
        expiresAt: '2025-01-01T00:00:00.000Z',
      };

      const encrypted = encryptCredentials(credsWithMetadata, testPassword);
      expect(encrypted.createdAt).toBe(credsWithMetadata.createdAt);
      expect(encrypted.expiresAt).toBe(credsWithMetadata.expiresAt);

      const decrypted = decryptCredentials(encrypted, testPassword);
      expect(decrypted.createdAt).toBe(credsWithMetadata.createdAt);
      expect(decrypted.expiresAt).toBe(credsWithMetadata.expiresAt);
    });
  });

  describe('clearCredentials', () => {
    test('should clear sensitive fields from credentials', () => {
      const creds = {
        apiKey: 'test_key',
        apiSecret: 'test_secret',
        passphrase: 'test_passphrase',
      };

      clearCredentials(creds);

      expect(creds).not.toHaveProperty('apiSecret');
      expect(creds).not.toHaveProperty('passphrase');
      expect(creds.apiKey).toBe('test_key'); // apiKey is not cleared
    });

    test('should handle null or undefined input', () => {
      expect(() => clearCredentials(null)).not.toThrow();
      expect(() => clearCredentials(undefined)).not.toThrow();
    });

    test('should handle credentials without sensitive fields', () => {
      const creds = { apiKey: 'test_key' };
      expect(() => clearCredentials(creds)).not.toThrow();
    });
  });

  describe('PBKDF2 iterations', () => {
    test('should use 100,000 iterations as specified', () => {
      expect(PBKDF2_ITERATIONS).toBe(100000);
    });
  });
});
