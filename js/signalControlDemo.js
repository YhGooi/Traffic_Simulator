/**
 * Dynamic Traffic Signal Control Demonstrations
 * 
 * This file demonstrates the dynamic signal control interface for optimization algorithms.
 * All functions are available in the browser console.
 */

import { SignalPhase, SignalState } from './signal.js';

// ========================================
// 1. BASIC SIGNAL CONTROL
// ========================================

/**
 * Demo: Update signal timings for a single junction
 */
function demoBasicTimingControl(world) {
  console.log('=== Basic Signal Timing Control Demo ===\n');
  
  const junction = world.junctions.values().next().value;
  if (!junction) {
    console.log('No junctions available. Please add junctions first.');
    return;
  }
  
  const signal = junction.signal;
  
  // Get current timings
  console.log('Current timings:', signal.getTimings());
  
  // Update to longer green time (better for heavy traffic)
  signal.updateTimings({ greenMs: 5000 });
  console.log('✅ Updated green time to 5000ms');
  console.log('New timings:', signal.getTimings());
  
  // Update multiple timings at once
  signal.updateTimings({ 
    greenMs: 4000,
    yellowMs: 500,
    allRedMs: 1500
  });
  console.log('✅ Updated all timings');
  console.log('Final timings:', signal.getTimings());
}

/**
 * Demo: Manual phase control
 */
function demoManualPhaseControl(world) {
  console.log('\n=== Manual Phase Control Demo ===\n');
  
  const junction = world.junctions.values().next().value;
  if (!junction) return;
  
  const signal = junction.signal;
  
  console.log(`Current phase: ${signal.phase}`);
  console.log(`Time remaining: ${signal.getRemainingTime()}ms`);
  
  // Skip to next phase
  console.log('\n🚦 Advancing to next phase...');
  signal.advanceToNextPhase();
  console.log(`New phase: ${signal.phase}`);
  
  // Extend current phase
  console.log('\n⏰ Extending current phase by 3 seconds...');
  signal.extendCurrentPhase(3000);
  console.log(`New remaining time: ${signal.getRemainingTime()}ms`);
}

// ========================================
// 2. ADAPTIVE SIGNAL CONTROL
// ========================================

/**
 * Demo: Queue-based adaptive signal control
 * Adjusts green time based on waiting vehicles
 */
function demoAdaptiveControl(world) {
  console.log('\n=== Adaptive Signal Control Demo ===\n');
  console.log('Starting adaptive control based on queue length...\n');
  
  let intervalId = null;
  let iterations = 0;
  const maxIterations = 20; // Run for 20 iterations
  
  intervalId = setInterval(() => {
    iterations++;
    
    if (iterations > maxIterations) {
      clearInterval(intervalId);
      console.log('\n✅ Adaptive control demo completed');
      return;
    }
    
    for (const junction of world.junctions.values()) {
      const lanes = junction.getLanes();
      
      // Count vehicles in each direction
      const ewCount = (lanes.W?.getQueueLength() || 0) + (lanes.E?.getQueueLength() || 0);
      const nsCount = (lanes.N?.getQueueLength() || 0) + (lanes.S?.getQueueLength() || 0);
      
      const signal = junction.signal;
      const currentTimings = signal.getTimings();
      
      // Adaptive logic: Adjust green time based on demand
      if (ewCount > nsCount * 1.5) {
        // Heavy EW traffic
        signal.updateTimings({ greenMs: 6000 });
        console.log(`Junction ${junction.id}: Heavy EW traffic (${ewCount} vs ${nsCount}) → Green 6s`);
      } else if (nsCount > ewCount * 1.5) {
        // Heavy NS traffic
        signal.updateTimings({ greenMs: 6000 });
        console.log(`Junction ${junction.id}: Heavy NS traffic (${nsCount} vs ${ewCount}) → Green 6s`);
      } else if (ewCount === 0 && nsCount === 0) {
        // No traffic, minimal timing
        signal.updateTimings({ greenMs: 2000, allRedMs: 500 });
        console.log(`Junction ${junction.id}: No traffic → Green 2s, All-red 0.5s`);
      } else {
        // Balanced traffic
        signal.updateTimings({ greenMs: 4000, allRedMs: 2000 });
      }
    }
  }, 2000); // Check every 2 seconds
  
  return intervalId;
}

/**
 * Demo: Time-of-day signal control
 * Simulates rush hour vs off-peak timing adjustments
 */
function demoTimeOfDayControl(world) {
  console.log('\n=== Time-of-Day Signal Control Demo ===\n');
  
  const simTimeMs = world.simTimeMs || 0;
  const simMinutes = simTimeMs / 60000;
  
  // Simulate time-of-day patterns
  const isRushHour = (simMinutes % 60) < 20; // First 20 min of each hour = rush hour
  
  for (const junction of world.junctions.values()) {
    const signal = junction.signal;
    
    if (isRushHour) {
      // Rush hour: longer green, shorter all-red
      signal.updateTimings({ 
        greenMs: 6000,
        allRedMs: 1000
      });
      console.log(`Junction ${junction.id}: Rush hour mode (Green 6s, All-red 1s)`);
    } else {
      // Off-peak: shorter green, standard all-red
      signal.updateTimings({ 
        greenMs: 3000,
        allRedMs: 2500
      });
      console.log(`Junction ${junction.id}: Off-peak mode (Green 3s, All-red 2.5s)`);
    }
  }
}

// ========================================
// 3. EMERGENCY & PRIORITY CONTROL
// ========================================

/**
 * Demo: Emergency vehicle priority
 * Forces all signals green in emergency vehicle's direction
 */
function demoEmergencyControl(world, direction = 'EW') {
  console.log('\n=== Emergency Vehicle Priority Demo ===\n');
  console.log(`🚨 Emergency vehicle approaching from ${direction} direction!\n`);
  
  const targetPhase = direction === 'EW' ? 
    SignalPhase.EW_GREEN : SignalPhase.NS_GREEN;
  
  for (const junction of world.junctions.values()) {
    const signal = junction.signal;
    const currentPhase = signal.phase;
    
    // Force signal to green for emergency vehicle
    signal.setPhase(targetPhase);
    
    // Extend green time for emergency vehicle passage
    signal.extendCurrentPhase(5000);
    
    console.log(`Junction ${junction.id}: ${currentPhase} → ${targetPhase} (Extended 5s)`);
  }
  
  console.log('\n✅ All signals cleared for emergency vehicle');
  
  // Auto-resume normal operation after 10 seconds
  setTimeout(() => {
    console.log('\n🔄 Resuming normal signal operation...');
    for (const junction of world.junctions.values()) {
      junction.signal.start(); // Restart normal cycle
    }
  }, 10000);
}

// ========================================
// 4. OPTIMIZATION ALGORITHMS
// ========================================

/**
 * Demo: Minimize average waiting time
 * Simple optimization that extends green when vehicles are waiting
 */
function demoWaitTimeOptimization(world) {
  console.log('\n=== Wait Time Optimization Demo ===\n');
  console.log('Optimizing signal timings to minimize vehicle waiting time...\n');
  
  let intervalId = null;
  let iterations = 0;
  const maxIterations = 15;
  
  intervalId = setInterval(() => {
    iterations++;
    
    if (iterations > maxIterations) {
      clearInterval(intervalId);
      console.log('\n✅ Wait time optimization completed');
      return;
    }
    
    for (const junction of world.junctions.values()) {
      const lanes = junction.getLanes();
      const signal = junction.signal;
      
      // Calculate average waiting time per direction
      let ewWaitTime = 0, nsWaitTime = 0;
      let ewCount = 0, nsCount = 0;
      
      const simTime = world.simTimeMs;
      
      if (lanes.W) {
        ewWaitTime += lanes.W.getAverageWaitingTime(simTime);
        ewCount += lanes.W.getQueueLength();
      }
      if (lanes.E) {
        ewWaitTime += lanes.E.getAverageWaitingTime(simTime);
        ewCount += lanes.E.getQueueLength();
      }
      if (lanes.N) {
        nsWaitTime += lanes.N.getAverageWaitingTime(simTime);
        nsCount += lanes.N.getQueueLength();
      }
      if (lanes.S) {
        nsWaitTime += lanes.S.getAverageWaitingTime(simTime);
        nsCount += lanes.S.getQueueLength();
      }
      
      const avgEwWait = ewCount > 0 ? ewWaitTime / ewCount : 0;
      const avgNsWait = nsCount > 0 ? nsWaitTime / nsCount : 0;
      
      // Optimization: Extend green for direction with higher waiting time
      const currentPhase = signal.phase;
      
      if ((currentPhase === SignalPhase.EW_GREEN && avgEwWait > 5000) ||
          (currentPhase === SignalPhase.NS_GREEN && avgNsWait > 5000)) {
        signal.extendCurrentPhase(1000);
        console.log(`Junction ${junction.id}: Extended green (EW wait: ${(avgEwWait/1000).toFixed(1)}s, NS wait: ${(avgNsWait/1000).toFixed(1)}s)`);
      }
    }
  }, 2000);
  
  return intervalId;
}

/**
 * Demo: Throughput maximization
 * Adjusts timings to maximize vehicles passing through intersections
 */
function demoThroughputMaximization(world) {
  console.log('\n=== Throughput Maximization Demo ===\n');
  
  const baseStats = world.getStatsSnapshot();
  console.log(`Initial throughput: ${baseStats.currentThroughputPerHour} vehicles/hour\n`);
  
  let bestThroughput = baseStats.currentThroughputPerHour;
  let bestTimings = { greenMs: 3000, allRedMs: 3000 };
  
  // Test different timing configurations
  const configurations = [
    { greenMs: 2000, allRedMs: 1000, name: 'Short cycles' },
    { greenMs: 4000, allRedMs: 2000, name: 'Balanced' },
    { greenMs: 6000, allRedMs: 3000, name: 'Long green' },
    { greenMs: 5000, allRedMs: 1000, name: 'Minimal all-red' }
  ];
  
  console.log('Testing configurations...\n');
  
  let configIndex = 0;
  const testInterval = setInterval(() => {
    if (configIndex >= configurations.length) {
      clearInterval(testInterval);
      
      // Apply best configuration
      for (const junction of world.junctions.values()) {
        junction.signal.updateTimings(bestTimings);
      }
      
      console.log('\n✅ Optimization complete!');
      console.log(`Best configuration: Green ${bestTimings.greenMs}ms, All-red ${bestTimings.allRedMs}ms`);
      console.log(`Expected throughput: ${bestThroughput.toFixed(0)} vehicles/hour`);
      return;
    }
    
    const config = configurations[configIndex];
    
    // Apply configuration to all junctions
    for (const junction of world.junctions.values()) {
      junction.signal.updateTimings(config);
    }
    
    // Measure throughput after a delay
    setTimeout(() => {
      const stats = world.getStatsSnapshot();
      const throughput = stats.currentThroughputPerHour;
      
      console.log(`${config.name}: ${throughput.toFixed(0)} vehicles/hour`);
      
      if (throughput > bestThroughput) {
        bestThroughput = throughput;
        bestTimings = { greenMs: config.greenMs, allRedMs: config.allRedMs };
      }
    }, 2000);
    
    configIndex++;
  }, 5000); // Test each config for 5 seconds
}

// ========================================
// 5. ANALYTICS & MONITORING
// ========================================

/**
 * Monitor signal performance in real-time
 */
function monitorSignalPerformance(world, duration = 30000) {
  console.log('\n=== Signal Performance Monitoring ===\n');
  console.log(`Monitoring for ${duration/1000} seconds...\n`);
  
  const startTime = Date.now();
  
  const intervalId = setInterval(() => {
    const elapsed = Date.now() - startTime;
    
    if (elapsed > duration) {
      clearInterval(intervalId);
      console.log('\n✅ Monitoring completed');
      return;
    }
    
    console.log(`\n--- Time: ${(elapsed/1000).toFixed(0)}s ---`);
    
    for (const junction of world.junctions.values()) {
      const signal = junction.signal;
      const state = signal.getStateSnapshot();
      const stats = signal.getCycleStatistics();
      const lanes = junction.getLanes();
      
      const totalVehicles = Object.values(lanes).reduce((sum, lane) => 
        sum + (lane.getQueueLength() || 0), 0);
      
      console.log(`Junction ${junction.id}:`);
      console.log(`  Phase: ${state.phase} (${(state.remainingMs/1000).toFixed(1)}s remaining)`);
      console.log(`  Queue: ${totalVehicles} vehicles`);
      console.log(`  Avg cycle time: ${(stats.averageCycleTime/1000).toFixed(1)}s`);
      console.log(`  Cycles completed: ${stats.totalCycles}`);
    }
  }, 5000); // Update every 5 seconds
  
  return intervalId;
}

/**
 * Get comprehensive signal control report
 */
function getSignalControlReport(world) {
  console.log('\n=== Signal Control Report ===\n');
  
  const report = {
    junctions: [],
    systemMetrics: {
      totalVehicles: world.vehicles.size,
      totalJunctions: world.junctions.size,
      simulationTime: world.simTimeMs
    }
  };
  
  for (const junction of world.junctions.values()) {
    const signal = junction.signal;
    const timings = signal.getTimings();
    const state = signal.getStateSnapshot();
    const stats = signal.getCycleStatistics();
    const lanes = junction.getLanes();
    
    const laneData = {};
    for (const [dir, lane] of Object.entries(lanes)) {
      laneData[dir] = {
        queueLength: lane.getQueueLength(),
        occupancy: lane.getOccupancyRate(),
        avgWaitTime: lane.getAverageWaitingTime(world.simTimeMs)
      };
    }
    
    report.junctions.push({
      id: junction.id,
      currentPhase: state.phase,
      timings: timings,
      cycleStats: {
        totalCycles: stats.totalCycles,
        avgCycleTime: stats.averageCycleTime,
        avgGreenTime: stats.averageGreenTime
      },
      lanes: laneData
    });
  }
  
  console.log(JSON.stringify(report, null, 2));
  return report;
}

// ========================================
// EXPORT API
// ========================================

// Make all functions available globally
if (typeof window !== 'undefined') {
  window.signalControlDemo = {
    // Basic control
    demoBasicTimingControl,
    demoManualPhaseControl,
    
    // Adaptive control
    demoAdaptiveControl,
    demoTimeOfDayControl,
    
    // Emergency & priority
    demoEmergencyControl,
    
    // Optimization
    demoWaitTimeOptimization,
    demoThroughputMaximization,
    
    // Monitoring
    monitorSignalPerformance,
    getSignalControlReport,
    
    // Quick access to signal constants
    SignalPhase: SignalPhase,
    SignalState: SignalState
  };
  
  console.log('✨ Signal Control Demo API loaded!');
  console.log('📚 Try: signalControlDemo.demoBasicTimingControl(world)');
  console.log('🚦 Try: signalControlDemo.demoAdaptiveControl(world)');
  console.log('🚨 Try: signalControlDemo.demoEmergencyControl(world)');
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    demoBasicTimingControl,
    demoManualPhaseControl,
    demoAdaptiveControl,
    demoTimeOfDayControl,
    demoEmergencyControl,
    demoWaitTimeOptimization,
    demoThroughputMaximization,
    monitorSignalPerformance,
    getSignalControlReport
  };
}
