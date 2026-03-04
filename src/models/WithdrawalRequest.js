/**
 * WithdrawalRequest Model
 * Represents a single withdrawal request to an exchange
 */

class WithdrawalRequest {
  /**
   * @param {string} exchangeId - Exchange identifier
   * @param {string} asset - Asset symbol (e.g., 'BTC', 'ETH')
   * @param {number} amount - Withdrawal amount
   * @param {string} destinationAddress - Destination wallet address
   * @param {string} network - Network/chain for the withdrawal
   * @param {string|null} memo - Optional memo/tag for the withdrawal
   */
  constructor(exchangeId, asset, amount, destinationAddress, network, memo = null) {
    this.exchangeId = exchangeId;
    this.asset = asset;
    this.amount = amount;
    this.destinationAddress = destinationAddress;
    this.network = network;
    this.memo = memo;
  }

  /**
   * Validate the WithdrawalRequest model
   * @returns {{isValid: boolean, errors: string[]}}
   */
  validate() {
    const errors = [];

    if (!this.exchangeId || typeof this.exchangeId !== 'string') {
      errors.push('exchangeId must be a non-empty string');
    }

    if (!this.asset || typeof this.asset !== 'string') {
      errors.push('asset must be a non-empty string');
    }

    if (typeof this.amount !== 'number' || this.amount <= 0) {
      errors.push('amount must be a positive number');
    }

    if (!this.destinationAddress || typeof this.destinationAddress !== 'string') {
      errors.push('destinationAddress must be a non-empty string');
    }

    if (!this.network || typeof this.network !== 'string') {
      errors.push('network must be a non-empty string');
    }

    if (this.memo !== null && typeof this.memo !== 'string') {
      errors.push('memo must be a string or null');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  toJSON() {
    return {
      exchangeId: this.exchangeId,
      asset: this.asset,
      amount: this.amount,
      destinationAddress: this.destinationAddress,
      network: this.network,
      memo: this.memo,
    };
  }
}

export { WithdrawalRequest };
