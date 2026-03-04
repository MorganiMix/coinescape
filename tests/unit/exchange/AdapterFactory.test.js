/**
 * Unit tests for AdapterFactory
 */

import AdapterFactory, { SUPPORTED_EXCHANGES } from '../../../src/exchange/AdapterFactory.js';
import BinanceAdapter from '../../../src/exchange/adapters/BinanceAdapter.js';
import CoinbaseAdapter from '../../../src/exchange/adapters/CoinbaseAdapter.js';
import KrakenAdapter from '../../../src/exchange/adapters/KrakenAdapter.js';
import GenericAdapter from '../../../src/exchange/adapters/GenericAdapter.js';

describe('AdapterFactory', () => {
  describe('createAdapter', () => {
    it('should create BinanceAdapter for binance exchange', () => {
      const adapter = AdapterFactory.createAdapter('binance');
      expect(adapter).toBeInstanceOf(BinanceAdapter);
      expect(adapter.exchangeId).toBe('binance');
    });

    it('should create CoinbaseAdapter for coinbase exchange', () => {
      const adapter = AdapterFactory.createAdapter('coinbase');
      expect(adapter).toBeInstanceOf(CoinbaseAdapter);
      expect(adapter.exchangeId).toBe('coinbase');
    });

    it('should create KrakenAdapter for kraken exchange', () => {
      const adapter = AdapterFactory.createAdapter('kraken');
      expect(adapter).toBeInstanceOf(KrakenAdapter);
      expect(adapter.exchangeId).toBe('kraken');
    });

    it('should create GenericAdapter for unsupported exchange', () => {
      const adapter = AdapterFactory.createAdapter('bitfinex');
      expect(adapter).toBeInstanceOf(GenericAdapter);
      expect(adapter.exchangeId).toBe('bitfinex');
    });

    it('should handle case-insensitive exchange IDs', () => {
      const adapter1 = AdapterFactory.createAdapter('BINANCE');
      const adapter2 = AdapterFactory.createAdapter('Binance');
      const adapter3 = AdapterFactory.createAdapter('binance');

      expect(adapter1).toBeInstanceOf(BinanceAdapter);
      expect(adapter2).toBeInstanceOf(BinanceAdapter);
      expect(adapter3).toBeInstanceOf(BinanceAdapter);
    });

    it('should throw error for invalid exchangeId', () => {
      expect(() => AdapterFactory.createAdapter('')).toThrow('Invalid exchangeId');
      expect(() => AdapterFactory.createAdapter(null)).toThrow('Invalid exchangeId');
      expect(() => AdapterFactory.createAdapter(undefined)).toThrow('Invalid exchangeId');
      expect(() => AdapterFactory.createAdapter(123)).toThrow('Invalid exchangeId');
    });
  });

  describe('hasSpecificAdapter', () => {
    it('should return true for exchanges with specific adapters', () => {
      expect(AdapterFactory.hasSpecificAdapter('binance')).toBe(true);
      expect(AdapterFactory.hasSpecificAdapter('coinbase')).toBe(true);
      expect(AdapterFactory.hasSpecificAdapter('kraken')).toBe(true);
    });

    it('should return false for exchanges without specific adapters', () => {
      expect(AdapterFactory.hasSpecificAdapter('bitfinex')).toBe(false);
      expect(AdapterFactory.hasSpecificAdapter('gemini')).toBe(false);
    });

    it('should handle case-insensitive exchange IDs', () => {
      expect(AdapterFactory.hasSpecificAdapter('BINANCE')).toBe(true);
      expect(AdapterFactory.hasSpecificAdapter('Binance')).toBe(true);
    });
  });

  describe('getSpecificAdapters', () => {
    it('should return list of exchanges with specific adapters', () => {
      const adapters = AdapterFactory.getSpecificAdapters();

      expect(adapters).toContain('binance');
      expect(adapters).toContain('coinbase');
      expect(adapters).toContain('kraken');
      expect(adapters.length).toBe(3);
    });
  });

  describe('SUPPORTED_EXCHANGES', () => {
    it('should export supported exchange constants', () => {
      expect(SUPPORTED_EXCHANGES.BINANCE).toBe('binance');
      expect(SUPPORTED_EXCHANGES.COINBASE).toBe('coinbase');
      expect(SUPPORTED_EXCHANGES.KRAKEN).toBe('kraken');
    });
  });
});
