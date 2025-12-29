/**
 * TrafficSignal Module
 * Implements a finite state machine for traffic signal control.
 * Part of the Signal Control & Monitoring layer in the energy-aware architecture.
 * 
 * States: RED, YELLOW, GREEN (per direction)
 * Phases: EW_GREEN, EW_YELLOW, NS_GREEN, NS_YELLOW, ALL_RED
 */

// Signal State Constants
export const SignalState = Object.freeze({
  RED: 'RED',
  YELLOW: 'YELLOW',
  GREEN: 'GREEN'
});

// Signal Phase Constants
export const SignalPhase = Object.freeze({
  EW_GREEN: 'EW_GREEN',
  EW_YELLOW: 'EW_YELLOW',
  NS_GREEN: 'NS_GREEN',
  NS_YELLOW: 'NS_YELLOW',
  ALL_RED: 'ALL_RED'
});

export class SignalController {
  constructor(cfg) {
    this.cfg = cfg;

    // Current phase in the signal cycle
    this.phase = SignalPhase.EW_GREEN;

    this._listeners = new Set();

    // Tick-driven timing (no setTimeout). Pause works naturally.
    this._running = false;
    this._remainingMs = 0;

    // Track which direction we were serving before ALL_RED, so we alternate.
    this._lastAllRedFromNS = false;
    
    // Phase history for analytics
    this.phaseHistory = [];
    this.phaseStartTime = 0;
  }

  onChange(fn) {
    this._listeners.add(fn);
  }

  _emit() {
    for (const fn of this._listeners) fn(this.phase);
  }

  start() {
    // Initialize to a known state; after this, update(deltaMs) drives the cycle.
    this._running = true;
    this.phase = SignalPhase.EW_GREEN;
    this._remainingMs = this._durFor(this.phase);
    this.phaseStartTime = 0;
    this._emit();
  }

  stop() {
    // Stop advancing, but keep the current phase (useful for pause UI).
    this._running = false;
  }

  resume() {
    // Resume advancing from the current phase.
    if (this._remainingMs <= 0) this._remainingMs = this._durFor(this.phase);
    this._running = true;
  }

  _durFor(phase) {
    if (phase === SignalPhase.EW_GREEN || phase === SignalPhase.NS_GREEN) return this.cfg.GREEN_MS;
    if (phase === SignalPhase.EW_YELLOW || phase === SignalPhase.NS_YELLOW) return this.cfg.YELLOW_MS;
    return this.cfg.ALLRED_MS; // ALL_RED
  }

  _advancePhase() {
    // Record phase history
    this.phaseHistory.push({
      phase: this.phase,
      duration: this._durFor(this.phase) - this._remainingMs,
      timestamp: this.phaseStartTime
    });
    
    // Keep only recent history (last 100 phase changes)
    if (this.phaseHistory.length > 100) {
      this.phaseHistory.shift();
    }
    
    switch (this.phase) {
      case SignalPhase.EW_GREEN:
        this.phase = SignalPhase.EW_YELLOW;
        break;
      case SignalPhase.EW_YELLOW:
        this._lastAllRedFromNS = false;
        this.phase = SignalPhase.ALL_RED;
        break;
      case SignalPhase.NS_GREEN:
        this.phase = SignalPhase.NS_YELLOW;
        break;
      case SignalPhase.NS_YELLOW:
        this._lastAllRedFromNS = true;
        this.phase = SignalPhase.ALL_RED;
        break;
      case SignalPhase.ALL_RED:
      default:
        // After ALL_RED, serve the opposite direction next
        this.phase = this._lastAllRedFromNS ? SignalPhase.EW_GREEN : SignalPhase.NS_GREEN;
        break;
    }

    this._remainingMs = this._durFor(this.phase);
    this.phaseStartTime = Date.now();
    this._emit();
  }

  update(deltaMs) {
    if (!this._running) return;
    if (!deltaMs || deltaMs <= 0) return;

    let d = deltaMs;
    while (d > 0) {
      if (d < this._remainingMs) {
        this._remainingMs -= d;
        break;
      }

      d -= this._remainingMs;
      this._advancePhase();
    }
  }

  // Only GREEN lets crossing; yellow/red/all-red => stop.
  isGreen(axis) {
    return axis === "H" ? this.phase === SignalPhase.EW_GREEN : this.phase === SignalPhase.NS_GREEN;
  }
  
  /**
   * Get the signal state for a specific axis
   * @param {string} axis - 'H' or 'V'
   * @returns {string} SignalState (RED, YELLOW, GREEN)
   */
  getState(axis) {
    if (axis === "H") {
      if (this.phase === SignalPhase.EW_GREEN) return SignalState.GREEN;
      if (this.phase === SignalPhase.EW_YELLOW) return SignalState.YELLOW;
      return SignalState.RED;
    } else {
      if (this.phase === SignalPhase.NS_GREEN) return SignalState.GREEN;
      if (this.phase === SignalPhase.NS_YELLOW) return SignalState.YELLOW;
      return SignalState.RED;
    }
  }
  
  /**
   * Get programmatic state snapshot for monitoring
   * @returns {Object} Signal state
   */
  getStateSnapshot() {
    return {
      phase: this.phase,
      horizontalState: this.getState('H'),
      verticalState: this.getState('V'),
      remainingMs: this._remainingMs,
      isRunning: this._running,
      cycleHistory: [...this.phaseHistory]
    };
  }
  
  /**
   * Check if signal allows crossing for given axis
   * @param {string} axis - 'H' or 'V'
   * @returns {boolean}
   */
  canCross(axis) {
    return this.isGreen(axis);
  }
  
  // ========================================
  // Dynamic Signal Control Interface
  // ========================================
  
  /**
   * Update signal phase durations at runtime
   * This is the primary control interface for optimization algorithms
   * Implements SAFE timing updates with validation and gradual transitions
   * 
   * @param {Object} timings - New timing configuration
   * @param {number} [timings.greenMs] - Green phase duration in milliseconds
   * @param {number} [timings.yellowMs] - Yellow phase duration in milliseconds
   * @param {number} [timings.allRedMs] - All-red phase duration in milliseconds
   * @param {boolean} [applyImmediately=false] - If true, adjust current phase remaining time
   * @param {boolean} [validateSafety=true] - If true, enforce safety constraints
   * 
   * @returns {Object} Update result { success: boolean, appliedTimings: Object, warnings: Array }
   * 
   * @example
   * // Increase green time to reduce congestion
   * signal.updateTimings({ greenMs: 5000 });
   * 
   * @example
   * // Adaptive control based on queue length
   * const result = signal.updateTimings({ 
   *   greenMs: 4000, 
   *   allRedMs: 1500,
   *   applyImmediately: true 
   * });
   * if (result.success) console.log('Timings updated safely');
   */
  updateTimings({ greenMs, yellowMs, allRedMs, applyImmediately = false, validateSafety = true }) {
    const result = {
      success: true,
      appliedTimings: {},
      warnings: [],
      rejections: []
    };

    const oldTimings = this.getTimings();

    // Safety constraints (MUTCD standards-inspired)
    const CONSTRAINTS = {
      minGreen: 3000,      // 3 seconds minimum green
      maxGreen: 120000,    // 2 minutes maximum green
      minYellow: 1000,     // 1 second minimum yellow (safety critical)
      maxYellow: 6000,     // 6 seconds maximum yellow
      minAllRed: 0,        // 0 seconds minimum all-red
      maxAllRed: 3000,     // 3 seconds maximum all-red
      maxGreenChange: 10000, // Max 10s change per update (gradual)
      maxYellowChange: 2000, // Max 2s change per update
      maxAllRedChange: 2000  // Max 2s change per update
    };

    // Validate and apply green timing
    if (greenMs !== undefined) {
      if (typeof greenMs !== 'number') {
        result.rejections.push('greenMs must be a number');
        result.success = false;
      } else if (validateSafety && greenMs < CONSTRAINTS.minGreen) {
        result.warnings.push(`greenMs ${greenMs}ms below minimum ${CONSTRAINTS.minGreen}ms, clamping`);
        greenMs = CONSTRAINTS.minGreen;
      } else if (validateSafety && greenMs > CONSTRAINTS.maxGreen) {
        result.warnings.push(`greenMs ${greenMs}ms above maximum ${CONSTRAINTS.maxGreen}ms, clamping`);
        greenMs = CONSTRAINTS.maxGreen;
      }

      // Gradual change enforcement
      if (validateSafety) {
        const change = Math.abs(greenMs - oldTimings.greenMs);
        if (change > CONSTRAINTS.maxGreenChange) {
          const direction = greenMs > oldTimings.greenMs ? 1 : -1;
          greenMs = oldTimings.greenMs + (direction * CONSTRAINTS.maxGreenChange);
          result.warnings.push(`Green change limited to ${CONSTRAINTS.maxGreenChange}ms per update`);
        }
      }

      if (result.success || !validateSafety) {
        this.cfg.GREEN_MS = greenMs;
        result.appliedTimings.greenMs = greenMs;
      }
    }
    
    // Validate and apply yellow timing (SAFETY CRITICAL)
    if (yellowMs !== undefined) {
      if (typeof yellowMs !== 'number') {
        result.rejections.push('yellowMs must be a number');
        result.success = false;
      } else if (validateSafety && yellowMs < CONSTRAINTS.minYellow) {
        result.rejections.push(`yellowMs ${yellowMs}ms below SAFETY MINIMUM ${CONSTRAINTS.minYellow}ms - REJECTED`);
        result.success = false;
      } else if (validateSafety && yellowMs > CONSTRAINTS.maxYellow) {
        result.warnings.push(`yellowMs ${yellowMs}ms above maximum ${CONSTRAINTS.maxYellow}ms, clamping`);
        yellowMs = CONSTRAINTS.maxYellow;
      }

      // Gradual change enforcement (less strict than green, but still controlled)
      if (validateSafety && result.success) {
        const change = Math.abs(yellowMs - oldTimings.yellowMs);
        if (change > CONSTRAINTS.maxYellowChange) {
          const direction = yellowMs > oldTimings.yellowMs ? 1 : -1;
          yellowMs = oldTimings.yellowMs + (direction * CONSTRAINTS.maxYellowChange);
          result.warnings.push(`Yellow change limited to ${CONSTRAINTS.maxYellowChange}ms per update`);
        }
      }

      if (result.success) {
        this.cfg.YELLOW_MS = yellowMs;
        result.appliedTimings.yellowMs = yellowMs;
      }
    }
    
    // Validate and apply all-red timing
    if (allRedMs !== undefined) {
      if (typeof allRedMs !== 'number') {
        result.rejections.push('allRedMs must be a number');
        result.success = false;
      } else if (validateSafety && allRedMs < CONSTRAINTS.minAllRed) {
        result.warnings.push(`allRedMs ${allRedMs}ms below minimum ${CONSTRAINTS.minAllRed}ms, clamping`);
        allRedMs = CONSTRAINTS.minAllRed;
      } else if (validateSafety && allRedMs > CONSTRAINTS.maxAllRed) {
        result.warnings.push(`allRedMs ${allRedMs}ms above maximum ${CONSTRAINTS.maxAllRed}ms, clamping`);
        allRedMs = CONSTRAINTS.maxAllRed;
      }

      // Gradual change enforcement
      if (validateSafety) {
        const change = Math.abs(allRedMs - oldTimings.allRedMs);
        if (change > CONSTRAINTS.maxAllRedChange) {
          const direction = allRedMs > oldTimings.allRedMs ? 1 : -1;
          allRedMs = oldTimings.allRedMs + (direction * CONSTRAINTS.maxAllRedChange);
          result.warnings.push(`All-red change limited to ${CONSTRAINTS.maxAllRedChange}ms per update`);
        }
      }

      if (result.success || !validateSafety) {
        this.cfg.ALLRED_MS = allRedMs;
        result.appliedTimings.allRedMs = allRedMs;
      }
    }
    
    // Phase-aware application
    if (result.success && applyImmediately) {
      // Only adjust current phase if it's safe to do so
      const safeToAdjust = this._isSafeToAdjustPhase();
      if (safeToAdjust) {
        this._remainingMs = this._durFor(this.phase);
        result.appliedTimings.immediate = true;
      } else {
        result.warnings.push('Deferred immediate application: currently in critical phase');
        result.appliedTimings.immediate = false;
      }
    }

    // Log warnings and rejections
    if (result.warnings.length > 0) {
      console.warn(`[Signal] Timing update warnings:`, result.warnings);
    }
    if (result.rejections.length > 0) {
      console.error(`[Signal] Timing update rejections:`, result.rejections);
    }

    return result;
  }

  /**
   * Check if current phase is safe to adjust
   * @private
   * @returns {boolean} True if safe to adjust current phase timing
   */
  _isSafeToAdjustPhase() {
    // Don't adjust during yellow or all-red (safety critical phases)
    if (this.phase === SignalPhase.EW_YELLOW || 
        this.phase === SignalPhase.NS_YELLOW ||
        this.phase === SignalPhase.ALL_RED) {
      return false;
    }

    // Don't adjust if we're too close to phase transition (< 2 seconds remaining)
    if (this._remainingMs < 2000) {
      return false;
    }

    return true;
  }

  /**
   * Apply timing updates gradually over multiple cycles
   * This is the SAFEST way to update signal timings
   * @param {Object} targetTimings - Target timing configuration
   * @param {number} targetTimings.greenMs - Target green duration
   * @param {number} targetTimings.yellowMs - Target yellow duration
   * @param {number} targetTimings.allRedMs - Target all-red duration
   * @param {number} [steps=3] - Number of cycles to reach target (minimum 1)
   * @returns {Object} Transition plan
   */
  scheduleGradualTransition(targetTimings, steps = 3) {
    steps = Math.max(1, steps); // At least 1 step
    const currentTimings = this.getTimings();
    const transitionPlan = {
      steps: [],
      totalSteps: steps,
      startTimings: { ...currentTimings },
      targetTimings: { ...targetTimings }
    };

    // Calculate incremental changes
    const deltaGreen = (targetTimings.greenMs - currentTimings.greenMs) / steps;
    const deltaYellow = targetTimings.yellowMs !== undefined ? 
      (targetTimings.yellowMs - currentTimings.yellowMs) / steps : 0;
    const deltaAllRed = targetTimings.allRedMs !== undefined ?
      (targetTimings.allRedMs - currentTimings.allRedMs) / steps : 0;

    // Generate transition steps
    for (let i = 1; i <= steps; i++) {
      const stepTimings = {
        greenMs: Math.round(currentTimings.greenMs + (deltaGreen * i)),
        yellowMs: targetTimings.yellowMs !== undefined ?
          Math.round(currentTimings.yellowMs + (deltaYellow * i)) : undefined,
        allRedMs: targetTimings.allRedMs !== undefined ?
          Math.round(currentTimings.allRedMs + (deltaAllRed * i)) : undefined
      };
      transitionPlan.steps.push(stepTimings);
    }

    console.log(`[Signal] Scheduled gradual transition over ${steps} cycles`);
    return transitionPlan;
  }
  
  /**
   * Get current timing configuration
   * @returns {Object} Current phase durations
   */
  getTimings() {
    return {
      greenMs: this.cfg.GREEN_MS,
      yellowMs: this.cfg.YELLOW_MS,
      allRedMs: this.cfg.ALLRED_MS
    };
  }
  
  /**
   * Manually set the signal phase (for testing or emergency control)
   * WARNING: This bypasses normal phase transitions. Use with caution.
   * 
   * @param {string} phase - One of SignalPhase constants
   * @param {boolean} [resetTimer=true] - Whether to reset the phase timer
   * 
   * @example
   * // Force signal to green for emergency vehicle
   * signal.setPhase(SignalPhase.EW_GREEN);
   */
  setPhase(phase, resetTimer = true) {
    const validPhases = Object.values(SignalPhase);
    
    if (!validPhases.includes(phase)) {
      console.error(`Invalid phase: ${phase}. Must be one of: ${validPhases.join(', ')}`);
      return false;
    }
    
    this.phase = phase;
    
    if (resetTimer) {
      this._remainingMs = this._durFor(this.phase);
      this.phaseStartTime = Date.now();
    }
    
    this._emit();
    return true;
  }
  
  /**
   * Get time remaining in current phase
   * @returns {number} Milliseconds remaining
   */
  getRemainingTime() {
    return this._remainingMs;
  }
  
  /**
   * Skip to next phase immediately (useful for adaptive control)
   * @example
   * // Skip to next phase if no vehicles waiting
   * if (queueLength === 0) signal.advanceToNextPhase();
   */
  advanceToNextPhase() {
    if (!this._running) {
      console.warn('Cannot advance phase: signal is not running');
      return false;
    }
    
    this._remainingMs = 0;
    this._advancePhase();
    return true;
  }
  
  /**
   * Extend current phase duration (useful for adaptive control)
   * @param {number} additionalMs - Milliseconds to add to current phase
   * @example
   * // Extend green if heavy traffic detected
   * signal.extendCurrentPhase(2000); // +2 seconds
   */
  extendCurrentPhase(additionalMs) {
    if (typeof additionalMs !== 'number' || additionalMs < 0) {
      console.warn('Invalid extension time. Must be a positive number.');
      return false;
    }
    
    this._remainingMs += additionalMs;
    return true;
  }
  
  /**
   * Get phase cycle statistics
   * @returns {Object} Statistics about phase cycling
   */
  getCycleStatistics() {
    if (this.phaseHistory.length === 0) {
      return {
        totalCycles: 0,
        averageCycleTime: 0,
        averageGreenTime: 0,
        averageRedTime: 0
      };
    }
    
    let totalGreenTime = 0;
    let totalRedTime = 0;
    let greenCount = 0;
    let redCount = 0;
    
    for (const entry of this.phaseHistory) {
      if (entry.phase === SignalPhase.EW_GREEN || entry.phase === SignalPhase.NS_GREEN) {
        totalGreenTime += entry.duration;
        greenCount++;
      } else if (entry.phase === SignalPhase.EW_YELLOW || entry.phase === SignalPhase.NS_YELLOW || entry.phase === SignalPhase.ALL_RED) {
        totalRedTime += entry.duration;
        redCount++;
      }
    }
    
    return {
      totalCycles: this.phaseHistory.length,
      averageCycleTime: (totalGreenTime + totalRedTime) / this.phaseHistory.length,
      averageGreenTime: greenCount > 0 ? totalGreenTime / greenCount : 0,
      averageRedTime: redCount > 0 ? totalRedTime / redCount : 0,
      history: [...this.phaseHistory]
    };
  }
}
