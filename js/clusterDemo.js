/**
 * Cluster Scalability Demo Module
 * 
 * Demonstrates architectural scalability with multiple intersections.
 * Tests: 1, 5, 10 intersections with local sensing, local analytics,
 * and coordinated optimization.
 * 
 * Each demo shows:
 * - Per-intersection local sensing
 * - Per-intersection local analytics
 * - Cluster-wide coordination
 * - Performance metrics
 */

import { World } from './world.js';
import { ClusterManager, createClusterManager } from './clusterManager.js';

// Demo utilities
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function spawnVehiclesForWorld(world, count) {
  const roads = Array.from(world.roads.values());
  let spawned = 0;

  for (let i = 0; i < count && spawned < count; i++) {
    const road = roads[Math.floor(Math.random() * roads.length)];
    try {
      world.spawnVehicle(road);
      spawned++;
    } catch (e) {
      // Road full, continue
    }
  }

  return spawned;
}

// ========================================
// Demo 1: Single Intersection (Baseline)
// ========================================

export async function demoSingleIntersection() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║   DEMO 1: Single Intersection (Baseline)              ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  // Create 1×1 grid (single intersection)
  const world = new World({
    gridSize: 1,
    roadLength: 200
  });

  world.start();
  console.log('✓ World created with 1 intersection');

  // Spawn vehicles
  const spawned = spawnVehiclesForWorld(world, 10);
  console.log(`✓ Spawned ${spawned} vehicles`);

  // Create cluster manager
  const clusterManager = createClusterManager(world, {
    sensingInterval: 1000,
    analyticsInterval: 1000,
    optimizationInterval: 5000,
    optimizationStrategy: 'ADAPTIVE'
  });

  console.log('✓ Cluster manager created');

  // Start analytics
  const trafficAnalyzer = world.getTrafficAnalyzer(1000);
  trafficAnalyzer.start();

  // Start cluster
  clusterManager.start(trafficAnalyzer, world);
  console.log('✓ Cluster started\n');

  // Monitor for 20 seconds
  console.log('Monitoring single intersection for 20 seconds...\n');

  for (let i = 0; i < 4; i++) {
    await sleep(5000);

    const report = clusterManager.getStatusReport();
    const controller = clusterManager.getAllControllers()[0];
    const metrics = controller.getMetrics();

    console.log(`[${(i + 1) * 5}s] Status:`);
    console.log(`  Intersection: ${metrics.junctionId}`);
    console.log(`  Cycles Processed: ${metrics.cyclesProcessed}`);
    console.log(`  Congestion: ${metrics.analytics?.congestionLevel || 'N/A'}`);
    console.log(`  Density: ${metrics.analytics?.density?.toFixed(2) || 'N/A'}`);
    console.log(`  Local Optimizations: ${metrics.localOptimizations}`);
    console.log(`  Update Time: ${report.performance.avgUpdateTime}\n`);
  }

  // Final report
  const finalReport = clusterManager.getStatusReport();
  console.log('═══ Final Report ═══');
  console.log(`Intersections: ${finalReport.cluster.totalIntersections}`);
  console.log(`Total Cycles: ${finalReport.cluster.totalCycles}`);
  console.log(`Avg Update Time: ${finalReport.performance.avgUpdateTime}`);
  console.log(`Max Update Time: ${finalReport.performance.maxUpdateTime}`);

  if (finalReport.optimization) {
    console.log(`Optimizations: ${finalReport.optimization.totalOptimizations}`);
  }

  // Cleanup
  clusterManager.stop();
  world.destroy();

  console.log('\n✅ Demo 1 Complete\n');

  return finalReport;
}

// ========================================
// Demo 2: Five Intersections (Medium Scale)
// ========================================

export async function demoFiveIntersections() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║   DEMO 2: Five Intersections (Medium Scale)           ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  // Create 3×3 grid (9 intersections, but we'll focus on coordination)
  const world = new World({
    gridSize: 3,
    roadLength: 200
  });

  world.start();
  console.log(`✓ World created with ${world.junctions.size} intersections (using first 5)`);

  // Spawn vehicles
  const spawned = spawnVehiclesForWorld(world, 30);
  console.log(`✓ Spawned ${spawned} vehicles`);

  // Create cluster manager with all intersections
  const clusterManager = createClusterManager(world, {
    sensingInterval: 1000,
    analyticsInterval: 1000,
    optimizationInterval: 5000,
    optimizationStrategy: 'COORDINATED', // Use coordination for multiple
    enableCoordination: true
  });

  console.log(`✓ Cluster manager created with ${clusterManager.state.totalIntersections} intersections`);

  // Start analytics
  const trafficAnalyzer = world.getTrafficAnalyzer(1000);
  trafficAnalyzer.start();

  // Start cluster
  clusterManager.start(trafficAnalyzer, world);
  console.log('✓ Cluster started with COORDINATED strategy\n');

  // Monitor for 25 seconds
  console.log('Monitoring 5+ intersections for 25 seconds...\n');

  for (let i = 0; i < 5; i++) {
    await sleep(5000);

    const report = clusterManager.getStatusReport();

    console.log(`[${(i + 1) * 5}s] Cluster Status:`);
    console.log(`  Active Intersections: ${report.cluster.activeIntersections}`);
    console.log(`  Total Cycles: ${report.cluster.totalCycles}`);
    console.log(`  Cycles/sec: ${report.cluster.cyclesPerSecond}`);
    console.log(`  Avg Update Time: ${report.performance.avgUpdateTime}`);
    console.log(`  Max Update Time: ${report.performance.maxUpdateTime}`);
    console.log(`  Avg Density: ${report.statistics.avgDensity.toFixed(2)}`);
    console.log(`  Total Vehicles: ${report.statistics.totalVehicles}`);

    // Show congestion distribution
    const dist = report.statistics.congestionDistribution;
    console.log(`  Congestion: LOW=${dist.LOW}, MED=${dist.MEDIUM}, HIGH=${dist.HIGH}, CRIT=${dist.CRITICAL}`);

    // Sample 3 intersections
    console.log('  Sample Intersections:');
    report.intersectionDetails.slice(0, 3).forEach(int => {
      console.log(`    - ${int.id}: ${int.congestion} (density: ${int.density})`);
    });

    console.log();
  }

  // Final report
  const finalReport = clusterManager.getStatusReport();
  console.log('═══ Final Report ═══');
  console.log(`Total Intersections: ${finalReport.cluster.totalIntersections}`);
  console.log(`Total Cycles: ${finalReport.cluster.totalCycles}`);
  console.log(`Avg Update Time: ${finalReport.performance.avgUpdateTime}`);
  console.log(`Max Update Time: ${finalReport.performance.maxUpdateTime}`);
  console.log(`Avg Density: ${finalReport.statistics.avgDensity.toFixed(2)}`);

  if (finalReport.optimization) {
    console.log(`Total Optimizations: ${finalReport.optimization.totalOptimizations}`);
    console.log(`Avg Cost: ${finalReport.optimization.averageCost?.toFixed(2) || 'N/A'}`);
  }

  // Cleanup
  clusterManager.stop();
  world.destroy();

  console.log('\n✅ Demo 2 Complete\n');

  return finalReport;
}

// ========================================
// Demo 3: Ten Intersections (Large Scale)
// ========================================

export async function demoTenIntersections() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║   DEMO 3: Ten Intersections (Large Scale)             ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  // Create 4×4 grid (16 intersections)
  const world = new World({
    gridSize: 4,
    roadLength: 200
  });

  world.start();
  console.log(`✓ World created with ${world.junctions.size} intersections`);

  // Spawn more vehicles for larger network
  const spawned = spawnVehiclesForWorld(world, 60);
  console.log(`✓ Spawned ${spawned} vehicles`);

  // Create cluster manager
  const clusterManager = createClusterManager(world, {
    sensingInterval: 1000,
    analyticsInterval: 1000,
    optimizationInterval: 6000, // Slightly slower for larger network
    optimizationStrategy: 'BALANCED',
    enableCoordination: true
  });

  console.log(`✓ Cluster manager created with ${clusterManager.state.totalIntersections} intersections`);

  // Start analytics
  const trafficAnalyzer = world.getTrafficAnalyzer(1000);
  trafficAnalyzer.start();

  // Start cluster
  clusterManager.start(trafficAnalyzer, world);
  console.log('✓ Cluster started with BALANCED strategy\n');

  // Monitor for 30 seconds
  console.log('Monitoring 10+ intersections for 30 seconds...\n');

  const performanceHistory = [];

  for (let i = 0; i < 6; i++) {
    await sleep(5000);

    const report = clusterManager.getStatusReport();
    performanceHistory.push({
      time: (i + 1) * 5,
      avgUpdateTime: parseFloat(report.performance.avgUpdateTime),
      maxUpdateTime: parseFloat(report.performance.maxUpdateTime),
      cycles: report.cluster.totalCycles
    });

    console.log(`[${(i + 1) * 5}s] Cluster Status:`);
    console.log(`  Active Intersections: ${report.cluster.activeIntersections}`);
    console.log(`  Total Cycles: ${report.cluster.totalCycles}`);
    console.log(`  Cycles/sec: ${report.cluster.cyclesPerSecond}`);
    console.log(`  Avg Update Time: ${report.performance.avgUpdateTime}`);
    console.log(`  Max Update Time: ${report.performance.maxUpdateTime}`);
    console.log(`  Avg Density: ${report.statistics.avgDensity.toFixed(2)}`);
    console.log(`  Total Vehicles: ${report.statistics.totalVehicles}`);

    // Congestion distribution
    const dist = report.statistics.congestionDistribution;
    console.log(`  Congestion Distribution:`);
    console.log(`    LOW: ${dist.LOW} | MEDIUM: ${dist.MEDIUM} | HIGH: ${dist.HIGH} | CRITICAL: ${dist.CRITICAL}`);

    // Show sample of intersections
    console.log('  Intersection Sample (first 5):');
    report.intersectionDetails.slice(0, 5).forEach(int => {
      console.log(`    • ${int.id}: ${int.congestion.padEnd(8)} density=${int.density} opt=${int.optimizations}`);
    });

    console.log();
  }

  // Final report with performance analysis
  const finalReport = clusterManager.getStatusReport();
  console.log('═══ Final Report ═══');
  console.log(`Total Intersections: ${finalReport.cluster.totalIntersections}`);
  console.log(`Total Cycles: ${finalReport.cluster.totalCycles}`);
  console.log(`Avg Update Time: ${finalReport.performance.avgUpdateTime}`);
  console.log(`Max Update Time: ${finalReport.performance.maxUpdateTime}`);
  console.log(`Avg Density: ${finalReport.statistics.avgDensity.toFixed(2)}`);

  if (finalReport.optimization) {
    console.log(`\nOptimization Metrics:`);
    console.log(`  Total Optimizations: ${finalReport.optimization.totalOptimizations}`);
    console.log(`  Current Cost: ${finalReport.optimization.currentCost?.toFixed(2) || 'N/A'}`);
    console.log(`  Avg Cost: ${finalReport.optimization.averageCost?.toFixed(2) || 'N/A'}`);
  }

  // Performance trend
  console.log(`\nPerformance Trend:`);
  performanceHistory.forEach(p => {
    console.log(`  ${p.time}s: avg=${p.avgUpdateTime.toFixed(2)}ms, max=${p.maxUpdateTime.toFixed(2)}ms, cycles=${p.cycles}`);
  });

  // Cleanup
  clusterManager.stop();
  world.destroy();

  console.log('\n✅ Demo 3 Complete\n');

  return finalReport;
}

// ========================================
// Demo 4: Scalability Comparison
// ========================================

export async function demoScalabilityComparison() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║   DEMO 4: Scalability Comparison (1 vs 5 vs 10)       ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  const configs = [
    { name: '1 Intersection', gridSize: 1, vehicles: 10, duration: 15000 },
    { name: '5 Intersections', gridSize: 3, vehicles: 30, duration: 15000 },
    { name: '10+ Intersections', gridSize: 4, vehicles: 60, duration: 15000 }
  ];

  const results = [];

  for (const config of configs) {
    console.log(`\n--- Testing: ${config.name} ---\n`);

    const world = new World({
      gridSize: config.gridSize,
      roadLength: 200
    });

    world.start();
    spawnVehiclesForWorld(world, config.vehicles);

    const clusterManager = createClusterManager(world, {
      sensingInterval: 1000,
      analyticsInterval: 1000,
      optimizationInterval: 5000,
      optimizationStrategy: 'ADAPTIVE'
    });

    const trafficAnalyzer = world.getTrafficAnalyzer(1000);
    trafficAnalyzer.start();
    clusterManager.start(trafficAnalyzer, world);

    console.log(`Created ${clusterManager.state.totalIntersections} intersections, spawned ${config.vehicles} vehicles`);
    console.log(`Running for ${config.duration / 1000} seconds...\n`);

    // Wait for duration
    await sleep(config.duration);

    // Get final metrics
    const report = clusterManager.getStatusReport();

    results.push({
      name: config.name,
      intersections: report.cluster.totalIntersections,
      cycles: report.cluster.totalCycles,
      cyclesPerSec: parseFloat(report.cluster.cyclesPerSecond),
      avgUpdateTime: parseFloat(report.performance.avgUpdateTime),
      maxUpdateTime: parseFloat(report.performance.maxUpdateTime),
      avgDensity: report.statistics.avgDensity,
      optimizations: report.optimization?.totalOptimizations || 0
    });

    console.log(`${config.name} complete:`);
    console.log(`  Cycles: ${report.cluster.totalCycles}`);
    console.log(`  Avg Update: ${report.performance.avgUpdateTime}`);
    console.log(`  Max Update: ${report.performance.maxUpdateTime}\n`);

    clusterManager.stop();
    world.destroy();
  }

  // Comparison table
  console.log('\n═══ SCALABILITY COMPARISON ═══\n');
  console.log('Configuration         | Intersections | Cycles | Cycles/sec | Avg Update | Max Update | Optimizations');
  console.log('----------------------|---------------|--------|------------|------------|------------|-------------');

  results.forEach(r => {
    console.log(
      `${r.name.padEnd(21)} | ` +
      `${r.intersections.toString().padStart(13)} | ` +
      `${r.cycles.toString().padStart(6)} | ` +
      `${r.cyclesPerSec.toFixed(2).padStart(10)} | ` +
      `${r.avgUpdateTime.toFixed(2).padStart(9)}ms | ` +
      `${r.maxUpdateTime.toFixed(2).padStart(9)}ms | ` +
      `${r.optimizations.toString().padStart(13)}`
    );
  });

  // Performance analysis
  console.log('\n═══ PERFORMANCE ANALYSIS ═══\n');

  const baseline = results[0];
  console.log(`Baseline (1 intersection):`);
  console.log(`  Avg Update Time: ${baseline.avgUpdateTime.toFixed(2)}ms`);
  console.log(`  Cycles/sec: ${baseline.cyclesPerSec.toFixed(2)}`);

  results.slice(1).forEach(r => {
    const updateIncrease = ((r.avgUpdateTime - baseline.avgUpdateTime) / baseline.avgUpdateTime * 100);
    const cyclesRatio = (r.cyclesPerSec / baseline.cyclesPerSec);

    console.log(`\n${r.name} vs Baseline:`);
    console.log(`  Intersections: ${r.intersections}x`);
    console.log(`  Update Time Increase: ${updateIncrease > 0 ? '+' : ''}${updateIncrease.toFixed(1)}%`);
    console.log(`  Cycles/sec Ratio: ${cyclesRatio.toFixed(2)}x`);
    console.log(`  Scalability: ${updateIncrease < 50 ? '✅ Good' : updateIncrease < 100 ? '⚠️ Acceptable' : '❌ Poor'}`);
  });

  console.log('\n✅ Demo 4 Complete\n');

  return results;
}

// ========================================
// Demo 5: Load Testing
// ========================================

export async function demoLoadTesting() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║   DEMO 5: Load Testing (Progressive Vehicle Increase) ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  const world = new World({
    gridSize: 3,
    roadLength: 200
  });

  world.start();

  const clusterManager = createClusterManager(world, {
    sensingInterval: 1000,
    analyticsInterval: 1000,
    optimizationInterval: 5000,
    optimizationStrategy: 'ADAPTIVE'
  });

  const trafficAnalyzer = world.getTrafficAnalyzer(1000);
  trafficAnalyzer.start();
  clusterManager.start(trafficAnalyzer, world);

  console.log(`Cluster created with ${clusterManager.state.totalIntersections} intersections\n`);

  const loadStages = [
    { name: 'Light Load', vehicles: 15, duration: 10000 },
    { name: 'Medium Load', vehicles: 25, duration: 10000 },
    { name: 'Heavy Load', vehicles: 35, duration: 10000 }
  ];

  const loadResults = [];

  for (const stage of loadStages) {
    console.log(`--- ${stage.name}: Adding ${stage.vehicles} vehicles ---\n`);

    const spawned = spawnVehiclesForWorld(world, stage.vehicles);
    console.log(`Spawned ${spawned} vehicles (total: ${world.vehicles.size})`);

    await sleep(stage.duration);

    const report = clusterManager.getStatusReport();
    loadResults.push({
      stage: stage.name,
      totalVehicles: report.statistics.totalVehicles,
      avgDensity: report.statistics.avgDensity,
      avgUpdateTime: parseFloat(report.performance.avgUpdateTime),
      congestionDist: { ...report.statistics.congestionDistribution }
    });

    console.log(`\nStatus after ${stage.name}:`);
    console.log(`  Total Vehicles: ${report.statistics.totalVehicles}`);
    console.log(`  Avg Density: ${report.statistics.avgDensity.toFixed(2)}`);
    console.log(`  Avg Update Time: ${report.performance.avgUpdateTime}`);
    console.log(`  Congestion: ${JSON.stringify(report.statistics.congestionDistribution)}\n`);
  }

  // Load test summary
  console.log('═══ LOAD TEST SUMMARY ═══\n');
  console.log('Stage         | Vehicles | Avg Density | Update Time | Congestion');
  console.log('--------------|----------|-------------|-------------|------------');

  loadResults.forEach(r => {
    const congestionStr = `L:${r.congestionDist.LOW} M:${r.congestionDist.MEDIUM} H:${r.congestionDist.HIGH} C:${r.congestionDist.CRITICAL}`;
    console.log(
      `${r.stage.padEnd(13)} | ` +
      `${r.totalVehicles.toString().padStart(8)} | ` +
      `${r.avgDensity.toFixed(2).padStart(11)} | ` +
      `${r.avgUpdateTime.toFixed(2).padStart(10)}ms | ` +
      congestionStr
    );
  });

  // Cleanup
  clusterManager.stop();
  world.destroy();

  console.log('\n✅ Demo 5 Complete\n');

  return loadResults;
}

// ========================================
// Run All Demos
// ========================================

export async function runAllScalabilityDemos() {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   CLUSTER SCALABILITY DEMO SUITE                         ║');
  console.log('║   Testing: 1, 5, 10+ Intersections                       ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  const results = {};

  try {
    results.demo1 = await demoSingleIntersection();
    results.demo2 = await demoFiveIntersections();
    results.demo3 = await demoTenIntersections();
    results.demo4 = await demoScalabilityComparison();
    results.demo5 = await demoLoadTesting();

    console.log('\n');
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║   ALL DEMOS COMPLETED SUCCESSFULLY                       ║');
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
  console.log('Cluster Scalability Demo Module Loaded');
  console.log('Available demos:');
  console.log('  - demoSingleIntersection()');
  console.log('  - demoFiveIntersections()');
  console.log('  - demoTenIntersections()');
  console.log('  - demoScalabilityComparison()');
  console.log('  - demoLoadTesting()');
  console.log('  - runAllScalabilityDemos()');

  window.clusterDemos = {
    single: demoSingleIntersection,
    five: demoFiveIntersections,
    ten: demoTenIntersections,
    comparison: demoScalabilityComparison,
    loadTest: demoLoadTesting,
    runAll: runAllScalabilityDemos
  };
}
