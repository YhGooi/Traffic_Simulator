/**
 * OptimizeTiming Module
 * Generates optimized signal timing plans based on current traffic conditions
 * Uses energy-aware cost evaluation to select the best timing configuration
 */

import { EnergyCostEvaluation } from './EnergyCostEvaluation.js';

class OptimizeTiming {
    constructor(config = {}) {
        // Green time adjustment bounds
        this.minGreenTime = config.minGreenTime || 10; // seconds
        this.maxGreenTime = config.maxGreenTime || 60; // seconds
        this.greenTimeStep = config.greenTimeStep || 5; // seconds per adjustment
        
        // Cycle time constraints
        this.minCycleTime = config.minCycleTime || 40; // seconds
        this.maxCycleTime = config.maxCycleTime || 120; // seconds
        
        // Phase timing
        this.yellowTime = config.yellowTime || 4; // seconds
        this.allRedTime = config.allRedTime || 2; // seconds
        
        // Optimization parameters
        this.maxCandidates = config.maxCandidates || 10;
        this.phaseReorderThreshold = config.phaseReorderThreshold || 0.15; // 15% improvement needed
        
        // Energy cost evaluator
        this.energyEvaluator = new EnergyCostEvaluation(config.energyCostConfig || {});
        
        // History
        this.optimizationHistory = [];
    }

    /**
     * Main optimization function
     * @param {Object} currentTimingPlan - Current signal timing configuration
     * @param {Object} trafficState - Current traffic metrics
     * @param {Object} energyCostParams - Energy cost parameters (optional)
     * @returns {Object} - Optimized timing plan with evaluation results
     */
    optimize(currentTimingPlan, trafficState, energyCostParams = {}) {
        // Update energy cost parameters if provided
        if (Object.keys(energyCostParams).length > 0) {
            this.energyEvaluator.updateConfig(energyCostParams);
        }
        
        // Step 1: Identify priority approaches
        const priorities = this.identifyPriorityApproaches(trafficState);
        
        // Step 2: Generate candidate timing plans
        const candidates = this.generateCandidatePlans(currentTimingPlan, trafficState, priorities);
        
        // Step 3: Evaluate each candidate
        const evaluatedCandidates = this.evaluateCandidates(candidates, currentTimingPlan, trafficState);
        
        // Step 4: Select best plan
        const bestPlan = this.selectBestPlan(evaluatedCandidates, currentTimingPlan);
        
        // Store in history
        this.optimizationHistory.push({
            timestamp: Date.now(),
            currentPlan: currentTimingPlan,
            bestPlan: bestPlan,
            candidatesEvaluated: evaluatedCandidates.length,
            priorities: priorities
        });
        
        return bestPlan;
    }

    /**
     * Identify priority approaches based on queue length, waiting time, stops, and idle time
     * @param {Object} trafficState - Traffic state with lane data
     * @returns {Array} - Sorted array of approaches by priority (highest first)
     */
    identifyPriorityApproaches(trafficState) {
        const lanes = trafficState.lanes || [];
        const approaches = new Map();
        
        // Group lanes by direction/approach
        for (const lane of lanes) {
            const direction = lane.direction || lane.approachId || 'EW';
            
            if (!approaches.has(direction)) {
                approaches.set(direction, {
                    direction: direction,
                    totalQueue: 0,
                    totalWaitingTime: 0,
                    totalStops: 0,
                    totalIdleTime: 0,
                    totalVehicles: 0,
                    laneCount: 0,
                    demand: 0
                });
            }
            
            const approach = approaches.get(direction);
            approach.totalQueue += lane.queueLength || 0;
            approach.totalWaitingTime += lane.averageWaitingTime || 0;
            approach.totalStops += lane.totalStops || 0;
            approach.totalIdleTime += lane.avgIdleTime || 0;
            approach.totalVehicles += lane.vehicleCount || 0;
            approach.demand += lane.demand || lane.arrivalRate || 0;
            approach.laneCount++;
        }
        
        // Calculate priority score for each approach
        const priorityList = [];
        for (const [direction, data] of approaches.entries()) {
            const avgQueue = data.laneCount > 0 ? data.totalQueue / data.laneCount : 0;
            const avgWait = data.laneCount > 0 ? data.totalWaitingTime / data.laneCount : 0;
            const avgStops = data.totalVehicles > 0 ? data.totalStops / data.totalVehicles : 0;
            const avgIdleTime = data.totalVehicles > 0 ? data.totalIdleTime / data.totalVehicles : 0;
            
            // Priority score = weighted combination of all congestion indicators
            // Higher queue, wait time, stops, and idle time = higher priority = needs more green
            const priorityScore = 
                (avgQueue * 2.5) +           // Queue length is critical
                (avgWait * 2.0) +            // Current waiting time
                (avgStops * 1.5) +           // Multiple stops indicate poor coordination
                (avgIdleTime * 1.8) +        // High idle time = wasted fuel
                (data.demand * 1.0);         // Future demand
            
            priorityList.push({
                direction: direction,
                priorityScore: priorityScore,
                avgQueue: avgQueue,
                avgWait: avgWait,
                avgStops: avgStops,
                avgIdleTime: avgIdleTime,
                demand: data.demand,
                laneCount: data.laneCount
            });
        }
        
        // Sort by priority (highest first)
        priorityList.sort((a, b) => b.priorityScore - a.priorityScore);
        
        return priorityList;
    }

    /**
     * Generate candidate timing plans
     * @param {Object} currentPlan - Current timing plan
     * @param {Object} trafficState - Traffic state
     * @param {Array} priorities - Priority approaches
     * @returns {Array} - Array of candidate timing plans
     */
    generateCandidatePlans(currentPlan, trafficState, priorities) {
        const candidates = [];
        
        // Candidate 1: Current plan (baseline)
        candidates.push({
            ...this.deepCopy(currentPlan),
            description: 'Current plan (baseline)',
            modifications: []
        });
        
        // Candidate 2-N: Adjust green times based on priorities
        const adjustments = this.generateGreenTimeAdjustments(currentPlan, priorities);
        for (const adjustment of adjustments) {
            candidates.push(adjustment);
        }
        
        // Evaluate if phase reordering would help
        const reorderBenefit = this.evaluatePhaseReordering(currentPlan, trafficState, priorities);
        
        if (reorderBenefit.beneficial) {
            // Generate candidates with reordered phases
            const reorderedCandidates = this.generateReorderedPhases(currentPlan, priorities, reorderBenefit);
            candidates.push(...reorderedCandidates);
        }
        
        // Limit to max candidates
        return candidates.slice(0, this.maxCandidates);
    }

    /**
     * Generate green time adjustment candidates
     * @param {Object} currentPlan - Current timing plan
     * @param {Array} priorities - Priority approaches (sorted highest to lowest)
     * @returns {Array} - Candidate plans with adjusted green times
     */
    generateGreenTimeAdjustments(currentPlan, priorities) {
        const candidates = [];
        
        if (priorities.length < 2) return candidates;
        
        // High priority = most congested = needs MORE green time
        const highPriority = priorities[0];
        const lowPriority = priorities[priorities.length - 1];
        
        // Strategy 1: Give more green to congested direction, reduce uncongested
        const increase1 = this.deepCopy(currentPlan);
        this.adjustGreenTime(increase1, highPriority.direction, +this.greenTimeStep);
        this.adjustGreenTime(increase1, lowPriority.direction, -this.greenTimeStep);
        candidates.push({
            ...increase1,
            description: `+${this.greenTimeStep}s green for congested ${highPriority.direction}`,
            modifications: [`+${this.greenTimeStep}s to ${highPriority.direction}`, `-${this.greenTimeStep}s from ${lowPriority.direction}`]
        });
        
        // Strategy 2: Larger increase for highly congested direction
        const increase2 = this.deepCopy(currentPlan);
        this.adjustGreenTime(increase2, highPriority.direction, +this.greenTimeStep * 2);
        this.adjustGreenTime(increase2, lowPriority.direction, -this.greenTimeStep * 2);
        candidates.push({
            ...increase2,
            description: `+${this.greenTimeStep * 2}s green for congested ${highPriority.direction}`,
            modifications: [`+${this.greenTimeStep * 2}s to ${highPriority.direction}`, `-${this.greenTimeStep * 2}s from ${lowPriority.direction}`]
        });
        
        // Strategy 3: Proportional to congestion levels
        if (priorities.length >= 2) {
            const moderate = this.deepCopy(currentPlan);
            const totalPriority = priorities.reduce((sum, p) => sum + p.priorityScore, 0);
            
            if (totalPriority > 0) {
                for (const priority of priorities) {
                    // More congested = higher score = more green time
                    const priorityRatio = priority.priorityScore / totalPriority;
                    const adjustment = (priorityRatio - 0.5) * this.greenTimeStep * 2;
                    this.adjustGreenTime(moderate, priority.direction, adjustment);
                }
                candidates.push({
                    ...moderate,
                    description: 'Proportional to congestion levels',
                    modifications: ['Green time proportional to congestion']
                });
            }
        }
        
        // Strategy 4: Balance based on demand ratio
        const balanced = this.deepCopy(currentPlan);
        const totalDemand = priorities.reduce((sum, p) => sum + p.demand, 0);
        if (totalDemand > 0) {
            for (const priority of priorities) {
                const demandRatio = priority.demand / totalDemand;
                const targetGreen = this.calculateTargetGreenTime(demandRatio, balanced.cycleTime);
                const currentGreen = this.getGreenTimeForDirection(balanced, priority.direction);
                const adjustment = Math.min(Math.max(targetGreen - currentGreen, -this.greenTimeStep * 2), this.greenTimeStep * 2);
                this.adjustGreenTime(balanced, priority.direction, adjustment);
            }
            candidates.push({
                ...balanced,
                description: 'Demand-proportional allocation',
                modifications: ['Green time proportional to demand']
            });
        }
        
        return candidates;
    }

    /**
     * Adjust green time for a specific direction in a timing plan
     * @param {Object} plan - Timing plan to modify (modified in place)
     * @param {string} direction - Direction to adjust (N, S, E, W, EW, NS)
     * @param {number} adjustment - Adjustment in seconds (positive or negative)
     */
    adjustGreenTime(plan, direction, adjustment) {
        // Determine if this is EW or NS
        const isEW = direction.includes('E') || direction.includes('W') || direction === 'EW';
        const isNS = direction.includes('N') || direction.includes('S') || direction === 'NS';
        
        if (isEW) {
            const current = plan.ewGreenTime || 25;
            const proposed = current + adjustment;
            plan.ewGreenTime = Math.max(this.minGreenTime, Math.min(this.maxGreenTime, proposed));
        } else if (isNS) {
            const current = plan.nsGreenTime || 25;
            const proposed = current + adjustment;
            plan.nsGreenTime = Math.max(this.minGreenTime, Math.min(this.maxGreenTime, proposed));
        }
        
        // Recalculate cycle time and ensure it's valid
        this.recalculateCycleTime(plan);
        
        // If cycle time is out of bounds, scale back the green times proportionally
        if (plan.cycleTime > this.maxCycleTime) {
            const scale = (this.maxCycleTime - (this.yellowTime * 2) - (this.allRedTime * 2)) / 
                         ((plan.ewGreenTime || 25) + (plan.nsGreenTime || 25));
            if (scale < 1) {
                plan.ewGreenTime = Math.max(this.minGreenTime, (plan.ewGreenTime || 25) * scale);
                plan.nsGreenTime = Math.max(this.minGreenTime, (plan.nsGreenTime || 25) * scale);
                this.recalculateCycleTime(plan);
            }
        } else if (plan.cycleTime < this.minCycleTime) {
            const deficit = this.minCycleTime - plan.cycleTime;
            // Add deficit proportionally to both directions
            plan.ewGreenTime = (plan.ewGreenTime || 25) + deficit / 2;
            plan.nsGreenTime = (plan.nsGreenTime || 25) + deficit / 2;
            this.recalculateCycleTime(plan);
        }
    }

    /**
     * Get current green time for a direction
     * @param {Object} plan - Timing plan
     * @param {string} direction - Direction
     * @returns {number} - Green time in seconds
     */
    getGreenTimeForDirection(plan, direction) {
        const isEW = direction.includes('E') || direction.includes('W') || direction === 'EW';
        return isEW ? (plan.ewGreenTime || 25) : (plan.nsGreenTime || 25);
    }

    /**
     * Calculate target green time based on demand ratio
     * @param {number} demandRatio - Proportion of total demand (0-1)
     * @param {number} cycleTime - Current cycle time
     * @returns {number} - Target green time
     */
    calculateTargetGreenTime(demandRatio, cycleTime) {
        const availableGreen = cycleTime - (this.yellowTime * 2) - (this.allRedTime * 2);
        return demandRatio * availableGreen;
    }

    /**
     * Recalculate cycle time based on green times
     * @param {Object} plan - Timing plan to update
     */
    recalculateCycleTime(plan) {
        const ewGreen = plan.ewGreenTime || 25;
        const nsGreen = plan.nsGreenTime || 25;
        
        // Cycle = EW green + yellow + NS green + yellow + 2 × all-red
        const calculatedCycle = ewGreen + this.yellowTime + nsGreen + this.yellowTime + (this.allRedTime * 2);
        
        plan.cycleTime = Math.max(this.minCycleTime, Math.min(this.maxCycleTime, calculatedCycle));
        plan.yellowTime = this.yellowTime;
        plan.allRedTime = this.allRedTime;
    }

    /**
     * Evaluate if phase reordering would be beneficial
     * @param {Object} currentPlan - Current timing plan
     * @param {Object} trafficState - Traffic state
     * @param {Array} priorities - Priority approaches
     * @returns {Object} - {beneficial: boolean, reason: string, estimatedImprovement: number}
     */
    evaluatePhaseReordering(currentPlan, trafficState, priorities) {
        // Phase reordering is beneficial when:
        // 1. There's significant imbalance between directions
        // 2. The switching cost is outweighed by delay reduction
        
        if (priorities.length < 2) {
            return { beneficial: false, reason: 'Insufficient approaches for reordering' };
        }
        
        const highPriority = priorities[0];
        const lowPriority = priorities[priorities.length - 1];
        
        // Check imbalance
        const imbalance = highPriority.priorityScore / (lowPriority.priorityScore + 1);
        
        if (imbalance > 2.0) {
            // Estimate benefit vs switching cost
            const delayReduction = (highPriority.avgQueue * highPriority.avgWait) * 0.3; // 30% reduction estimate
            const switchingCost = this.phaseReorderThreshold * 100; // normalized cost
            
            if (delayReduction > switchingCost) {
                return {
                    beneficial: true,
                    reason: 'High imbalance detected, reordering likely beneficial',
                    estimatedImprovement: delayReduction - switchingCost
                };
            }
        }
        
        return {
            beneficial: false,
            reason: 'Switching cost exceeds potential benefit',
            estimatedImprovement: 0
        };
    }

    /**
     * Generate candidates with reordered phases
     * @param {Object} currentPlan - Current timing plan
     * @param {Array} priorities - Priority approaches
     * @param {Object} reorderBenefit - Benefit analysis
     * @returns {Array} - Candidate plans with reordered phases
     */
    generateReorderedPhases(currentPlan, priorities, reorderBenefit) {
        const candidates = [];
        
        // Strategy: Give high-priority direction first green phase
        const reordered = this.deepCopy(currentPlan);
        reordered.phaseOrder = priorities.map(p => p.direction);
        reordered.description = 'Reordered phases by priority';
        reordered.modifications = [`Phase order: ${reordered.phaseOrder.join(' → ')}`];
        
        candidates.push(reordered);
        
        return candidates;
    }

    /**
     * Evaluate all candidate plans using energy cost evaluation
     * @param {Array} candidates - Candidate timing plans
     * @param {Object} currentPlan - Current timing plan
     * @param {Object} trafficState - Traffic state
     * @returns {Array} - Candidates with evaluation results
     */
    evaluateCandidates(candidates, currentPlan, trafficState) {
        const evaluated = [];
        
        for (const candidate of candidates) {
            const evaluation = this.energyEvaluator.evaluate(candidate, currentPlan, trafficState);
            
            evaluated.push({
                plan: candidate,
                evaluation: evaluation,
                cost: evaluation.candidateCost,
                improvement: evaluation.improvement
            });
        }
        
        // Sort by cost (lowest first)
        evaluated.sort((a, b) => a.cost - b.cost);
        
        return evaluated;
    }

    /**
     * Select the best timing plan from evaluated candidates
     * @param {Array} evaluatedCandidates - Candidates with evaluation results
     * @param {Object} currentPlan - Current timing plan
     * @returns {Object} - Best timing plan with full evaluation
     */
    selectBestPlan(evaluatedCandidates, currentPlan) {
        if (evaluatedCandidates.length === 0) {
            return {
                plan: currentPlan,
                selected: false,
                reason: 'No candidates generated'
            };
        }
        
        // Best candidate is the one with minimum total cost
        const best = evaluatedCandidates[0];
        
        return {
            plan: best.plan,
            evaluation: best.evaluation,
            selected: true,
            reason: `Selected plan with minimum cost: ${best.cost.toFixed(2)} g CO₂`,
            candidatesEvaluated: evaluatedCandidates.length,
            improvement: best.improvement,
            description: best.plan.description || 'Optimized plan'
        };
    }

    /**
     * Deep copy an object
     * @param {Object} obj - Object to copy
     * @returns {Object} - Deep copy
     */
    deepCopy(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    /**
     * Get optimization history
     * @returns {Array} - History of optimizations
     */
    getHistory() {
        return this.optimizationHistory;
    }

    /**
     * Clear optimization history
     */
    clearHistory() {
        this.optimizationHistory = [];
    }

    /**
     * Update configuration
     * @param {Object} newConfig - New configuration parameters
     */
    updateConfig(newConfig) {
        if (newConfig.minGreenTime !== undefined) this.minGreenTime = newConfig.minGreenTime;
        if (newConfig.maxGreenTime !== undefined) this.maxGreenTime = newConfig.maxGreenTime;
        if (newConfig.greenTimeStep !== undefined) this.greenTimeStep = newConfig.greenTimeStep;
        if (newConfig.minCycleTime !== undefined) this.minCycleTime = newConfig.minCycleTime;
        if (newConfig.maxCycleTime !== undefined) this.maxCycleTime = newConfig.maxCycleTime;
        if (newConfig.yellowTime !== undefined) this.yellowTime = newConfig.yellowTime;
        if (newConfig.allRedTime !== undefined) this.allRedTime = newConfig.allRedTime;
        if (newConfig.maxCandidates !== undefined) this.maxCandidates = newConfig.maxCandidates;
        if (newConfig.phaseReorderThreshold !== undefined) this.phaseReorderThreshold = newConfig.phaseReorderThreshold;
        
        if (newConfig.energyCostConfig) {
            this.energyEvaluator.updateConfig(newConfig.energyCostConfig);
        }
    }

    /**
     * Generate optimization report
     * @param {Object} result - Result from optimize()
     * @returns {string} - Formatted report
     */
    generateReport(result) {
        const lines = [];
        lines.push('=== Signal Timing Optimization Report ===');
        lines.push(`Selected: ${result.selected ? 'Yes' : 'No'}`);
        lines.push(`Reason: ${result.reason}`);
        
        if (result.selected) {
            lines.push('');
            lines.push(`Description: ${result.description}`);
            lines.push(`Candidates Evaluated: ${result.candidatesEvaluated}`);
            lines.push(`Improvement: ${result.improvement.toFixed(2)} g CO₂`);
            
            if (result.plan.modifications && result.plan.modifications.length > 0) {
                lines.push('');
                lines.push('Modifications:');
                result.plan.modifications.forEach(mod => lines.push(`  - ${mod}`));
            }
            
            lines.push('');
            lines.push('Optimized Timing Plan:');
            lines.push(`  EW Green Time: ${result.plan.ewGreenTime || 'N/A'} seconds`);
            lines.push(`  NS Green Time: ${result.plan.nsGreenTime || 'N/A'} seconds`);
            lines.push(`  Cycle Time: ${result.plan.cycleTime || 'N/A'} seconds`);
            lines.push(`  Yellow Time: ${result.plan.yellowTime || 'N/A'} seconds`);
            lines.push(`  All-Red Time: ${result.plan.allRedTime || 'N/A'} seconds`);
        }
        
        return lines.join('\n');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OptimizeTiming;
}

// ES6 export
export { OptimizeTiming };
