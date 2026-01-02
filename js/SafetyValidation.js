/**
 * SafetyValidation Module
 * Enforces safety and legal constraints on signal timing plans
 * Validates phase durations, clearance intervals, and cycle times
 * (Pedestrian phases excluded as per requirements)
 */

class SafetyValidation {
    constructor(config = {}) {
        // Phase duration constraints (seconds)
        this.minGreenTime = config.minGreenTime || 7;
        this.maxGreenTime = config.maxGreenTime || 90;
        
        // Yellow and clearance interval constraints (seconds)
        this.minYellowTime = config.minYellowTime || 3;
        this.maxYellowTime = config.maxYellowTime || 6;
        this.minAllRedTime = config.minAllRedTime || 1;
        this.maxAllRedTime = config.maxAllRedTime || 5;
        
        // Cycle time constraints (seconds)
        this.minCycleTime = config.minCycleTime || 30;
        this.maxCycleTime = config.maxCycleTime || 180;
        
        // Conflicting movement definitions
        // Movements that cannot have green simultaneously
        this.conflictingMovements = config.conflictingMovements || this._getDefaultConflicts();
        
        // Validation history
        this.validationHistory = [];
        
        // Strict mode: reject on first violation vs collect all violations
        this.strictMode = config.strictMode !== undefined ? config.strictMode : false;
    }

    /**
     * Main validation function
     * @param {Object} timingPlan - Optimized timing plan to validate
     * @returns {Object} - {valid: boolean, violations: Array, decision: string}
     */
    validate(timingPlan) {
        const violations = [];
        
        // Step 1: Validate minimum and maximum phase durations
        const phaseDurationCheck = this.validatePhaseDurations(timingPlan);
        if (!phaseDurationCheck.valid) {
            violations.push(...phaseDurationCheck.violations);
            if (this.strictMode) {
                return this._buildResult(false, violations, 'Reject timing plan - invalid phase durations');
            }
        }
        
        // Step 2: Check phase compatibility (no conflicting movements)
        const conflictCheck = this.checkPhaseCompatibility(timingPlan);
        if (!conflictCheck.valid) {
            violations.push(...conflictCheck.violations);
            if (this.strictMode) {
                return this._buildResult(false, violations, 'Reject timing plan - conflicting movements detected');
            }
        }
        
        // Step 3: Validate yellow and all-red clearance intervals
        const clearanceCheck = this.validateClearanceIntervals(timingPlan);
        if (!clearanceCheck.valid) {
            violations.push(...clearanceCheck.violations);
            if (this.strictMode) {
                return this._buildResult(false, violations, 'Reject timing plan - invalid clearance intervals');
            }
        }
        
        // Step 4: Validate total cycle time
        const cycleTimeCheck = this.validateCycleTime(timingPlan);
        if (!cycleTimeCheck.valid) {
            violations.push(...cycleTimeCheck.violations);
            if (this.strictMode) {
                return this._buildResult(false, violations, 'Reject timing plan - cycle time out of bounds');
            }
        }
        
        // Final decision
        const valid = violations.length === 0;
        const decision = valid 
            ? 'Approve timing plan - forward to deployment stage'
            : 'Reject timing plan - safety constraints violated';
        
        return this._buildResult(valid, violations, decision);
    }

    /**
     * Validate minimum and maximum phase durations
     * @param {Object} timingPlan - Timing plan
     * @returns {Object} - {valid: boolean, violations: Array}
     */
    validatePhaseDurations(timingPlan) {
        const violations = [];
        
        // Check EW green time
        const ewGreen = timingPlan.ewGreenTime;
        if (ewGreen !== undefined && ewGreen !== null) {
            if (ewGreen < this.minGreenTime) {
                violations.push({
                    type: 'PHASE_DURATION',
                    severity: 'ERROR',
                    message: `EW green time (${ewGreen}s) below minimum (${this.minGreenTime}s)`,
                    phase: 'EW',
                    value: ewGreen,
                    constraint: 'min',
                    limit: this.minGreenTime
                });
            }
            if (ewGreen > this.maxGreenTime) {
                violations.push({
                    type: 'PHASE_DURATION',
                    severity: 'ERROR',
                    message: `EW green time (${ewGreen}s) exceeds maximum (${this.maxGreenTime}s)`,
                    phase: 'EW',
                    value: ewGreen,
                    constraint: 'max',
                    limit: this.maxGreenTime
                });
            }
        }
        
        // Check NS green time
        const nsGreen = timingPlan.nsGreenTime;
        if (nsGreen !== undefined && nsGreen !== null) {
            if (nsGreen < this.minGreenTime) {
                violations.push({
                    type: 'PHASE_DURATION',
                    severity: 'ERROR',
                    message: `NS green time (${nsGreen}s) below minimum (${this.minGreenTime}s)`,
                    phase: 'NS',
                    value: nsGreen,
                    constraint: 'min',
                    limit: this.minGreenTime
                });
            }
            if (nsGreen > this.maxGreenTime) {
                violations.push({
                    type: 'PHASE_DURATION',
                    severity: 'ERROR',
                    message: `NS green time (${nsGreen}s) exceeds maximum (${this.maxGreenTime}s)`,
                    phase: 'NS',
                    value: nsGreen,
                    constraint: 'max',
                    limit: this.maxGreenTime
                });
            }
        }
        
        // Check additional phases if present
        if (timingPlan.phases && Array.isArray(timingPlan.phases)) {
            for (let i = 0; i < timingPlan.phases.length; i++) {
                const phase = timingPlan.phases[i];
                const greenTime = phase.greenTime || phase.duration;
                
                if (greenTime !== undefined && greenTime !== null) {
                    if (greenTime < this.minGreenTime) {
                        violations.push({
                            type: 'PHASE_DURATION',
                            severity: 'ERROR',
                            message: `Phase ${i + 1} green time (${greenTime}s) below minimum (${this.minGreenTime}s)`,
                            phase: phase.name || `Phase ${i + 1}`,
                            value: greenTime,
                            constraint: 'min',
                            limit: this.minGreenTime
                        });
                    }
                    if (greenTime > this.maxGreenTime) {
                        violations.push({
                            type: 'PHASE_DURATION',
                            severity: 'ERROR',
                            message: `Phase ${i + 1} green time (${greenTime}s) exceeds maximum (${this.maxGreenTime}s)`,
                            phase: phase.name || `Phase ${i + 1}`,
                            value: greenTime,
                            constraint: 'max',
                            limit: this.maxGreenTime
                        });
                    }
                }
            }
        }
        
        return {
            valid: violations.length === 0,
            violations: violations
        };
    }

    /**
     * Check phase compatibility - ensure no conflicting movements have green simultaneously
     * @param {Object} timingPlan - Timing plan
     * @returns {Object} - {valid: boolean, violations: Array}
     */
    checkPhaseCompatibility(timingPlan) {
        const violations = [];
        
        // For standard two-phase operation (EW and NS), they're mutually exclusive by design
        // So we only need to check if there are custom phases with potential conflicts
        
        if (timingPlan.phases && Array.isArray(timingPlan.phases)) {
            // Check each pair of concurrent phases
            for (let i = 0; i < timingPlan.phases.length; i++) {
                for (let j = i + 1; j < timingPlan.phases.length; j++) {
                    const phase1 = timingPlan.phases[i];
                    const phase2 = timingPlan.phases[j];
                    
                    // Check if phases overlap in time
                    if (this._phasesOverlap(phase1, phase2)) {
                        // Check if their movements conflict
                        const conflict = this._checkMovementConflict(phase1, phase2);
                        if (conflict) {
                            violations.push({
                                type: 'PHASE_CONFLICT',
                                severity: 'CRITICAL',
                                message: `Conflicting movements in phases "${phase1.name}" and "${phase2.name}"`,
                                phase1: phase1.name || `Phase ${i + 1}`,
                                phase2: phase2.name || `Phase ${j + 1}`,
                                movements1: phase1.movements || phase1.direction,
                                movements2: phase2.movements || phase2.direction
                            });
                        }
                    }
                }
            }
        }
        
        // Verify basic EW/NS separation (sanity check)
        // In a valid timing plan, EW and NS should never be green simultaneously
        if (timingPlan.simultaneousEWNS === true) {
            violations.push({
                type: 'PHASE_CONFLICT',
                severity: 'CRITICAL',
                message: 'EW and NS movements cannot be green simultaneously',
                phase1: 'EW',
                phase2: 'NS'
            });
        }
        
        return {
            valid: violations.length === 0,
            violations: violations
        };
    }

    /**
     * Validate yellow and all-red clearance intervals
     * @param {Object} timingPlan - Timing plan
     * @returns {Object} - {valid: boolean, violations: Array}
     */
    validateClearanceIntervals(timingPlan) {
        const violations = [];
        
        // Validate yellow time
        const yellowTime = timingPlan.yellowTime;
        if (yellowTime !== undefined && yellowTime !== null) {
            if (yellowTime < this.minYellowTime) {
                violations.push({
                    type: 'CLEARANCE_INTERVAL',
                    severity: 'ERROR',
                    message: `Yellow time (${yellowTime}s) below minimum (${this.minYellowTime}s)`,
                    interval: 'yellow',
                    value: yellowTime,
                    constraint: 'min',
                    limit: this.minYellowTime
                });
            }
            if (yellowTime > this.maxYellowTime) {
                violations.push({
                    type: 'CLEARANCE_INTERVAL',
                    severity: 'WARNING',
                    message: `Yellow time (${yellowTime}s) exceeds maximum (${this.maxYellowTime}s)`,
                    interval: 'yellow',
                    value: yellowTime,
                    constraint: 'max',
                    limit: this.maxYellowTime
                });
            }
        } else {
            violations.push({
                type: 'CLEARANCE_INTERVAL',
                severity: 'ERROR',
                message: 'Yellow time not specified',
                interval: 'yellow'
            });
        }
        
        // Validate all-red time
        const allRedTime = timingPlan.allRedTime;
        if (allRedTime !== undefined && allRedTime !== null) {
            if (allRedTime < this.minAllRedTime) {
                violations.push({
                    type: 'CLEARANCE_INTERVAL',
                    severity: 'ERROR',
                    message: `All-red time (${allRedTime}s) below minimum (${this.minAllRedTime}s)`,
                    interval: 'all-red',
                    value: allRedTime,
                    constraint: 'min',
                    limit: this.minAllRedTime
                });
            }
            if (allRedTime > this.maxAllRedTime) {
                violations.push({
                    type: 'CLEARANCE_INTERVAL',
                    severity: 'WARNING',
                    message: `All-red time (${allRedTime}s) exceeds maximum (${this.maxAllRedTime}s)`,
                    interval: 'all-red',
                    value: allRedTime,
                    constraint: 'max',
                    limit: this.maxAllRedTime
                });
            }
        } else {
            violations.push({
                type: 'CLEARANCE_INTERVAL',
                severity: 'ERROR',
                message: 'All-red time not specified',
                interval: 'all-red'
            });
        }
        
        return {
            valid: violations.length === 0,
            violations: violations
        };
    }

    /**
     * Validate total cycle time within configured bounds
     * @param {Object} timingPlan - Timing plan
     * @returns {Object} - {valid: boolean, violations: Array}
     */
    validateCycleTime(timingPlan) {
        const violations = [];
        
        let cycleTime = timingPlan.cycleTime;
        
        // If cycle time not explicitly provided, calculate it
        if (cycleTime === undefined || cycleTime === null) {
            cycleTime = this._calculateCycleTime(timingPlan);
        }
        
        if (cycleTime < this.minCycleTime) {
            violations.push({
                type: 'CYCLE_TIME',
                severity: 'ERROR',
                message: `Cycle time (${cycleTime}s) below minimum (${this.minCycleTime}s)`,
                value: cycleTime,
                constraint: 'min',
                limit: this.minCycleTime
            });
        }
        
        if (cycleTime > this.maxCycleTime) {
            violations.push({
                type: 'CYCLE_TIME',
                severity: 'ERROR',
                message: `Cycle time (${cycleTime}s) exceeds maximum (${this.maxCycleTime}s)`,
                value: cycleTime,
                constraint: 'max',
                limit: this.maxCycleTime
            });
        }
        
        // Verify cycle time consistency
        const calculatedCycle = this._calculateCycleTime(timingPlan);
        const tolerance = 1.0; // Allow 1 second tolerance
        
        if (Math.abs(cycleTime - calculatedCycle) > tolerance) {
            violations.push({
                type: 'CYCLE_TIME',
                severity: 'WARNING',
                message: `Cycle time inconsistency: declared (${cycleTime}s) vs calculated (${calculatedCycle.toFixed(1)}s)`,
                declaredValue: cycleTime,
                calculatedValue: calculatedCycle
            });
        }
        
        return {
            valid: violations.length === 0,
            violations: violations
        };
    }

    /**
     * Calculate cycle time from phase components
     * @param {Object} timingPlan - Timing plan
     * @returns {number} - Calculated cycle time in seconds
     */
    _calculateCycleTime(timingPlan) {
        const ewGreen = timingPlan.ewGreenTime || 0;
        const nsGreen = timingPlan.nsGreenTime || 0;
        const yellowTime = timingPlan.yellowTime || 0;
        const allRedTime = timingPlan.allRedTime || 0;
        
        // Standard cycle: EW green + yellow + all-red + NS green + yellow + all-red
        return ewGreen + yellowTime + allRedTime + nsGreen + yellowTime + allRedTime;
    }

    /**
     * Check if two phases overlap in time
     * @param {Object} phase1 - First phase
     * @param {Object} phase2 - Second phase
     * @returns {boolean} - True if phases overlap
     */
    _phasesOverlap(phase1, phase2) {
        // If no timing information, assume they don't overlap
        if (!phase1.startTime || !phase2.startTime) return false;
        
        const end1 = phase1.startTime + (phase1.duration || phase1.greenTime || 0);
        const end2 = phase2.startTime + (phase2.duration || phase2.greenTime || 0);
        
        // Check if intervals overlap
        return !(end1 <= phase2.startTime || end2 <= phase1.startTime);
    }

    /**
     * Check if two phases have conflicting movements
     * @param {Object} phase1 - First phase
     * @param {Object} phase2 - Second phase
     * @returns {boolean} - True if movements conflict
     */
    _checkMovementConflict(phase1, phase2) {
        const movements1 = this._getMovements(phase1);
        const movements2 = this._getMovements(phase2);
        
        // Check each movement pair for conflicts
        for (const m1 of movements1) {
            for (const m2 of movements2) {
                if (this._movementsConflict(m1, m2)) {
                    return true;
                }
            }
        }
        
        return false;
    }

    /**
     * Extract movements from a phase
     * @param {Object} phase - Phase object
     * @returns {Array} - Array of movement strings
     */
    _getMovements(phase) {
        if (phase.movements && Array.isArray(phase.movements)) {
            return phase.movements;
        }
        if (phase.direction) {
            return [phase.direction];
        }
        return [];
    }

    /**
     * Check if two movements conflict
     * @param {string} m1 - First movement
     * @param {string} m2 - Second movement
     * @returns {boolean} - True if conflicting
     */
    _movementsConflict(m1, m2) {
        // Check against defined conflicts
        for (const conflict of this.conflictingMovements) {
            if ((conflict[0] === m1 && conflict[1] === m2) ||
                (conflict[0] === m2 && conflict[1] === m1)) {
                return true;
            }
        }
        
        // Basic conflict rules: EW conflicts with NS
        if ((m1.includes('E') || m1.includes('W')) && 
            (m2.includes('N') || m2.includes('S'))) {
            return true;
        }
        if ((m1.includes('N') || m1.includes('S')) && 
            (m2.includes('E') || m2.includes('W'))) {
            return true;
        }
        
        return false;
    }

    /**
     * Get default conflicting movements
     * @returns {Array} - Array of conflicting movement pairs
     */
    _getDefaultConflicts() {
        return [
            ['EW', 'NS'],
            ['E', 'N'],
            ['E', 'S'],
            ['W', 'N'],
            ['W', 'S'],
            ['N', 'E'],
            ['N', 'W'],
            ['S', 'E'],
            ['S', 'W']
        ];
    }

    /**
     * Build validation result object
     * @param {boolean} valid - Whether plan is valid
     * @param {Array} violations - Array of violations
     * @param {string} decision - Decision message
     * @returns {Object} - Complete validation result
     */
    _buildResult(valid, violations, decision) {
        const result = {
            valid: valid,
            approved: valid,
            violations: violations,
            decision: decision,
            violationCount: violations.length,
            criticalViolations: violations.filter(v => v.severity === 'CRITICAL').length,
            errorViolations: violations.filter(v => v.severity === 'ERROR').length,
            warningViolations: violations.filter(v => v.severity === 'WARNING').length,
            timestamp: Date.now()
        };
        
        // Store in history
        this.validationHistory.push(result);
        
        return result;
    }

    /**
     * Get validation history
     * @returns {Array} - History of validations
     */
    getHistory() {
        return this.validationHistory;
    }

    /**
     * Clear validation history
     */
    clearHistory() {
        this.validationHistory = [];
    }

    /**
     * Update configuration
     * @param {Object} newConfig - New configuration parameters
     */
    updateConfig(newConfig) {
        if (newConfig.minGreenTime !== undefined) this.minGreenTime = newConfig.minGreenTime;
        if (newConfig.maxGreenTime !== undefined) this.maxGreenTime = newConfig.maxGreenTime;
        if (newConfig.minYellowTime !== undefined) this.minYellowTime = newConfig.minYellowTime;
        if (newConfig.maxYellowTime !== undefined) this.maxYellowTime = newConfig.maxYellowTime;
        if (newConfig.minAllRedTime !== undefined) this.minAllRedTime = newConfig.minAllRedTime;
        if (newConfig.maxAllRedTime !== undefined) this.maxAllRedTime = newConfig.maxAllRedTime;
        if (newConfig.minCycleTime !== undefined) this.minCycleTime = newConfig.minCycleTime;
        if (newConfig.maxCycleTime !== undefined) this.maxCycleTime = newConfig.maxCycleTime;
        if (newConfig.strictMode !== undefined) this.strictMode = newConfig.strictMode;
        if (newConfig.conflictingMovements) this.conflictingMovements = newConfig.conflictingMovements;
    }

    /**
     * Generate validation report
     * @param {Object} result - Result from validate()
     * @returns {string} - Formatted report
     */
    generateReport(result) {
        const lines = [];
        lines.push('=== Safety Validation Report ===');
        lines.push(`Decision: ${result.decision}`);
        lines.push(`Valid: ${result.valid ? 'Yes' : 'No'}`);
        lines.push(`Approved: ${result.approved ? 'Yes' : 'No'}`);
        lines.push('');
        
        lines.push(`Total Violations: ${result.violationCount}`);
        if (result.criticalViolations > 0) {
            lines.push(`  Critical: ${result.criticalViolations}`);
        }
        if (result.errorViolations > 0) {
            lines.push(`  Errors: ${result.errorViolations}`);
        }
        if (result.warningViolations > 0) {
            lines.push(`  Warnings: ${result.warningViolations}`);
        }
        
        if (result.violations.length > 0) {
            lines.push('');
            lines.push('Violation Details:');
            result.violations.forEach((v, i) => {
                lines.push(`  ${i + 1}. [${v.severity}] ${v.message}`);
                if (v.phase) lines.push(`     Phase: ${v.phase}`);
                if (v.value !== undefined) lines.push(`     Value: ${v.value}`);
                if (v.limit !== undefined) lines.push(`     Limit: ${v.limit}`);
            });
        }
        
        return lines.join('\n');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SafetyValidation;
}

// ES6 export
export { SafetyValidation };
