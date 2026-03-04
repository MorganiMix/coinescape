/**
 * Exchange Manager
 * 
 * Manages connections to multiple cryptocurrency exchanges and provides
 * a unified interface for exchange operations.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 2.1, 2.2, 2.7, 24.1, 24.6, 24.7
 */

import AdapterFactory from './AdapterFactory.js';
import { Exchange, ConnectionStatus } from '../models/Exchange.js';
import { ApiCredentials, Permission } from '../models/ApiCredentials.js';
import {
  storeCredentials,
  retrieveCredentials,
  deleteCredentials,
  hasCredentials,
} from '../security/credentialStorage.js';
import { getSessionPassword } from '../security/sessionManager.js';
import { logOperation } from '../security/auditLogger.js';

class ExchangeManager {
  constructor() {
    // In-memory cache of connected exchanges
    this.exchanges = new Map();
    
    // Balance cache with timestamps
    this.balanceCache = new Map();
    this.CACHE_DURATION_MS = 30000; // 30 seconds
  }

  /**
   * Connect to an exchange with API credentials
   * @param {string} exchangeId - Exchange identifier
   * @param {Object} credentials - API credentials {apiKey, apiSecret, passphrase}
   * @returns {Promise<{status: string, supportedAssets?: string[], errorMessage?: string}>}
   * Requirements: 1.1, 1.2, 1.3, 1.5
   */
  async connectExchange(exchangeId, credentials) {
    try {
      // Validate inputs
      if (!exchangeId || typeof exchangeId !== 'string') {
        return {
          status: 'FAILED',
          errorMessage: 'Invalid exchangeId: must be a non-empty string',
        };
      }

      if (!credentials || !credentials.apiKey || !credentials.apiSecret) {
        return {
          status: 'FAILED',
          errorMessage: 'Invalid credentials: apiKey and apiSecret are required',
        };
      }

      // Create adapter for the exchange
      const adapter = AdapterFactory.createAdapter(exchangeId);

      // Test connection
      const testResult = await adapter.testConnection(credentials);
      if (!testResult.isSuccessful) {
        await logOperation({
          operation: 'connectExchange',
          exchangeId,
          status: 'FAILED',
          errorMessage: testResult.errorMessage,
          timestamp: new Date(),
        });
        
        return {
          status: 'FAILED',
          errorMessage: testResult.errorMessage,
        };
      }

      // Verify WITHDRAW permission
      const permissions = await adapter.getPermissions(credentials);
      if (!permissions.includes('WITHDRAW')) {
        await logOperation({
          operation: 'connectExchange',
          exchangeId,
          status: 'FAILED',
          errorMessage: 'API key lacks WITHDRAW permission',
          timestamp: new Date(),
        });
        
        return {
          status: 'FAILED',
          errorMessage: 'API key lacks WITHDRAW permission',
        };
      }

      // Get supported assets
      const supportedAssets = await adapter.getSupportedAssets();

      // Store encrypted credentials
      const password = getSessionPassword();
      if (!password) {
        return {
          status: 'FAILED',
          errorMessage: 'No active session - please authenticate first',
        };
      }

      const apiCredentials = new ApiCredentials(
        exchangeId,
        credentials.apiKey,
        credentials.apiSecret,
        credentials.passphrase || null,
        permissions,
        new Date(),
        null
      );

      storeCredentials(exchangeId, apiCredentials, password);

      // Create and store exchange object
      const exchange = new Exchange(
        exchangeId,
        exchangeId.charAt(0).toUpperCase() + exchangeId.slice(1),
        true,
        ConnectionStatus.CONNECTED,
        new Date(),
        supportedAssets
      );

      this.exchanges.set(exchangeId, exchange);

      // Log successful connection
      await logOperation({
        operation: 'connectExchange',
        exchangeId,
        status: 'SUCCESS',
        timestamp: new Date(),
      });

      return {
        status: 'SUCCESS',
        supportedAssets,
      };
    } catch (error) {
      await logOperation({
        operation: 'connectExchange',
        exchangeId,
        status: 'FAILED',
        errorMessage: error.message,
        timestamp: new Date(),
      });
      
      return {
        status: 'FAILED',
        errorMessage: `Connection failed: ${error.message}`,
      };
    }
  }

  /**
   * Disconnect from an exchange
   * @param {string} exchangeId - Exchange identifier
   * @returns {Promise<boolean>} Success status
   * Requirements: 1.4
   */
  async disconnectExchange(exchangeId) {
    try {
      // Delete stored credentials
      deleteCredentials(exchangeId);

      // Remove from in-memory cache
      this.exchanges.delete(exchangeId);

      // Clear balance cache
      this.balanceCache.delete(exchangeId);

      // Log disconnection
      await logOperation({
        operation: 'disconnectExchange',
        exchangeId,
        status: 'SUCCESS',
        timestamp: new Date(),
      });

      return true;
    } catch (error) {
      await logOperation({
        operation: 'disconnectExchange',
        exchangeId,
        status: 'FAILED',
        errorMessage: error.message,
        timestamp: new Date(),
      });
      
      return false;
    }
  }

  /**
   * Get list of connected exchanges
   * @returns {Exchange[]} Array of connected exchanges
   * Requirements: 1.6
   */
  getConnectedExchanges() {
    return Array.from(this.exchanges.values());
  }

  /**
   * Get balances for a specific exchange
   * @param {string} exchangeId - Exchange identifier
   * @returns {Promise<Map<string, number>>} Map of asset symbol to balance
   * Requirements: 2.1, 2.5, 2.6, 2.7
   */
  async getExchangeBalances(exchangeId) {
    try {
      // Check cache first
      const cached = this.balanceCache.get(exchangeId);
      if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION_MS) {
        return cached.balances;
      }

      // Retrieve credentials
      const password = getSessionPassword();
      if (!password) {
        throw new Error('No active session - please authenticate first');
      }

      const credentials = retrieveCredentials(exchangeId, password);
      if (!credentials) {
        throw new Error(`No credentials found for exchange: ${exchangeId}`);
      }

      // Create adapter and fetch balances
      const adapter = AdapterFactory.createAdapter(exchangeId);
      const balances = await adapter.getBalances(credentials);

      // Update cache
      this.balanceCache.set(exchangeId, {
        balances,
        timestamp: Date.now(),
      });

      // Update last sync time
      const exchange = this.exchanges.get(exchangeId);
      if (exchange) {
        exchange.lastSyncTime = new Date();
        exchange.connectionStatus = ConnectionStatus.CONNECTED;
      }

      return balances;
    } catch (error) {
      // Update exchange status to ERROR
      const exchange = this.exchanges.get(exchangeId);
      if (exchange) {
        exchange.connectionStatus = ConnectionStatus.ERROR;
      }

      throw new Error(`Failed to fetch balances for ${exchangeId}: ${error.message}`);
    }
  }

  /**
   * Get balances from all connected exchanges in parallel
   * @returns {Promise<Map<string, Map<string, number>>>} Map of exchangeId to balance map
   * Requirements: 2.1, 2.2
   */
  async getAllBalances() {
    const exchangeIds = Array.from(this.exchanges.keys());
    
    // Fetch balances in parallel
    const balancePromises = exchangeIds.map(async (exchangeId) => {
      try {
        const balances = await this.getExchangeBalances(exchangeId);
        return { exchangeId, balances, error: null };
      } catch (error) {
        return { exchangeId, balances: new Map(), error: error.message };
      }
    });

    const results = await Promise.all(balancePromises);

    // Build result map
    const allBalances = new Map();
    for (const result of results) {
      allBalances.set(result.exchangeId, result.balances);
    }

    return allBalances;
  }

  /**
   * Execute a withdrawal on a specific exchange
   * @param {string} exchangeId - Exchange identifier
   * @param {Object} request - Withdrawal request {asset, amount, destinationAddress, network, memo}
   * @returns {Promise<{status: string, transactionId?: string, errorMessage?: string, timestamp: Date}>}
   * Requirements: 1.1, 6.7, 6.8
   */
  async executeWithdrawal(exchangeId, request) {
    try {
      // Retrieve credentials
      const password = getSessionPassword();
      if (!password) {
        return {
          status: 'FAILED',
          errorMessage: 'No active session - please authenticate first',
          timestamp: new Date(),
        };
      }

      const credentials = retrieveCredentials(exchangeId, password);
      if (!credentials) {
        return {
          status: 'FAILED',
          errorMessage: `No credentials found for exchange: ${exchangeId}`,
          timestamp: new Date(),
        };
      }

      // Create adapter and execute withdrawal
      const adapter = AdapterFactory.createAdapter(exchangeId);
      const result = await adapter.executeWithdrawal(credentials, request);

      // Log withdrawal attempt
      await logOperation({
        operation: 'executeWithdrawal',
        exchangeId,
        asset: request.asset,
        amount: request.amount,
        status: result.status,
        transactionId: result.transactionId,
        errorMessage: result.errorMessage,
        timestamp: result.timestamp,
      });

      // Clear balance cache for this exchange
      this.balanceCache.delete(exchangeId);

      return result;
    } catch (error) {
      const result = {
        status: 'FAILED',
        errorMessage: `Withdrawal failed: ${error.message}`,
        timestamp: new Date(),
      };

      await logOperation({
        operation: 'executeWithdrawal',
        exchangeId,
        asset: request.asset,
        amount: request.amount,
        status: result.status,
        errorMessage: result.errorMessage,
        timestamp: result.timestamp,
      });

      return result;
    }
  }

  /**
   * Test connection to an exchange
   * @param {string} exchangeId - Exchange identifier
   * @returns {Promise<{isSuccessful: boolean, errorMessage?: string}>}
   * Requirements: 1.7, 24.6, 24.7
   */
  async testConnection(exchangeId) {
    try {
      // Retrieve credentials
      const password = getSessionPassword();
      if (!password) {
        return {
          isSuccessful: false,
          errorMessage: 'No active session - please authenticate first',
        };
      }

      const credentials = retrieveCredentials(exchangeId, password);
      if (!credentials) {
        return {
          isSuccessful: false,
          errorMessage: `No credentials found for exchange: ${exchangeId}`,
        };
      }

      // Create adapter and test connection
      const adapter = AdapterFactory.createAdapter(exchangeId);
      const result = await adapter.testConnection(credentials);

      // Update exchange status
      const exchange = this.exchanges.get(exchangeId);
      if (exchange) {
        if (result.isSuccessful) {
          exchange.connectionStatus = ConnectionStatus.CONNECTED;
          exchange.lastSyncTime = new Date();
        } else {
          exchange.connectionStatus = ConnectionStatus.ERROR;
        }
      }

      return result;
    } catch (error) {
      // Update exchange status to ERROR
      const exchange = this.exchanges.get(exchangeId);
      if (exchange) {
        exchange.connectionStatus = ConnectionStatus.ERROR;
      }

      return {
        isSuccessful: false,
        errorMessage: `Connection test failed: ${error.message}`,
      };
    }
  }

  /**
   * Get exchange status information
   * @param {string} exchangeId - Exchange identifier
   * @returns {Exchange|null} Exchange object or null if not found
   * Requirements: 24.1
   */
  getExchangeStatus(exchangeId) {
    return this.exchanges.get(exchangeId) || null;
  }

  /**
   * Check if an exchange is connected
   * @param {string} exchangeId - Exchange identifier
   * @returns {boolean} True if exchange is connected
   */
  isExchangeConnected(exchangeId) {
    const exchange = this.exchanges.get(exchangeId);
    return exchange ? exchange.isConnected : false;
  }

  /**
   * Load all exchanges from stored credentials
   * @returns {Promise<void>}
   */
  async loadStoredExchanges() {
    try {
      const password = getSessionPassword();
      if (!password) {
        return;
      }

      // This would need to be implemented to restore exchanges from storage
      // For now, exchanges need to be reconnected manually after app restart
    } catch (error) {
      console.error('Failed to load stored exchanges:', error.message);
    }
  }
}

export default ExchangeManager;
