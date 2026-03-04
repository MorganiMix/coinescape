/**
 * ApiCredentials Model
 * Represents API credentials for exchange access
 */

const Permission = {
  READ_BALANCE: 'READ_BALANCE',
  WITHDRAW: 'WITHDRAW',
  TRADE: 'TRADE',
};

class ApiCredentials {
  /**
   * @param {string} exchangeId - Exchange identifier
   * @param {string} apiKey - API key (unencrypted)
   * @param {string} apiSecret - API secret (should be encrypted before storage)
   * @param {string|null} passphrase - Optional passphrase (should be encrypted before storage)
   * @param {string[]} permissions - Array of permission strings
   * @param {Date} createdAt - Creation timestamp
   * @param {Date|null} expiresAt - Optional expiration timestamp
   */
  constructor(exchangeId, apiKey, apiSecret, passphrase = null, permissions = [], createdAt = new Date(), expiresAt = null) {
    this.exchangeId = exchangeId;
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.passphrase = passphrase;
    this.permissions = permissions;
    this.createdAt = createdAt;
    this.expiresAt = expiresAt;
  }

  /**
   * Validate the ApiCredentials model
   * @returns {{isValid: boolean, errors: string[]}}
   */
  validate() {
    const errors = [];

    if (!this.exchangeId || typeof this.exchangeId !== 'string') {
      errors.push('exchangeId must be a non-empty string');
    }

    if (!this.apiKey || typeof this.apiKey !== 'string') {
      errors.push('apiKey must be a non-empty string');
    }

    if (!this.apiSecret || typeof this.apiSecret !== 'string') {
      errors.push('apiSecret must be a non-empty string');
    }

    if (this.passphrase !== null && typeof this.passphrase !== 'string') {
      errors.push('passphrase must be a string or null');
    }

    if (!Array.isArray(this.permissions)) {
      errors.push('permissions must be an array');
    } else {
      const validPermissions = Object.values(Permission);
      this.permissions.forEach((perm) => {
        if (!validPermissions.includes(perm)) {
          errors.push(`Invalid permission: ${perm}`);
        }
      });
    }

    if (!(this.createdAt instanceof Date)) {
      errors.push('createdAt must be a Date object');
    }

    if (this.expiresAt !== null) {
      if (!(this.expiresAt instanceof Date)) {
        errors.push('expiresAt must be a Date object or null');
      } else if (this.expiresAt <= new Date()) {
        errors.push('expiresAt must be in the future');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check if credentials have WITHDRAW permission
   * @returns {boolean}
   */
  hasWithdrawPermission() {
    return this.permissions.includes(Permission.WITHDRAW);
  }

  toJSON() {
    return {
      exchangeId: this.exchangeId,
      apiKey: this.apiKey,
      apiSecret: this.apiSecret, // Note: Should be encrypted in actual storage
      passphrase: this.passphrase, // Note: Should be encrypted in actual storage
      permissions: this.permissions,
      createdAt: this.createdAt.toISOString(),
      expiresAt: this.expiresAt ? this.expiresAt.toISOString() : null,
    };
  }
}

export { ApiCredentials, Permission };
