/**
 * Binance Exchange Adapter
 * 
 * Implements exchange-specific logic for Binance using ccxt library.
 * 
 * Requirements: 1.1, 13.2, 13.3, 13.4, 13.5, 14.4, 14.5
 */

import ccxt from 'ccxt';
import ExchangeAdapter from '../ExchangeAdapter.js';

class BinanceAdapter extends ExchangeAdapter {
  constructor(exchangeId) {
    super(exchangeId);
  }

  /**
   * Create and configure ccxt exchange instance
   * @param {Object} credentials - API credentials
   * @returns {ccxt.Exchange} Configured exchange instance
   * @private
   */
  _createExchangeInstance(credentials) {
    return new ccxt.binance({
      apiKey: credentials.apiKey,
      secret: credentials.apiSecret,
      enableRateLimit: true,
      options: {
        defaultType: 'spot', // Use spot trading by default
      },
    });
  }

  /**
   * Test connection to Binance
   * @param {Object} credentials - API credentials
   * @returns {Promise<{isSuccessful: boolean, errorMessage?: string}>}
   */
  async testConnection(credentials) {
    try {
      const exchange = this._createExchangeInstance(credentials);
      
      // Test connection by fetching account status
      await exchange.fetchBalance();
      
      return { isSuccessful: true };
    } catch (error) {
      return {
        isSuccessful: false,
        errorMessage: `Binance connection failed: ${error.message}`,
      };
    }
  }

  /**
   * Get account balances from Binance
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
      throw new Error(`Failed to fetch Binance balances: ${error.message}`);
    }
  }

  /**
   * Execute withdrawal on Binance
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
        params.tag = request.memo; // Binance uses 'tag' for memo
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
        transactionId: result.id || result.info?.id,
        timestamp,
      };
    } catch (error) {
      return {
        status: 'FAILED',
        errorMessage: `Binance withdrawal failed: ${error.message}`,
        timestamp,
      };
    }
  }

  /**
   * Get API key permissions from Binance
   * @param {Object} credentials - API credentials
   * @returns {Promise<string[]>}
   */
  async getPermissions(credentials) {
    try {
      const exchange = this._createExchangeInstance(credentials);
      
      // Fetch API key permissions
      const response = await exchange.sapiGetAccountApiRestrictions();
      
      const permissions = [];
      
      if (response.enableReading) {
        permissions.push('READ_BALANCE');
      }
      if (response.enableWithdrawals) {
        permissions.push('WITHDRAW');
      }
      if (response.enableSpotAndMarginTrading) {
        permissions.push('TRADE');
      }
      
      return permissions;
    } catch (error) {
      // If we can't fetch permissions, try to infer from balance fetch
      try {
        await this.getBalances(credentials);
        // If balance fetch succeeds, we at least have READ permission
        // We can't verify WITHDRAW without attempting a withdrawal
        return ['READ_BALANCE'];
      } catch {
        throw new Error(`Failed to fetch Binance permissions: ${error.message}`);
      }
    }
  }

  /**
   * Get supported assets on Binance
   * @returns {Promise<string[]>}
   */
  async getSupportedAssets() {
    try {
      const exchange = new ccxt.binance({ enableRateLimit: true });
      await exchange.loadMarkets();
      
      // Get unique list of currencies
      const assets = Object.keys(exchange.currencies);
      return assets;
    } catch (error) {
      throw new Error(`Failed to fetch Binance supported assets: ${error.message}`);
    }
  }

  /**
   * Check if network is supported for an asset on Binance
   * @param {string} asset - Asset symbol
   * @param {string} network - Network name
   * @returns {Promise<boolean>}
   */
  async isNetworkSupported(asset, network) {
    try {
      const exchange = new ccxt.binance({ enableRateLimit: true });
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

export default BinanceAdapter;
