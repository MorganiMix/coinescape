/**
 * Unit tests for ExchangeManager
 */

import { jest } from '@jest/globals';
import ExchangeManager from '../../../src/exchange/ExchangeManager.js';
import AdapterFactory from '../../../src/exchange/AdapterFactory.js';
import { ConnectionStatus } from '../../../src/models/Exchange.js';

// Create mock functions
const mockStoreCredentials = jest.fn();
const mockRetrieveCredentials = jest.fn();
const mockDeleteCredentials = jest.fn();
const mockHasCredentials = jest.fn();
const mockGetSessionPassword = jest.fn();
const mockLogOperation = jest.fn();

// Mock the modules before importing
jest.unstable_mockModule('../../../src/security/credentialStorage.js', () => ({
  storeCredentials: mockStoreCredentials,
  retrieveCredentials: mockRetrieveCredentials,
  deleteCredentials: mockDeleteCredentials,
  hasCredentials: mockHasCredentials,
}));

jest.unstable_mockModule('../../../src/security/sessionManager.js', () => ({
  getSessionPassword: mockGetSessionPassword,
}));

jest.unstable_mockModule('../../../src/security/auditLogger.js', () => ({
  logOperation: mockLogOperation,
}));

describe('ExchangeManager', () => {
  let exchangeManager;
  let mockAdapter;
  let originalCreateAdapter;

  beforeEach(() => {
    exchangeManager = new ExchangeManager();
    
    // Create mock adapter
    mockAdapter = {
      testConnection: jest.fn(),
      getBalances: jest.fn(),
      executeWithdrawal: jest.fn(),
      getPermissions: jest.fn(),
      getSupportedAssets: jest.fn(),
    };

    // Mock AdapterFactory.createAdapter
    originalCreateAdapter = AdapterFactory.createAdapter;
    AdapterFactory.createAdapter = jest.fn().mockReturnValue(mockAdapter);
    
    // Setup default mocks
    mockGetSessionPassword.mockReturnValue('test-password');
    mockLogOperation.mockResolvedValue(true);
  });

  afterEach(() => {
    // Restore original method
    if (originalCreateAdapter) {
      AdapterFactory.createAdapter = originalCreateAdapter;
    }
    jest.clearAllMocks();
  });

  describe('connectExchange', () => {
    it('should successfully connect to an exchange with valid credentials', async () => {
      const credentials = {
        apiKey: 'test-key',
        apiSecret: 'test-secret',
      };

      mockAdapter.testConnection.mockResolvedValue({ isSuccessful: true });
      mockAdapter.getPermissions.mockResolvedValue(['READ_BALANCE', 'WITHDRAW']);
      mockAdapter.getSupportedAssets.mockResolvedValue(['BTC', 'ETH', 'SOL']);
      mockStoreCredentials.mockReturnValue(true);

      const result = await exchangeManager.connectExchange('binance', credentials);

      expect(result.status).toBe('SUCCESS');
      expect(result.supportedAssets).toEqual(['BTC', 'ETH', 'SOL']);
      expect(mockStoreCredentials).toHaveBeenCalled();
      expect(mockLogOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'connectExchange',
          exchangeId: 'binance',
          status: 'SUCCESS',
        })
      );
    });

    it('should reject connection when credentials lack WITHDRAW permission', async () => {
      const credentials = {
        apiKey: 'test-key',
        apiSecret: 'test-secret',
      };

      mockAdapter.testConnection.mockResolvedValue({ isSuccessful: true });
      mockAdapter.getPermissions.mockResolvedValue(['READ_BALANCE']); // No WITHDRAW

      const result = await exchangeManager.connectExchange('binance', credentials);

      expect(result.status).toBe('FAILED');
      expect(result.errorMessage).toContain('WITHDRAW permission');
      expect(mockStoreCredentials).not.toHaveBeenCalled();
    });

    it('should reject connection when test connection fails', async () => {
      const credentials = {
        apiKey: 'test-key',
        apiSecret: 'test-secret',
      };

      mockAdapter.testConnection.mockResolvedValue({
        isSuccessful: false,
        errorMessage: 'Invalid API key',
      });

      const result = await exchangeManager.connectExchange('binance', credentials);

      expect(result.status).toBe('FAILED');
      expect(result.errorMessage).toContain('Invalid API key');
      expect(mockStoreCredentials).not.toHaveBeenCalled();
    });

    it('should reject connection with invalid exchangeId', async () => {
      const result = await exchangeManager.connectExchange('', {});

      expect(result.status).toBe('FAILED');
      expect(result.errorMessage).toContain('Invalid exchangeId');
    });

    it('should reject connection with missing credentials', async () => {
      const result = await exchangeManager.connectExchange('binance', {});

      expect(result.status).toBe('FAILED');
      expect(result.errorMessage).toContain('Invalid credentials');
    });

    it('should reject connection when no active session', async () => {
      mockGetSessionPassword.mockReturnValue(null);

      const credentials = {
        apiKey: 'test-key',
        apiSecret: 'test-secret',
      };

      mockAdapter.testConnection.mockResolvedValue({ isSuccessful: true });
      mockAdapter.getPermissions.mockResolvedValue(['READ_BALANCE', 'WITHDRAW']);
      mockAdapter.getSupportedAssets.mockResolvedValue(['BTC', 'ETH']);

      const result = await exchangeManager.connectExchange('binance', credentials);

      expect(result.status).toBe('FAILED');
      expect(result.errorMessage).toContain('No active session');
    });
  });

  describe('disconnectExchange', () => {
    it('should successfully disconnect an exchange', async () => {
      mockDeleteCredentials.mockReturnValue(true);

      const result = await exchangeManager.disconnectExchange('binance');

      expect(result).toBe(true);
      expect(mockDeleteCredentials).toHaveBeenCalledWith('binance');
      expect(mockLogOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'disconnectExchange',
          exchangeId: 'binance',
          status: 'SUCCESS',
        })
      );
    });

    it('should handle errors during disconnection', async () => {
      mockDeleteCredentials.mockImplementation(() => {
        throw new Error('Storage error');
      });

      const result = await exchangeManager.disconnectExchange('binance');

      expect(result).toBe(false);
    });
  });

  describe('getConnectedExchanges', () => {
    it('should return empty array when no exchanges connected', () => {
      const exchanges = exchangeManager.getConnectedExchanges();

      expect(exchanges).toEqual([]);
    });

    it('should return list of connected exchanges', async () => {
      // Connect an exchange first
      const credentials = {
        apiKey: 'test-key',
        apiSecret: 'test-secret',
      };

      mockAdapter.testConnection.mockResolvedValue({ isSuccessful: true });
      mockAdapter.getPermissions.mockResolvedValue(['READ_BALANCE', 'WITHDRAW']);
      mockAdapter.getSupportedAssets.mockResolvedValue(['BTC', 'ETH']);
      credentialStorage.storeCredentials.mockReturnValue(true);

      await exchangeManager.connectExchange('binance', credentials);

      const exchanges = exchangeManager.getConnectedExchanges();

      expect(exchanges).toHaveLength(1);
      expect(exchanges[0].id).toBe('binance');
      expect(exchanges[0].isConnected).toBe(true);
    });
  });

  describe('getExchangeBalances', () => {
    it('should fetch and return balances for an exchange', async () => {
      const mockBalances = new Map([
        ['BTC', 1.5],
        ['ETH', 10.0],
      ]);

      credentialStorage.retrieveCredentials.mockReturnValue({
        apiKey: 'test-key',
        apiSecret: 'test-secret',
      });
      mockAdapter.getBalances.mockResolvedValue(mockBalances);

      const balances = await exchangeManager.getExchangeBalances('binance');

      expect(balances).toEqual(mockBalances);
      expect(mockAdapter.getBalances).toHaveBeenCalled();
    });

    it('should use cached balances when available and fresh', async () => {
      const mockBalances = new Map([['BTC', 1.5]]);

      credentialStorage.retrieveCredentials.mockReturnValue({
        apiKey: 'test-key',
        apiSecret: 'test-secret',
      });
      mockAdapter.getBalances.mockResolvedValue(mockBalances);

      // First call - should fetch
      await exchangeManager.getExchangeBalances('binance');
      expect(mockAdapter.getBalances).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      await exchangeManager.getExchangeBalances('binance');
      expect(mockAdapter.getBalances).toHaveBeenCalledTimes(1);
    });

    it('should throw error when no credentials found', async () => {
      mockRetrieveCredentials.mockReturnValue(null);

      await expect(exchangeManager.getExchangeBalances('binance')).rejects.toThrow(
        'No credentials found'
      );
    });

    it('should throw error when no active session', async () => {
      mockGetSessionPassword.mockReturnValue(null);

      await expect(exchangeManager.getExchangeBalances('binance')).rejects.toThrow(
        'No active session'
      );
    });
  });

  describe('getAllBalances', () => {
    it('should fetch balances from all connected exchanges in parallel', async () => {
      // Connect two exchanges
      const credentials = {
        apiKey: 'test-key',
        apiSecret: 'test-secret',
      };

      mockAdapter.testConnection.mockResolvedValue({ isSuccessful: true });
      mockAdapter.getPermissions.mockResolvedValue(['READ_BALANCE', 'WITHDRAW']);
      mockAdapter.getSupportedAssets.mockResolvedValue(['BTC', 'ETH']);
      mockStoreCredentials.mockReturnValue(true);

      await exchangeManager.connectExchange('binance', credentials);
      await exchangeManager.connectExchange('coinbase', credentials);

      // Setup balance mocks
      mockRetrieveCredentials.mockReturnValue(credentials);
      mockAdapter.getBalances.mockResolvedValue(
        new Map([['BTC', 1.5]])
      );

      const allBalances = await exchangeManager.getAllBalances();

      expect(allBalances.size).toBe(2);
      expect(allBalances.has('binance')).toBe(true);
      expect(allBalances.has('coinbase')).toBe(true);
    });

    it('should return empty map when no exchanges connected', async () => {
      const allBalances = await exchangeManager.getAllBalances();

      expect(allBalances.size).toBe(0);
    });
  });

  describe('executeWithdrawal', () => {
    it('should successfully execute a withdrawal', async () => {
      const request = {
        asset: 'BTC',
        amount: 0.5,
        destinationAddress: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
        network: 'BTC',
      };

      credentialStorage.retrieveCredentials.mockReturnValue({
        apiKey: 'test-key',
        apiSecret: 'test-secret',
      });

      mockAdapter.executeWithdrawal.mockResolvedValue({
        status: 'SUCCESS',
        transactionId: 'tx123',
        timestamp: new Date(),
      });

      const result = await exchangeManager.executeWithdrawal('binance', request);

      expect(result.status).toBe('SUCCESS');
      expect(result.transactionId).toBe('tx123');
      expect(mockAdapter.executeWithdrawal).toHaveBeenCalledWith(
        expect.any(Object),
        request
      );
    });

    it('should handle withdrawal failure', async () => {
      const request = {
        asset: 'BTC',
        amount: 0.5,
        destinationAddress: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
      };

      credentialStorage.retrieveCredentials.mockReturnValue({
        apiKey: 'test-key',
        apiSecret: 'test-secret',
      });

      mockAdapter.executeWithdrawal.mockResolvedValue({
        status: 'FAILED',
        errorMessage: 'Insufficient balance',
        timestamp: new Date(),
      });

      const result = await exchangeManager.executeWithdrawal('binance', request);

      expect(result.status).toBe('FAILED');
      expect(result.errorMessage).toContain('Insufficient balance');
    });

    it('should clear balance cache after withdrawal', async () => {
      const request = {
        asset: 'BTC',
        amount: 0.5,
        destinationAddress: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
      };

      credentialStorage.retrieveCredentials.mockReturnValue({
        apiKey: 'test-key',
        apiSecret: 'test-secret',
      });

      mockAdapter.executeWithdrawal.mockResolvedValue({
        status: 'SUCCESS',
        transactionId: 'tx123',
        timestamp: new Date(),
      });

      // Set up cache
      exchangeManager.balanceCache.set('binance', {
        balances: new Map([['BTC', 1.0]]),
        timestamp: Date.now(),
      });

      await exchangeManager.executeWithdrawal('binance', request);

      expect(exchangeManager.balanceCache.has('binance')).toBe(false);
    });
  });

  describe('testConnection', () => {
    it('should successfully test connection', async () => {
      credentialStorage.retrieveCredentials.mockReturnValue({
        apiKey: 'test-key',
        apiSecret: 'test-secret',
      });

      mockAdapter.testConnection.mockResolvedValue({ isSuccessful: true });

      const result = await exchangeManager.testConnection('binance');

      expect(result.isSuccessful).toBe(true);
      expect(mockAdapter.testConnection).toHaveBeenCalled();
    });

    it('should handle connection test failure', async () => {
      credentialStorage.retrieveCredentials.mockReturnValue({
        apiKey: 'test-key',
        apiSecret: 'test-secret',
      });

      mockAdapter.testConnection.mockResolvedValue({
        isSuccessful: false,
        errorMessage: 'Connection timeout',
      });

      const result = await exchangeManager.testConnection('binance');

      expect(result.isSuccessful).toBe(false);
      expect(result.errorMessage).toContain('Connection timeout');
    });

    it('should update exchange status after test', async () => {
      // First connect an exchange
      const credentials = {
        apiKey: 'test-key',
        apiSecret: 'test-secret',
      };

      mockAdapter.testConnection.mockResolvedValue({ isSuccessful: true });
      mockAdapter.getPermissions.mockResolvedValue(['READ_BALANCE', 'WITHDRAW']);
      mockAdapter.getSupportedAssets.mockResolvedValue(['BTC']);
      mockStoreCredentials.mockReturnValue(true);

      await exchangeManager.connectExchange('binance', credentials);

      // Now test connection
      mockRetrieveCredentials.mockReturnValue(credentials);
      mockAdapter.testConnection.mockResolvedValue({ isSuccessful: true });

      await exchangeManager.testConnection('binance');

      const exchange = exchangeManager.getExchangeStatus('binance');
      expect(exchange.connectionStatus).toBe(ConnectionStatus.CONNECTED);
    });
  });

  describe('getExchangeStatus', () => {
    it('should return exchange status when exchange exists', async () => {
      const credentials = {
        apiKey: 'test-key',
        apiSecret: 'test-secret',
      };

      mockAdapter.testConnection.mockResolvedValue({ isSuccessful: true });
      mockAdapter.getPermissions.mockResolvedValue(['READ_BALANCE', 'WITHDRAW']);
      mockAdapter.getSupportedAssets.mockResolvedValue(['BTC']);
      credentialStorage.storeCredentials.mockReturnValue(true);

      await exchangeManager.connectExchange('binance', credentials);

      const status = exchangeManager.getExchangeStatus('binance');

      expect(status).not.toBeNull();
      expect(status.id).toBe('binance');
    });

    it('should return null when exchange does not exist', () => {
      const status = exchangeManager.getExchangeStatus('nonexistent');

      expect(status).toBeNull();
    });
  });

  describe('isExchangeConnected', () => {
    it('should return true for connected exchange', async () => {
      const credentials = {
        apiKey: 'test-key',
        apiSecret: 'test-secret',
      };

      mockAdapter.testConnection.mockResolvedValue({ isSuccessful: true });
      mockAdapter.getPermissions.mockResolvedValue(['READ_BALANCE', 'WITHDRAW']);
      mockAdapter.getSupportedAssets.mockResolvedValue(['BTC']);
      credentialStorage.storeCredentials.mockReturnValue(true);

      await exchangeManager.connectExchange('binance', credentials);

      expect(exchangeManager.isExchangeConnected('binance')).toBe(true);
    });

    it('should return false for non-connected exchange', () => {
      expect(exchangeManager.isExchangeConnected('binance')).toBe(false);
    });
  });
});
