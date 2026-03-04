/**
 * Exchange Model
 * Represents a cryptocurrency exchange connection
 */

const ConnectionStatus = {
  CONNECTED: 'CONNECTED',
  DISCONNECTED: 'DISCONNECTED',
  ERROR: 'ERROR',
  CONNECTING: 'CONNECTING',
};

class Exchange {
  /**
   * @param {string} id - Unique exchange identifier
   * @param {string} name - Exchange name
   * @param {boolean} isConnected - Connection state
   * @param {string} connectionStatus - Current connection status
   * @param {Date|null} lastSyncTime - Last successful sync timestamp
   * @param {string[]} supportedAssets - List of supported asset symbols
   */
  constructor(id, name, isConnected = false, connectionStatus = ConnectionStatus.DISCONNECTED, lastSyncTime = null, supportedAssets = []) {
    this.id = id;
    this.name = name;
    this.isConnected = isConnected;
    this.connectionStatus = connectionStatus;
    this.lastSyncTime = lastSyncTime;
    this.supportedAssets = supportedAssets;
  }

  /**
   * Validate the Exchange model
   * @returns {{isValid: boolean, errors: string[]}}
   */
  validate() {
    const errors = [];

    if (!this.id || typeof this.id !== 'string' || this.id.trim() === '') {
      errors.push('Exchange id must be a non-empty string');
    }

    if (!this.name || typeof this.name !== 'string' || this.name.trim() === '') {
      errors.push('Exchange name must be a non-empty string');
    }

    if (!Object.values(ConnectionStatus).includes(this.connectionStatus)) {
      errors.push(`Invalid connection status: ${this.connectionStatus}`);
    }

    if (this.lastSyncTime !== null && !(this.lastSyncTime instanceof Date)) {
      errors.push('lastSyncTime must be a Date object or null');
    }

    if (!Array.isArray(this.supportedAssets)) {
      errors.push('supportedAssets must be an array');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      isConnected: this.isConnected,
      connectionStatus: this.connectionStatus,
      lastSyncTime: this.lastSyncTime ? this.lastSyncTime.toISOString() : null,
      supportedAssets: this.supportedAssets,
    };
  }
}

export { Exchange, ConnectionStatus };
