/**
 * Evaluation Demo Module
 * 
 * Demonstrates the evaluation framework for academic analysis:
 * - Fixed-time baseline vs adaptive control
 * - Energy consumption comparison
 * - Metrics collection and export
 * - CSV/JSON data export for reporting
 */

import { World } from './world.js';
import { EvaluationFramework } from './evaluation.js';
import { MetricsCollector } from './metrics.js';
import { FixedTimeControllerFactory } from './fixedTimeController.js';

// Demo utilities
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function spawnVehiclesForEval(world, count) {
  let spawned = 0;
  for (let i = 0; i < count; i++) {
    world.spawnVehicleRandom({ force: true });
    spawned++;
  }
  return spawned;
}

function startSimulationLoop(world, metricsCollector = null) {
  let lastTime = performance.now();
  const intervalId = setInterval(() => {
    const now = performance.now();
    const dt = (now - lastTime) / 1000; // seconds
    const deltaMs = now - lastTime;
    lastTime = now;
    
    world.update(dt, deltaMs);
    
    // Update metrics collector every frame
    if (metricsCollector) {
      metricsCollector.update();
    }
    
    // Spawn new vehicles periodically
    if (Math.random() < 0.1) {
      world.spawnVehicleRandom();
    }
  }, 16); // ~60 FPS
  
  return intervalId;
}

// ========================================
// Demo 1: Metrics Collection
// ========================================

export async function demoMetricsCollection() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║   DEMO 1: Metrics Collection                           ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  // Create world
  const world = new World({
    gridSize: 2,
    roadLength: 200
  });

  world.start();
  console.log('✓ World created with 4 intersections');

  // Spawn vehicles
  const spawned = spawnVehiclesForEval(world, 20);
  console.log(`✓ Spawned ${spawned} vehicles\n`);

  // Create fixed-time controller
  const controller = FixedTimeControllerFactory.createBalanced(world);
  controller.start();
  console.log('✓ Fixed-time controller started\n');

  // Create metrics collector
  const metricsCollector = new MetricsCollector(world, {
    intervalDuration: 15000 // 15-second intervals
  });

  metricsCollector.start('FIXED_TIME', 'BALANCED');
  console.log('✓ Metrics collector started (15s intervals)\n');

  // Start simulation loop (pass metrics collector for continuous updates)
  const simLoop = startSimulationLoop(world, metricsCollector);

  // Collect for 60 seconds
  console.log('Collecting metrics for 60 seconds...\n');

  for (let i = 0; i < 4; i++) {
    await sleep(15000);
    
    const intervals = metricsCollector.getIntervals();
    const latest = intervals[intervals.length - 1];
    
    if (latest) {
      console.log(`[Interval ${latest.intervalId}]`);
      console.log(`  Vehicles: ${latest.vehicleCount}`);
      console.log(`  Avg Waiting: ${latest.avgWaitingTime.toFixed(2)}ms`);
      console.log(`  Avg Idle: ${latest.avgIdleTime.toFixed(2)}ms`);
      console.log(`  Energy: ${latest.totalEnergyConsumption.toFixed(4)} kWh`);
      console.log(`  Fuel: ${latest.totalFuelConsumption.toFixed(4)} L\n`);
    }
  }

  // Stop collection
  clearInterval(simLoop);
  metricsCollector.stop();
  controller.stop();

  // Print summary
  const summary = metricsCollector.getSummary();
  console.log('═══ Collection Summary ═══');
  console.log(`Total Intervals: ${summary.totalIntervals}`);
  console.log(`Avg Waiting Time: ${summary.avgWaitingTimePerVehicle?.toFixed(2) || 'N/A'}ms`);
  console.log(`Avg Idle Time: ${summary.avgIdleTimePerVehicle?.toFixed(2) || 'N/A'}ms`);
  console.log(`Total Energy: ${summary.totalEnergyConsumption?.toFixed(4) || 'N/A'} kWh`);
  console.log(`Total Fuel: ${summary.totalFuelConsumption?.toFixed(4) || 'N/A'} L`);

  // Cleanup
  world.destroy();

  console.log('\n✅ Demo 1 Complete\n');
  return { summary, intervals: metricsCollector.getIntervals() };
}

// ========================================
// Demo 2: Fixed vs Adaptive Comparison
// ========================================

export async function demoFixedVsAdaptive() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║   DEMO 2: Fixed-Time vs Adaptive Control              ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  // Create evaluation framework
  const framework = new EvaluationFramework({
    defaultDuration: 90000, // 90 seconds per run
    intervalDuration: 20000, // 20-second intervals
    warmupTime: 10000 // 10-second warmup
  });

  // Create world
  const world = new World({
    gridSize: 2,
    roadLength: 200
  });

  world.start();
  console.log('✓ World created\n');

  // Run comparison
  const results = await framework.runComparison(world, ['fixed', 'adaptive']);

  // Export results
  console.log('\n═══ Exporting Results ═══');
  
  const jsonData = framework.exportToJSON();
  console.log('JSON export ready');
  console.log(`  Runs: ${jsonData.runs.length}`);
  console.log(`  Comparison data: ${jsonData.comparison ? 'Yes' : 'No'}`);

  const csvData = framework.exportToCSV();
  console.log('\nCSV export ready');
  console.log(`  Rows: ${csvData.split('\n').length}`);

  // Cleanup
  world.destroy();

  console.log('\n✅ Demo 2 Complete\n');
  return { results, jsonData, csvData };
}

// ========================================
// Demo 3: Energy-Aware Evaluation
// ========================================

export async function demoEnergyAware() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║   DEMO 3: Energy-Aware Optimization                    ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  const framework = new EvaluationFramework({
    defaultDuration: 90000,
    intervalDuration: 20000,
    warmupTime: 10000
  });

  const world = new World({
    gridSize: 2,
    roadLength: 200
  });

  world.start();
  console.log('✓ World created\n');

  // Run all three strategies
  const results = await framework.runComparison(world, ['fixed', 'adaptive', 'energy']);

  // Detailed comparison
  console.log('\n═══ Energy Analysis ═══\n');
  
  results.forEach(result => {
    const s = result.summary;
    console.log(`${result.controllerStrategy}:`);
    console.log(`  Total Energy: ${s.totalEnergyConsumption?.toFixed(4) || 'N/A'} kWh`);
    console.log(`  Total Fuel: ${s.totalFuelConsumption?.toFixed(4) || 'N/A'} L`);
    console.log(`  Avg Energy/Interval: ${s.avgEnergyPerInterval?.toFixed(4) || 'N/A'} kWh`);
    console.log(`  Avg Waiting Time: ${s.avgWaitingTimePerVehicle?.toFixed(2) || 'N/A'}ms`);
    console.log(`  Avg Idle Time: ${s.avgIdleTimePerVehicle?.toFixed(2) || 'N/A'}ms\n`);
  });

  // Export detailed data
  console.log('═══ Exporting Detailed Data ═══');
  const detailedCSV = framework.exportDetailedCSV();
  console.log(`Detailed CSV: ${detailedCSV.split('\n').length} rows`);

  // Cleanup
  world.destroy();

  console.log('\n✅ Demo 3 Complete\n');
  return results;
}

// ========================================
// Demo 4: Data Export Demonstration
// ========================================

export async function demoDataExport() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║   DEMO 4: Data Export (CSV/JSON)                       ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  const world = new World({
    gridSize: 2,
    roadLength: 200
  });

  world.start();

  // Spawn vehicles
  const spawned = spawnVehiclesForEval(world, 30);
  console.log(`✓ World setup complete with ${spawned} vehicles\n`);

  // Create and run metrics collector
  const metricsCollector = new MetricsCollector(world, {
    intervalDuration: 15000
  });

  const controller = FixedTimeControllerFactory.createBalanced(world);
  
  metricsCollector.start('FIXED_TIME', 'DEMO');
  controller.start();

  // Start simulation loop
  const simLoop = startSimulationLoop(world, metricsCollector);

  console.log('Running 45-second collection...\n');

  for (let i = 0; i < 3; i++) {
    await sleep(15000);
  }

  clearInterval(simLoop);
  metricsCollector.stop();
  controller.stop();

  // Export demonstrations
  console.log('═══ Export Formats ═══\n');

  // JSON export
  const jsonExport = metricsCollector.exportToJSON();
  console.log('1. JSON Export:');
  console.log(`   Metadata: ${Object.keys(jsonExport.metadata).length} fields`);
  console.log(`   Summary: ${Object.keys(jsonExport.summary).length} metrics`);
  console.log(`   Intervals: ${jsonExport.intervals.length} records`);
  console.log(`   Sample JSON structure:`);
  console.log(JSON.stringify(jsonExport.intervals[0], null, 2).split('\n').slice(0, 10).join('\n'));
  console.log('   ...\n');

  // CSV export
  const csvExport = metricsCollector.exportToCSV();
  console.log('2. CSV Export:');
  console.log(`   Total rows: ${csvExport.split('\n').length}`);
  console.log(`   Columns: ${csvExport.split('\n')[0].split(',').length}`);
  console.log('   Sample CSV (first 5 rows):');
  console.log(csvExport.split('\n').slice(0, 5).join('\n'));
  console.log('   ...\n');

  // Show download instructions
  console.log('═══ Download Instructions ═══\n');
  console.log('To download exports, use:');
  console.log('  metricsCollector.downloadJSON("my_metrics.json")');
  console.log('  metricsCollector.downloadCSV("my_metrics.csv")');
  console.log('\nOr for evaluation framework:');
  console.log('  framework.downloadJSON("evaluation_results.json")');
  console.log('  framework.downloadCSV("evaluation_summary.csv")');
  console.log('  framework.downloadDetailedCSV("evaluation_detailed.csv")');

  // Cleanup
  world.destroy();

  console.log('\n✅ Demo 4 Complete\n');
  return { jsonExport, csvExport };
}

// ========================================
// Demo 5: Full Academic Evaluation
// ========================================

export async function demoFullEvaluation() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║   DEMO 5: Full Academic Evaluation                     ║');
  console.log('║   Fixed-Time → Adaptive → Energy-Aware                 ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  const framework = new EvaluationFramework({
    defaultDuration: 120000, // 2 minutes per strategy
    intervalDuration: 30000, // 30-second intervals
    warmupTime: 15000 // 15-second warmup
  });

  const world = new World({
    gridSize: 3,
    roadLength: 200
  });

  world.start();
  console.log(`✓ World created with ${world.junctions.size} intersections\n`);

  // Run full comparison
  console.log('Starting comprehensive evaluation...\n');
  const results = await framework.runComparison(world, ['fixed', 'adaptive', 'energy']);

  // Generate academic report
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║   ACADEMIC EVALUATION REPORT                           ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  console.log('METHODOLOGY');
  console.log('-----------');
  console.log(`Simulation Duration: ${framework.config.defaultDuration / 1000}s per strategy`);
  console.log(`Measurement Interval: ${framework.config.intervalDuration / 1000}s`);
  console.log(`Network Size: ${world.junctions.size} intersections`);
  console.log(`Warmup Period: ${framework.config.warmupTime / 1000}s`);
  console.log();

  console.log('RESULTS SUMMARY');
  console.log('---------------');
  results.forEach((result, index) => {
    const s = result.summary;
    console.log(`\n${index + 1}. ${result.controllerStrategy}`);
    console.log(`   Avg Waiting Time: ${s.avgWaitingTimePerVehicle?.toFixed(2) || 'N/A'} ms`);
    console.log(`   Avg Idle Time: ${s.avgIdleTimePerVehicle?.toFixed(2) || 'N/A'} ms`);
    console.log(`   Total Energy: ${s.totalEnergyConsumption?.toFixed(4) || 'N/A'} kWh`);
    console.log(`   Total Fuel: ${s.totalFuelConsumption?.toFixed(4) || 'N/A'} L`);
    console.log(`   Avg Stops/Vehicle: ${s.avgStopsPerVehicle?.toFixed(2) || 'N/A'}`);
  });

  console.log('\n\nKEY FINDINGS');
  console.log('------------');
  
  const baseline = results[0].summary;
  results.slice(1).forEach(result => {
    const s = result.summary;
    console.log(`\n${result.controllerStrategy} vs Fixed-Time:`);
    
    const waitReduction = baseline.avgWaitingTimePerVehicle 
      ? ((baseline.avgWaitingTimePerVehicle - s.avgWaitingTimePerVehicle) / baseline.avgWaitingTimePerVehicle * 100)
      : 0;
    console.log(`  • Waiting time: ${waitReduction.toFixed(1)}% ${waitReduction > 0 ? 'reduction' : 'increase'}`);
    
    const idleReduction = baseline.avgIdleTimePerVehicle
      ? ((baseline.avgIdleTimePerVehicle - s.avgIdleTimePerVehicle) / baseline.avgIdleTimePerVehicle * 100)
      : 0;
    console.log(`  • Idle time: ${idleReduction.toFixed(1)}% ${idleReduction > 0 ? 'reduction' : 'increase'}`);
    
    const energyReduction = baseline.totalEnergyConsumption
      ? ((baseline.totalEnergyConsumption - s.totalEnergyConsumption) / baseline.totalEnergyConsumption * 100)
      : 0;
    console.log(`  • Energy consumption: ${energyReduction.toFixed(1)}% ${energyReduction > 0 ? 'reduction' : 'increase'}`);
  });

  console.log('\n\nDATA EXPORT');
  console.log('-----------');
  console.log('Ready for export:');
  console.log('  • Summary CSV: framework.downloadCSV()');
  console.log('  • Detailed CSV: framework.downloadDetailedCSV()');
  console.log('  • Full JSON: framework.downloadJSON()');

  // Show sample data structure
  console.log('\nSample interval data structure:');
  const sampleInterval = results[0].intervals[0];
  if (sampleInterval) {
    console.log(JSON.stringify(sampleInterval, null, 2).split('\n').slice(0, 15).join('\n'));
    console.log('  ...');
  }

  // Cleanup
  world.destroy();

  console.log('\n✅ Demo 5 Complete\n');
  console.log('══════════════════════════════════════════════════════════');
  console.log('Full evaluation data ready for academic reporting');
  console.log('Use framework.downloadJSON/CSV() to export results');
  console.log('══════════════════════════════════════════════════════════\n');

  return { framework, results };
}

// ========================================
// Run All Evaluation Demos
// ========================================

export async function runAllEvaluationDemos() {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   EVALUATION & MONITORING DEMO SUITE                     ║');
  console.log('║   Academic Evaluation with Metrics & Export              ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  const results = {};

  try {
    results.demo1 = await demoMetricsCollection();
    results.demo2 = await demoFixedVsAdaptive();
    results.demo3 = await demoEnergyAware();
    results.demo4 = await demoDataExport();
    results.demo5 = await demoFullEvaluation();

    console.log('\n');
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║   ALL EVALUATION DEMOS COMPLETED                         ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('\n');

    return results;
  } catch (error) {
    console.error('❌ Demo suite failed:', error);
    throw error;
  }
}

// Auto-expose to window for browser console
if (typeof window !== 'undefined') {
  console.log('Evaluation Demo Module Loaded');
  console.log('Available demos:');
  console.log('  - demoMetricsCollection()');
  console.log('  - demoFixedVsAdaptive()');
  console.log('  - demoEnergyAware()');
  console.log('  - demoDataExport()');
  console.log('  - demoFullEvaluation()');
  console.log('  - runAllEvaluationDemos()');

  window.evaluationDemos = {
    metrics: demoMetricsCollection,
    fixedVsAdaptive: demoFixedVsAdaptive,
    energyAware: demoEnergyAware,
    dataExport: demoDataExport,
    fullEval: demoFullEvaluation,
    runAll: runAllEvaluationDemos
  };
}
