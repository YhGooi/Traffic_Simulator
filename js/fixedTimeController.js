/**
 * Fixed-Time Signal Controller
 * 
 * Baseline controller for comparison with adaptive strategies.
 * Uses predetermined fixed timing cycles regardless of traffic conditions.
 * 
 * This serves as the control group for academic evaluation.
 */

/**
 * Fixed-Time Signal Controller
 * Simple controller with fixed green/yellow/red phases
 */
export class FixedTimeSignalController {
  constructor(config = {}) {
    this.config = {
      cycleLength: config.cycleLength || 120, // Total cycle length in seconds
      greenSplit: config.greenSplit || [0.4, 0.4, 0.1, 0.1], // % of cycle for each phase
      yellowDuration: config.yellowDuration || 3, // seconds
      allRedDuration: config.allRedDuration || 2, // seconds for safety
      minGreenTime: config.minGreenTime || 10, // minimum green per phase
      ...config
    };

    // State
    this.junctionTimings = new Map(); // junctionId -> timing config
    this.isRunning = false;
    this.world = null;
    this.updateTimer = null;
    this.cycleCount = 0;
    this.startTime = null;
  }

  /**
   * Initialize fixed timings for all junctions
   */
  initialize(world) {
    this.world = world;
    
    console.log('Initializing Fixed-Time Signal Controller...');
    console.log(`Cycle Length: ${this.config.cycleLength}s`);
    console.log(`Green Split: ${this.config.greenSplit.join(', ')}`);

    // Calculate fixed timings for each junction
    for (const [junctionId, junction] of world.junctions.entries()) {
      const timing = this.calculateFixedTiming(junction);
      this.junctionTimings.set(junctionId, timing);
      
      console.log(`Junction ${junctionId}: ${timing.phases.map(p => `${p.duration}s`).join(' / ')}`);
    }

    console.log(`Fixed timings initialized for ${this.junctionTimings.size} junctions`);
  }

  /**
   * Calculate fixed timing for a junction based on config
   */
  calculateFixedTiming(junction) {
    const phases = [];
    const numPhases = junction.signals?.length || 4;
    
    // Distribute cycle time according to green split
    const greenSplit = this.config.greenSplit.slice(0, numPhases);
    const totalSplit = greenSplit.reduce((a, b) => a + b, 0);
    
    // Normalize splits if needed
    const normalizedSplit = greenSplit.map(s => s / totalSplit);
    
    // Calculate phase durations
    const availableTime = this.config.cycleLength - 
                          (this.config.yellowDuration * numPhases) -
                          (this.config.allRedDuration * numPhases);

    normalizedSplit.forEach((split, index) => {
      const greenTime = Math.max(
        this.config.minGreenTime,
        availableTime * split
      );

      phases.push({
        index: index,
        greenDuration: greenTime,
        yellowDuration: this.config.yellowDuration,
        allRedDuration: this.config.allRedDuration,
        totalDuration: greenTime + this.config.yellowDuration + this.config.allRedDuration
      });
    });

    return {
      junctionId: junction.id,
      phases: phases,
      cycleLength: phases.reduce((sum, p) => sum + p.totalDuration, 0),
      currentPhaseIndex: 0,
      phaseStartTime: Date.now()
    };
  }

  /**
   * Start the fixed-time controller
   */
  start() {
    if (this.isRunning) {
      console.warn('FixedTimeSignalController already running');
      return;
    }

    if (!this.world) {
      throw new Error('Must initialize controller with world before starting');
    }

    this.isRunning = true;
    this.startTime = Date.now();
    this.cycleCount = 0;

    console.log('Fixed-Time Signal Controller started');

    // Apply initial timings
    this.applyCurrentTimings();

    // Update periodically (check every second)
    this.updateTimer = setInterval(() => {
      this.update();
    }, 1000);
  }

  /**
   * Stop the controller
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }

    this.isRunning = false;
    console.log(`Fixed-Time Signal Controller stopped after ${this.cycleCount} cycles`);
  }

  /**
   * Update controller state
   */
  update() {
    if (!this.isRunning) {
      return;
    }

    const now = Date.now();
    let cyclesCompleted = 0;

    // Check each junction for phase transitions
    for (const [junctionId, timing] of this.junctionTimings.entries()) {
      const currentPhase = timing.phases[timing.currentPhaseIndex];
      const elapsed = (now - timing.phaseStartTime) / 1000; // seconds

      // Check if phase should transition
      if (elapsed >= currentPhase.totalDuration) {
        // Move to next phase
        timing.currentPhaseIndex = (timing.currentPhaseIndex + 1) % timing.phases.length;
        timing.phaseStartTime = now;
        cyclesCompleted++;

        // Apply new timing
        this.applyJunctionTiming(junctionId, timing);
      }
    }

    if (cyclesCompleted > 0) {
      this.cycleCount += cyclesCompleted;
    }
  }

  /**
   * Apply current timings to all junctions
   */
  applyCurrentTimings() {
    for (const [junctionId, timing] of this.junctionTimings.entries()) {
      this.applyJunctionTiming(junctionId, timing);
    }
  }

  /**
   * Apply timing to a specific junction
   */
  applyJunctionTiming(junctionId, timing) {
    const junction = this.world.junctions.get(junctionId);
    if (!junction) {
      return;
    }

    const currentPhase = timing.phases[timing.currentPhaseIndex];
    
    // Create timing update for the junction
    const timingUpdate = {
      junctionId: junctionId,
      greenDuration: currentPhase.greenDuration,
      yellowDuration: currentPhase.yellowDuration,
      redDuration: currentPhase.allRedDuration,
      phaseIndex: timing.currentPhaseIndex
    };

    // Apply to signal controller if available
    if (junction.signalController) {
      try {
        junction.signalController.updateTimings(timingUpdate);
      } catch (e) {
        console.warn(`Failed to update junction ${junctionId}:`, e.message);
      }
    }
  }

  /**
   * Get controller metrics
   */
  getMetrics() {
    const runTime = this.startTime ? (Date.now() - this.startTime) / 1000 : 0;

    return {
      type: 'FIXED_TIME',
      strategy: 'FIXED',
      isRunning: this.isRunning,
      cycleCount: this.cycleCount,
      runTime: runTime,
      cyclesPerSecond: runTime > 0 ? this.cycleCount / runTime : 0,
      junctionCount: this.junctionTimings.size,
      averageCycleLength: this.config.cycleLength
    };
  }

  /**
   * Get status report
   */
  getStatus() {
    const metrics = this.getMetrics();
    const junctionStatus = [];

    for (const [junctionId, timing] of this.junctionTimings.entries()) {
      const currentPhase = timing.phases[timing.currentPhaseIndex];
      const elapsed = (Date.now() - timing.phaseStartTime) / 1000;
      const remaining = currentPhase.totalDuration - elapsed;

      junctionStatus.push({
        junctionId: junctionId,
        currentPhase: timing.currentPhaseIndex,
        phaseElapsed: elapsed.toFixed(1),
        phaseRemaining: Math.max(0, remaining).toFixed(1),
        cycleLength: timing.cycleLength
      });
    }

    return {
      ...metrics,
      junctions: junctionStatus
    };
  }
}

/**
 * Fixed-Time Controller Factory
 * Creates preset configurations for common scenarios
 */
export class FixedTimeControllerFactory {
  /**
   * Create a balanced fixed-time controller
   * Equal time for all phases
   */
  static createBalanced(world) {
    const controller = new FixedTimeSignalController({
      cycleLength: 120,
      greenSplit: [0.25, 0.25, 0.25, 0.25],
      yellowDuration: 3,
      allRedDuration: 2
    });
    
    controller.initialize(world);
    return controller;
  }

  /**
   * Create a main-road-priority controller
   * Favors main directions (NS/EW)
   */
  static createMainRoadPriority(world) {
    const controller = new FixedTimeSignalController({
      cycleLength: 120,
      greenSplit: [0.35, 0.35, 0.15, 0.15], // Favor first two phases
      yellowDuration: 3,
      allRedDuration: 2
    });
    
    controller.initialize(world);
    return controller;
  }

  /**
   * Create a short-cycle controller
   * Faster cycling for responsive feel
   */
  static createShortCycle(world) {
    const controller = new FixedTimeSignalController({
      cycleLength: 60,
      greenSplit: [0.25, 0.25, 0.25, 0.25],
      yellowDuration: 2,
      allRedDuration: 1,
      minGreenTime: 8
    });
    
    controller.initialize(world);
    return controller;
  }

  /**
   * Create a long-cycle controller
   * Slower cycling for high-volume roads
   */
  static createLongCycle(world) {
    const controller = new FixedTimeSignalController({
      cycleLength: 180,
      greenSplit: [0.3, 0.3, 0.2, 0.2],
      yellowDuration: 4,
      allRedDuration: 2,
      minGreenTime: 15
    });
    
    controller.initialize(world);
    return controller;
  }

  /**
   * Create a custom controller
   */
  static createCustom(world, config) {
    const controller = new FixedTimeSignalController(config);
    controller.initialize(world);
    return controller;
  }
}

// Auto-expose to window for browser console
if (typeof window !== 'undefined') {
  window.FixedTimeSignalController = FixedTimeSignalController;
  window.FixedTimeControllerFactory = FixedTimeControllerFactory;
}
