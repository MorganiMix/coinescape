/**
 * Base Exchange Adapter Interface
 * 
 * Provides a unified interface for all exchange operations.
 * Exchange-specific adapters must implement all methods defined here.
 * 
 * Requirements: 13.1, 13.2, 13.3, 13.4
 */

/**
 * Base class for exchange adapters
 * All exchange-specific adapters must extend this class
 */
class ExchangeAdapter {
  constructor(exchangeId) {
    if (new.target === ExchangeAdapter) {
      throw new Error('ExchangeAdapter is an abstract class and cannot be instantiated directly');
    }
    this.exchangeId = exchangeId;
  }

  /**
   * Test connection to the exchange
   * @param {Object} credentials - API credentials {apiKey, apiSecret, passphrase}
   * @returns {Promise<{isSuccessful: boolean, errorMessage?: string}>}
   */
  async testConnection(credentials) {
    throw new Error('testConnection() must be implemented by subclass');
  }

  /**
   * Get account balances from the exchange
   * @param {Object} credentials - API credentials
   * @returns {Promise<Map<string, number>>} Map of asset symbol to balance amount
   */
  async getBalances(credentials) {
    throw new Error('getBalances() must be implemented by subclass');
  }

  /**
   * Execute a withdrawal on the exchange
   * @param {Object} credentials - API credentials
   * @param {Object} request - Withdrawal request {asset, amount, destinationAddress, network, memo}
   * @returns {Promise<{status: string, transactionId?: string, errorMessage?: string, timestamp: Date}>}
   */
  async executeWithdrawal(credentials, request) {
    throw new Error('executeWithdrawal() must be implemented by subclass');
  }

  /**
   * Get API key permissions
   * @param {Object} credentials - API credentials
   * @returns {Promise<string[]>} Array of permission strings
   */
  async getPermissions(credentials) {
    throw new Error('getPermissions() must be implemented by subclass');
  }

  /**
   * Get list of supported assets
   * @returns {Promise<string[]>} Array of asset symbols
   */
  async getSupportedAssets() {
    throw new Error('getSupportedAssets() must be implemented by subclass');
  }

  /**
   * Validate if an asset is supported by this exchange
   * @param {string} asset - Asset symbol
   * @returns {Promise<boolean>}
   */
  async isAssetSupported(asset) {
    const supportedAssets = await this.getSupportedAssets();
    return supportedAssets.includes(asset);
  }

  /**
   * Validate if a network is supported for an asset
   * @param {string} asset - Asset symbol
   * @param {string} network - Network name
   * @returns {Promise<boolean>}
   */
  async isNetworkSupported(asset, network) {
    throw new Error('isNetworkSupported() must be implemented by subclass');
  }
}

export default ExchangeAdapter;
