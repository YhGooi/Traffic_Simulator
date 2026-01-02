/**
 * EvaluateOptimization Module
 * Determines if signal timing optimization is required based on traffic conditions
 */

class EvaluateOptimization {
    constructor(config = {}) {
        // Default thresholds - can be overridden via config
        this.queueLengthThreshold = config.queueLengthThreshold || 10;
        this.waitingTimeLimit = config.waitingTimeLimit || 60; // seconds
        this.laneImbalanceThreshold = config.laneImbalanceThreshold || 0.5; // 50% difference
        this.reoptimizationInterval = config.reoptimizationInterval || 300; // 5 minutes in seconds
        
        this.lastOptimizationTime = 0;
    }

    /**
     * Main evaluation function
     * @param {Object} trafficState - Current traffic state data
     * @param {Object} signalState - Current signal state data
     * @param {number} currentTime - Current simulation time in seconds
     * @returns {Object} - {optimizationRequired: boolean, reason: string}
     */
    evaluate(trafficState, signalState, currentTime) {
        // Check queue length threshold
        const queueCheck = this.checkQueueLength(trafficState);
        if (queueCheck.exceeded) {
            return {
                optimizationRequired: true,
                reason: 'Queue length exceeded threshold',
                details: queueCheck.details
            };
        }

        // Check waiting time threshold
        const waitingTimeCheck = this.checkWaitingTime(trafficState);
        if (waitingTimeCheck.exceeded) {
            return {
                optimizationRequired: true,
                reason: 'Waiting time exceeded limit',
                details: waitingTimeCheck.details
            };
        }

        // Check lane imbalance
        const imbalanceCheck = this.checkLaneImbalance(trafficState);
        if (imbalanceCheck.detected) {
            return {
                optimizationRequired: true,
                reason: 'Lane imbalance detected',
                details: imbalanceCheck.details
            };
        }

        // Check time window expiration
        const timeWindowCheck = this.checkTimeWindow(currentTime);
        if (timeWindowCheck.expired) {
            return {
                optimizationRequired: true,
                reason: 'Re-optimization interval elapsed',
                details: timeWindowCheck.details
            };
        }

        // No significant change detected
        return {
            optimizationRequired: false,
            reason: 'No significant change detected - maintaining current signal timing'
        };
    }

    /**
     * Check if queue length exceeds threshold
     * @param {Object} trafficState - Traffic state with queue data
     * @returns {Object} - {exceeded: boolean, details: Object}
     */
    checkQueueLength(trafficState) {
        const lanes = trafficState.lanes || [];
        const exceededLanes = [];

        for (const lane of lanes) {
            const queueLength = lane.queueLength || 0;
            if (queueLength > this.queueLengthThreshold) {
                exceededLanes.push({
                    laneId: lane.id,
                    queueLength: queueLength,
                    threshold: this.queueLengthThreshold
                });
            }
        }

        return {
            exceeded: exceededLanes.length > 0,
            details: {
                exceededLanes: exceededLanes,
                maxQueueLength: Math.max(...lanes.map(l => l.queueLength || 0))
            }
        };
    }

    /**
     * Check if waiting time exceeds limit
     * @param {Object} trafficState - Traffic state with waiting time data
     * @returns {Object} - {exceeded: boolean, details: Object}
     */
    checkWaitingTime(trafficState) {
        const lanes = trafficState.lanes || [];
        const exceededLanes = [];

        for (const lane of lanes) {
            const avgWaitingTime = lane.averageWaitingTime || 0;
            if (avgWaitingTime > this.waitingTimeLimit) {
                exceededLanes.push({
                    laneId: lane.id,
                    waitingTime: avgWaitingTime,
                    limit: this.waitingTimeLimit
                });
            }
        }

        return {
            exceeded: exceededLanes.length > 0,
            details: {
                exceededLanes: exceededLanes,
                maxWaitingTime: Math.max(...lanes.map(l => l.averageWaitingTime || 0))
            }
        };
    }

    /**
     * Check for lane imbalance
     * @param {Object} trafficState - Traffic state with lane data
     * @returns {Object} - {detected: boolean, details: Object}
     */
    checkLaneImbalance(trafficState) {
        const lanes = trafficState.lanes || [];
        
        if (lanes.length < 2) {
            return { detected: false, details: {} };
        }

        // Group lanes by approach/direction
        const approaches = this.groupLanesByApproach(lanes);
        const imbalances = [];

        for (const [approachId, approachLanes] of Object.entries(approaches)) {
            const demands = approachLanes.map(l => l.queueLength || 0);
            const maxDemand = Math.max(...demands);
            const minDemand = Math.min(...demands);

            if (maxDemand > 0) {
                const imbalanceRatio = (maxDemand - minDemand) / maxDemand;
                
                if (imbalanceRatio > this.laneImbalanceThreshold) {
                    imbalances.push({
                        approachId: approachId,
                        maxDemand: maxDemand,
                        minDemand: minDemand,
                        imbalanceRatio: imbalanceRatio
                    });
                }
            }
        }

        return {
            detected: imbalances.length > 0,
            details: { imbalances: imbalances }
        };
    }

    /**
     * Group lanes by approach
     * @param {Array} lanes - Array of lane objects
     * @returns {Object} - Grouped lanes by approach
     */
    groupLanesByApproach(lanes) {
        const approaches = {};
        
        for (const lane of lanes) {
            const approachId = lane.approachId || lane.direction || 'unknown';
            if (!approaches[approachId]) {
                approaches[approachId] = [];
            }
            approaches[approachId].push(lane);
        }

        return approaches;
    }

    /**
     * Check if re-optimization interval has elapsed
     * @param {number} currentTime - Current simulation time
     * @returns {Object} - {expired: boolean, details: Object}
     */
    checkTimeWindow(currentTime) {
        const timeSinceLastOptimization = currentTime - this.lastOptimizationTime;
        const expired = timeSinceLastOptimization >= this.reoptimizationInterval;

        return {
            expired: expired,
            details: {
                timeSinceLastOptimization: timeSinceLastOptimization,
                reoptimizationInterval: this.reoptimizationInterval
            }
        };
    }

    /**
     * Update the last optimization time
     * @param {number} currentTime - Current simulation time
     */
    updateOptimizationTime(currentTime) {
        this.lastOptimizationTime = currentTime;
    }

    /**
     * Reset the evaluation module
     */
    reset() {
        this.lastOptimizationTime = 0;
    }

    /**
     * Update configuration thresholds
     * @param {Object} newConfig - New configuration parameters
     */
    updateConfig(newConfig) {
        if (newConfig.queueLengthThreshold !== undefined) {
            this.queueLengthThreshold = newConfig.queueLengthThreshold;
        }
        if (newConfig.waitingTimeLimit !== undefined) {
            this.waitingTimeLimit = newConfig.waitingTimeLimit;
        }
        if (newConfig.laneImbalanceThreshold !== undefined) {
            this.laneImbalanceThreshold = newConfig.laneImbalanceThreshold;
        }
        if (newConfig.reoptimizationInterval !== undefined) {
            this.reoptimizationInterval = newConfig.reoptimizationInterval;
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EvaluateOptimization;
}

// ES6 export
export { EvaluateOptimization };