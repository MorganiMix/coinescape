/**
 * AllocationTargets Model
 * Represents allocation configuration for emergency withdrawals
 */

class AllocationConfig {
  /**
   * @param {number} percentage - Allocation percentage (0-100)
   * @param {number} minimumAmount - Minimum withdrawal amount
   * @param {number} priority - Priority level (higher = more important)
   */
  constructor(percentage, minimumAmount = 0, priority = 1) {
    this.percentage = percentage;
    this.minimumAmount = minimumAmount;
    this.priority = priority;
  }

  validate() {
    const errors = [];

    if (typeof this.percentage !== 'number' || this.percentage < 0 || this.percentage > 100) {
      errors.push('percentage must be a number between 0 and 100');
    }

    if (typeof this.minimumAmount !== 'number' || this.minimumAmount < 0) {
      errors.push('minimumAmount must be a non-negative number');
    }

    if (typeof this.priority !== 'number' || this.priority < 1) {
      errors.push('priority must be a positive integer');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  toJSON() {
    return {
      percentage: this.percentage,
      minimumAmount: this.minimumAmount,
      priority: this.priority,
    };
  }
}

class AllocationTargets {
  /**
   * @param {string} targetAddress - Destination wallet address
   * @param {Object} assetAllocations - Map of asset symbol to AllocationConfig
   */
  constructor(targetAddress, assetAllocations = {}) {
    this.targetAddress = targetAddress;
    this.assetAllocations = assetAllocations;
  }

  /**
   * Validate the AllocationTargets model
   * @returns {{isValid: boolean, errors: string[]}}
   */
  validate() {
    const errors = [];

    if (!this.targetAddress || typeof this.targetAddress !== 'string') {
      errors.push('targetAddress must be a non-empty string');
    }

    if (typeof this.assetAllocations !== 'object' || this.assetAllocations === null) {
      errors.push('assetAllocations must be an object');
      return { isValid: false, errors };
    }

    // Validate each allocation config
    const allocations = Object.values(this.assetAllocations);
    allocations.forEach((config, index) => {
      if (config.validate) {
        const validation = config.validate();
        if (!validation.isValid) {
          errors.push(`Allocation ${index}: ${validation.errors.join(', ')}`);
        }
      }
    });

    // Validate that percentages sum to 100
    const totalPercentage = allocations.reduce((sum, config) => sum + (config.percentage || 0), 0);
    const tolerance = 0.01; // Allow small floating point errors
    if (Math.abs(totalPercentage - 100.0) > tolerance) {
      errors.push(`Total allocation percentage must equal 100.0, got ${totalPercentage.toFixed(2)}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Add or update an asset allocation
   * @param {string} asset - Asset symbol
   * @param {number} percentage - Allocation percentage
   * @param {number} minimumAmount - Minimum withdrawal amount
   * @param {number} priority - Priority level
   */
  setAllocation(asset, percentage, minimumAmount = 0, priority = 1) {
    this.assetAllocations[asset] = new AllocationConfig(percentage, minimumAmount, priority);
  }

  /**
   * Get allocation for a specific asset
   * @param {string} asset - Asset symbol
   * @returns {AllocationConfig|null}
   */
  getAllocation(asset) {
    return this.assetAllocations[asset] || null;
  }

  toJSON() {
    const allocations = {};
    Object.keys(this.assetAllocations).forEach((asset) => {
      const config = this.assetAllocations[asset];
      allocations[asset] = config.toJSON ? config.toJSON() : config;
    });

    return {
      targetAddress: this.targetAddress,
      assetAllocations: allocations,
    };
  }
}

export { AllocationTargets, AllocationConfig };
