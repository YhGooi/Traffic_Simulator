/**
 * SimulationEngine Module
 * Core simulation logic separated from UI rendering.
 * Provides programmatic API for state access and control.
 * Part of the Traffic Analytics and Energy-Aware Optimization layers.
 */

export class SimulationEngine {
  constructor({ config }) {
    this.config = config;
    
    // Simulation state
    this.simTimeMs = 0;
    this.isRunning = false;
    this.isPaused = false;
    
    // References to simulation entities (set by World)
    this.junctions = null;
    this.vehicles = null;
    
    // Simulation metrics
    this.metrics = {
      totalSteps: 0,
      averageStepTime: 0,
      lastStepTime: 0
    };
  }

  /**
   * Initialize the simulation engine with world entities
   * @param {Map} junctions - Map of junction objects
   * @param {Set} vehicles - Set of vehicle objects
   */
  initialize(junctions, vehicles) {
    this.junctions = junctions;
    this.vehicles = vehicles;
    this.isRunning = true;
  }

  /**
   * Update simulation state (called each frame)
   * @param {number} dt - Delta time (simulation-scaled)
   * @param {number} deltaMs - Delta time in milliseconds
   */
  update(dt, deltaMs) {
    if (!this.isRunning || this.isPaused) return;
    
    const stepStartTime = performance.now();
    
    // Update simulation time
    this.simTimeMs += deltaMs;
    
    // Update all traffic signals
    this._updateSignals(deltaMs);
    
    // Plan vehicle movements
    this._planVehicleMovements(dt);
    
    // Apply collision avoidance and queuing
    this._applyQueuing();
    
    // Apply vehicle movements
    this._applyVehicleMovements();
    
    // Update metrics
    const stepEndTime = performance.now();
    this.metrics.lastStepTime = stepEndTime - stepStartTime;
    this.metrics.totalSteps++;
    this.metrics.averageStepTime = 
      (this.metrics.averageStepTime * (this.metrics.totalSteps - 1) + this.metrics.lastStepTime) / this.metrics.totalSteps;
  }

  /**
   * Update all traffic signals
   * @private
   */
  _updateSignals(deltaMs) {
    if (!this.junctions) return;
    
    for (const junction of this.junctions.values()) {
      junction.signal.update(deltaMs);
    }
  }

  /**
   * Plan movements for all vehicles
   * @private
   */
  _planVehicleMovements(dt) {
    if (!this.vehicles) return;
    
    for (const vehicle of this.vehicles) {
      vehicle.planStep(dt);
    }
  }

  /**
   * Apply queuing and collision avoidance logic
   * @private
   */
  _applyQueuing() {
    if (!this.vehicles) return;
    
    // Group vehicles by lane
    const groups = new Map();
    const snap = 2;

    for (const v of this.vehicles) {
      if (!v.plan || v.plan.done) continue;
      const { axis, sign, laneCoord } = v.plan;
      const snapped = Math.round(laneCoord / snap) * snap;
      const k = `${axis}|${sign}|${snapped}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(v);
    }

    // Apply no-overlap logic per lane
    for (const arr of groups.values()) {
      if (arr.length <= 1) continue;

      const axis = arr[0].plan.axis;
      const sign = arr[0].plan.sign;

      // Sort leader -> follower
      arr.sort((a, b) => {
        const pa = axis === "H" ? a.plan.nx : a.plan.ny;
        const pb = axis === "H" ? b.plan.nx : b.plan.ny;
        return sign > 0 ? (pb - pa) : (pa - pb);
      });

      for (let i = 1; i < arr.length; i++) {
        const lead = arr[i - 1];
        const fol = arr[i];
        const gap = this.config.CAR_GAP;

        if (axis === "H") {
          const original = fol.plan.nx;
          if (sign > 0) {
            const maxX = lead.plan.nx - gap - fol.len;
            fol.plan.nx = Math.min(fol.plan.nx, maxX);
            fol.plan.nx = Math.max(fol.plan.nx, fol.x);
          } else {
            const minX = lead.plan.nx + lead.len + gap;
            fol.plan.nx = Math.max(fol.plan.nx, minX);
            fol.plan.nx = Math.min(fol.plan.nx, fol.x);
          }
          if (Math.abs(fol.plan.nx - original) > 0.001) fol.plan.blockedByLeader = true;
        } else {
          const original = fol.plan.ny;
          if (sign > 0) {
            const maxY = lead.plan.ny - gap - fol.len;
            fol.plan.ny = Math.min(fol.plan.ny, maxY);
            fol.plan.ny = Math.max(fol.plan.ny, fol.y);
          } else {
            const minY = lead.plan.ny + lead.len + gap;
            fol.plan.ny = Math.max(fol.plan.ny, minY);
            fol.plan.ny = Math.min(fol.plan.ny, fol.y);
          }
          if (Math.abs(fol.plan.ny - original) > 0.001) fol.plan.blockedByLeader = true;
        }
      }
    }
  }

  /**
   * Apply planned movements to all vehicles
   * @private
   */
  _applyVehicleMovements() {
    if (!this.vehicles) return;
    
    for (const vehicle of this.vehicles) {
      vehicle.applyStep();
    }
  }

  /**
   * Pause the simulation
   */
  pause() {
    this.isPaused = true;
  }

  /**
   * Resume the simulation
   */
  resume() {
    this.isPaused = false;
  }

  /**
   * Stop the simulation
   */
  stop() {
    this.isRunning = false;
  }

  /**
   * Get complete simulation state snapshot
   * @returns {Object} Complete simulation state
   */
  getState() {
    const junctionStates = [];
    if (this.junctions) {
      for (const junction of this.junctions.values()) {
        junctionStates.push(junction.getState(this.simTimeMs));
      }
    }

    const vehicleStates = [];
    if (this.vehicles) {
      for (const vehicle of this.vehicles) {
        vehicleStates.push(vehicle.getState(this.simTimeMs));
      }
    }

    return {
      simTimeMs: this.simTimeMs,
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      junctions: junctionStates,
      vehicles: vehicleStates,
      vehicleCount: this.vehicles ? this.vehicles.size : 0,
      junctionCount: this.junctions ? this.junctions.size : 0,
      metrics: { ...this.metrics }
    };
  }

  /**
   * Get performance metrics
   * @returns {Object} Performance metrics
   */
  getPerformanceMetrics() {
    return {
      ...this.metrics,
      simTimeMs: this.simTimeMs,
      fps: this.metrics.lastStepTime > 0 ? 1000 / this.metrics.lastStepTime : 0
    };
  }

  /**
   * Reset simulation metrics
   */
  resetMetrics() {
    this.metrics = {
      totalSteps: 0,
      averageStepTime: 0,
      lastStepTime: 0
    };
  }
}
