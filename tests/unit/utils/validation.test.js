/**
 * Unit tests for validation functions
 */

import {
  validateWithdrawalRequest,
  validateAllocationTargets,
  validateDestinationAddress,
  isValidCredentialFormat,
} from '../../../src/utils/validation.js';

import {
  WithdrawalRequest,
  AllocationTargets,
  ApiCredentials,
  Permission,
  Exchange,
  ConnectionStatus,
} from '../../../src/models/index.js';

describe('validateWithdrawalRequest', () => {
  const mockExchange = new Exchange('binance', 'Binance', true, ConnectionStatus.CONNECTED, new Date(), ['BTC', 'ETH']);
  const mockBalances = { binance: { BTC: 1.0, ETH: 10.0 } };
  const mockMinimums = { binance: { BTC: 0.001, ETH: 0.01 } };

  test('should validate valid withdrawal request', () => {
    const request = new WithdrawalRequest('binance', 'BTC', 0.5, '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', 'BTC');
    const result = validateWithdrawalRequest(request, {
      connectedExchanges: { binance: mockExchange },
      exchangeBalances: mockBalances,
      exchangeMinimums: mockMinimums,
    });

    expect(result.isValid).toBe(true);
    expect(result.errorMessage).toBeNull();
  });

  test('should reject request for disconnected exchange', () => {
    const request = new WithdrawalRequest('kraken', 'BTC', 0.5, '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', 'BTC');
    const result = validateWithdrawalRequest(request, {
      connectedExchanges: { binance: mockExchange },
      exchangeBalances: mockBalances,
    });

    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toContain('not connected');
  });

  test('should reject request for unsupported asset', () => {
    const request = new WithdrawalRequest('binance', 'XRP', 100, 'rN7n7otQDd6FczFgLdlqtyMVrn3HMfGi2', 'XRP');
    const result = validateWithdrawalRequest(request, {
      connectedExchanges: { binance: mockExchange },
      exchangeBalances: mockBalances,
    });

    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toContain('not supported');
  });

  test('should reject request exceeding available balance', () => {
    const request = new WithdrawalRequest('binance', 'BTC', 2.0, '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', 'BTC');
    const result = validateWithdrawalRequest(request, {
      connectedExchanges: { binance: mockExchange },
      exchangeBalances: mockBalances,
      exchangeMinimums: mockMinimums,
    });

    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toContain('Insufficient balance');
  });

  test('should reject request below minimum threshold', () => {
    const request = new WithdrawalRequest('binance', 'BTC', 0.0001, '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', 'BTC');
    const result = validateWithdrawalRequest(request, {
      connectedExchanges: { binance: mockExchange },
      exchangeBalances: mockBalances,
      exchangeMinimums: mockMinimums,
    });

    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toContain('below exchange minimum');
  });
});

describe('validateAllocationTargets', () => {
  test('should validate valid allocation targets', () => {
    const targets = new AllocationTargets('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb');
    targets.setAllocation('BTC', 60.0, 0.001, 1);
    targets.setAllocation('ETH', 40.0, 0.01, 2);

    const result = validateAllocationTargets(targets);
    expect(result.isValid).toBe(true);
    expect(result.errorMessage).toBeNull();
  });

  test('should reject allocations not summing to 100', () => {
    const targets = new AllocationTargets('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb');
    targets.setAllocation('BTC', 60.0, 0.001, 1);
    targets.setAllocation('ETH', 30.0, 0.01, 2);

    const result = validateAllocationTargets(targets);
    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toContain('100.0');
  });
});

describe('validateDestinationAddress', () => {
  test('should validate Bitcoin address', () => {
    const result = validateDestinationAddress('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', 'BTC', 'BTC');
    expect(result.isValid).toBe(true);
  });

  test('should validate Ethereum address', () => {
    const result = validateDestinationAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEbF', 'ETH', 'ETHEREUM');
    expect(result.isValid).toBe(true);
  });

  test('should reject invalid Bitcoin address', () => {
    const result = validateDestinationAddress('invalid-btc-address', 'BTC', 'BTC');
    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toContain('Invalid Bitcoin address');
  });

  test('should reject invalid Ethereum address', () => {
    const result = validateDestinationAddress('0xinvalid', 'ETH', 'ETHEREUM');
    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toContain('Invalid Ethereum address');
  });

  test('should validate Solana address', () => {
    const result = validateDestinationAddress('7EqQdEULxWcraVx3mXKFjc84LhCkMGZCkRuDpvcMwJeK', 'SOL', 'SOLANA');
    expect(result.isValid).toBe(true);
  });

  test('should reject empty address', () => {
    const result = validateDestinationAddress('', 'BTC', 'BTC');
    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toContain('required');
  });
});

describe('isValidCredentialFormat', () => {
  test('should validate valid credentials', () => {
    const credentials = new ApiCredentials(
      'binance',
      'valid-api-key-123',
      'valid-api-secret-456',
      null,
      [Permission.WITHDRAW]
    );

    const result = isValidCredentialFormat(credentials);
    expect(result.isValid).toBe(true);
  });

  test('should reject credentials without WITHDRAW permission', () => {
    const credentials = new ApiCredentials(
      'binance',
      'valid-api-key-123',
      'valid-api-secret-456',
      null,
      [Permission.READ_BALANCE]
    );

    const result = isValidCredentialFormat(credentials);
    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toContain('WITHDRAW permission');
  });

  test('should reject credentials with short API key', () => {
    const credentials = new ApiCredentials('binance', 'short', 'valid-api-secret-456', null, [Permission.WITHDRAW]);

    const result = isValidCredentialFormat(credentials);
    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toContain('too short');
  });

  test('should reject null credentials', () => {
    const result = isValidCredentialFormat(null);
    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toContain('null or undefined');
  });
});
