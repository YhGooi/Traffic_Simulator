/**
 * Lane Module
 * Represents a single traffic lane with vehicle queue management and capacity tracking.
 * Part of the Sensing & Data Ingestion layer in the energy-aware architecture.
 */

export class Lane {
  /**
   * @param {Object} params
   * @param {string} params.id - Unique lane identifier
   * @param {string} params.axis - 'H' (horizontal) or 'V' (vertical)
   * @param {number} params.sign - Direction sign (+1 or -1)
   * @param {number} params.laneCoord - The perpendicular coordinate (y for H, x for V)
   * @param {Object} params.entryPoint - {x, y} entry coordinates
   * @param {Object} params.exitPoint - {x, y} exit coordinates
   * @param {number} params.capacity - Maximum vehicle capacity
   */
  constructor({ id, axis, sign, laneCoord, entryPoint, exitPoint, capacity = 10 }) {
    this.id = id;
    this.axis = axis;
    this.sign = sign;
    this.laneCoord = laneCoord;
    this.entryPoint = entryPoint;
    this.exitPoint = exitPoint;
    this.capacity = capacity;
    
    // Vehicle queue (ordered from leader to follower)
    this.vehicles = [];
    
    // Lane state metrics
    this.metrics = {
      totalVehiclesServed: 0,
      averageWaitTime: 0,
      currentQueueLength: 0,
      occupancyRate: 0,
      cumulativeWaitTime: 0
    };
  }

  /**
   * Add a vehicle to the lane queue
   * @param {Vehicle} vehicle
   * @returns {boolean} Success status
   */
  addVehicle(vehicle) {
    if (this.vehicles.length >= this.capacity) {
      return false;
    }
    
    this.vehicles.push(vehicle);
    this._updateMetrics();
    return true;
  }

  /**
   * Remove a vehicle from the lane queue
   * @param {Vehicle} vehicle
   */
  removeVehicle(vehicle) {
    const index = this.vehicles.indexOf(vehicle);
    if (index !== -1) {
      this.vehicles.splice(index, 1);
      this.metrics.totalVehiclesServed++;
      this._updateMetrics();
    }
  }

  /**
   * Get vehicles sorted by position (leader first)
   * @returns {Array} Sorted vehicle array
   */
  getSortedVehicles() {
    return [...this.vehicles].sort((a, b) => {
      const posA = this.axis === 'H' ? a.x : a.y;
      const posB = this.axis === 'H' ? b.x : b.y;
      return this.sign > 0 ? (posB - posA) : (posA - posB);
    });
  }

  /**
   * Check if lane is at capacity
   * @returns {boolean}
   */
  isFull() {
    return this.vehicles.length >= this.capacity;
  }

  /**
   * Get current queue length
   * @returns {number}
   */
  getQueueLength() {
    return this.vehicles.length;
  }

  /**
   * Get lane occupancy rate (0.0 to 1.0)
   * @returns {number}
   */
  getOccupancyRate() {
    return this.vehicles.length / this.capacity;
  }

  /**
   * Calculate average waiting time for vehicles in this lane
   * @param {number} currentSimTime - Current simulation time in ms
   * @returns {number} Average wait time in ms
   */
  getAverageWaitingTime(currentSimTime) {
    if (this.vehicles.length === 0) return 0;
    
    let totalWait = 0;
    for (const v of this.vehicles) {
      const waitTime = v.getWaitingTime(currentSimTime);
      totalWait += waitTime;
    }
    
    return totalWait / this.vehicles.length;
  }

  /**
   * Update lane metrics
   * @private
   */
  _updateMetrics() {
    this.metrics.currentQueueLength = this.vehicles.length;
    this.metrics.occupancyRate = this.getOccupancyRate();
  }

  /**
   * Get programmatic state snapshot for analytics
   * @param {number} currentSimTime - Current simulation time
   * @returns {Object} Lane state snapshot
   */
  getState(currentSimTime) {
    return {
      id: this.id,
      axis: this.axis,
      sign: this.sign,
      vehicleCount: this.vehicles.length,
      capacity: this.capacity,
      occupancyRate: this.getOccupancyRate(),
      isFull: this.isFull(),
      averageWaitTime: this.getAverageWaitingTime(currentSimTime),
      metrics: { ...this.metrics }
    };
  }

  /**
   * Reset lane statistics
   */
  resetMetrics() {
    this.metrics = {
      totalVehiclesServed: 0,
      averageWaitTime: 0,
      currentQueueLength: 0,
      occupancyRate: 0,
      cumulativeWaitTime: 0
    };
  }
}
