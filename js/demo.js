/**
 * Demo: Programmatic State Access
 * 
 * This demo shows how to access simulation state programmatically
 * for research and analytics purposes.
 */

// Example 1: Access complete simulation state
function demoSimulationState(world) {
  console.log('=== Simulation State Demo ===');
  
  const state = world.getSimulationState();
  
  console.log(`Simulation Time: ${state.simTimeMs}ms`);
  console.log(`Total Junctions: ${state.junctionCount}`);
  console.log(`Total Vehicles: ${state.vehicleCount}`);
  console.log(`Running: ${state.isRunning}, Paused: ${state.isPaused}`);
  
  return state;
}

// Example 2: Access individual junction state
function demoJunctionState(world) {
  console.log('\n=== Junction State Demo ===');
  
  const junction = world.junctions.values().next().value;
  if (!junction) {
    console.log('No junctions available');
    return;
  }
  
  const state = junction.getState(world.simTimeMs);
  
  console.log(`Junction ID: ${state.id}`);
  console.log(`Position: Row ${state.position.r}, Col ${state.position.c}`);
  console.log(`Signal Phase: ${state.signalState.phase}`);
  console.log(`Total Vehicles: ${state.totalVehicles}`);
  
  // Lane details
  console.log('\nLane States:');
  for (const [dir, laneState] of Object.entries(state.lanes)) {
    console.log(`  ${dir}: ${laneState.vehicleCount} vehicles, ${(laneState.occupancyRate * 100).toFixed(1)}% occupancy`);
  }
  
  return state;
}

// Example 3: Access vehicle states
function demoVehicleStates(world) {
  console.log('\n=== Vehicle States Demo ===');
  
  let totalWaiting = 0;
  let waitingCount = 0;
  
  for (const vehicle of world.vehicles) {
    const state = vehicle.getState(world.simTimeMs);
    
    if (state.isWaiting) {
      waitingCount++;
      totalWaiting += state.waitingTime;
    }
  }
  
  console.log(`Total Vehicles: ${world.vehicles.size}`);
  console.log(`Waiting Vehicles: ${waitingCount}`);
  if (waitingCount > 0) {
    console.log(`Average Wait Time: ${(totalWaiting / waitingCount / 1000).toFixed(2)}s`);
  }
}

// Example 4: Energy and emissions tracking
function demoEnergyMetrics(world) {
  console.log('\n=== Energy Metrics Demo ===');
  
  const stats = world.getStatsSnapshot();
  
  console.log(`Total CO₂ Emissions: ${(stats.totalCo2G / 1000).toFixed(2)} kg`);
  console.log(`Current CO₂ Rate: ${stats.co2RateGPerMin.toFixed(2)} g/min`);
  console.log(`Total Distance: ${((stats.totalDistancePx / 10) / 1000).toFixed(2)} km`);
  console.log(`Idle Time: ${(stats.totalIdleMs / 1000).toFixed(1)}s`);
  console.log(`Moving Time: ${(stats.totalMovingMs / 1000).toFixed(1)}s`);
  
  const totalTime = stats.totalIdleMs + stats.totalMovingMs;
  if (totalTime > 0) {
    console.log(`Stop Percentage: ${((stats.totalIdleMs / totalTime) * 100).toFixed(1)}%`);
  }
  
  if (stats.totalCompleted > 0) {
    const avgCo2 = stats.completedCo2G / stats.totalCompleted;
    console.log(`Average CO₂ per Trip: ${avgCo2.toFixed(0)} g`);
  }
}

// Example 5: Signal timing analysis
function demoSignalAnalysis(world) {
  console.log('\n=== Signal Timing Analysis Demo ===');
  
  for (const junction of world.junctions.values()) {
    const signalState = junction.signal.getStateSnapshot();
    
    console.log(`\nJunction ${junction.id}:`);
    console.log(`  Phase: ${signalState.phase}`);
    console.log(`  H-State: ${signalState.horizontalState}, V-State: ${signalState.verticalState}`);
    console.log(`  Time Remaining: ${(signalState.remainingMs / 1000).toFixed(1)}s`);
    
    if (signalState.cycleHistory.length > 0) {
      console.log(`  Phase History Length: ${signalState.cycleHistory.length}`);
    }
  }
}

// Example 6: Performance metrics
function demoPerformanceMetrics(world) {
  console.log('\n=== Performance Metrics Demo ===');
  
  const perf = world.simulationEngine.getPerformanceMetrics();
  
  console.log(`Total Steps: ${perf.totalSteps}`);
  console.log(`Average Step Time: ${perf.averageStepTime.toFixed(3)}ms`);
  console.log(`Last Step Time: ${perf.lastStepTime.toFixed(3)}ms`);
  console.log(`Estimated FPS: ${perf.fps.toFixed(1)}`);
}

// Example 7: Data collection for research
function collectResearchData(world) {
  console.log('\n=== Research Data Collection Demo ===');
  
  const data = {
    timestamp: world.simTimeMs,
    
    // Simulation state
    vehicleCount: world.vehicles.size,
    junctionCount: world.junctions.size,
    
    // Traffic metrics
    stats: world.getStatsSnapshot(),
    
    // Junction states
    junctions: [],
    
    // Energy metrics
    energy: {
      totalCo2G: world.stats.totalCo2G,
      co2RateGPerMin: world.stats.co2RateGPerMin,
      idleTimeMs: world.stats.totalIdleMs,
      movingTimeMs: world.stats.totalMovingMs
    },
    
    // Performance
    performance: world.simulationEngine.getPerformanceMetrics()
  };
  
  // Collect junction-level data
  for (const junction of world.junctions.values()) {
    const jState = junction.getState(world.simTimeMs);
    const jMetrics = junction.getMetrics();
    
    data.junctions.push({
      id: jState.id,
      position: jState.position,
      signalPhase: jState.signalState.phase,
      totalVehicles: jState.totalVehicles,
      avgOccupancy: jMetrics.averageOccupancyRate,
      utilization: jMetrics.utilizationRate
    });
  }
  
  console.log('Research data collected:');
  console.log(JSON.stringify(data, null, 2));
  
  return data;
}

// Main demo function - run all demos
function runAllDemos(world) {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║  Traffic Simulator - Programmatic API Demo  ║');
  console.log('╚════════════════════════════════════════════╝');
  
  demoSimulationState(world);
  demoJunctionState(world);
  demoVehicleStates(world);
  demoEnergyMetrics(world);
  demoSignalAnalysis(world);
  demoPerformanceMetrics(world);
  
  // Collect research data (optional - can generate large output)
  // collectResearchData(world);
  
  console.log('\n✅ All demos completed!');
  console.log('💡 Tip: You can run individual demos by calling:');
  console.log('   demoSimulationState(world)');
  console.log('   demoJunctionState(world)');
  console.log('   demoVehicleStates(world)');
  console.log('   etc.');
}

// Make functions available globally for console access
if (typeof window !== 'undefined') {
  window.trafficSimDemo = {
    runAllDemos,
    demoSimulationState,
    demoJunctionState,
    demoVehicleStates,
    demoEnergyMetrics,
    demoSignalAnalysis,
    demoPerformanceMetrics,
    collectResearchData
  };
  
  console.log('✨ Traffic Simulator Demo API loaded!');
  console.log('📚 Run: trafficSimDemo.runAllDemos(world)');
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    runAllDemos,
    demoSimulationState,
    demoJunctionState,
    demoVehicleStates,
    demoEnergyMetrics,
    demoSignalAnalysis,
    demoPerformanceMetrics,
    collectResearchData
  };
}
