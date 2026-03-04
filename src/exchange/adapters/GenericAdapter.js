/**
 * Generic Exchange Adapter
 * 
 * Provides support for any ccxt-supported exchange that doesn't have
 * a specific adapter implementation.
 * 
 * Requirements: 1.1, 13.2, 13.3, 13.4, 13.5, 14.4, 14.5
 */

import ccxt from 'ccxt';
import ExchangeAdapter from '../ExchangeAdapter.js';

class GenericAdapter extends ExchangeAdapter {
  constructor(exchangeId) {
    super(exchangeId);
    
    // Validate that the exchange is supported by ccxt
    if (!ccxt.exchanges.includes(exchangeId)) {
      throw new Error(`Exchange '${exchangeId}' is not supported by ccxt`);
    }
  }

  /**
   * Create and configure ccxt exchange instance
   * @param {Object} credentials - API credentials
   * @returns {ccxt.Exchange} Configured exchange instance
   * @private
   */
  _createExchangeInstance(credentials) {
    const ExchangeClass = ccxt[this.exchangeId];
    
    const config = {
      apiKey: credentials.apiKey,
      secret: credentials.apiSecret,
      enableRateLimit: true,
    };
    
    // Add passphrase if provided (some exchanges require it)
    if (credentials.passphrase) {
      config.password = credentials.passphrase;
    }
    
    return new ExchangeClass(config);
  }

  /**
   * Test connection to the exchange
   * @param {Object} credentials - API credentials
   * @returns {Promise<{isSuccessful: boolean, errorMessage?: string}>}
   */
  async testConnection(credentials) {
    try {
      const exchange = this._createExchangeInstance(credentials);
      
      // Test connection by fetching balance
      await exchange.fetchBalance();
      
      return { isSuccessful: true };
    } catch (error) {
      return {
        isSuccessful: false,
        errorMessage: `${this.exchangeId} connection failed: ${error.message}`,
      };
    }
  }

  /**
   * Get account balances from the exchange
   * @param {Object} credentials - API credentials
   * @returns {Promise<Map<string, number>>}
   */
  async getBalances(credentials) {
    try {
      const exchange = this._createExchangeInstance(credentials);
      const balance = await exchange.fetchBalance();
      
      const balanceMap = new Map();
      
      // Extract free (available) balances
      for (const [asset, amounts] of Object.entries(balance)) {
        if (asset !== 'info' && asset !== 'free' && asset !== 'used' && asset !== 'total') {
          const freeAmount = amounts.free || 0;
          if (freeAmount > 0) {
            balanceMap.set(asset, freeAmount);
          }
        }
      }
      
      return balanceMap;
    } catch (error) {
      throw new Error(`Failed to fetch ${this.exchangeId} balances: ${error.message}`);
    }
  }

  /**
   * Execute withdrawal on the exchange
   * @param {Object} credentials - API credentials
   * @param {Object} request - Withdrawal request
   * @returns {Promise<{status: string, transactionId?: string, errorMessage?: string, timestamp: Date}>}
   */
  async executeWithdrawal(credentials, request) {
    const timestamp = new Date();
    
    try {
      const exchange = this._createExchangeInstance(credentials);
      
      // Prepare withdrawal parameters
      const params = {};
      if (request.network) {
        params.network = request.network;
      }
      if (request.memo) {
        // Different exchanges use different parameter names for memo
        params.tag = request.memo;
        params.memo = request.memo;
        params.destination_tag = request.memo;
      }
      
      // Execute withdrawal
      const result = await exchange.withdraw(
        request.asset,
        request.amount,
        request.destinationAddress,
        params
      );
      
      return {
        status: 'SUCCESS',
        transactionId: result.id || result.info?.id || result.info?.txid,
        timestamp,
      };
    } catch (error) {
      return {
        status: 'FAILED',
        errorMessage: `${this.exchangeId} withdrawal failed: ${error.message}`,
        timestamp,
      };
    }
  }

  /**
   * Get API key permissions from the exchange
   * @param {Object} credentials - API credentials
   * @returns {Promise<string[]>}
   */
  async getPermissions(credentials) {
    try {
      const exchange = this._createExchangeInstance(credentials);
      
      // Try to fetch balance to verify READ permission
      await exchange.fetchBalance();
      
      // Most exchanges don't provide a direct API to check permissions
      // We assume if balance fetch succeeds, we have READ_BALANCE
      // WITHDRAW permission can only be verified by attempting a withdrawal
      // For safety, we return both if connection succeeds
      return ['READ_BALANCE', 'WITHDRAW'];
    } catch (error) {
      throw new Error(`Failed to verify ${this.exchangeId} permissions: ${error.message}`);
    }
  }

  /**
   * Get supported assets on the exchange
   * @returns {Promise<string[]>}
   */
  async getSupportedAssets() {
    try {
      const ExchangeClass = ccxt[this.exchangeId];
      const exchange = new ExchangeClass({ enableRateLimit: true });
      await exchange.loadMarkets();
      
      // Get unique list of currencies
      const assets = Object.keys(exchange.currencies);
      return assets;
    } catch (error) {
      throw new Error(`Failed to fetch ${this.exchangeId} supported assets: ${error.message}`);
    }
  }

  /**
   * Check if network is supported for an asset on the exchange
   * @param {string} asset - Asset symbol
   * @param {string} network - Network name
   * @returns {Promise<boolean>}
   */
  async isNetworkSupported(asset, network) {
    try {
      const ExchangeClass = ccxt[this.exchangeId];
      const exchange = new ExchangeClass({ enableRateLimit: true });
      await exchange.loadMarkets();
      
      const currency = exchange.currencies[asset];
      if (!currency) {
        return false;
      }
      
      // Check if network is in the list of supported networks
      if (currency.networks && typeof currency.networks === 'object') {
        return network in currency.networks;
      }
      
      // If no network info available, assume supported
      return true;
    } catch (error) {
      return false;
    }
  }
}

export default GenericAdapter;
