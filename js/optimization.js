/**
 * Energy-Aware Optimization Engine
 * Optimizes traffic signal timing to minimize vehicle idling and emissions.
 * 
 * This module is the core research contribution.
 * Uses rule-based and heuristic optimization methods.
 * No machine learning or reinforcement learning.
 * 
 * Cost Function:
 *   totalCost = idle_time + stop_penalty + signal_switch_penalty
 * 
 * Objectives:
 * - Minimize vehicle idling (energy waste)
 * - Minimize unnecessary stops
 * - Minimize signal switching (stability)
 * 
 * Part of the Energy-Aware Optimization layer in the architecture.
 */

import { CongestionLevel, TrafficPeriod } from './analytics.js';

/**
 * Optimization Strategy Enumeration
 */
export const OptimizationStrategy = {
  GREEDY: 'GREEDY',                   // Greedy per-intersection optimization
  ADAPTIVE: 'ADAPTIVE',               // Adaptive based on traffic state
  COORDINATED: 'COORDINATED',         // Coordinated across network
  PRESSURE_BASED: 'PRESSURE_BASED',   // Based on pressure scores
  BALANCED: 'BALANCED'                // Balance all factors
};

/**
 * Cost Function Weights
 */
export const DEFAULT_WEIGHTS = {
  idleTime: 1.0,        // Weight for idle time cost
  stopPenalty: 0.8,     // Weight for stop penalty
  switchPenalty: 0.3    // Weight for signal switch penalty
};

/**
 * Signal timing constraints
 */
export const TIMING_CONSTRAINTS = {
  minGreenMs: 3000,     // Minimum green phase duration
  maxGreenMs: 30000,    // Maximum green phase duration
  minYellowMs: 1000,    // Minimum yellow phase duration
  maxYellowMs: 3000,    // Maximum yellow phase duration
  minAllRedMs: 0,       // Minimum all-red phase duration
  maxAllRedMs: 2000,    // Maximum all-red phase duration
  adjustmentStepMs: 1000 // Adjustment step size
};

/**
 * CostCalculator Class
 * Calculates optimization cost for signal configurations
 */
export class CostCalculator {
  constructor(weights = DEFAULT_WEIGHTS) {
    this.weights = weights;
  }

  /**
   * Calculate total cost for a signal configuration
   * @param {Object} trafficState - Current traffic state from analytics
   * @param {Object} currentTimings - Current signal timings
   * @param {Object} proposedTimings - Proposed signal timings
   * @returns {Object} Cost breakdown
   */
  calculateCost(trafficState, currentTimings, proposedTimings) {
    const idleCost = this._calculateIdleCost(trafficState);
    const stopCost = this._calculateStopCost(trafficState);
    const switchCost = this._calculateSwitchCost(currentTimings, proposedTimings);

    const totalCost = 
      this.weights.idleTime * idleCost +
      this.weights.stopPenalty * stopCost +
      this.weights.switchPenalty * switchCost;

    return {
      totalCost: totalCost,
      components: {
        idleCost: idleCost,
        stopCost: stopCost,
        switchCost: switchCost
      },
      weighted: {
        idleCost: this.weights.idleTime * idleCost,
        stopCost: this.weights.stopPenalty * stopCost,
        switchCost: this.weights.switchPenalty * switchCost
      }
    };
  }

  /**
   * Calculate idle time cost
   * Higher queue length and wait time = higher cost
   * @private
   */
  _calculateIdleCost(trafficState) {
    const metrics = trafficState.metrics.aggregate;
    
    // Normalize to 0-100 scale
    const queueCost = Math.min((metrics.totalQueue / 20) * 50, 50);
    const waitCost = Math.min((metrics.avgWaitTime / 30000) * 50, 50);
    
    return queueCost + waitCost;
  }

  /**
   * Calculate stop penalty cost
   * More vehicles queued = higher stop cost
   * @private
   */
  _calculateStopCost(trafficState) {
    const metrics = trafficState.metrics.aggregate;
    
    // Penalty based on queue length and density
    const queuePenalty = Math.min((metrics.totalQueue / 15) * 60, 60);
    const densityPenalty = metrics.density * 40;
    
    return queuePenalty + densityPenalty;
  }

  /**
   * Calculate signal switch penalty
   * Larger timing changes = higher penalty (stability)
   * @private
   */
  _calculateSwitchCost(currentTimings, proposedTimings) {
    if (!currentTimings || !proposedTimings) return 0;

    const greenDiff = Math.abs(proposedTimings.greenMs - currentTimings.greenMs);
    const yellowDiff = Math.abs(proposedTimings.yellowMs - currentTimings.yellowMs);
    const allRedDiff = Math.abs(proposedTimings.allRedMs - currentTimings.allRedMs);

    // Normalize changes to 0-100 scale
    const greenCost = (greenDiff / 10000) * 50;
    const yellowCost = (yellowDiff / 1000) * 25;
    const allRedCost = (allRedDiff / 1000) * 25;

    return greenCost + yellowCost + allRedCost;
  }

  /**
   * Estimate energy savings from optimization
   * @param {Object} beforeState - Traffic state before optimization
   * @param {Object} afterState - Traffic state after optimization
   * @returns {Object} Energy savings estimate
   */
  estimateEnergySavings(beforeState, afterState) {
    const beforeWait = beforeState.metrics.aggregate.avgWaitTime;
    const afterWait = afterState.metrics.aggregate.avgWaitTime;
    const waitReduction = beforeWait - afterWait;

    // Estimate fuel savings (idle fuel consumption rate)
    // Typical idle: 0.6 L/hr = 0.0001667 L/s
    const idleGalPerMs = 0.6 / 3600000; // gal/ms
    const co2PerGal = 8887; // grams CO2 per gallon

    const vehicles = beforeState.metrics.aggregate.totalVehicles;
    const energySavings = vehicles * waitReduction * idleGalPerMs * co2PerGal;

    return {
      waitReductionMs: waitReduction,
      estimatedCO2SavingsG: energySavings,
      vehiclesAffected: vehicles
    };
  }
}

/**
 * SignalOptimizer Class
 * Optimizes signal timing for a single intersection
 */
export class SignalOptimizer {
  constructor(junctionId, strategy = OptimizationStrategy.ADAPTIVE) {
    this.junctionId = junctionId;
    this.strategy = strategy;
    this.costCalculator = new CostCalculator();
    
    // Optimization history
    this.history = {
      optimizations: [],
      maxHistory: 50
    };
  }

  /**
   * Optimize signal timing based on traffic state
   * @param {Object} intersectionState - Analytics state for this intersection
   * @param {Object} currentTimings - Current signal timings
   * @returns {Object} Optimized timings and metrics
   */
  optimize(intersectionState, currentTimings) {
    let optimizedTimings;

    switch (this.strategy) {
      case OptimizationStrategy.GREEDY:
        optimizedTimings = this._optimizeGreedy(intersectionState, currentTimings);
        break;
      case OptimizationStrategy.ADAPTIVE:
        optimizedTimings = this._optimizeAdaptive(intersectionState, currentTimings);
        break;
      case OptimizationStrategy.PRESSURE_BASED:
        optimizedTimings = this._optimizePressureBased(intersectionState, currentTimings);
        break;
      case OptimizationStrategy.BALANCED:
        optimizedTimings = this._optimizeBalanced(intersectionState, currentTimings);
        break;
      default:
        optimizedTimings = this._optimizeAdaptive(intersectionState, currentTimings);
    }

    // Calculate cost improvement
    const beforeCost = this.costCalculator.calculateCost(
      intersectionState, currentTimings, currentTimings
    );
    const afterCost = this.costCalculator.calculateCost(
      intersectionState, currentTimings, optimizedTimings
    );

    const result = {
      junctionId: this.junctionId,
      strategy: this.strategy,
      currentTimings: currentTimings,
      optimizedTimings: optimizedTimings,
      costBefore: beforeCost.totalCost,
      costAfter: afterCost.totalCost,
      costImprovement: beforeCost.totalCost - afterCost.totalCost,
      costBreakdown: afterCost
    };

    // Record in history
    this._recordOptimization(result);

    return result;
  }

  /**
   * Greedy optimization: maximize green time for congested direction
   * @private
   */
  _optimizeGreedy(intersectionState, currentTimings) {
    const metrics = intersectionState.metrics;
    const agg = metrics.aggregate;

    // Find most congested direction
    let maxQueue = 0;
    let dominantDir = null;
    for (const [dir, dirMetrics] of Object.entries(metrics.perDirection)) {
      if (dirMetrics.queueLength > maxQueue) {
        maxQueue = dirMetrics.queueLength;
        dominantDir = dir;
      }
    }

    // Increase green time proportional to queue length
    const queueRatio = Math.min(maxQueue / 15, 1.0);
    const greenAdjustment = queueRatio * 5000; // Up to 5 seconds more

    let newGreenMs = currentTimings.greenMs + greenAdjustment;
    newGreenMs = this._clamp(newGreenMs, TIMING_CONSTRAINTS.minGreenMs, TIMING_CONSTRAINTS.maxGreenMs);

    return {
      greenMs: Math.round(newGreenMs / TIMING_CONSTRAINTS.adjustmentStepMs) * TIMING_CONSTRAINTS.adjustmentStepMs,
      yellowMs: currentTimings.yellowMs,
      allRedMs: currentTimings.allRedMs
    };
  }

  /**
   * Adaptive optimization: adjust based on congestion level
   * @private
   */
  _optimizeAdaptive(intersectionState, currentTimings) {
    const congestion = intersectionState.metrics.aggregate.congestionLevel;
    const density = intersectionState.metrics.aggregate.density;
    const avgWait = intersectionState.metrics.aggregate.avgWaitTime;

    let greenMs = currentTimings.greenMs;
    let yellowMs = currentTimings.yellowMs;
    let allRedMs = currentTimings.allRedMs;

    // Adjust based on congestion level
    switch (congestion) {
      case CongestionLevel.CRITICAL:
        // Maximum green time, longer yellow for safety
        greenMs = TIMING_CONSTRAINTS.maxGreenMs * 0.9;
        yellowMs = Math.min(currentTimings.yellowMs + 500, TIMING_CONSTRAINTS.maxYellowMs);
        allRedMs = Math.max(currentTimings.allRedMs, 500);
        break;

      case CongestionLevel.HIGH:
        // Increase green time significantly
        greenMs = currentTimings.greenMs + 4000;
        yellowMs = Math.min(currentTimings.yellowMs + 200, TIMING_CONSTRAINTS.maxYellowMs);
        break;

      case CongestionLevel.MEDIUM:
        // Moderate increase
        greenMs = currentTimings.greenMs + 2000;
        break;

      case CongestionLevel.LOW:
        // Reduce to save energy when not needed
        greenMs = Math.max(currentTimings.greenMs - 1000, TIMING_CONSTRAINTS.minGreenMs);
        break;
    }

    // Fine-tune based on density
    if (density > 0.8) {
      greenMs += 2000;
    } else if (density < 0.3) {
      greenMs = Math.max(greenMs - 1000, TIMING_CONSTRAINTS.minGreenMs);
    }

    // Apply constraints
    greenMs = this._clamp(greenMs, TIMING_CONSTRAINTS.minGreenMs, TIMING_CONSTRAINTS.maxGreenMs);
    yellowMs = this._clamp(yellowMs, TIMING_CONSTRAINTS.minYellowMs, TIMING_CONSTRAINTS.maxYellowMs);
    allRedMs = this._clamp(allRedMs, TIMING_CONSTRAINTS.minAllRedMs, TIMING_CONSTRAINTS.maxAllRedMs);

    return {
      greenMs: Math.round(greenMs / TIMING_CONSTRAINTS.adjustmentStepMs) * TIMING_CONSTRAINTS.adjustmentStepMs,
      yellowMs: Math.round(yellowMs / 100) * 100,
      allRedMs: Math.round(allRedMs / 100) * 100
    };
  }

  /**
   * Pressure-based optimization: use pressure score
   * @private
   */
  _optimizePressureBased(intersectionState, currentTimings) {
    const pressure = intersectionState.metrics.aggregate.pressureScore;

    // Linear mapping from pressure to green time
    // Pressure 0-100 maps to minGreen-maxGreen
    const greenRange = TIMING_CONSTRAINTS.maxGreenMs - TIMING_CONSTRAINTS.minGreenMs;
    const greenMs = TIMING_CONSTRAINTS.minGreenMs + (pressure / 100) * greenRange;

    // Yellow time increases slightly with pressure
    const yellowMs = TIMING_CONSTRAINTS.minYellowMs + (pressure / 100) * 500;

    return {
      greenMs: Math.round(greenMs / TIMING_CONSTRAINTS.adjustmentStepMs) * TIMING_CONSTRAINTS.adjustmentStepMs,
      yellowMs: Math.round(yellowMs / 100) * 100,
      allRedMs: currentTimings.allRedMs
    };
  }

  /**
   * Balanced optimization: balance all cost components
   * @private
   */
  _optimizeBalanced(intersectionState, currentTimings) {
    const agg = intersectionState.metrics.aggregate;

    // Start with current timings
    let bestTimings = { ...currentTimings };
    let bestCost = this.costCalculator.calculateCost(
      intersectionState, currentTimings, currentTimings
    ).totalCost;

    // Try different green time adjustments
    const adjustments = [-2000, -1000, 0, 1000, 2000, 3000, 4000];

    for (const adj of adjustments) {
      const candidateGreen = currentTimings.greenMs + adj;
      
      if (candidateGreen < TIMING_CONSTRAINTS.minGreenMs || 
          candidateGreen > TIMING_CONSTRAINTS.maxGreenMs) {
        continue;
      }

      const candidateTimings = {
        greenMs: candidateGreen,
        yellowMs: currentTimings.yellowMs,
        allRedMs: currentTimings.allRedMs
      };

      const cost = this.costCalculator.calculateCost(
        intersectionState, currentTimings, candidateTimings
      ).totalCost;

      if (cost < bestCost) {
        bestCost = cost;
        bestTimings = candidateTimings;
      }
    }

    return bestTimings;
  }

  /**
   * Clamp value between min and max
   * @private
   */
  _clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Record optimization in history
   * @private
   */
  _recordOptimization(result) {
    this.history.optimizations.push({
      timestamp: Date.now(),
      costImprovement: result.costImprovement,
      strategy: result.strategy
    });

    if (this.history.optimizations.length > this.history.maxHistory) {
      this.history.optimizations.shift();
    }
  }

  /**
   * Get optimization statistics
   * @returns {Object} Statistics
   */
  getStatistics() {
    if (this.history.optimizations.length === 0) return null;

    const improvements = this.history.optimizations.map(o => o.costImprovement);
    const avgImprovement = improvements.reduce((a, b) => a + b, 0) / improvements.length;
    const totalOptimizations = this.history.optimizations.length;

    return {
      totalOptimizations: totalOptimizations,
      avgCostImprovement: avgImprovement,
      strategy: this.strategy
    };
  }
}

/**
 * NetworkOptimizer Class
 * Coordinates optimization across entire network
 */
export class NetworkOptimizer {
  constructor(strategy = OptimizationStrategy.COORDINATED) {
    this.strategy = strategy;
    this.intersectionOptimizers = new Map();
    
    // Network-level optimization state
    this.optimizationCount = 0;
    this.totalEnergySavings = 0;
    
    // Coordination parameters
    this.coordination = {
      enabled: strategy === OptimizationStrategy.COORDINATED,
      offsetMs: 0,  // Phase offset between intersections
      bandwidth: 1.0 // Green wave bandwidth factor
    };
  }

  /**
   * Get or create optimizer for intersection
   * @private
   */
  _getOptimizer(junctionId) {
    if (!this.intersectionOptimizers.has(junctionId)) {
      const optimizer = new SignalOptimizer(junctionId, this.strategy);
      this.intersectionOptimizers.set(junctionId, optimizer);
    }
    return this.intersectionOptimizers.get(junctionId);
  }

  /**
   * Optimize entire network
   * @param {Object} analyticsSnapshot - Complete analytics snapshot
   * @param {Map} junctions - Map of junction objects
   * @returns {Object} Optimization results
   */
  optimizeNetwork(analyticsSnapshot, junctions) {
    const results = {
      timestamp: Date.now(),
      intersections: {},
      network: {
        totalCostImprovement: 0,
        optimizationsApplied: 0,
        estimatedEnergySavings: 0
      }
    };

    // Optimize each intersection
    for (const [junctionId, intersectionData] of Object.entries(analyticsSnapshot.intersections)) {
      const junction = junctions.get(junctionId);
      if (!junction) continue;

      const currentTimings = junction.signal.getTimings();
      const optimizer = this._getOptimizer(junctionId);
      
      const optimization = optimizer.optimize(intersectionData.state, currentTimings);
      
      results.intersections[junctionId] = optimization;
      results.network.totalCostImprovement += optimization.costImprovement;

      // Apply optimization if improvement is significant
      if (optimization.costImprovement > 5) { // Threshold: 5 cost units
        const updateResult = junction.signal.updateTimings({
          ...optimization.optimizedTimings,
          applyImmediately: false, // Smooth transition - wait for next cycle
          validateSafety: true      // Enforce safety constraints
        });

        if (updateResult.success) {
          results.network.optimizationsApplied++;
          optimization.applied = true;
          optimization.appliedTimings = updateResult.appliedTimings;
          
          // Log any warnings from signal controller
          if (updateResult.warnings.length > 0) {
            optimization.warnings = updateResult.warnings;
          }
        } else {
          optimization.applied = false;
          optimization.rejections = updateResult.rejections;
          console.warn(`[NetworkOptimizer] Failed to apply optimization for ${junctionId}:`, updateResult.rejections);
        }
      }
    }

    // Coordinated optimization if enabled
    if (this.coordination.enabled && results.network.optimizationsApplied > 0) {
      this._applyCoordination(results, junctions);
    }

    this.optimizationCount++;
    return results;
  }

  /**
   * Apply coordinated timing (green wave)
   * @private
   */
  _applyCoordination(results, junctions) {
    // Simple coordination: stagger phase starts for arterial flow
    // This is a basic heuristic for green wave coordination
    
    const junctionIds = Array.from(junctions.keys());
    if (junctionIds.length < 2) return;

    // Calculate average cycle time
    let totalCycle = 0;
    let count = 0;
    for (const [junctionId, opt] of Object.entries(results.intersections)) {
      const timings = opt.optimizedTimings;
      const cycle = timings.greenMs + timings.yellowMs + timings.allRedMs;
      totalCycle += cycle;
      count++;
    }
    const avgCycle = totalCycle / count;

    // Apply phase offsets (simplified arterial coordination)
    const offsetStep = avgCycle * 0.3; // 30% of cycle as offset
    
    for (let i = 0; i < junctionIds.length; i++) {
      const junctionId = junctionIds[i];
      const junction = junctions.get(junctionId);
      if (!junction) continue;

      // Offset could be applied here
      // For now, we just mark it as coordinated
      results.intersections[junctionId].coordinated = true;
      results.intersections[junctionId].offset = i * offsetStep;
    }
  }

  /**
   * Get network optimization statistics
   * @returns {Object} Statistics
   */
  getStatistics() {
    const intersectionStats = {};
    for (const [junctionId, optimizer] of this.intersectionOptimizers.entries()) {
      intersectionStats[junctionId] = optimizer.getStatistics();
    }

    return {
      optimizationCount: this.optimizationCount,
      totalEnergySavings: this.totalEnergySavings,
      strategy: this.strategy,
      coordinationEnabled: this.coordination.enabled,
      intersections: intersectionStats
    };
  }

  /**
   * Change optimization strategy
   * @param {string} newStrategy - New strategy
   */
  setStrategy(newStrategy) {
    this.strategy = newStrategy;
    this.coordination.enabled = (newStrategy === OptimizationStrategy.COORDINATED);
    
    // Update all intersection optimizers
    for (const optimizer of this.intersectionOptimizers.values()) {
      optimizer.strategy = newStrategy;
    }
  }
}

/**
 * OptimizationEngine Class
 * Main optimization engine that integrates with analytics
 */
export class OptimizationEngine {
  constructor({ trafficAnalyzer, world, strategy = OptimizationStrategy.ADAPTIVE, autoRun = false }) {
    this.trafficAnalyzer = trafficAnalyzer;
    this.world = world;
    this.strategy = strategy;
    this.autoRun = autoRun;

    // Network optimizer
    this.networkOptimizer = new NetworkOptimizer(strategy);

    // Engine state
    this.isRunning = false;
    this.intervalId = null;
    this.optimizationIntervalMs = 5000; // Run every 5 seconds

    // Performance tracking
    this.metrics = {
      totalOptimizations: 0,
      totalCostReduction: 0,
      totalEnergySavings: 0,
      startTime: null
    };

    // Auto-start if requested
    if (autoRun) {
      this.start();
    }
  }

  /**
   * Start optimization engine
   */
  start() {
    if (this.isRunning) {
      console.warn('[OptimizationEngine] Already running');
      return;
    }

    // Ensure analytics is running
    if (!this.trafficAnalyzer.isRunning) {
      console.warn('[OptimizationEngine] Starting traffic analyzer');
      this.trafficAnalyzer.start();
    }

    this.isRunning = true;
    this.metrics.startTime = Date.now();

    // Start periodic optimization
    this.intervalId = setInterval(() => {
      this._runOptimization();
    }, this.optimizationIntervalMs);

    console.log(`[OptimizationEngine] Started (strategy: ${this.strategy}, interval: ${this.optimizationIntervalMs}ms)`);
  }

  /**
   * Stop optimization engine
   */
  stop() {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    console.log('[OptimizationEngine] Stopped');
  }

  /**
   * Run optimization cycle
   * CLOSED CONTROL LOOP: Simulator → Sensing → Analytics → Optimization → Signal Controller → Simulator
   * @private
   */
  _runOptimization() {
    // === STEP 1: Get Analytics Data (from Sensing Layer) ===
    const snapshot = this.trafficAnalyzer.getSnapshot();
    if (!snapshot || !snapshot.network.state) {
      console.warn('[OptimizationEngine] No analytics data available for control loop');
      return;
    }

    const cycleStart = Date.now();
    console.log(`[Control Loop] Cycle ${this.metrics.totalOptimizations + 1} started`);
    console.log(`  └─ Network Congestion: ${snapshot.network.congestionLevel}, Density: ${snapshot.network.density?.toFixed(2) || 'N/A'}`);

    // === STEP 2: Run Optimization (compute optimal signal timings) ===
    const results = this.networkOptimizer.optimizeNetwork(
      snapshot,
      this.world.junctions
    );

    // === STEP 3: Update Metrics ===
    this.metrics.totalOptimizations++;
    this.metrics.totalCostReduction += results.network.totalCostImprovement;

    const cycleTime = Date.now() - cycleStart;

    // === STEP 4: Log Control Loop Results ===
    console.log(`[Control Loop] Cycle ${this.metrics.totalOptimizations} completed in ${cycleTime}ms`);
    if (results.network.optimizationsApplied > 0) {
      console.log(`  ├─ Optimizations Applied: ${results.network.optimizationsApplied}/${Object.keys(results.intersections).length} intersections`);
      console.log(`  ├─ Cost Improvement: ${results.network.totalCostImprovement.toFixed(1)}`);
      console.log(`  └─ Signal updates propagated to simulation`);
    } else {
      console.log(`  └─ No optimizations applied (improvements below threshold)`);
    }

    // Log any safety warnings from signal updates
    let totalWarnings = 0;
    for (const [junctionId, optimization] of Object.entries(results.intersections)) {
      if (optimization.warnings && optimization.warnings.length > 0) {
        totalWarnings += optimization.warnings.length;
      }
    }
    if (totalWarnings > 0) {
      console.warn(`[Control Loop] ${totalWarnings} safety warnings during signal updates`);
    }
  }

  /**
   * Run single optimization manually
   * @returns {Object} Optimization results
   */
  optimize() {
    const snapshot = this.trafficAnalyzer.getSnapshot();
    if (!snapshot || !snapshot.network.state) {
      console.warn('[OptimizationEngine] No analytics data available');
      return null;
    }

    const results = this.networkOptimizer.optimizeNetwork(
      snapshot,
      this.world.junctions
    );

    this.metrics.totalOptimizations++;
    this.metrics.totalCostReduction += results.network.totalCostImprovement;

    return results;
  }

  /**
   * Change optimization strategy
   * @param {string} newStrategy - New strategy
   */
  setStrategy(newStrategy) {
    this.strategy = newStrategy;
    this.networkOptimizer.setStrategy(newStrategy);
    console.log(`[OptimizationEngine] Strategy changed to ${newStrategy}`);
  }

  /**
   * Set optimization interval
   * @param {number} intervalMs - Interval in milliseconds
   */
  setInterval(intervalMs) {
    this.optimizationIntervalMs = intervalMs;
    
    if (this.isRunning) {
      // Restart with new interval
      this.stop();
      this.start();
    }
  }

  /**
   * Get engine metrics
   * @returns {Object} Metrics
   */
  getMetrics() {
    const uptime = this.metrics.startTime ? Date.now() - this.metrics.startTime : 0;
    
    return {
      ...this.metrics,
      uptime: uptime,
      optimizationsPerMinute: uptime > 0 ? 
        (this.metrics.totalOptimizations / (uptime / 60000)).toFixed(2) : 0,
      avgCostReduction: this.metrics.totalOptimizations > 0 ?
        (this.metrics.totalCostReduction / this.metrics.totalOptimizations).toFixed(2) : 0
    };
  }

  /**
   * Get detailed statistics
   * @returns {Object} Statistics
   */
  getStatistics() {
    return {
      engine: this.getMetrics(),
      network: this.networkOptimizer.getStatistics(),
      strategy: this.strategy,
      isRunning: this.isRunning
    };
  }
}

/**
 * Helper function to create optimization engine
 * @param {TrafficAnalyzer} trafficAnalyzer - Traffic analyzer instance
 * @param {World} world - World instance
 * @param {string} strategy - Optimization strategy
 * @param {boolean} autoRun - Start automatically
 * @returns {OptimizationEngine} Engine instance
 */
export function createOptimizationEngine(trafficAnalyzer, world, strategy = OptimizationStrategy.ADAPTIVE, autoRun = false) {
  return new OptimizationEngine({ trafficAnalyzer, world, strategy, autoRun });
}
