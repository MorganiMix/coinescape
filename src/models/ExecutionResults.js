/**
 * ExecutionResults Model
 * Represents the results of a withdrawal operation
 */

const OperationStatus = {
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  PARTIAL_SUCCESS: 'PARTIAL_SUCCESS',
};

const TransactionStatus = {
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  PENDING: 'PENDING',
  CANCELLED: 'CANCELLED',
};

class WithdrawalResult {
  /**
   * @param {string} exchangeId - Exchange identifier
   * @param {string} asset - Asset symbol
   * @param {number} amount - Withdrawal amount
   * @param {string} status - Transaction status
   * @param {string|null} transactionId - Transaction ID from exchange
   * @param {string|null} errorMessage - Error message if failed
   * @param {Date} timestamp - Result timestamp
   */
  constructor(exchangeId, asset, amount, status, transactionId = null, errorMessage = null, timestamp = new Date()) {
    this.exchangeId = exchangeId;
    this.asset = asset;
    this.amount = amount;
    this.status = status;
    this.transactionId = transactionId;
    this.errorMessage = errorMessage;
    this.timestamp = timestamp;
  }

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

    if (!Object.values(TransactionStatus).includes(this.status)) {
      errors.push(`Invalid transaction status: ${this.status}`);
    }

    if (this.status === TransactionStatus.SUCCESS && !this.transactionId) {
      errors.push('transactionId must be present when status is SUCCESS');
    }

    if (this.status === TransactionStatus.PENDING && !this.transactionId) {
      errors.push('transactionId must be present when status is PENDING');
    }

    if (this.status === TransactionStatus.FAILED && !this.errorMessage) {
      errors.push('errorMessage must be present when status is FAILED');
    }

    if (!(this.timestamp instanceof Date)) {
      errors.push('timestamp must be a Date object');
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
      status: this.status,
      transactionId: this.transactionId,
      errorMessage: this.errorMessage,
      timestamp: this.timestamp.toISOString(),
    };
  }
}

class ExecutionResults {
  /**
   * @param {string} operationId - Operation identifier
   * @param {string} mode - Execution mode
   * @param {Date} startTime - Operation start time
   * @param {Date} endTime - Operation end time
   * @param {string} overallStatus - Overall operation status
   * @param {Array} individualResults - Array of WithdrawalResult objects
   * @param {number} successCount - Number of successful withdrawals
   * @param {number} failureCount - Number of failed withdrawals
   * @param {number} totalProcessed - Total amount processed
   */
  constructor(operationId, mode, startTime, endTime, overallStatus, individualResults = [], successCount = 0, failureCount = 0, totalProcessed = 0) {
    this.operationId = operationId;
    this.mode = mode;
    this.startTime = startTime;
    this.endTime = endTime;
    this.overallStatus = overallStatus;
    this.individualResults = individualResults;
    this.successCount = successCount;
    this.failureCount = failureCount;
    this.totalProcessed = totalProcessed;
  }

  validate() {
    const errors = [];

    if (!this.operationId || typeof this.operationId !== 'string') {
      errors.push('operationId must be a non-empty string');
    }

    if (!(this.startTime instanceof Date)) {
      errors.push('startTime must be a Date object');
    }

    if (!(this.endTime instanceof Date)) {
      errors.push('endTime must be a Date object');
    }

    if (this.endTime < this.startTime) {
      errors.push('endTime must be after startTime');
    }

    if (!Object.values(OperationStatus).includes(this.overallStatus)) {
      errors.push(`Invalid operation status: ${this.overallStatus}`);
    }

    if (!Array.isArray(this.individualResults)) {
      errors.push('individualResults must be an array');
    }

    if (this.successCount + this.failureCount !== this.individualResults.length) {
      errors.push('successCount + failureCount must equal length of individualResults');
    }

    // Validate individual results
    if (Array.isArray(this.individualResults)) {
      this.individualResults.forEach((result, index) => {
        if (result.validate) {
          const validation = result.validate();
          if (!validation.isValid) {
            errors.push(`Result ${index}: ${validation.errors.join(', ')}`);
          }
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  toJSON() {
    return {
      operationId: this.operationId,
      mode: this.mode,
      startTime: this.startTime.toISOString(),
      endTime: this.endTime.toISOString(),
      overallStatus: this.overallStatus,
      individualResults: this.individualResults.map((r) => (r.toJSON ? r.toJSON() : r)),
      successCount: this.successCount,
      failureCount: this.failureCount,
      totalProcessed: this.totalProcessed,
    };
  }
}

export { ExecutionResults, WithdrawalResult, OperationStatus, TransactionStatus };
