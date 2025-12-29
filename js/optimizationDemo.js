/**
 * Optimization Engine Demo Module
 * 
 * Demonstrates the capabilities of the energy-aware optimization engine
 * for traffic signal timing. This module is the "core research contribution"
 * showcasing intelligent, cost-minimizing signal control.
 * 
 * Key Features Demonstrated:
 * - Cost function analysis (idle time, stops, signal switches)
 * - Multiple optimization strategies (GREEDY, ADAPTIVE, COORDINATED, etc.)
 * - Network coordination and green waves
 * - Performance metrics and comparison
 * - Energy awareness (CO2, fuel consumption)
 * - Integration with analytics layer
 */

import { World } from './world.js';
import { OptimizationStrategy } from './optimization.js';

// ========================================
// Demo Configuration
// ========================================

const DEMO_CONFIG = {
  // Simulation settings
  simulationDuration: 30000, // 30 seconds per demo
  optimizationInterval: 5000, // Optimize every 5 seconds
  
  // Cost function weights for experimentation
  defaultWeights: {
    idleTime: 1.0,
    stopPenalty: 0.8,
    switchPenalty: 0.3
  },
  
  // Alternative weight configurations for comparison
  energyFocusedWeights: {
    idleTime: 1.5,      // Emphasize idle time reduction
    stopPenalty: 0.5,
    switchPenalty: 0.2
  },
  
  smoothFlowWeights: {
    idleTime: 0.8,
    stopPenalty: 1.2,   // Emphasize stop reduction
    switchPenalty: 0.1
  },
  
  stabilityFocusedWeights: {
    idleTime: 0.7,
    stopPenalty: 0.7,
    switchPenalty: 1.0  // Emphasize signal stability
  }
};

// ========================================
// Demo 1: Basic Optimization
// ========================================

/**
 * Demonstrates basic optimization with default ADAPTIVE strategy
 * Shows before/after signal timings and cost improvements
 */
export async function demoBasicOptimization() {
  console.log('\n=== Demo 1: Basic Optimization ===\n');
  
  const world = new World({
    gridSize: 3,
    roadLength: 200
  });
  
  try {
    // Start simulation
    world.start();
    console.log('[Demo] Simulation started with 3x3 grid');
    
    // Spawn vehicles to create traffic
    spawnDemoVehicles(world, 30);
    console.log('[Demo] Spawned 30 vehicles');
    
    // Wait for initial traffic data
    console.log('[Demo] Collecting baseline traffic data...');
    await sleep(5000);
    
    // Get baseline state
    const baselineSnapshot = world.trafficAnalyzer?.getSnapshot();
    if (baselineSnapshot) {
      console.log('\n[Baseline Traffic State]');
      displayNetworkState(baselineSnapshot.network);
    }
    
    // Start optimization with ADAPTIVE strategy
    console.log('\n[Demo] Starting ADAPTIVE optimization...');
    const optimizer = world.startOptimization('ADAPTIVE', 5000);
    
    // Monitor optimization for 20 seconds
    for (let i = 0; i < 4; i++) {
      await sleep(5000);
      const metrics = optimizer.getPerformanceMetrics();
      console.log(`\n[Optimization Cycle ${i + 1}]`);
      displayPerformanceMetrics(metrics);
    }
    
    // Show final results
    console.log('\n[Demo] Final Results:');
    const finalMetrics = optimizer.getPerformanceMetrics();
    displayOptimizationSummary(finalMetrics);
    
    // Cleanup
    world.stopOptimization();
    world.destroy();
    console.log('\n[Demo] Completed successfully\n');
    
  } catch (error) {
    console.error('[Demo] Error:', error);
    world.destroy();
  }
}

// ========================================
// Demo 2: Strategy Comparison
// ========================================

/**
 * Compares different optimization strategies side-by-side
 * Tests: GREEDY, ADAPTIVE, PRESSURE_BASED, BALANCED
 */
export async function demoStrategyComparison() {
  console.log('\n=== Demo 2: Strategy Comparison ===\n');
  
  const strategies = ['GREEDY', 'ADAPTIVE', 'PRESSURE_BASED', 'BALANCED'];
  const results = {};
  
  for (const strategy of strategies) {
    console.log(`\n--- Testing ${strategy} Strategy ---\n`);
    
    const world = new World({
      gridSize: 3,
      roadLength: 200
    });
    
    try {
      world.start();
      spawnDemoVehicles(world, 40);
      
      // Collect baseline
      await sleep(3000);
      
      // Run optimization
      const optimizer = world.startOptimization(strategy, 5000);
      
      // Monitor for 15 seconds
      await sleep(15000);
      
      // Collect results
      const metrics = optimizer.getPerformanceMetrics();
      results[strategy] = {
        avgCost: metrics.averageCost,
        minCost: metrics.minCost,
        totalOptimizations: metrics.totalOptimizations,
        improvements: metrics.improvements,
        degradations: metrics.degradations
      };
      
      console.log(`[${strategy}] Results collected`);
      
      world.stopOptimization();
      world.destroy();
      
    } catch (error) {
      console.error(`[${strategy}] Error:`, error);
      world.destroy();
    }
  }
  
  // Display comparison
  console.log('\n=== Strategy Comparison Results ===\n');
  displayStrategyComparison(results);
}

// ========================================
// Demo 3: Cost Function Analysis
// ========================================

/**
 * Analyzes the impact of different cost function components
 * Shows how idle time, stops, and signal switches contribute to total cost
 */
export async function demoCostFunctionAnalysis() {
  console.log('\n=== Demo 3: Cost Function Analysis ===\n');
  
  const world = new World({
    gridSize: 2,
    roadLength: 150
  });
  
  try {
    world.start();
    spawnDemoVehicles(world, 20);
    console.log('[Demo] Simulation started');
    
    // Start optimization with detailed cost tracking
    await sleep(3000);
    const optimizer = world.startOptimization('BALANCED', 5000);
    
    console.log('\n[Demo] Monitoring cost components over time...\n');
    
    // Track cost components for 20 seconds
    const costHistory = [];
    for (let i = 0; i < 4; i++) {
      await sleep(5000);
      
      const history = optimizer.getOptimizationHistory();
      if (history.length > 0) {
        const latest = history[history.length - 1];
        costHistory.push(latest);
        
        console.log(`\nCycle ${i + 1}:`);
        console.log(`  Total Cost: ${latest.cost.toFixed(2)}`);
        console.log(`  Components:`);
        if (latest.costBreakdown) {
          console.log(`    - Idle Time: ${latest.costBreakdown.components.idleCost.toFixed(2)} (weighted: ${latest.costBreakdown.weighted.idleCost.toFixed(2)})`);
          console.log(`    - Stop Penalty: ${latest.costBreakdown.components.stopCost.toFixed(2)} (weighted: ${latest.costBreakdown.weighted.stopCost.toFixed(2)})`);
          console.log(`    - Switch Penalty: ${latest.costBreakdown.components.switchCost.toFixed(2)} (weighted: ${latest.costBreakdown.weighted.switchCost.toFixed(2)})`);
        }
      }
    }
    
    // Analyze cost evolution
    console.log('\n=== Cost Evolution Analysis ===\n');
    analyzeCostEvolution(costHistory);
    
    world.stopOptimization();
    world.destroy();
    console.log('\n[Demo] Completed successfully\n');
    
  } catch (error) {
    console.error('[Demo] Error:', error);
    world.destroy();
  }
}

// ========================================
// Demo 4: Network Coordination
// ========================================

/**
 * Demonstrates network-wide coordination for green waves
 * Shows how coordinated timing improves flow vs. independent optimization
 */
export async function demoNetworkCoordination() {
  console.log('\n=== Demo 4: Network Coordination ===\n');
  
  // Test 1: Independent optimization
  console.log('[Test 1] Independent Optimization (ADAPTIVE)\n');
  const world1 = new World({
    gridSize: 4,
    roadLength: 200
  });
  
  let independentResults = null;
  
  try {
    world1.start();
    spawnDemoVehicles(world1, 50);
    await sleep(3000);
    
    const optimizer1 = world1.startOptimization('ADAPTIVE', 5000);
    await sleep(15000);
    
    independentResults = optimizer1.getPerformanceMetrics();
    console.log('[Independent] Average Cost:', independentResults.averageCost.toFixed(2));
    
    world1.stopOptimization();
    world1.destroy();
    
  } catch (error) {
    console.error('[Independent] Error:', error);
    world1.destroy();
  }
  
  // Test 2: Coordinated optimization
  console.log('\n[Test 2] Coordinated Optimization (COORDINATED)\n');
  const world2 = new World({
    gridSize: 4,
    roadLength: 200
  });
  
  let coordinatedResults = null;
  
  try {
    world2.start();
    spawnDemoVehicles(world2, 50);
    await sleep(3000);
    
    const optimizer2 = world2.startOptimization('COORDINATED', 5000);
    await sleep(15000);
    
    coordinatedResults = optimizer2.getPerformanceMetrics();
    console.log('[Coordinated] Average Cost:', coordinatedResults.averageCost.toFixed(2));
    
    world2.stopOptimization();
    world2.destroy();
    
  } catch (error) {
    console.error('[Coordinated] Error:', error);
    world2.destroy();
  }
  
  // Compare results
  if (independentResults && coordinatedResults) {
    console.log('\n=== Coordination Impact ===\n');
    const improvement = ((independentResults.averageCost - coordinatedResults.averageCost) / 
                        independentResults.averageCost * 100);
    console.log(`Cost Reduction: ${improvement.toFixed(1)}%`);
    console.log(`Independent Avg: ${independentResults.averageCost.toFixed(2)}`);
    console.log(`Coordinated Avg: ${coordinatedResults.averageCost.toFixed(2)}`);
  }
  
  console.log('\n[Demo] Completed successfully\n');
}

// ========================================
// Demo 5: Weight Configuration Impact
// ========================================

/**
 * Tests different cost function weight configurations
 * Shows how weight tuning affects optimization behavior
 */
export async function demoWeightConfiguration() {
  console.log('\n=== Demo 5: Weight Configuration Impact ===\n');
  
  const configurations = {
    'Default': DEMO_CONFIG.defaultWeights,
    'Energy-Focused': DEMO_CONFIG.energyFocusedWeights,
    'Smooth-Flow': DEMO_CONFIG.smoothFlowWeights,
    'Stability-Focused': DEMO_CONFIG.stabilityFocusedWeights
  };
  
  const results = {};
  
  for (const [name, weights] of Object.entries(configurations)) {
    console.log(`\n--- Testing ${name} Configuration ---`);
    console.log(`Weights: idle=${weights.idleTime}, stop=${weights.stopPenalty}, switch=${weights.switchPenalty}\n`);
    
    const world = new World({
      gridSize: 3,
      roadLength: 200
    });
    
    try {
      world.start();
      spawnDemoVehicles(world, 35);
      await sleep(3000);
      
      // Create optimizer with custom weights
      const optimizer = world.getOptimizationEngine('BALANCED');
      optimizer.costCalculator.weights = weights;
      optimizer.optimizationIntervalMs = 5000;
      optimizer.start();
      
      await sleep(15000);
      
      const metrics = optimizer.getPerformanceMetrics();
      results[name] = metrics;
      
      console.log(`[${name}] Avg Cost: ${metrics.averageCost.toFixed(2)}`);
      
      world.stopOptimization();
      world.destroy();
      
    } catch (error) {
      console.error(`[${name}] Error:`, error);
      world.destroy();
    }
  }
  
  // Display comparison
  console.log('\n=== Weight Configuration Comparison ===\n');
  displayWeightComparison(results);
}

// ========================================
// Demo 6: Performance Metrics
// ========================================

/**
 * Demonstrates comprehensive performance metric tracking
 * Shows improvements, degradations, and optimization success rate
 */
export async function demoPerformanceMetrics() {
  console.log('\n=== Demo 6: Performance Metrics Tracking ===\n');
  
  const world = new World({
    gridSize: 3,
    roadLength: 200
  });
  
  try {
    world.start();
    spawnDemoVehicles(world, 40);
    console.log('[Demo] Simulation started\n');
    
    await sleep(3000);
    
    const optimizer = world.startOptimization('BALANCED', 4000);
    console.log('[Demo] Optimization started (4s interval)\n');
    
    // Monitor for 24 seconds (6 optimization cycles)
    for (let i = 0; i < 6; i++) {
      await sleep(4000);
      
      const metrics = optimizer.getPerformanceMetrics();
      console.log(`\n--- Cycle ${i + 1} Metrics ---`);
      console.log(`Total Optimizations: ${metrics.totalOptimizations}`);
      console.log(`Current Cost: ${metrics.currentCost.toFixed(2)}`);
      console.log(`Average Cost: ${metrics.averageCost.toFixed(2)}`);
      console.log(`Best Cost: ${metrics.minCost.toFixed(2)}`);
      console.log(`Improvements: ${metrics.improvements}`);
      console.log(`Degradations: ${metrics.degradations}`);
      console.log(`Success Rate: ${(metrics.improvements / metrics.totalOptimizations * 100).toFixed(1)}%`);
    }
    
    // Show final summary
    console.log('\n=== Final Performance Summary ===\n');
    const finalMetrics = optimizer.getPerformanceMetrics();
    displayDetailedMetrics(finalMetrics);
    
    world.stopOptimization();
    world.destroy();
    console.log('\n[Demo] Completed successfully\n');
    
  } catch (error) {
    console.error('[Demo] Error:', error);
    world.destroy();
  }
}

// ========================================
// Demo 7: Congestion Response
// ========================================

/**
 * Tests optimization response to different congestion levels
 * Shows how the system adapts to LOW, MEDIUM, HIGH, CRITICAL congestion
 */
export async function demoCongestionResponse() {
  console.log('\n=== Demo 7: Congestion Response ===\n');
  
  const congestionScenarios = [
    { name: 'Low Congestion', vehicles: 15 },
    { name: 'Medium Congestion', vehicles: 30 },
    { name: 'High Congestion', vehicles: 50 },
    { name: 'Critical Congestion', vehicles: 70 }
  ];
  
  for (const scenario of congestionScenarios) {
    console.log(`\n--- ${scenario.name} (${scenario.vehicles} vehicles) ---\n`);
    
    const world = new World({
      gridSize: 3,
      roadLength: 200
    });
    
    try {
      world.start();
      spawnDemoVehicles(world, scenario.vehicles);
      
      // Let traffic develop
      await sleep(4000);
      
      // Check congestion level
      const snapshot = world.trafficAnalyzer?.getSnapshot();
      if (snapshot) {
        console.log(`Detected Congestion: ${snapshot.network.congestionLevel}`);
        console.log(`Network Density: ${snapshot.network.density.toFixed(2)}`);
      }
      
      // Start optimization
      const optimizer = world.startOptimization('ADAPTIVE', 5000);
      
      // Monitor response
      await sleep(10000);
      
      const metrics = optimizer.getPerformanceMetrics();
      console.log(`Optimization Runs: ${metrics.totalOptimizations}`);
      console.log(`Average Cost: ${metrics.averageCost.toFixed(2)}`);
      console.log(`Improvement Rate: ${(metrics.improvements / metrics.totalOptimizations * 100).toFixed(1)}%`);
      
      world.stopOptimization();
      world.destroy();
      
    } catch (error) {
      console.error(`[${scenario.name}] Error:`, error);
      world.destroy();
    }
  }
  
  console.log('\n[Demo] Completed successfully\n');
}

// ========================================
// Demo 8: Real-time Adjustment
// ========================================

/**
 * Demonstrates real-time signal adjustment in response to traffic changes
 * Simulates dynamic traffic patterns and optimization response
 */
export async function demoRealTimeAdjustment() {
  console.log('\n=== Demo 8: Real-time Signal Adjustment ===\n');
  
  const world = new World({
    gridSize: 3,
    roadLength: 200
  });
  
  try {
    world.start();
    console.log('[Demo] Starting with light traffic...\n');
    
    // Phase 1: Light traffic
    spawnDemoVehicles(world, 15);
    await sleep(3000);
    
    const optimizer = world.startOptimization('ADAPTIVE', 3000);
    await sleep(6000);
    
    let metrics = optimizer.getPerformanceMetrics();
    console.log('[Phase 1] Light Traffic:');
    console.log(`  Average Cost: ${metrics.averageCost.toFixed(2)}\n`);
    
    // Phase 2: Add traffic (medium congestion)
    console.log('[Demo] Adding more vehicles (medium congestion)...\n');
    spawnDemoVehicles(world, 20);
    await sleep(6000);
    
    metrics = optimizer.getPerformanceMetrics();
    console.log('[Phase 2] Medium Congestion:');
    console.log(`  Average Cost: ${metrics.averageCost.toFixed(2)}\n`);
    
    // Phase 3: Heavy traffic
    console.log('[Demo] Adding heavy traffic...\n');
    spawnDemoVehicles(world, 25);
    await sleep(6000);
    
    metrics = optimizer.getPerformanceMetrics();
    console.log('[Phase 3] Heavy Congestion:');
    console.log(`  Average Cost: ${metrics.averageCost.toFixed(2)}\n`);
    
    // Show adaptation
    const history = optimizer.getOptimizationHistory();
    console.log('=== Adaptation Timeline ===\n');
    displayAdaptationTimeline(history);
    
    world.stopOptimization();
    world.destroy();
    console.log('\n[Demo] Completed successfully\n');
    
  } catch (error) {
    console.error('[Demo] Error:', error);
    world.destroy();
  }
}

// ========================================
// Helper Functions
// ========================================

/**
 * Spawn demo vehicles randomly across the network
 */
function spawnDemoVehicles(world, count) {
  const roads = Array.from(world.roads.values());
  
  for (let i = 0; i < count; i++) {
    const randomRoad = roads[Math.floor(Math.random() * roads.length)];
    try {
      world.spawnVehicle(randomRoad);
    } catch (e) {
      // Road might be full, continue
    }
  }
}

/**
 * Display network traffic state
 */
function displayNetworkState(networkState) {
  console.log(`  Congestion Level: ${networkState.congestionLevel}`);
  console.log(`  Traffic Period: ${networkState.trafficPeriod}`);
  console.log(`  Network Density: ${networkState.density.toFixed(2)}`);
  console.log(`  Average Queue: ${networkState.averageQueueLength.toFixed(2)}`);
  console.log(`  Average Wait: ${networkState.averageWaitTime.toFixed(2)}s`);
}

/**
 * Display performance metrics
 */
function displayPerformanceMetrics(metrics) {
  console.log(`  Current Cost: ${metrics.currentCost.toFixed(2)}`);
  console.log(`  Average Cost: ${metrics.averageCost.toFixed(2)}`);
  console.log(`  Min Cost: ${metrics.minCost.toFixed(2)}`);
  console.log(`  Optimizations: ${metrics.totalOptimizations}`);
  console.log(`  Improvements: ${metrics.improvements} | Degradations: ${metrics.degradations}`);
}

/**
 * Display optimization summary
 */
function displayOptimizationSummary(metrics) {
  const successRate = metrics.totalOptimizations > 0 
    ? (metrics.improvements / metrics.totalOptimizations * 100).toFixed(1)
    : 0;
  
  console.log(`Total Optimization Cycles: ${metrics.totalOptimizations}`);
  console.log(`Final Cost: ${metrics.currentCost.toFixed(2)}`);
  console.log(`Average Cost: ${metrics.averageCost.toFixed(2)}`);
  console.log(`Best Cost Achieved: ${metrics.minCost.toFixed(2)}`);
  console.log(`Cost Improvements: ${metrics.improvements}`);
  console.log(`Cost Degradations: ${metrics.degradations}`);
  console.log(`Success Rate: ${successRate}%`);
}

/**
 * Display strategy comparison results
 */
function displayStrategyComparison(results) {
  console.log('Strategy         | Avg Cost | Min Cost | Success Rate');
  console.log('-----------------|----------|----------|-------------');
  
  for (const [strategy, data] of Object.entries(results)) {
    const successRate = data.totalOptimizations > 0
      ? (data.improvements / data.totalOptimizations * 100).toFixed(1)
      : 0;
    
    console.log(
      `${strategy.padEnd(16)} | ` +
      `${data.avgCost.toFixed(2).padStart(8)} | ` +
      `${data.minCost.toFixed(2).padStart(8)} | ` +
      `${successRate.padStart(8)}%`
    );
  }
}

/**
 * Analyze cost evolution over time
 */
function analyzeCostEvolution(costHistory) {
  if (costHistory.length < 2) {
    console.log('Insufficient data for analysis');
    return;
  }
  
  const firstCost = costHistory[0].cost;
  const lastCost = costHistory[costHistory.length - 1].cost;
  const improvement = ((firstCost - lastCost) / firstCost * 100);
  
  console.log(`Initial Cost: ${firstCost.toFixed(2)}`);
  console.log(`Final Cost: ${lastCost.toFixed(2)}`);
  console.log(`Total Improvement: ${improvement.toFixed(1)}%`);
  
  // Analyze component contributions
  if (costHistory[0].costBreakdown && costHistory[costHistory.length - 1].costBreakdown) {
    const firstBreakdown = costHistory[0].costBreakdown.weighted;
    const lastBreakdown = costHistory[costHistory.length - 1].costBreakdown.weighted;
    
    console.log('\nComponent Improvements:');
    console.log(`  Idle Time: ${((firstBreakdown.idleCost - lastBreakdown.idleCost) / firstBreakdown.idleCost * 100).toFixed(1)}%`);
    console.log(`  Stop Penalty: ${((firstBreakdown.stopCost - lastBreakdown.stopCost) / firstBreakdown.stopCost * 100).toFixed(1)}%`);
    console.log(`  Switch Penalty: ${((firstBreakdown.switchCost - lastBreakdown.switchCost) / firstBreakdown.switchCost * 100).toFixed(1)}%`);
  }
}

/**
 * Display weight configuration comparison
 */
function displayWeightComparison(results) {
  console.log('Configuration      | Avg Cost | Min Cost | Improvements');
  console.log('-------------------|----------|----------|-------------');
  
  for (const [name, metrics] of Object.entries(results)) {
    console.log(
      `${name.padEnd(18)} | ` +
      `${metrics.averageCost.toFixed(2).padStart(8)} | ` +
      `${metrics.minCost.toFixed(2).padStart(8)} | ` +
      `${metrics.improvements.toString().padStart(12)}`
    );
  }
}

/**
 * Display detailed performance metrics
 */
function displayDetailedMetrics(metrics) {
  console.log('Performance Summary:');
  console.log(`  Total Optimization Cycles: ${metrics.totalOptimizations}`);
  console.log(`  Current Cost: ${metrics.currentCost.toFixed(2)}`);
  console.log(`  Average Cost: ${metrics.averageCost.toFixed(2)}`);
  console.log(`  Minimum Cost: ${metrics.minCost.toFixed(2)}`);
  console.log(`  Maximum Cost: ${metrics.maxCost.toFixed(2)}`);
  console.log(`  Cost Variance: ${((metrics.maxCost - metrics.minCost) / metrics.averageCost * 100).toFixed(1)}%`);
  console.log('\nOutcome Distribution:');
  console.log(`  Improvements: ${metrics.improvements} (${(metrics.improvements / metrics.totalOptimizations * 100).toFixed(1)}%)`);
  console.log(`  Degradations: ${metrics.degradations} (${(metrics.degradations / metrics.totalOptimizations * 100).toFixed(1)}%)`);
  console.log(`  Neutral: ${metrics.totalOptimizations - metrics.improvements - metrics.degradations}`);
}

/**
 * Display adaptation timeline
 */
function displayAdaptationTimeline(history) {
  if (history.length === 0) return;
  
  const phases = Math.min(6, history.length);
  const step = Math.floor(history.length / phases);
  
  for (let i = 0; i < phases; i++) {
    const index = i * step;
    if (index >= history.length) break;
    
    const entry = history[index];
    console.log(`Time ${(entry.timestamp / 1000).toFixed(0)}s: Cost ${entry.cost.toFixed(2)}`);
  }
}

/**
 * Sleep utility
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ========================================
// Auto-run Demos (if loaded directly)
// ========================================

if (typeof window !== 'undefined') {
  console.log('Optimization Demo Module Loaded');
  console.log('Available demos:');
  console.log('  - demoBasicOptimization()');
  console.log('  - demoStrategyComparison()');
  console.log('  - demoCostFunctionAnalysis()');
  console.log('  - demoNetworkCoordination()');
  console.log('  - demoWeightConfiguration()');
  console.log('  - demoPerformanceMetrics()');
  console.log('  - demoCongestionResponse()');
  console.log('  - demoRealTimeAdjustment()');
  
  // Expose to window for easy access
  window.optimizationDemos = {
    basic: demoBasicOptimization,
    strategyComparison: demoStrategyComparison,
    costAnalysis: demoCostFunctionAnalysis,
    coordination: demoNetworkCoordination,
    weights: demoWeightConfiguration,
    metrics: demoPerformanceMetrics,
    congestion: demoCongestionResponse,
    realtime: demoRealTimeAdjustment
  };
}
