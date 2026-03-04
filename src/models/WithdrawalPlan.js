/**
 * WithdrawalPlan Model
 * Represents a complete withdrawal plan with multiple requests
 */

const ExecutionMode = {
  DRY_RUN: 'DRY_RUN',
  REAL_WITHDRAWAL: 'REAL_WITHDRAWAL',
};

class WithdrawalPlan {
  /**
   * @param {string} operationId - Unique operation identifier
   * @param {Date} createdAt - Plan creation timestamp
   * @param {string} mode - Execution mode (DRY_RUN or REAL_WITHDRAWAL)
   * @param {Array} requests - Array of WithdrawalRequest objects
   * @param {number} estimatedDuration - Estimated duration in seconds
   * @param {number} totalValueUSD - Total value in USD
   */
  constructor(operationId, createdAt, mode, requests = [], estimatedDuration = 0, totalValueUSD = 0) {
    this.operationId = operationId;
    this.createdAt = createdAt;
    this.mode = mode;
    this.requests = requests;
    this.estimatedDuration = estimatedDuration;
    this.totalValueUSD = totalValueUSD;
  }

  /**
   * Validate the WithdrawalPlan model
   * @returns {{isValid: boolean, errors: string[]}}
   */
  validate() {
    const errors = [];

    if (!this.operationId || typeof this.operationId !== 'string') {
      errors.push('operationId must be a non-empty string');
    }

    if (!(this.createdAt instanceof Date)) {
      errors.push('createdAt must be a Date object');
    }

    if (!Object.values(ExecutionMode).includes(this.mode)) {
      errors.push(`Invalid execution mode: ${this.mode}`);
    }

    if (!Array.isArray(this.requests)) {
      errors.push('requests must be an array');
    }

    if (typeof this.estimatedDuration !== 'number' || this.estimatedDuration < 0) {
      errors.push('estimatedDuration must be a non-negative number');
    }

    if (typeof this.totalValueUSD !== 'number' || this.totalValueUSD < 0) {
      errors.push('totalValueUSD must be a non-negative number');
    }

    // Validate individual requests
    if (Array.isArray(this.requests)) {
      this.requests.forEach((request, index) => {
        if (request.validate) {
          const validation = request.validate();
          if (!validation.isValid) {
            errors.push(`Request ${index}: ${validation.errors.join(', ')}`);
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
      createdAt: this.createdAt.toISOString(),
      mode: this.mode,
      requests: this.requests.map((r) => (r.toJSON ? r.toJSON() : r)),
      estimatedDuration: this.estimatedDuration,
      totalValueUSD: this.totalValueUSD,
    };
  }
}

export { WithdrawalPlan, ExecutionMode };
