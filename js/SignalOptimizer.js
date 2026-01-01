/**
 * SignalOptimizer Integration Module
 * Integrates the complete signal optimization pipeline into the traffic simulation
 * Orchestrates: EvaluateOptimization → EnergyCostEvaluation → OptimizeTiming → SafetyValidation
 */

import { EvaluateOptimization } from './EvaluateOptimization.js';
import { EnergyCostEvaluation } from './EnergyCostEvaluation.js';
import { OptimizeTiming } from './OptimizeTiming.js';
import { SafetyValidation } from './SafetyValidation.js';

export class SignalOptimizer {
    constructor(config = {}) {
        // Initialize all optimization modules
        this.evaluator = new EvaluateOptimization(config.evaluationConfig || {});
        this.costEvaluator = new EnergyCostEvaluation(config.costConfig || {});
        this.timingOptimizer = new OptimizeTiming(config.timingConfig || {});
        this.validator = new SafetyValidation(config.validationConfig || {});
        
        // Optimization state
        this.enabled = config.enabled !== undefined ? config.enabled : false;
        this.optimizationInterval = config.optimizationInterval || 60; // seconds (simulation time)
        
        // Per-junction tracking
        this.junctionState = new Map(); // junctionId -> { lastOptimizationTime, stats, history }
        
        // Global statistics
        this.stats = {
            totalOptimizations: 0,
            successfulOptimizations: 0,
            rejectedByEnergy: 0,
            rejectedBySafety: 0,
            totalEnergySaved: 0,
            lastOptimizationResult: null
        };
        
        // History
        this.optimizationHistory = [];
        this.maxHistorySize = config.maxHistorySize || 50;
    }

    /**
     * Main optimization cycle - called periodically from world update
     * Optimizes each junction individually (asynchronously)
     * @param {Object} world - World instance with traffic state
     * @param {number} currentSimTime - Current simulation time in seconds
     * @returns {Promise<Object|null>} - Optimization result if triggered, null otherwise
     */
    async tick(world, currentSimTime) {
        if (!this.enabled) return null;
        
        const promises = [];
        
        // Optimize each junction independently
        for (const [junctionId, junction] of world.junctions.entries()) {
            // Get or create junction state
            if (!this.junctionState.has(junctionId)) {
                this.junctionState.set(junctionId, {
                    lastOptimizationTime: 0,
                    isOptimizing: false,
                    stats: {
                        totalOptimizations: 0,
                        successfulOptimizations: 0,
                        rejectedByEnergy: 0,
                        rejectedBySafety: 0,
                        totalEnergySaved: 0
                    },
                    history: []
                });
            }
            
            const jState = this.junctionState.get(junctionId);
            
            // Skip if this junction is already being optimized
            if (jState.isOptimizing) continue;
            
            // Check if it's time to optimize this junction
            const timeSinceLastOpt = currentSimTime - jState.lastOptimizationTime;
            if (timeSinceLastOpt < this.optimizationInterval) continue;
            
            // Run optimization for this specific junction asynchronously
            promises.push(
                this.optimizeJunction(world, junction, junctionId, currentSimTime)
            );
        }
        
        // Wait for all optimizations to complete
        if (promises.length === 0) return null;
        
        const results = await Promise.all(promises);
        const validResults = results.filter(r => r !== null);
        
        // Return combined results or null if nothing optimized
        return validResults.length > 0 ? { junctionResults: validResults, count: validResults.length } : null;
    }

    /**
     * Run the complete optimization pipeline for a specific junction (asynchronously)
     * @param {Object} world - World instance
     * @param {Object} junction - Specific junction to optimize
     * @param {string} junctionId - Junction ID
     * @param {number} currentSimTime - Current simulation time in seconds
     * @returns {Promise<Object>} - Complete optimization result
     */
    async optimizeJunction(world, junction, junctionId, currentSimTime) {
        const jState = this.junctionState.get(junctionId);
        
        // Mark this junction as being optimized
        jState.isOptimizing = true;
        
        try {
            return await this._doOptimizeJunction(world, junction, junctionId, currentSimTime);
        } finally {
            // Always clear the flag, even if optimization fails
            jState.isOptimizing = false;
            jState.lastOptimizationTime = currentSimTime;
        }
    }
    
    /**
     * Internal optimization logic
     * @private
     */
    async _doOptimizeJunction(world, junction, junctionId, currentSimTime) {
        const startTime = Date.now();
        const jState = this.junctionState.get(junctionId);
        
        // Step 1: Collect traffic state for this specific junction
        const trafficState = this.collectJunctionTrafficState(world, junction, junctionId);
        
        // Step 2: Get current signal timing plan for this junction
        const currentPlan = this.getJunctionTimingPlan(junction);
        
        // Step 3: Evaluate if optimization is required
        const evaluationResult = this.evaluator.evaluate(trafficState, {}, currentSimTime);
        
        // Yield to event loop
        await new Promise(resolve => setTimeout(resolve, 0));
        
        if (!evaluationResult.optimizationRequired) {
            const result = {
                junctionId: junctionId,
                triggered: false,
                reason: evaluationResult.reason,
                timestamp: Date.now(),
                simTime: currentSimTime,
                evaluation: evaluationResult
            };
            
            this.stats.lastOptimizationResult = result;
            this._addToHistory(result);
            this._addToJunctionHistory(junctionId, result);
            
            return result;
        }
        
        // Step 4: Generate optimized timing plan
        const optimizationResult = this.timingOptimizer.optimize(currentPlan, trafficState);
        
        // Yield to event loop
        await new Promise(resolve => setTimeout(resolve, 0));
        
        if (!optimizationResult.selected) {
            const result = {
                junctionId: junctionId,
                triggered: true,
                approved: false,
                deployed: false,
                reason: 'No better timing plan found',
                timestamp: Date.now(),
                simTime: currentSimTime,
                evaluation: evaluationResult,
                optimization: optimizationResult,
                stage: 'optimization'
            };
            
            this.stats.totalOptimizations++;
            jState.stats.totalOptimizations++;
            this.stats.lastOptimizationResult = result;
            this._addToHistory(result);
            this._addToJunctionHistory(junctionId, result);
            
            return result;
        }
        
        const candidatePlan = optimizationResult.plan;
        
        // Step 5: Validate safety constraints
        const validationResult = this.validator.validate(candidatePlan);
        
        if (!validationResult.approved) {
            const result = {
                junctionId: junctionId,
                triggered: true,
                approved: false,
                deployed: false,
                reason: 'Rejected by safety validation',
                timestamp: Date.now(),
                simTime: currentSimTime,
                evaluation: evaluationResult,
                optimization: optimizationResult,
                validation: validationResult,
                stage: 'validation'
            };
            
            this.stats.totalOptimizations++;
            this.stats.rejectedBySafety++;
            jState.stats.totalOptimizations++;
            jState.stats.rejectedBySafety++;
            this.stats.lastOptimizationResult = result;
            this._addToHistory(result);
            this._addToJunctionHistory(junctionId, result);
            
            return result;
        }
        
        // Step 6: Deploy approved timing plan to this specific junction
        const deployed = this.deployJunctionTimingPlan(junction, candidatePlan);
        
        const result = {
            junctionId: junctionId,
            triggered: true,
            approved: true,
            deployed: deployed,
            reason: 'Timing plan approved and deployed',
            timestamp: Date.now(),
            simTime: currentSimTime,
            processingTime: Date.now() - startTime,
            evaluation: evaluationResult,
            optimization: optimizationResult,
            validation: validationResult,
            currentPlan: currentPlan,
            newPlan: candidatePlan,
            stage: 'deployed'
        };
        
        // Update statistics
        this.stats.totalOptimizations++;
        jState.stats.totalOptimizations++;
        if (deployed) {
            this.stats.successfulOptimizations++;
            jState.stats.successfulOptimizations++;
            const energySaved = optimizationResult.improvement || 0;
            this.stats.totalEnergySaved += energySaved;
            jState.stats.totalEnergySaved += energySaved;
        }
        this.stats.lastOptimizationResult = result;
        this._addToHistory(result);
        this._addToJunctionHistory(junctionId, result);
        
        // Update evaluator's last optimization time
        this.evaluator.updateOptimizationTime(currentSimTime);
        
        return result;
    }

    /**
     * Collect traffic state for a specific junction
     * @param {Object} world - World instance
     * @param {Object} junction - Specific junction
     * @param {string} junctionId - Junction ID
     * @returns {Object} - Traffic state data for this junction
     */
    collectJunctionTrafficState(world, junction, junctionId) {
        const junctionData = this._analyzeJunction(world, junctionId, junction);
        
        return {
            lanes: junctionData.lanes,
            junctionId: junctionId,
            timestamp: Date.now(),
            simTime: world.simTimeMs / 1000 // Convert to seconds
        };
    }

    /**
     * Analyze traffic at a specific junction
     * @param {Object} world - World instance
     * @param {string} junctionId - Junction ID
     * @param {Object} junction - Junction instance
     * @returns {Object} - Junction traffic analysis
     */
    _analyzeJunction(world, junctionId, junction) {
        const lanes = [];
        const directions = ['N', 'S', 'E', 'W'];
        
        for (const direction of directions) {
            const laneData = this._analyzeLane(world, junctionId, junction, direction);
            if (laneData.queueLength > 0 || laneData.demand > 0) {
                lanes.push(laneData);
            }
        }
        
        return { lanes };
    }

    /**
     * Analyze a specific lane at a junction
     * @param {Object} world - World instance
     * @param {string} junctionId - Junction ID
     * @param {Object} junction - Junction instance
     * @param {string} direction - Lane direction
     * @returns {Object} - Lane metrics
     */
    _analyzeLane(world, junctionId, junction, direction) {
        // Get vehicles approaching this junction from this direction
        const lanePoint = junction.lanePointForApproach(direction);
        const approaching = [];
        const waiting = [];
        let totalStops = 0;
        let totalIdleTime = 0;
        let vehicleCount = 0;
        
        for (const vehicle of world.vehicles) {
            if (!vehicle.plan || vehicle.plan.done) continue;
            
            // Check if vehicle is heading toward this junction
            const nextWaypoint = vehicle.waypoints[vehicle.wpIdx + 1];
            if (!nextWaypoint || nextWaypoint.junctionId !== junctionId) continue;
            
            // Check if vehicle is on the approach lane
            const tolerance = 35; // lane width tolerance
            const onLane = (lanePoint.axis === 'H' && Math.abs(vehicle.y - lanePoint.y) < tolerance) ||
                          (lanePoint.axis === 'V' && Math.abs(vehicle.x - lanePoint.x) < tolerance);
            
            if (onLane) {
                approaching.push(vehicle);
                vehicleCount++;
                
                // Get vehicle metadata for stop count and idle time
                const meta = world._vehMeta?.get(vehicle);
                if (meta) {
                    // Track stops: count how many times vehicle had to stop
                    // We approximate this by checking if vehicle has significant idle time
                    const idleTimeSeconds = (meta.idleMs || 0) / 1000;
                    totalIdleTime += idleTimeSeconds;
                    
                    // Estimate stop count: idle time / average stop duration
                    // Assuming average stop is ~10-15 seconds at a red light
                    const estimatedStops = Math.floor(idleTimeSeconds / 12);
                    totalStops += estimatedStops;
                }
                
                // Check if vehicle is stopped/waiting right now
                if (vehicle.plan.blockedAtStop) {
                    waiting.push(vehicle);
                }
            }
        }
        
        // Calculate metrics
        const queueLength = waiting.length;
        const demand = approaching.length;
        
        // Estimate average waiting time for currently waiting vehicles
        let totalWaitTime = 0;
        for (const v of waiting) {
            const meta = world._vehMeta?.get(v);
            if (meta) {
                totalWaitTime += (meta.idleMs || 0) / 1000; // Convert to seconds
            }
        }
        const avgWaitingTime = waiting.length > 0 ? totalWaitTime / waiting.length : 0;
        
        // Calculate average stop count and idle time per vehicle
        const avgStopsPerVehicle = vehicleCount > 0 ? totalStops / vehicleCount : 0;
        const avgIdleTimePerVehicle = vehicleCount > 0 ? totalIdleTime / vehicleCount : 0;
        
        // Determine movement direction (which green phase serves this approach)
        const movementDir = direction === 'N' || direction === 'S' ? 'NS' : 'EW';
        
        return {
            id: `${junctionId}_${direction}`,
            junctionId: junctionId,
            direction: direction,
            approachId: movementDir,
            queueLength: queueLength,
            demand: demand,
            averageWaitingTime: avgWaitingTime,
            arrivalRate: demand * 0.1, // rough estimate: 10% per update cycle
            totalStops: totalStops,
            avgStopsPerVehicle: avgStopsPerVehicle,
            avgIdleTime: avgIdleTimePerVehicle,
            vehicleCount: vehicleCount
        };
    }

    /**
     * Get current signal timing plan from a specific junction
     * @param {Object} junction - Specific junction
     * @returns {Object} - Current timing plan
     */
    getJunctionTimingPlan(junction) {
        if (!junction || !junction.signal) {
            // Return default plan
            return {
                ewGreenTime: 25,
                nsGreenTime: 25,
                yellowTime: 4,
                allRedTime: 2,
                cycleTime: 64,
                phases: []
            };
        }
        
        const signal = junction.signal;
        
        // Read from signal's mutable properties (not frozen cfg)
        const greenMs = signal.GREEN_MS || 3000;
        const yellowMs = signal.YELLOW_MS || 400;
        const allRedMs = signal.ALLRED_MS || 3000;
        
        const ewGreenTime = greenMs / 1000;
        const nsGreenTime = greenMs / 1000; // assuming both use same for now
        const yellowTime = yellowMs / 1000;
        const allRedTime = allRedMs / 1000;
        
        return {
            ewGreenTime: ewGreenTime,
            nsGreenTime: nsGreenTime,
            yellowTime: yellowTime,
            allRedTime: allRedTime,
            cycleTime: (ewGreenTime + yellowTime + allRedTime + nsGreenTime + yellowTime + allRedTime),
            phases: []
        };
    }

    /**
     * Deploy approved timing plan to a specific junction
     * @param {Object} junction - Specific junction
     * @param {Object} timingPlan - Approved timing plan
     * @returns {boolean} - True if successfully deployed
     */
    deployJunctionTimingPlan(junction, timingPlan) {
        try {
            if (junction.signal) {
                this._applyTimingToSignal(junction.signal, timingPlan);
            }
            return true;
        } catch (error) {
            console.error('Failed to deploy timing plan to junction:', error);
            return false;
        }
    }

    /**
     * Apply timing plan to a signal controller
     * @param {Object} signal - Signal controller instance
     * @param {Object} timingPlan - Timing plan
     */
    _applyTimingToSignal(signal, timingPlan) {
        // Convert seconds to milliseconds and update signal's mutable timing properties
        if (timingPlan.ewGreenTime !== undefined) {
            signal.GREEN_MS = timingPlan.ewGreenTime * 1000;
        }
        if (timingPlan.nsGreenTime !== undefined) {
            signal.GREEN_MS = timingPlan.nsGreenTime * 1000; // Assuming NS uses same as EW
        }
        if (timingPlan.yellowTime !== undefined) {
            signal.YELLOW_MS = timingPlan.yellowTime * 1000;
        }
        if (timingPlan.allRedTime !== undefined) {
            signal.ALLRED_MS = timingPlan.allRedTime * 1000;
        }
        
        // Reset signal timing with new durations
        signal._remainingMs = signal._durFor(signal.phase);
    }

    /**
     * Add result to global history with size limit
     * @param {Object} result - Optimization result
     */
    _addToHistory(result) {
        this.optimizationHistory.push(result);
        
        // Limit history size
        if (this.optimizationHistory.length > this.maxHistorySize) {
            this.optimizationHistory.shift();
        }
    }

    /**
     * Add result to junction-specific history
     * @param {string} junctionId - Junction ID
     * @param {Object} result - Optimization result
     */
    _addToJunctionHistory(junctionId, result) {
        const jState = this.junctionState.get(junctionId);
        if (!jState) return;
        
        jState.history.push(result);
        
        // Limit per-junction history size
        if (jState.history.length > 20) {
            jState.history.shift();
        }
    }

    /**
     * Enable/disable optimization
     * @param {boolean} enabled - Enable state
     */
    setEnabled(enabled) {
        this.enabled = enabled;
    }

    /**
     * Get optimization statistics
     * @returns {Object} - Statistics
     */
    getStats() {
        return { ...this.stats };
    }

    /**
     * Get optimization history
     * @param {string} junctionId - Optional junction ID for per-junction history
     * @returns {Array} - History of optimization results
     */
    getHistory(junctionId = null) {
        if (junctionId && this.junctionState.has(junctionId)) {
            return [...this.junctionState.get(junctionId).history];
        }
        return [...this.optimizationHistory];
    }

    /**
     * Get statistics for a specific junction
     * @param {string} junctionId - Junction ID
     * @returns {Object|null} - Junction statistics or null
     */
    getJunctionStats(junctionId) {
        if (this.junctionState.has(junctionId)) {
            return { ...this.junctionState.get(junctionId).stats };
        }
        return null;
    }

    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            totalOptimizations: 0,
            successfulOptimizations: 0,
            rejectedByEnergy: 0,
            rejectedBySafety: 0,
            totalEnergySaved: 0,
            lastOptimizationResult: null
        };
        this.optimizationHistory = [];
    }

    /**
     * Generate optimization summary report
     * @returns {string} - Formatted report
     */
    generateSummaryReport() {
        const lines = [];
        lines.push('=== Signal Optimization System Summary ===');
        lines.push(`Status: ${this.enabled ? 'ENABLED' : 'DISABLED'}`);
        lines.push(`Optimization Interval: ${this.optimizationInterval}s`);
        lines.push('');
        lines.push('Statistics:');
        lines.push(`  Total Optimizations: ${this.stats.totalOptimizations}`);
        lines.push(`  Successful: ${this.stats.successfulOptimizations}`);
        lines.push(`  Rejected by Safety: ${this.stats.rejectedBySafety}`);
        lines.push(`  Rejected by Energy: ${this.stats.rejectedByEnergy}`);
        lines.push(`  Total Energy Saved: ${this.stats.totalEnergySaved.toFixed(2)} g CO₂`);
        
        if (this.stats.lastOptimizationResult) {
            lines.push('');
            lines.push('Last Optimization:');
            const last = this.stats.lastOptimizationResult;
            lines.push(`  Triggered: ${last.triggered ? 'Yes' : 'No'}`);
            lines.push(`  Approved: ${last.approved ? 'Yes' : 'No'}`);
            lines.push(`  Deployed: ${last.deployed ? 'Yes' : 'No'}`);
            lines.push(`  Reason: ${last.reason}`);
        }
        
        return lines.join('\n');
    }
}
