/**
 * Control Loop Integration Test
 * 
 * Validates the complete closed control loop:
 * Simulator → Sensing → Analytics → Optimization → Signal Controller → Simulator
 * 
 * Tests:
 * 1. Basic control loop operation
 * 2. Safety constraint enforcement
 * 3. Gradual timing transitions
 * 4. Phase-aware updates
 * 5. Loop stability under varying traffic
 */

import { World } from './world.js';
import { SignalPhase } from './signal.js';

// Test utilities
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function spawnVehicles(world, count) {
  const roads = Array.from(world.roads.values());
  let spawned = 0;
  
  for (let i = 0; i < count && spawned < count; i++) {
    const randomRoad = roads[Math.floor(Math.random() * roads.length)];
    try {
      world.spawnVehicle(randomRoad);
      spawned++;
    } catch (e) {
      // Road full, try another
    }
  }
  
  return spawned;
}

// ========================================
// Test 1: Basic Control Loop Operation
// ========================================

export async function testBasicControlLoop() {
  console.log('\n=== TEST 1: Basic Control Loop Operation ===\n');
  
  const world = new World({
    gridSize: 2,
    roadLength: 200
  });
  
  try {
    // Start simulation
    world.start();
    console.log('✓ Simulation started');
    
    // Spawn initial traffic
    const spawned = spawnVehicles(world, 20);
    console.log(`✓ Spawned ${spawned} vehicles`);
    
    // Start control loop layers
    world.startDataIngestion(1000);
    console.log('✓ Sensing layer started (1s interval)');
    
    world.startTrafficAnalytics(1000);
    console.log('✓ Analytics layer started (1s interval)');
    
    const optimizer = world.startOptimization('ADAPTIVE', 3000);
    console.log('✓ Optimization layer started (3s interval)');
    
    // Wait for multiple optimization cycles
    console.log('\nWaiting for 15 seconds (5 optimization cycles)...');
    await sleep(15000);
    
    // Verify loop operation
    const metrics = optimizer.getMetrics();
    
    console.log('\n--- Loop Metrics ---');
    console.log(`Total Optimizations: ${metrics.totalOptimizations}`);
    console.log(`Uptime: ${(metrics.uptime / 1000).toFixed(1)}s`);
    console.log(`Optimizations/min: ${metrics.optimizationsPerMinute}`);
    
    // Assertions
    if (metrics.totalOptimizations < 4) {
      throw new Error(`Expected at least 4 optimizations, got ${metrics.totalOptimizations}`);
    }
    
    console.log('\n✅ TEST 1 PASSED: Control loop operates correctly\n');
    
    // Cleanup
    world.stopOptimization();
    world.stopTrafficAnalytics();
    world.stopDataIngestion();
    world.destroy();
    
  } catch (error) {
    console.error('❌ TEST 1 FAILED:', error.message);
    world.destroy();
    throw error;
  }
}

// ========================================
// Test 2: Safety Constraint Enforcement
// ========================================

export async function testSafetyConstraints() {
  console.log('\n=== TEST 2: Safety Constraint Enforcement ===\n');
  
  const world = new World({
    gridSize: 2,
    roadLength: 200
  });
  
  try {
    world.start();
    
    const junction = Array.from(world.junctions.values())[0];
    const signal = junction.signal;
    
    console.log('Testing safety constraints on signal...\n');
    
    // Test 1: Reject yellow time below minimum
    console.log('Test 1: Rejecting unsafe yellow time (500ms < 1000ms)');
    const result1 = signal.updateTimings({
      yellowMs: 500,
      validateSafety: true
    });
    
    if (result1.success) {
      throw new Error('Should have rejected yellow time below minimum');
    }
    console.log(`✓ Correctly rejected: ${result1.rejections[0]}`);
    
    // Test 2: Clamp excessive green time
    console.log('\nTest 2: Clamping excessive green time (150s > 120s)');
    const result2 = signal.updateTimings({
      greenMs: 150000,
      validateSafety: true
    });
    
    if (!result2.success || result2.appliedTimings.greenMs > 120000) {
      throw new Error('Should have clamped green time to maximum');
    }
    console.log(`✓ Correctly clamped to ${result2.appliedTimings.greenMs}ms`);
    console.log(`  Warning: ${result2.warnings[0]}`);
    
    // Test 3: Enforce gradual changes
    console.log('\nTest 3: Enforcing gradual change (15s change limited to 10s)');
    const currentGreen = signal.getTimings().greenMs;
    const result3 = signal.updateTimings({
      greenMs: currentGreen + 15000,
      validateSafety: true
    });
    
    const actualChange = Math.abs(result3.appliedTimings.greenMs - currentGreen);
    if (actualChange > 10000) {
      throw new Error(`Change should be limited to 10s, got ${actualChange}ms`);
    }
    console.log(`✓ Correctly limited change to ${actualChange}ms`);
    console.log(`  Warning: ${result3.warnings[0]}`);
    
    // Test 4: Accept valid timing
    console.log('\nTest 4: Accepting valid timing update');
    const result4 = signal.updateTimings({
      greenMs: 5000,
      yellowMs: 1000,
      allRedMs: 500,
      validateSafety: true
    });
    
    if (!result4.success) {
      throw new Error('Should have accepted valid timings');
    }
    console.log('✓ Correctly accepted valid timings');
    console.log(`  Applied: green=${result4.appliedTimings.greenMs}ms`);
    
    console.log('\n✅ TEST 2 PASSED: Safety constraints enforced correctly\n');
    
    world.destroy();
    
  } catch (error) {
    console.error('❌ TEST 2 FAILED:', error.message);
    world.destroy();
    throw error;
  }
}

// ========================================
// Test 3: Phase-Aware Updates
// ========================================

export async function testPhaseAwareUpdates() {
  console.log('\n=== TEST 3: Phase-Aware Updates ===\n');
  
  const world = new World({
    gridSize: 2,
    roadLength: 200
  });
  
  try {
    world.start();
    
    const junction = Array.from(world.junctions.values())[0];
    const signal = junction.signal;
    signal.start();
    
    console.log('Testing phase-aware timing updates...\n');
    
    // Wait for signal to reach yellow phase
    console.log('Waiting for YELLOW phase...');
    while (signal.phase !== SignalPhase.EW_YELLOW && signal.phase !== SignalPhase.NS_YELLOW) {
      world.update(100);
      await sleep(100);
    }
    console.log(`✓ Signal in ${signal.phase} phase`);
    
    // Try to apply immediate update during yellow
    console.log('\nAttempting immediate update during YELLOW phase...');
    const result1 = signal.updateTimings({
      greenMs: 6000,
      applyImmediately: true,
      validateSafety: true
    });
    
    if (result1.appliedTimings.immediate !== false) {
      throw new Error('Should have deferred immediate application during yellow phase');
    }
    console.log('✓ Correctly deferred immediate application');
    console.log(`  Warning: ${result1.warnings[result1.warnings.length - 1]}`);
    
    // Wait for green phase
    console.log('\nWaiting for GREEN phase...');
    while (signal.phase !== SignalPhase.EW_GREEN && signal.phase !== SignalPhase.NS_GREEN) {
      world.update(100);
      await sleep(100);
    }
    console.log(`✓ Signal in ${signal.phase} phase`);
    
    // Ensure we're not too close to phase transition
    while (signal.getRemainingTime() < 2000) {
      world.update(100);
      await sleep(100);
    }
    console.log(`  Remaining time: ${signal.getRemainingTime()}ms`);
    
    // Try immediate update during safe phase
    console.log('\nAttempting immediate update during safe GREEN phase...');
    const result2 = signal.updateTimings({
      greenMs: 7000,
      applyImmediately: true,
      validateSafety: true
    });
    
    if (!result2.success || result2.appliedTimings.immediate !== true) {
      throw new Error('Should have applied immediately during safe green phase');
    }
    console.log('✓ Correctly applied immediately during safe phase');
    
    console.log('\n✅ TEST 3 PASSED: Phase-aware updates working correctly\n');
    
    world.destroy();
    
  } catch (error) {
    console.error('❌ TEST 3 FAILED:', error.message);
    world.destroy();
    throw error;
  }
}

// ========================================
// Test 4: Loop Stability Under Load
// ========================================

export async function testLoopStability() {
  console.log('\n=== TEST 4: Loop Stability Under Varying Load ===\n');
  
  const world = new World({
    gridSize: 3,
    roadLength: 200
  });
  
  try {
    world.start();
    
    // Start control loop
    world.startDataIngestion(1000);
    world.startTrafficAnalytics(1000);
    const optimizer = world.startOptimization('ADAPTIVE', 4000);
    
    console.log('Control loop started\n');
    
    // Phase 1: Light traffic
    console.log('Phase 1: Light traffic (20 vehicles)');
    spawnVehicles(world, 20);
    await sleep(8000);
    
    const metrics1 = optimizer.getMetrics();
    const snapshot1 = world.trafficAnalyzer.getSnapshot();
    
    console.log(`  Congestion: ${snapshot1.network.congestionLevel}`);
    console.log(`  Optimizations: ${metrics1.totalOptimizations}`);
    
    // Phase 2: Medium traffic
    console.log('\nPhase 2: Adding vehicles (total 40)');
    spawnVehicles(world, 20);
    await sleep(8000);
    
    const metrics2 = optimizer.getMetrics();
    const snapshot2 = world.trafficAnalyzer.getSnapshot();
    
    console.log(`  Congestion: ${snapshot2.network.congestionLevel}`);
    console.log(`  Optimizations: ${metrics2.totalOptimizations}`);
    
    // Phase 3: Heavy traffic
    console.log('\nPhase 3: Adding more vehicles (total 60)');
    spawnVehicles(world, 20);
    await sleep(8000);
    
    const metrics3 = optimizer.getMetrics();
    const snapshot3 = world.trafficAnalyzer.getSnapshot();
    
    console.log(`  Congestion: ${snapshot3.network.congestionLevel}`);
    console.log(`  Optimizations: ${metrics3.totalOptimizations}`);
    
    // Verify loop remained stable
    if (!optimizer.isRunning) {
      throw new Error('Optimization loop stopped unexpectedly');
    }
    
    if (metrics3.totalOptimizations < 5) {
      throw new Error(`Expected at least 5 optimizations, got ${metrics3.totalOptimizations}`);
    }
    
    console.log('\n--- Final Metrics ---');
    console.log(`Total Optimizations: ${metrics3.totalOptimizations}`);
    console.log(`Avg Cost Reduction: ${metrics3.avgCostReduction}`);
    console.log(`Uptime: ${(metrics3.uptime / 1000).toFixed(1)}s`);
    
    console.log('\n✅ TEST 4 PASSED: Loop remained stable under varying load\n');
    
    world.stopOptimization();
    world.stopTrafficAnalytics();
    world.stopDataIngestion();
    world.destroy();
    
  } catch (error) {
    console.error('❌ TEST 4 FAILED:', error.message);
    world.destroy();
    throw error;
  }
}

// ========================================
// Test 5: Gradual Transition
// ========================================

export async function testGradualTransition() {
  console.log('\n=== TEST 5: Gradual Timing Transition ===\n');
  
  const world = new World({
    gridSize: 2,
    roadLength: 200
  });
  
  try {
    world.start();
    
    const junction = Array.from(world.junctions.values())[0];
    const signal = junction.signal;
    
    const initialTimings = signal.getTimings();
    console.log(`Initial timings: green=${initialTimings.greenMs}ms`);
    
    // Plan transition from 3s to 15s green (12s increase)
    const targetTimings = {
      greenMs: 15000,
      yellowMs: 1000,
      allRedMs: 500
    };
    
    console.log(`\nPlanning transition to: green=${targetTimings.greenMs}ms`);
    console.log(`Change: +${targetTimings.greenMs - initialTimings.greenMs}ms\n`);
    
    const plan = signal.scheduleGradualTransition(targetTimings, 3);
    
    console.log('Transition plan (3 steps):');
    plan.steps.forEach((step, i) => {
      console.log(`  Step ${i + 1}: green=${step.greenMs}ms`);
    });
    
    // Apply transition steps
    console.log('\nApplying transition steps...');
    for (let i = 0; i < plan.steps.length; i++) {
      const result = signal.updateTimings({
        ...plan.steps[i],
        validateSafety: true
      });
      
      if (!result.success) {
        throw new Error(`Step ${i + 1} failed: ${result.rejections.join(', ')}`);
      }
      
      const currentTimings = signal.getTimings();
      console.log(`  Step ${i + 1} applied: green=${currentTimings.greenMs}ms`);
      
      await sleep(1000);
    }
    
    // Verify final timings
    const finalTimings = signal.getTimings();
    const tolerance = 1000; // 1s tolerance
    
    if (Math.abs(finalTimings.greenMs - targetTimings.greenMs) > tolerance) {
      throw new Error(`Final green ${finalTimings.greenMs}ms not close to target ${targetTimings.greenMs}ms`);
    }
    
    console.log(`\n✓ Final timings: green=${finalTimings.greenMs}ms`);
    console.log(`✓ Successfully transitioned from ${initialTimings.greenMs}ms to ${finalTimings.greenMs}ms`);
    
    console.log('\n✅ TEST 5 PASSED: Gradual transition completed successfully\n');
    
    world.destroy();
    
  } catch (error) {
    console.error('❌ TEST 5 FAILED:', error.message);
    world.destroy();
    throw error;
  }
}

// ========================================
// Run All Tests
// ========================================

export async function runAllControlLoopTests() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║   CONTROL LOOP INTEGRATION TEST SUITE                 ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  
  const tests = [
    { name: 'Basic Control Loop Operation', fn: testBasicControlLoop },
    { name: 'Safety Constraint Enforcement', fn: testSafetyConstraints },
    { name: 'Phase-Aware Updates', fn: testPhaseAwareUpdates },
    { name: 'Loop Stability Under Load', fn: testLoopStability },
    { name: 'Gradual Timing Transition', fn: testGradualTransition }
  ];
  
  const results = {
    passed: 0,
    failed: 0,
    errors: []
  };
  
  for (const test of tests) {
    try {
      await test.fn();
      results.passed++;
    } catch (error) {
      results.failed++;
      results.errors.push({ test: test.name, error: error.message });
    }
  }
  
  // Summary
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║   TEST SUITE SUMMARY                                   ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log(`\nTotal Tests: ${tests.length}`);
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  
  if (results.failed > 0) {
    console.log('\nFailed Tests:');
    results.errors.forEach(({ test, error }) => {
      console.log(`  • ${test}: ${error}`);
    });
  }
  
  console.log('\n' + '═'.repeat(60) + '\n');
  
  return results;
}

// Auto-run if loaded directly
if (typeof window !== 'undefined') {
  console.log('\nControl Loop Test Module Loaded');
  console.log('Run tests with: runAllControlLoopTests()');
  
  window.controlLoopTests = {
    runAll: runAllControlLoopTests,
    testBasicControlLoop,
    testSafetyConstraints,
    testPhaseAwareUpdates,
    testLoopStability,
    testGradualTransition
  };
}
