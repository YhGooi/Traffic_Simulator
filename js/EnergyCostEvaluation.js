/**
 * EnergyCostEvaluation Module
 * Evaluates energy-aware cost of signal timing plans
 * Compares candidate timing plans against current timing to minimize energy consumption
 */

class EnergyCostEvaluation {
    constructor(config = {}) {
        // Cost weights - can be tuned based on real-world priorities
        this.idleTimeCostWeight = config.idleTimeCostWeight || 1.0;
        this.stopStartCostWeight = config.stopStartCostWeight || 1.5;
        this.signalSwitchingCostWeight = config.signalSwitchingCostWeight || 0.3;
        this.delayPenaltyWeight = config.delayPenaltyWeight || 1.2;
        
        // Energy parameters (g CO₂)
        this.idleCO2PerSecond = config.idleCO2PerSecond || 1.03; // ~0.35 gal/hr → 1.03 g/s
        this.stopStartCO2Penalty = config.stopStartCO2Penalty || 25; // g CO₂ per stop-start cycle
        this.signalSwitchCO2 = config.signalSwitchCO2 || 5; // indirect cost of switching
        
        // Thresholds
        this.acceptanceThreshold = config.acceptanceThreshold || 0.95; // candidate must be 5% better
        
        // History tracking
        this.evaluationHistory = [];
    }

    /**
     * Main evaluation function
     * @param {Object} candidatePlan - Proposed timing plan
     * @param {Object} currentPlan - Current timing plan
     * @param {Object} trafficState - Current traffic conditions
     * @returns {Object} - {accepted: boolean, currentCost: number, candidateCost: number, breakdown: Object}
     */
    evaluate(candidatePlan, currentPlan, trafficState) {
        // Calculate cost components for current plan
        const currentCosts = this.calculateTotalCost(currentPlan, trafficState);
        
        // Calculate cost components for candidate plan
        const candidateCosts = this.calculateTotalCost(candidatePlan, trafficState);
        
        // Compare costs
        const accepted = this.shouldAcceptCandidate(candidateCosts.total, currentCosts.total);
        
        const result = {
            accepted: accepted,
            currentCost: currentCosts.total,
            candidateCost: candidateCosts.total,
            improvement: currentCosts.total - candidateCosts.total,
            improvementPercent: ((currentCosts.total - candidateCosts.total) / currentCosts.total) * 100,
            breakdown: {
                current: currentCosts,
                candidate: candidateCosts
            },
            decision: accepted ? 'Accept optimized timing plan' : 'Reject optimized timing plan - maintain current signal timing'
        };
        
        // Store in history
        this.evaluationHistory.push({
            timestamp: Date.now(),
            result: result
        });
        
        return result;
    }

    /**
     * Calculate total energy-aware cost for a timing plan
     * @param {Object} timingPlan - Signal timing plan
     * @param {Object} trafficState - Current traffic conditions
     * @returns {Object} - Cost breakdown
     */
    calculateTotalCost(timingPlan, trafficState) {
        const idleCost = this.estimateIdleTimeCost(timingPlan, trafficState);
        const stopStartCost = this.estimateStopStartCost(timingPlan, trafficState);
        const switchingCost = this.estimateSignalSwitchingCost(timingPlan);
        const delayPenalty = this.estimateDelayPenalty(timingPlan, trafficState);
        
        const total = idleCost + stopStartCost + switchingCost + delayPenalty;
        
        return {
            idleCost: idleCost,
            stopStartCost: stopStartCost,
            switchingCost: switchingCost,
            delayPenalty: delayPenalty,
            total: total
        };
    }

    /**
     * Estimate idle time cost (vehicles waiting at red signals)
     * Higher idle time = more fuel consumption while stationary
     * @param {Object} timingPlan - Signal timing plan
     * @param {Object} trafficState - Traffic conditions
     * @returns {number} - Idle time cost
     */
    estimateIdleTimeCost(timingPlan, trafficState) {
        const lanes = trafficState.lanes || [];
        let totalIdleTime = 0;
        
        for (const lane of lanes) {
            const queueLength = lane.queueLength || 0;
            const avgWaitingTime = lane.averageWaitingTime || 0;
            const avgIdleTime = lane.avgIdleTime || 0;
            const vehicleCount = lane.vehicleCount || 0;
            const redTime = this.getRedTimeForLane(lane, timingPlan);
            const greenTime = this.getGreenTimeForLane(lane, timingPlan);
            const cycleTime = timingPlan.cycleTime || 60;
            
            // Use actual measured idle time from vehicles on this lane
            const measuredIdleTime = avgIdleTime * vehicleCount;
            
            // Existing queue waiting through current red
            const existingQueueIdleTime = queueLength * avgWaitingTime;
            
            // New arrivals during red phase (assumes uniform arrival)
            const demand = lane.demand || lane.arrivalRate || 0;
            const arrivalsPerCycle = demand * (cycleTime / 10); // rough estimate
            const newArrivalsDuringRed = arrivalsPerCycle * (redTime / cycleTime);
            const newArrivalsIdleTime = newArrivalsDuringRed * (redTime / 2); // average wait
            
            // Weighted combination: favor actual measurements
            totalIdleTime += measuredIdleTime * 0.6 + existingQueueIdleTime * 0.3 + newArrivalsIdleTime * 0.1;
        }
        
        // Convert to CO₂ cost
        const idleCost = totalIdleTime * this.idleCO2PerSecond * this.idleTimeCostWeight;
        
        return idleCost;
    }

    /**
     * Estimate stop-start energy cost
     * Each stop-start cycle consumes extra fuel due to acceleration
     * @param {Object} timingPlan - Signal timing plan
     * @param {Object} trafficState - Traffic conditions
     * @returns {number} - Stop-start cost
     */
    estimateStopStartCost(timingPlan, trafficState) {
        const lanes = trafficState.lanes || [];
        let totalStopStarts = 0;
        
        for (const lane of lanes) {
            const queueLength = lane.queueLength || 0;
            const arrivalRate = lane.arrivalRate || 0;
            const cycleTime = timingPlan.cycleTime || 60;
            
            // Use actual stop count data if available
            const currentStops = lane.totalStops || 0;
            
            // Estimate number of stop-start events per cycle
            // Vehicles that arrive during red phase must stop
            const redTime = this.getRedTimeForLane(lane, timingPlan);
            const stopsPerCycle = arrivalRate * (redTime / cycleTime);
            
            // Combine current stops with predicted future stops
            totalStopStarts += currentStops * 0.7 + stopsPerCycle * 0.3 + queueLength * 0.5;
        }
        
        // Apply stop-start penalty (each stop costs extra fuel)
        const stopStartCost = totalStopStarts * this.stopStartCO2Penalty * this.stopStartCostWeight;
        
        return stopStartCost;
    }

    /**
     * Estimate signal switching cost
     * Frequent phase changes can reduce efficiency and increase indirect costs
     * @param {Object} timingPlan - Signal timing plan
     * @returns {number} - Switching cost
     */
    estimateSignalSwitchingCost(timingPlan) {
        // Count number of phase transitions in the plan
        const phases = timingPlan.phases || [];
        const cycleTime = timingPlan.cycleTime || 60;
        
        // Typical cycle has 4 major transitions (EW green → yellow → NS green → yellow)
        // More complex plans with additional phases increase switching cost
        const switchesPerCycle = phases.length > 0 ? phases.length : 4;
        
        // Normalize by cycle time (longer cycles = fewer switches per second)
        const switchRate = switchesPerCycle / (cycleTime / 60);
        
        const switchingCost = switchRate * this.signalSwitchCO2 * this.signalSwitchingCostWeight;
        
        return switchingCost;
    }

    /**
     * Estimate delay penalty
     * Overall system delay affects travel time and user experience
     * @param {Object} timingPlan - Signal timing plan
     * @param {Object} trafficState - Traffic conditions
     * @returns {number} - Delay penalty
     */
    estimateDelayPenalty(timingPlan, trafficState) {
        const lanes = trafficState.lanes || [];
        let totalDelay = 0;
        
        for (const lane of lanes) {
            const queueLength = lane.queueLength || 0;
            const averageWaitingTime = lane.averageWaitingTime || 0;
            const demand = lane.demand || lane.arrivalRate || 0;
            
            // Current delay from existing queue
            const currentDelay = queueLength * averageWaitingTime;
            
            // Predicted delay based on demand vs capacity
            const greenTime = this.getGreenTimeForLane(lane, timingPlan);
            const cycleTime = timingPlan.cycleTime || 60;
            const capacity = this.estimateLaneCapacity(greenTime, cycleTime);
            const arrivalsPerCycle = demand * (cycleTime / 10);
            
            // If arrivals exceed capacity, queue builds up
            const deficit = Math.max(0, arrivalsPerCycle - capacity);
            const futureDelay = deficit * cycleTime;
            
            // Penalize congested lanes more heavily
            const congestionMultiplier = queueLength > 5 ? 2.0 : 1.0;
            
            totalDelay += (currentDelay + futureDelay) * congestionMultiplier;
        }
        
        // Convert delay to cost (delay in seconds × CO₂ rate)
        const delayPenalty = totalDelay * this.idleCO2PerSecond * this.delayPenaltyWeight;
        
        return delayPenalty;
    }

    /**
     * Get red time duration for a specific lane from timing plan
     * @param {Object} lane - Lane information
     * @param {Object} timingPlan - Timing plan
     * @returns {number} - Red time in seconds
     */
    getRedTimeForLane(lane, timingPlan) {
        const cycleTime = timingPlan.cycleTime || 60;
        const greenTime = this.getGreenTimeForLane(lane, timingPlan);
        const yellowTime = timingPlan.yellowTime || 4;
        const allRedTime = timingPlan.allRedTime || 2;
        
        // Red time = cycle time - own green - own yellow
        // (includes other direction's green, yellow, and all-red phases)
        const redTime = cycleTime - greenTime - yellowTime;
        
        return Math.max(0, redTime);
    }

    /**
     * Get green time duration for a specific lane from timing plan
     * @param {Object} lane - Lane information
     * @param {Object} timingPlan - Timing plan
     * @returns {number} - Green time in seconds
     */
    getGreenTimeForLane(lane, timingPlan) {
        const laneDirection = lane.direction || lane.approachId || 'EW';
        const phases = timingPlan.phases || [];
        
        // If phases are specified, sum green time for this direction
        if (phases.length > 0) {
            let totalGreen = 0;
            for (const phase of phases) {
                if (this.phaseServesDirection(phase, laneDirection)) {
                    totalGreen += phase.greenTime || 0;
                }
            }
            return totalGreen;
        }
        
        // Fallback: use simple EW/NS split
        const ewGreen = timingPlan.ewGreenTime || 25;
        const nsGreen = timingPlan.nsGreenTime || 25;
        
        return laneDirection.includes('E') || laneDirection.includes('W') ? ewGreen : nsGreen;
    }

    /**
     * Check if a phase serves a specific direction
     * @param {Object} phase - Phase information
     * @param {string} direction - Direction (N, S, E, W, NS, EW)
     * @returns {boolean}
     */
    phaseServesDirection(phase, direction) {
        const phaseDirection = phase.direction || phase.movement || '';
        return phaseDirection.includes(direction) || 
               (direction === 'EW' && (phaseDirection.includes('E') || phaseDirection.includes('W'))) ||
               (direction === 'NS' && (phaseDirection.includes('N') || phaseDirection.includes('S')));
    }

    /**
     * Estimate lane capacity (vehicles per cycle)
     * @param {number} greenTime - Green time in seconds
     * @param {number} cycleTime - Cycle time in seconds
     * @returns {number} - Capacity (vehicles)
     */
    estimateLaneCapacity(greenTime, cycleTime) {
        // Saturation flow rate: ~1800-2000 vehicles per hour per lane
        const saturationFlowRate = 1900 / 3600; // vehicles per second
        
        // Capacity = saturation flow × (green time / cycle time) × cycle time
        const capacity = saturationFlowRate * greenTime;
        
        return capacity;
    }

    /**
     * Decide if candidate plan should be accepted
     * @param {number} candidateCost - Total cost of candidate plan
     * @param {number} currentCost - Total cost of current plan
     * @returns {boolean} - True if candidate should be accepted
     */
    shouldAcceptCandidate(candidateCost, currentCost) {
        // Candidate must be better by at least the acceptance threshold
        // This prevents frequent switching for marginal improvements
        return candidateCost < (currentCost * this.acceptanceThreshold);
    }

    /**
     * Get evaluation history
     * @returns {Array} - Array of past evaluations
     */
    getHistory() {
        return this.evaluationHistory;
    }

    /**
     * Clear evaluation history
     */
    clearHistory() {
        this.evaluationHistory = [];
    }

    /**
     * Update configuration parameters
     * @param {Object} newConfig - New configuration
     */
    updateConfig(newConfig) {
        if (newConfig.idleTimeCostWeight !== undefined) {
            this.idleTimeCostWeight = newConfig.idleTimeCostWeight;
        }
        if (newConfig.stopStartCostWeight !== undefined) {
            this.stopStartCostWeight = newConfig.stopStartCostWeight;
        }
        if (newConfig.signalSwitchingCostWeight !== undefined) {
            this.signalSwitchingCostWeight = newConfig.signalSwitchingCostWeight;
        }
        if (newConfig.delayPenaltyWeight !== undefined) {
            this.delayPenaltyWeight = newConfig.delayPenaltyWeight;
        }
        if (newConfig.idleCO2PerSecond !== undefined) {
            this.idleCO2PerSecond = newConfig.idleCO2PerSecond;
        }
        if (newConfig.stopStartCO2Penalty !== undefined) {
            this.stopStartCO2Penalty = newConfig.stopStartCO2Penalty;
        }
        if (newConfig.signalSwitchCO2 !== undefined) {
            this.signalSwitchCO2 = newConfig.signalSwitchCO2;
        }
        if (newConfig.acceptanceThreshold !== undefined) {
            this.acceptanceThreshold = newConfig.acceptanceThreshold;
        }
    }

    /**
     * Generate a summary report of the evaluation
     * @param {Object} evaluationResult - Result from evaluate()
     * @returns {string} - Formatted summary
     */
    generateReport(evaluationResult) {
        const lines = [];
        lines.push('=== Energy Cost Evaluation Report ===');
        lines.push(`Decision: ${evaluationResult.decision}`);
        lines.push('');
        lines.push('Cost Comparison:');
        lines.push(`  Current Plan Total Cost:   ${evaluationResult.currentCost.toFixed(2)} g CO₂`);
        lines.push(`  Candidate Plan Total Cost: ${evaluationResult.candidateCost.toFixed(2)} g CO₂`);
        lines.push(`  Improvement:               ${evaluationResult.improvement.toFixed(2)} g CO₂ (${evaluationResult.improvementPercent.toFixed(1)}%)`);
        lines.push('');
        lines.push('Current Plan Breakdown:');
        lines.push(`  Idle Time Cost:       ${evaluationResult.breakdown.current.idleCost.toFixed(2)}`);
        lines.push(`  Stop-Start Cost:      ${evaluationResult.breakdown.current.stopStartCost.toFixed(2)}`);
        lines.push(`  Switching Cost:       ${evaluationResult.breakdown.current.switchingCost.toFixed(2)}`);
        lines.push(`  Delay Penalty:        ${evaluationResult.breakdown.current.delayPenalty.toFixed(2)}`);
        lines.push('');
        lines.push('Candidate Plan Breakdown:');
        lines.push(`  Idle Time Cost:       ${evaluationResult.breakdown.candidate.idleCost.toFixed(2)}`);
        lines.push(`  Stop-Start Cost:      ${evaluationResult.breakdown.candidate.stopStartCost.toFixed(2)}`);
        lines.push(`  Switching Cost:       ${evaluationResult.breakdown.candidate.switchingCost.toFixed(2)}`);
        lines.push(`  Delay Penalty:        ${evaluationResult.breakdown.candidate.delayPenalty.toFixed(2)}`);
        
        return lines.join('\n');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EnergyCostEvaluation;
}

// ES6 export
export { EnergyCostEvaluation };
