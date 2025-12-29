/**
 * Evaluation Framework
 * 
 * Compares different control strategies for academic evaluation:
 * - Fixed-time baseline
 * - Adaptive control strategies
 * - Energy-aware optimization
 * 
 * Exports results as CSV/JSON for analysis and reporting.
 */

import { MetricsCollector } from './metrics.js';
import { FixedTimeSignalController, FixedTimeControllerFactory } from './fixedTimeController.js';

/**
 * Evaluation Run
 * Single experimental run with one control strategy
 */
export class EvaluationRun {
  constructor(config) {
    this.config = config;
    this.id = config.id || `run_${Date.now()}`;
    this.name = config.name || 'Unnamed Run';
    this.controllerType = config.controllerType || 'UNKNOWN';
    this.controllerStrategy = config.controllerStrategy || 'UNKNOWN';
    this.duration = config.duration || 300000; // 5 minutes default
    
    // Results
    this.metricsCollector = null;
    this.startTime = null;
    this.endTime = null;
    this.completed = false;
    this.summary = null;
  }

  async execute(world, controller, metricsConfig = {}) {
    console.log(`\n╔═══════════════════════════════════════════════════════╗`);
    console.log(`║  Evaluation Run: ${this.name.padEnd(36)}  ║`);
    console.log(`╚═══════════════════════════════════════════════════════╝`);
    console.log(`Controller: ${this.controllerType} (${this.controllerStrategy})`);
    console.log(`Duration: ${this.duration / 1000}s\n`);

    this.startTime = Date.now();

    // Create metrics collector
    this.metricsCollector = new MetricsCollector(world, {
      intervalDuration: 30000, // 30-second intervals
      ...metricsConfig
    });

    // Start metrics collection
    this.metricsCollector.start(this.controllerType, this.controllerStrategy);

    // Start controller
    controller.start();
    console.log('Controller started\n');

    // Run simulation
    const startRealTime = Date.now();
    console.log('Running simulation...');

    // Start simulation loop
    let lastTime = performance.now();
    const simLoop = setInterval(() => {
      const now = performance.now();
      const dt = (now - lastTime) / 1000;
      const deltaMs = now - lastTime;
      lastTime = now;
      
      world.update(dt, deltaMs);
      
      // Spawn new vehicles periodically
      if (Math.random() < 0.05) {
        world.spawnVehicleRandom();
      }
    }, 16); // ~60 FPS

    // Update metrics periodically
    const updateInterval = setInterval(() => {
      this.metricsCollector.update();
    }, 100); // Update every 100ms

    // Wait for duration
    await new Promise(resolve => setTimeout(resolve, this.duration));

    // Stop simulation and cleanup
    clearInterval(simLoop);
    clearInterval(updateInterval);
    controller.stop();
    this.metricsCollector.stop();

    this.endTime = Date.now();
    this.completed = true;
    this.summary = this.metricsCollector.getSummary();

    const realTime = (Date.now() - startRealTime) / 1000;
    console.log(`\nRun completed in ${realTime.toFixed(1)}s\n`);
    
    this.printSummary();

    return this.summary;
  }

  printSummary() {
    if (!this.summary) {
      console.log('No summary available');
      return;
    }

    console.log('═══ Run Summary ═══');
    console.log(`Controller: ${this.summary.controllerType} (${this.summary.controllerStrategy})`);
    console.log(`Total Intervals: ${this.summary.totalIntervals}`);
    console.log(`Avg Vehicles/Interval: ${this.summary.avgVehiclesPerInterval?.toFixed(1) || 'N/A'}`);
    console.log(`Avg Waiting Time: ${this.summary.avgWaitingTimePerVehicle?.toFixed(2) || 'N/A'}ms`);
    console.log(`Avg Idle Time: ${this.summary.avgIdleTimePerVehicle?.toFixed(2) || 'N/A'}ms`);
    console.log(`Total Energy: ${this.summary.totalEnergyConsumption?.toFixed(4) || 'N/A'} kWh`);
    console.log(`Total Fuel: ${this.summary.totalFuelConsumption?.toFixed(4) || 'N/A'} L`);
    console.log(`Avg Energy/Interval: ${this.summary.avgEnergyPerInterval?.toFixed(4) || 'N/A'} kWh`);
  }

  getResults() {
    return {
      id: this.id,
      name: this.name,
      controllerType: this.controllerType,
      controllerStrategy: this.controllerStrategy,
      duration: this.duration,
      startTime: this.startTime,
      endTime: this.endTime,
      completed: this.completed,
      summary: this.summary,
      intervals: this.metricsCollector?.getIntervals() || []
    };
  }
}

/**
 * Evaluation Framework
 * Manages multiple evaluation runs and comparisons
 */
export class EvaluationFramework {
  constructor(config = {}) {
    this.config = {
      defaultDuration: config.defaultDuration || 300000, // 5 minutes
      intervalDuration: config.intervalDuration || 30000, // 30 seconds
      warmupTime: config.warmupTime || 30000, // 30 seconds warmup
      ...config
    };

    this.runs = [];
    this.currentRun = null;
  }

  /**
   * Run fixed-time baseline evaluation
   */
  async runFixedTimeBaseline(world, config = {}) {
    const runConfig = {
      id: 'fixed_baseline',
      name: 'Fixed-Time Baseline',
      controllerType: 'FIXED_TIME',
      controllerStrategy: 'BALANCED',
      duration: config.duration || this.config.defaultDuration
    };

    const run = new EvaluationRun(runConfig);
    
    // Create fixed-time controller
    const controller = FixedTimeControllerFactory.createBalanced(world);

    // Execute run
    await run.execute(world, controller, {
      intervalDuration: this.config.intervalDuration
    });

    this.runs.push(run);
    return run.getResults();
  }

  /**
   * Run adaptive control evaluation
   */
  async runAdaptiveControl(world, optimizationEngine, config = {}) {
    const runConfig = {
      id: 'adaptive_control',
      name: 'Adaptive Control',
      controllerType: 'ADAPTIVE',
      controllerStrategy: config.strategy || 'ADAPTIVE',
      duration: config.duration || this.config.defaultDuration
    };

    const run = new EvaluationRun(runConfig);

    // Use optimization engine as controller
    const controller = {
      start: () => {
        if (world.trafficAnalyzer) {
          world.trafficAnalyzer.start();
        }
        optimizationEngine.start();
      },
      stop: () => {
        optimizationEngine.stop();
        if (world.trafficAnalyzer) {
          world.trafficAnalyzer.stop();
        }
      }
    };

    // Execute run
    await run.execute(world, controller, {
      intervalDuration: this.config.intervalDuration
    });

    this.runs.push(run);
    return run.getResults();
  }

  /**
   * Run energy-aware evaluation
   */
  async runEnergyAware(world, optimizationEngine, config = {}) {
    // Configure optimization for energy awareness
    if (optimizationEngine.setStrategy) {
      optimizationEngine.setStrategy('ENERGY_AWARE');
    }

    const runConfig = {
      id: 'energy_aware',
      name: 'Energy-Aware Control',
      controllerType: 'ADAPTIVE',
      controllerStrategy: 'ENERGY_AWARE',
      duration: config.duration || this.config.defaultDuration
    };

    const run = new EvaluationRun(runConfig);

    const controller = {
      start: () => {
        if (world.trafficAnalyzer) {
          world.trafficAnalyzer.start();
        }
        optimizationEngine.start();
      },
      stop: () => {
        optimizationEngine.stop();
        if (world.trafficAnalyzer) {
          world.trafficAnalyzer.stop();
        }
      }
    };

    await run.execute(world, controller, {
      intervalDuration: this.config.intervalDuration
    });

    this.runs.push(run);
    return run.getResults();
  }

  /**
   * Run comparison between multiple strategies
   */
  async runComparison(world, strategies = ['fixed', 'adaptive', 'energy']) {
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║   EVALUATION COMPARISON                                  ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    const results = [];

    for (const strategy of strategies) {
      // Reset world for each run
      // Clear vehicles
      for (const vehicle of world.vehicles) {
        world.removeVehicle(vehicle);
      }

      // Spawn fresh vehicles
      this.spawnVehiclesForEvaluation(world, 30);

      // Wait for warmup
      console.log(`Warming up (${this.config.warmupTime / 1000}s)...`);
      await new Promise(resolve => setTimeout(resolve, this.config.warmupTime));

      // Run strategy
      let result;
      if (strategy === 'fixed') {
        result = await this.runFixedTimeBaseline(world);
      } else if (strategy === 'adaptive') {
        const optimizationEngine = world.getOptimizationEngine('ADAPTIVE');
        result = await this.runAdaptiveControl(world, optimizationEngine);
      } else if (strategy === 'energy') {
        const optimizationEngine = world.getOptimizationEngine('ENERGY_AWARE');
        result = await this.runEnergyAware(world, optimizationEngine);
      }

      results.push(result);

      // Brief pause between runs
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // Print comparison
    this.printComparison(results);

    return results;
  }

  /**
   * Print comparison table
   */
  printComparison(results) {
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║   COMPARISON RESULTS                                     ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    console.log('Strategy              | Avg Wait (ms) | Avg Idle (ms) | Energy (kWh) | Fuel (L)  | Avg E/Int (kWh)');
    console.log('----------------------|---------------|---------------|--------------|-----------|----------------');

    results.forEach(result => {
      const s = result.summary;
      const name = `${result.controllerStrategy}`.padEnd(21);
      const avgWait = s.avgWaitingTimePerVehicle?.toFixed(2).padStart(13) || 'N/A'.padStart(13);
      const avgIdle = s.avgIdleTimePerVehicle?.toFixed(2).padStart(13) || 'N/A'.padStart(13);
      const energy = s.totalEnergyConsumption?.toFixed(4).padStart(12) || 'N/A'.padStart(12);
      const fuel = s.totalFuelConsumption?.toFixed(4).padStart(9) || 'N/A'.padStart(9);
      const avgEInt = s.avgEnergyPerInterval?.toFixed(4).padStart(14) || 'N/A'.padStart(14);

      console.log(`${name} | ${avgWait} | ${avgIdle} | ${energy} | ${fuel} | ${avgEInt}`);
    });

    // Calculate improvements
    if (results.length > 1) {
      const baseline = results[0].summary;
      console.log('\n═══ Improvements vs Baseline ═══\n');

      results.slice(1).forEach(result => {
        const s = result.summary;
        const waitImprovement = baseline.avgWaitingTimePerVehicle 
          ? ((baseline.avgWaitingTimePerVehicle - s.avgWaitingTimePerVehicle) / baseline.avgWaitingTimePerVehicle * 100)
          : 0;
        const idleImprovement = baseline.avgIdleTimePerVehicle
          ? ((baseline.avgIdleTimePerVehicle - s.avgIdleTimePerVehicle) / baseline.avgIdleTimePerVehicle * 100)
          : 0;
        const energyImprovement = baseline.totalEnergyConsumption
          ? ((baseline.totalEnergyConsumption - s.totalEnergyConsumption) / baseline.totalEnergyConsumption * 100)
          : 0;

        console.log(`${result.controllerStrategy}:`);
        console.log(`  Waiting Time: ${waitImprovement > 0 ? '-' : '+'}${Math.abs(waitImprovement).toFixed(1)}%`);
        console.log(`  Idle Time: ${idleImprovement > 0 ? '-' : '+'}${Math.abs(idleImprovement).toFixed(1)}%`);
        console.log(`  Energy: ${energyImprovement > 0 ? '-' : '+'}${Math.abs(energyImprovement).toFixed(1)}%`);
      });
    }
  }

  /**
   * Spawn vehicles for evaluation
   */
  spawnVehiclesForEvaluation(world, count) {
    let spawned = 0;

    for (let i = 0; i < count; i++) {
      try {
        world.spawnVehicleRandom({ force: true });
        spawned++;
      } catch (e) {
        // Failed to spawn, continue
      }
    }

    console.log(`Spawned ${spawned} vehicles for evaluation`);
    return spawned;
  }

  /**
   * Get all run results
   */
  getAllResults() {
    return this.runs.map(run => run.getResults());
  }

  /**
   * Export all results to JSON
   */
  exportToJSON() {
    return {
      metadata: {
        framework: 'Traffic Signal Evaluation',
        evaluationDate: new Date().toISOString(),
        defaultDuration: this.config.defaultDuration,
        intervalDuration: this.config.intervalDuration,
        totalRuns: this.runs.length
      },
      runs: this.runs.map(run => run.getResults()),
      comparison: this.generateComparisonData()
    };
  }

  /**
   * Export all results to CSV
   */
  exportToCSV() {
    const rows = [];
    
    // Header
    rows.push([
      'runId',
      'runName',
      'controllerType',
      'controllerStrategy',
      'avgWaitingTime',
      'avgIdleTime',
      'totalEnergy',
      'totalFuel',
      'avgEnergyPerInterval',
      'totalVehicles',
      'totalIntervals'
    ].join(','));

    // Data rows
    this.runs.forEach(run => {
      const result = run.getResults();
      const s = result.summary;
      
      rows.push([
        result.id,
        result.name,
        result.controllerType,
        result.controllerStrategy,
        s.avgWaitingTimePerVehicle?.toFixed(2) || 'N/A',
        s.avgIdleTimePerVehicle?.toFixed(2) || 'N/A',
        s.totalEnergyConsumption?.toFixed(4) || 'N/A',
        s.totalFuelConsumption?.toFixed(4) || 'N/A',
        s.avgEnergyPerInterval?.toFixed(4) || 'N/A',
        s.avgVehiclesPerInterval?.toFixed(1) || 'N/A',
        s.totalIntervals || 0
      ].join(','));
    });

    return rows.join('\n');
  }

  /**
   * Export detailed interval data to CSV
   */
  exportDetailedCSV() {
    const rows = [];
    
    // Header
    rows.push([
      'runId',
      'controllerType',
      'controllerStrategy',
      'intervalId',
      'avgWaitingTime',
      'avgIdleTime',
      'totalEnergy',
      'vehicleCount',
      'congestion'
    ].join(','));

    // Data rows
    this.runs.forEach(run => {
      const result = run.getResults();
      result.intervals.forEach(interval => {
        rows.push([
          result.id,
          result.controllerType,
          result.controllerStrategy,
          interval.intervalId,
          interval.avgWaitingTime.toFixed(2),
          interval.avgIdleTime.toFixed(2),
          interval.totalEnergyConsumption.toFixed(4),
          interval.vehicleCount,
          interval.congestionLevel
        ].join(','));
      });
    });

    return rows.join('\n');
  }

  /**
   * Generate comparison data structure
   */
  generateComparisonData() {
    if (this.runs.length === 0) {
      return null;
    }

    const baseline = this.runs[0].getResults().summary;
    const comparisons = [];

    this.runs.slice(1).forEach(run => {
      const result = run.getResults();
      const s = result.summary;

      comparisons.push({
        strategy: result.controllerStrategy,
        waitingTimeChange: baseline.avgWaitingTimePerVehicle 
          ? ((s.avgWaitingTimePerVehicle - baseline.avgWaitingTimePerVehicle) / baseline.avgWaitingTimePerVehicle * 100)
          : 0,
        idleTimeChange: baseline.avgIdleTimePerVehicle
          ? ((s.avgIdleTimePerVehicle - baseline.avgIdleTimePerVehicle) / baseline.avgIdleTimePerVehicle * 100)
          : 0,
        energyChange: baseline.totalEnergyConsumption
          ? ((s.totalEnergyConsumption - baseline.totalEnergyConsumption) / baseline.totalEnergyConsumption * 100)
          : 0
      });
    });

    return {
      baseline: this.runs[0].getResults().controllerStrategy,
      comparisons: comparisons
    };
  }

  /**
   * Download JSON file
   */
  downloadJSON(filename = 'evaluation_results.json') {
    const data = this.exportToJSON();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    console.log(`Downloaded: ${filename}`);
  }

  /**
   * Download CSV file
   */
  downloadCSV(filename = 'evaluation_summary.csv') {
    const csv = this.exportToCSV();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    console.log(`Downloaded: ${filename}`);
  }

  /**
   * Download detailed CSV file
   */
  downloadDetailedCSV(filename = 'evaluation_detailed.csv') {
    const csv = this.exportDetailedCSV();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    console.log(`Downloaded: ${filename}`);
  }
}

// Auto-expose to window for browser console
if (typeof window !== 'undefined') {
  window.EvaluationFramework = EvaluationFramework;
  window.EvaluationRun = EvaluationRun;
}
