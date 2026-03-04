/**
 * Basic setup test to verify testing infrastructure
 */

import fc from 'fast-check';
import ccxt from 'ccxt';
import axios from 'axios';
import crypto from 'crypto';

describe('Project Setup', () => {
  test('should have Node.js version 18 or higher', () => {
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    expect(majorVersion).toBeGreaterThanOrEqual(18);
  });

  test('should be able to import fast-check', () => {
    expect(fc).toBeDefined();
    expect(fc.integer).toBeDefined();
  });

  test('should be able to import ccxt', () => {
    expect(ccxt).toBeDefined();
    expect(ccxt.exchanges).toBeDefined();
  });

  test('should be able to import axios', () => {
    expect(axios).toBeDefined();
    expect(axios.get).toBeDefined();
  });

  test('should have crypto module available', () => {
    expect(crypto).toBeDefined();
    expect(crypto.randomBytes).toBeDefined();
  });
});
