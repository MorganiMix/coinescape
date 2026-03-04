/**
 * Exchange Module
 * Exports all exchange-related functionality
 */

import ExchangeManager from './ExchangeManager.js';
import ExchangeAdapter from './ExchangeAdapter.js';
import AdapterFactory, { SUPPORTED_EXCHANGES } from './AdapterFactory.js';
import BinanceAdapter from './adapters/BinanceAdapter.js';
import CoinbaseAdapter from './adapters/CoinbaseAdapter.js';
import KrakenAdapter from './adapters/KrakenAdapter.js';
import GenericAdapter from './adapters/GenericAdapter.js';

export {
  ExchangeManager,
  ExchangeAdapter,
  AdapterFactory,
  SUPPORTED_EXCHANGES,
  BinanceAdapter,
  CoinbaseAdapter,
  KrakenAdapter,
  GenericAdapter,
};

export default ExchangeManager;
