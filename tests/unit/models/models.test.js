/**
 * Unit tests for data models
 */

import {
  Exchange,
  ConnectionStatus,
  WithdrawalRequest,
  WithdrawalPlan,
  ExecutionMode,
  ExecutionResults,
  WithdrawalResult,
  OperationStatus,
  TransactionStatus,
  ApiCredentials,
  Permission,
  AllocationTargets,
  AllocationConfig,
} from '../../../src/models/index.js';

describe('Exchange Model', () => {
  test('should create valid exchange', () => {
    const exchange = new Exchange('binance', 'Binance', true, ConnectionStatus.CONNECTED, new Date(), ['BTC', 'ETH']);

    const validation = exchange.validate();
    expect(validation.isValid).toBe(true);
    expect(validation.errors).toEqual([]);
  });

  test('should reject exchange with empty id', () => {
    const exchange = new Exchange('', 'Binance');

    const validation = exchange.validate();
    expect(validation.isValid).toBe(false);
    expect(validation.errors).toContain('Exchange id must be a non-empty string');
  });

  test('should reject exchange with invalid connection status', () => {
    const exchange = new Exchange('binance', 'Binance', true, 'INVALID_STATUS');

    const validation = exchange.validate();
    expect(validation.isValid).toBe(false);
  });

  test('should serialize to JSON correctly', () => {
    const date = new Date('2024-01-01T00:00:00Z');
    const exchange = new Exchange('binance', 'Binance', true, ConnectionStatus.CONNECTED, date, ['BTC']);

    const json = exchange.toJSON();
    expect(json.id).toBe('binance');
    expect(json.lastSyncTime).toBe(date.toISOString());
  });
});

describe('WithdrawalRequest Model', () => {
  test('should create valid withdrawal request', () => {
    const request = new WithdrawalRequest('binance', 'BTC', 0.5, '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', 'BTC');

    const validation = request.validate();
    expect(validation.isValid).toBe(true);
  });

  test('should reject request with negative amount', () => {
    const request = new WithdrawalRequest('binance', 'BTC', -0.5, '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', 'BTC');

    const validation = request.validate();
    expect(validation.isValid).toBe(false);
    expect(validation.errors).toContain('amount must be a positive number');
  });

  test('should handle optional memo', () => {
    const request = new WithdrawalRequest('binance', 'XRP', 100, 'rN7n7otQDd6FczFgLdlqtyMVrn3HMfGi2', 'XRP', '12345');

    expect(request.memo).toBe('12345');
    expect(request.validate().isValid).toBe(true);
  });
});

describe('WithdrawalPlan Model', () => {
  test('should create valid withdrawal plan', () => {
    const request = new WithdrawalRequest('binance', 'BTC', 0.5, '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', 'BTC');
    const plan = new WithdrawalPlan('op-123', new Date(), ExecutionMode.DRY_RUN, [request], 30, 25000);

    const validation = plan.validate();
    expect(validation.isValid).toBe(true);
  });

  test('should reject plan with invalid execution mode', () => {
    const plan = new WithdrawalPlan('op-123', new Date(), 'INVALID_MODE', [], 30, 25000);

    const validation = plan.validate();
    expect(validation.isValid).toBe(false);
  });

  test('should reject plan with negative estimated duration', () => {
    const plan = new WithdrawalPlan('op-123', new Date(), ExecutionMode.DRY_RUN, [], -10, 25000);

    const validation = plan.validate();
    expect(validation.isValid).toBe(false);
    expect(validation.errors).toContain('estimatedDuration must be a non-negative number');
  });
});

describe('ExecutionResults Model', () => {
  test('should create valid execution results', () => {
    const startTime = new Date('2024-01-01T00:00:00Z');
    const endTime = new Date('2024-01-01T00:00:30Z');
    const result = new WithdrawalResult('binance', 'BTC', 0.5, TransactionStatus.SUCCESS, 'tx-123', null, endTime);
    const results = new ExecutionResults('op-123', ExecutionMode.REAL_WITHDRAWAL, startTime, endTime, OperationStatus.SUCCESS, [result], 1, 0, 0.5);

    const validation = results.validate();
    expect(validation.isValid).toBe(true);
  });

  test('should reject results with endTime before startTime', () => {
    const startTime = new Date('2024-01-01T00:00:30Z');
    const endTime = new Date('2024-01-01T00:00:00Z');
    const results = new ExecutionResults('op-123', ExecutionMode.REAL_WITHDRAWAL, startTime, endTime, OperationStatus.SUCCESS, [], 0, 0, 0);

    const validation = results.validate();
    expect(validation.isValid).toBe(false);
    expect(validation.errors).toContain('endTime must be after startTime');
  });

  test('should reject results with mismatched counts', () => {
    const startTime = new Date('2024-01-01T00:00:00Z');
    const endTime = new Date('2024-01-01T00:00:30Z');
    const result = new WithdrawalResult('binance', 'BTC', 0.5, TransactionStatus.SUCCESS, 'tx-123', null, endTime);
    const results = new ExecutionResults('op-123', ExecutionMode.REAL_WITHDRAWAL, startTime, endTime, OperationStatus.SUCCESS, [result], 2, 0, 0.5);

    const validation = results.validate();
    expect(validation.isValid).toBe(false);
    expect(validation.errors).toContain('successCount + failureCount must equal length of individualResults');
  });
});

describe('WithdrawalResult Model', () => {
  test('should require transactionId for SUCCESS status', () => {
    const result = new WithdrawalResult('binance', 'BTC', 0.5, TransactionStatus.SUCCESS, null, null, new Date());

    const validation = result.validate();
    expect(validation.isValid).toBe(false);
    expect(validation.errors).toContain('transactionId must be present when status is SUCCESS');
  });

  test('should require errorMessage for FAILED status', () => {
    const result = new WithdrawalResult('binance', 'BTC', 0.5, TransactionStatus.FAILED, null, null, new Date());

    const validation = result.validate();
    expect(validation.isValid).toBe(false);
    expect(validation.errors).toContain('errorMessage must be present when status is FAILED');
  });

  test('should accept valid PENDING result', () => {
    const result = new WithdrawalResult('binance', 'BTC', 0.5, TransactionStatus.PENDING, 'tx-123', null, new Date());

    const validation = result.validate();
    expect(validation.isValid).toBe(true);
  });
});

describe('ApiCredentials Model', () => {
  test('should create valid credentials', () => {
    const credentials = new ApiCredentials('binance', 'api-key-123', 'api-secret-456', null, [Permission.READ_BALANCE, Permission.WITHDRAW]);

    const validation = credentials.validate();
    expect(validation.isValid).toBe(true);
  });

  test('should reject credentials without WITHDRAW permission', () => {
    const credentials = new ApiCredentials('binance', 'api-key-123', 'api-secret-456', null, [Permission.READ_BALANCE]);

    expect(credentials.hasWithdrawPermission()).toBe(false);
  });

  test('should accept credentials with WITHDRAW permission', () => {
    const credentials = new ApiCredentials('binance', 'api-key-123', 'api-secret-456', null, [Permission.WITHDRAW]);

    expect(credentials.hasWithdrawPermission()).toBe(true);
  });

  test('should reject expired credentials', () => {
    const pastDate = new Date('2020-01-01T00:00:00Z');
    const credentials = new ApiCredentials('binance', 'api-key-123', 'api-secret-456', null, [Permission.WITHDRAW], new Date(), pastDate);

    const validation = credentials.validate();
    expect(validation.isValid).toBe(false);
    expect(validation.errors).toContain('expiresAt must be in the future');
  });
});

describe('AllocationTargets Model', () => {
  test('should create valid allocation targets', () => {
    const targets = new AllocationTargets('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb');
    targets.setAllocation('BTC', 50.0, 0.001, 1);
    targets.setAllocation('ETH', 50.0, 0.01, 2);

    const validation = targets.validate();
    expect(validation.isValid).toBe(true);
  });

  test('should reject allocations that do not sum to 100', () => {
    const targets = new AllocationTargets('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb');
    targets.setAllocation('BTC', 40.0, 0.001, 1);
    targets.setAllocation('ETH', 50.0, 0.01, 2);

    const validation = targets.validate();
    expect(validation.isValid).toBe(false);
    expect(validation.errors[0]).toContain('Total allocation percentage must equal 100.0');
  });

  test('should reject allocation with percentage > 100', () => {
    const config = new AllocationConfig(150.0, 0.001, 1);

    const validation = config.validate();
    expect(validation.isValid).toBe(false);
    expect(validation.errors).toContain('percentage must be a number between 0 and 100');
  });

  test('should reject allocation with negative minimum amount', () => {
    const config = new AllocationConfig(50.0, -0.001, 1);

    const validation = config.validate();
    expect(validation.isValid).toBe(false);
    expect(validation.errors).toContain('minimumAmount must be a non-negative number');
  });

  test('should get allocation for specific asset', () => {
    const targets = new AllocationTargets('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb');
    targets.setAllocation('BTC', 100.0, 0.001, 1);

    const allocation = targets.getAllocation('BTC');
    expect(allocation).not.toBeNull();
    expect(allocation.percentage).toBe(100.0);
  });
});
