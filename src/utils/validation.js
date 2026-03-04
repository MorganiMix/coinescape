/**
 * Validation Functions
 * Comprehensive validation for withdrawal requests, allocations, addresses, and credentials
 */

/**
 * Validate a withdrawal request
 * Checks: exchange connection, asset support, balance sufficiency, amount thresholds,
 * destination address validity, and network support
 *
 * @param {Object} request - WithdrawalRequest object
 * @param {Object} options - Validation options
 * @param {Object} options.connectedExchanges - Map of connected exchanges
 * @param {Object} options.exchangeBalances - Map of exchange balances
 * @param {Object} options.exchangeMinimums - Map of exchange minimum withdrawal amounts
 * @returns {{isValid: boolean, errorMessage: string|null}}
 */
function validateWithdrawalRequest(request, options = {}) {
  const { connectedExchanges = {}, exchangeBalances = {}, exchangeMinimums = {} } = options;

  // Validate request structure
  if (!request) {
    return { isValid: false, errorMessage: 'Withdrawal request is null or undefined' };
  }

  const requestValidation = request.validate ? request.validate() : { isValid: true, errors: [] };
  if (!requestValidation.isValid) {
    return { isValid: false, errorMessage: requestValidation.errors.join('; ') };
  }

  // Check if exchange is connected and operational
  const exchange = connectedExchanges[request.exchangeId];
  if (!exchange) {
    return {
      isValid: false,
      errorMessage: `Exchange ${request.exchangeId} is not connected`,
    };
  }

  if (!exchange.isConnected || exchange.connectionStatus !== 'CONNECTED') {
    return {
      isValid: false,
      errorMessage: `Exchange ${request.exchangeId} is not operational (status: ${exchange.connectionStatus})`,
    };
  }

  // Check if asset is supported by the exchange
  if (exchange.supportedAssets && !exchange.supportedAssets.includes(request.asset)) {
    return {
      isValid: false,
      errorMessage: `Asset ${request.asset} is not supported by exchange ${request.exchangeId}`,
    };
  }

  // Check if amount exceeds available balance
  const balances = exchangeBalances[request.exchangeId] || {};
  const availableBalance = balances[request.asset] || 0;

  if (request.amount > availableBalance) {
    return {
      isValid: false,
      errorMessage: `Insufficient balance: requested ${request.amount} ${request.asset}, available ${availableBalance}`,
    };
  }

  // Check if amount meets exchange minimum withdrawal threshold
  const minimums = exchangeMinimums[request.exchangeId] || {};
  const minimumAmount = minimums[request.asset];

  if (minimumAmount !== undefined && request.amount < minimumAmount) {
    return {
      isValid: false,
      errorMessage: `Amount ${request.amount} ${request.asset} is below exchange minimum of ${minimumAmount}`,
    };
  }

  // Validate destination address for the asset and network
  const addressValidation = validateDestinationAddress(request.destinationAddress, request.asset, request.network);
  if (!addressValidation.isValid) {
    return addressValidation;
  }

  // Check if network is supported (basic check - would need exchange-specific data)
  if (!request.network || request.network.trim() === '') {
    return {
      isValid: false,
      errorMessage: 'Network must be specified',
    };
  }

  return { isValid: true, errorMessage: null };
}

/**
 * Validate allocation targets
 * Checks: percentage sum equals 100, percentages in valid range, minimum amounts non-negative
 *
 * @param {Object} allocationTargets - AllocationTargets object
 * @returns {{isValid: boolean, errorMessage: string|null}}
 */
function validateAllocationTargets(allocationTargets) {
  if (!allocationTargets) {
    return { isValid: false, errorMessage: 'Allocation targets is null or undefined' };
  }

  // Use the model's built-in validation
  const validation = allocationTargets.validate ? allocationTargets.validate() : { isValid: true, errors: [] };

  if (!validation.isValid) {
    return {
      isValid: false,
      errorMessage: validation.errors.join('; '),
    };
  }

  return { isValid: true, errorMessage: null };
}

/**
 * Validate destination address for different asset types
 * Performs format validation based on asset type and network
 *
 * @param {string} address - Destination wallet address
 * @param {string} asset - Asset symbol (e.g., 'BTC', 'ETH')
 * @param {string} network - Network/chain identifier
 * @returns {{isValid: boolean, errorMessage: string|null}}
 */
function validateDestinationAddress(address, asset, network) {
  if (!address || typeof address !== 'string' || address.trim() === '') {
    return { isValid: false, errorMessage: 'Destination address is required' };
  }

  if (!asset || typeof asset !== 'string') {
    return { isValid: false, errorMessage: 'Asset type is required for address validation' };
  }

  const trimmedAddress = address.trim();

  // Bitcoin address validation
  if (asset === 'BTC' || asset === 'BITCOIN') {
    // Bitcoin addresses: Legacy (1...), SegWit (3...), Bech32 (bc1...)
    const btcRegex = /^(1|3|bc1)[a-zA-HJ-NP-Z0-9]{25,62}$/;
    if (!btcRegex.test(trimmedAddress)) {
      return {
        isValid: false,
        errorMessage: `Invalid Bitcoin address format: ${trimmedAddress}`,
      };
    }
    return { isValid: true, errorMessage: null };
  }

  // Ethereum and ERC-20 tokens address validation
  if (asset === 'ETH' || asset === 'ETHEREUM' || network === 'ERC20' || network === 'ETHEREUM') {
    // Ethereum addresses: 0x followed by 40 hexadecimal characters
    const ethRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!ethRegex.test(trimmedAddress)) {
      return {
        isValid: false,
        errorMessage: `Invalid Ethereum address format: ${trimmedAddress}`,
      };
    }
    return { isValid: true, errorMessage: null };
  }

  // Solana address validation
  if (asset === 'SOL' || asset === 'SOLANA' || network === 'SOLANA') {
    // Solana addresses: Base58 encoded, typically 32-44 characters
    const solRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    if (!solRegex.test(trimmedAddress)) {
      return {
        isValid: false,
        errorMessage: `Invalid Solana address format: ${trimmedAddress}`,
      };
    }
    return { isValid: true, errorMessage: null };
  }

  // Cardano address validation
  if (asset === 'ADA' || asset === 'CARDANO' || network === 'CARDANO') {
    // Cardano addresses: addr1... (Shelley era)
    const adaRegex = /^addr1[a-z0-9]{58,}$/;
    if (!adaRegex.test(trimmedAddress)) {
      return {
        isValid: false,
        errorMessage: `Invalid Cardano address format: ${trimmedAddress}`,
      };
    }
    return { isValid: true, errorMessage: null };
  }

  // Polkadot address validation
  if (asset === 'DOT' || asset === 'POLKADOT' || network === 'POLKADOT') {
    // Polkadot addresses: Base58 encoded, typically start with 1
    const dotRegex = /^1[1-9A-HJ-NP-Za-km-z]{46,47}$/;
    if (!dotRegex.test(trimmedAddress)) {
      return {
        isValid: false,
        errorMessage: `Invalid Polkadot address format: ${trimmedAddress}`,
      };
    }
    return { isValid: true, errorMessage: null };
  }

  // USDT, USDC, DAI - depends on network
  if (asset === 'USDT' || asset === 'USDC' || asset === 'DAI') {
    if (network === 'ERC20' || network === 'ETHEREUM') {
      const ethRegex = /^0x[a-fA-F0-9]{40}$/;
      if (!ethRegex.test(trimmedAddress)) {
        return {
          isValid: false,
          errorMessage: `Invalid ERC-20 address format for ${asset}: ${trimmedAddress}`,
        };
      }
      return { isValid: true, errorMessage: null };
    }
    if (network === 'TRC20' || network === 'TRON') {
      // TRON addresses: T followed by 33 Base58 characters
      const tronRegex = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
      if (!tronRegex.test(trimmedAddress)) {
        return {
          isValid: false,
          errorMessage: `Invalid TRC-20 address format for ${asset}: ${trimmedAddress}`,
        };
      }
      return { isValid: true, errorMessage: null };
    }
  }

  // Generic validation for unknown assets - basic length and character check
  if (trimmedAddress.length < 20 || trimmedAddress.length > 100) {
    return {
      isValid: false,
      errorMessage: `Address length ${trimmedAddress.length} is outside valid range (20-100 characters)`,
    };
  }

  // Allow alphanumeric addresses for unknown assets
  const genericRegex = /^[a-zA-Z0-9]+$/;
  if (!genericRegex.test(trimmedAddress)) {
    return {
      isValid: false,
      errorMessage: `Address contains invalid characters: ${trimmedAddress}`,
    };
  }

  return { isValid: true, errorMessage: null };
}

/**
 * Validate API credential format
 * Checks basic format requirements for API credentials
 *
 * @param {Object} credentials - ApiCredentials object
 * @returns {{isValid: boolean, errorMessage: string|null}}
 */
function isValidCredentialFormat(credentials) {
  if (!credentials) {
    return { isValid: false, errorMessage: 'Credentials is null or undefined' };
  }

  // Use the model's built-in validation
  const validation = credentials.validate ? credentials.validate() : { isValid: true, errors: [] };

  if (!validation.isValid) {
    return {
      isValid: false,
      errorMessage: validation.errors.join('; '),
    };
  }

  // Additional format checks
  if (credentials.apiKey.length < 10) {
    return {
      isValid: false,
      errorMessage: 'API key is too short (minimum 10 characters)',
    };
  }

  if (credentials.apiSecret.length < 10) {
    return {
      isValid: false,
      errorMessage: 'API secret is too short (minimum 10 characters)',
    };
  }

  // Check for WITHDRAW permission
  if (!credentials.hasWithdrawPermission || !credentials.hasWithdrawPermission()) {
    return {
      isValid: false,
      errorMessage: 'API credentials must have WITHDRAW permission',
    };
  }

  return { isValid: true, errorMessage: null };
}

export {
  validateWithdrawalRequest,
  validateAllocationTargets,
  validateDestinationAddress,
  isValidCredentialFormat,
};
