/**
 * Exchange Adapter Factory
 * 
 * Routes operations to exchange-specific adapter implementations.
 * Provides a centralized way to create and manage exchange adapters.
 * 
 * Requirements: 13.1, 13.2, 13.3, 13.4
 */

import BinanceAdapter from './adapters/BinanceAdapter.js';
import CoinbaseAdapter from './adapters/CoinbaseAdapter.js';
import KrakenAdapter from './adapters/KrakenAdapter.js';
import GenericAdapter from './adapters/GenericAdapter.js';

/**
 * Supported exchange identifiers
 */
export const SUPPORTED_EXCHANGES = {
  BINANCE: 'binance',
  COINBASE: 'coinbase',
  KRAKEN: 'kraken',
};

/**
 * Factory class for creating exchange adapters
 */
class AdapterFactory {
  /**
   * Create an adapter for the specified exchange
   * @param {string} exchangeId - Exchange identifier (e.g., 'binance', 'coinbase', 'kraken')
   * @returns {ExchangeAdapter} Exchange adapter instance
   */
  static createAdapter(exchangeId) {
    if (!exchangeId || typeof exchangeId !== 'string') {
      throw new Error('Invalid exchangeId: must be a non-empty string');
    }

    const normalizedId = exchangeId.toLowerCase();

    switch (normalizedId) {
      case SUPPORTED_EXCHANGES.BINANCE:
        return new BinanceAdapter(normalizedId);
      
      case SUPPORTED_EXCHANGES.COINBASE:
        return new CoinbaseAdapter(normalizedId);
      
      case SUPPORTED_EXCHANGES.KRAKEN:
        return new KrakenAdapter(normalizedId);
      
      default:
        // Use generic adapter for other ccxt-supported exchanges
        return new GenericAdapter(normalizedId);
    }
  }

  /**
   * Check if an exchange has a specific adapter implementation
   * @param {string} exchangeId - Exchange identifier
   * @returns {boolean} True if exchange has specific adapter, false if it uses generic adapter
   */
  static hasSpecificAdapter(exchangeId) {
    const normalizedId = exchangeId.toLowerCase();
    return Object.values(SUPPORTED_EXCHANGES).includes(normalizedId);
  }

  /**
   * Get list of exchanges with specific adapter implementations
   * @returns {string[]} Array of exchange identifiers
   */
  static getSpecificAdapters() {
    return Object.values(SUPPORTED_EXCHANGES);
  }
}

export default AdapterFactory;
