# Dynamic Traffic Signal Control - Technical Documentation

## Overview

The traffic simulator now supports **dynamic traffic signal control** with a comprehensive API for runtime configuration and optimization. This enables research on adaptive signal timing, optimization algorithms, and real-time traffic management.

---

## Key Features

✅ **Configurable Phase Durations** - Adjust green, yellow, and all-red timings at runtime  
✅ **Manual Phase Control** - Force specific signal phases for testing or emergencies  
✅ **Adaptive Control Interface** - APIs designed for optimization algorithms  
✅ **Phase Extension** - Extend current phase duration dynamically  
✅ **Cycle Statistics** - Track and analyze signal performance  
✅ **Emergency Override** - Priority control for emergency vehicles  

---

## Signal Control API Reference

### 1. Update Signal Timings

**Primary method for optimization algorithms**

```javascript
signal.updateTimings({
  greenMs: 5000,      // Green phase duration (ms)
  yellowMs: 500,      // Yellow phase duration (ms)
  allRedMs: 1500,     // All-red phase duration (ms)
  applyImmediately: false  // Reset current phase timer
});
```

**Parameters:**
- `greenMs` (number, optional): Green light duration. Min: 500ms
- `yellowMs` (number, optional): Yellow light duration. Min: 200ms
- `allRedMs` (number, optional): All-red clearance time. Min: 0ms
- `applyImmediately` (boolean, optional): If true, resets current phase timer. Default: false

**Examples:**

```javascript
// Example 1: Increase green time for heavy traffic
const junction = world.junctions.get('0,0');
junction.signal.updateTimings({ greenMs: 6000 });

// Example 2: Minimize delay with short cycles
junction.signal.updateTimings({ 
  greenMs: 2000, 
  allRedMs: 500 
});

// Example 3: Update all timings and apply immediately
junction.signal.updateTimings({ 
  greenMs: 4000,
  yellowMs: 400,
  allRedMs: 1000,
  applyImmediately: true
});

// Example 4: Adaptive control based on queue
const lanes = junction.getLanes();
const queueLength = lanes.W.getQueueLength() + lanes.E.getQueueLength();
if (queueLength > 10) {
  junction.signal.updateTimings({ greenMs: 7000 });
}
```

---

### 2. Get Current Timings

```javascript
const timings = signal.getTimings();
// Returns: { greenMs: 3000, yellowMs: 400, allRedMs: 3000 }
```

---

### 3. Manual Phase Control

**Force a specific signal phase**

```javascript
signal.setPhase(phase, resetTimer = true);
```

**Parameters:**
- `phase` (string): One of `SignalPhase.EW_GREEN`, `SignalPhase.EW_YELLOW`, `SignalPhase.NS_GREEN`, `SignalPhase.NS_YELLOW`, `SignalPhase.ALL_RED`
- `resetTimer` (boolean, optional): Whether to reset phase timer. Default: true

**Examples:**

```javascript
import { SignalPhase } from './js/signal.js';

// Force green for emergency vehicle
signal.setPhase(SignalPhase.EW_GREEN);

// Set phase without resetting timer
signal.setPhase(SignalPhase.NS_GREEN, false);
```

**⚠️ Warning:** This bypasses normal phase transitions. Use for emergencies or testing only.

---

### 4. Advance to Next Phase

**Skip to the next phase in the cycle**

```javascript
signal.advanceToNextPhase();
// Returns: true if successful, false if signal not running
```

**Example:**

```javascript
// Skip to next phase if no vehicles waiting
const totalVehicles = Object.values(junction.getLanes())
  .reduce((sum, lane) => sum + lane.getQueueLength(), 0);

if (totalVehicles === 0) {
  signal.advanceToNextPhase();
}
```

---

### 5. Extend Current Phase

**Add time to current phase duration**

```javascript
signal.extendCurrentPhase(additionalMs);
// Returns: true if successful, false if invalid input
```

**Example:**

```javascript
// Extend green if vehicles still waiting
if (lane.getQueueLength() > 5) {
  signal.extendCurrentPhase(2000); // +2 seconds
}
```

---

### 6. Get Remaining Time

```javascript
const remaining = signal.getRemainingTime();
// Returns: milliseconds remaining in current phase
```

---

### 7. Get Cycle Statistics

```javascript
const stats = signal.getCycleStatistics();
```

**Returns:**
```javascript
{
  totalCycles: 45,           // Number of phase changes
  averageCycleTime: 8500,    // Avg time per cycle (ms)
  averageGreenTime: 3200,    // Avg green duration (ms)
  averageRedTime: 5300,      // Avg red duration (ms)
  history: [...]             // Phase history array
}
```

---

## Vehicle Behavior with Signals

### ✅ Stop at Red
Vehicles automatically stop before the stop line when signal is:
- RED
- YELLOW (unless already committed)
- ALL_RED

```javascript
// Vehicle checks signal in planStep()
const green = junction.signal.isGreen(axis);
if (!green && !vehicle.committedJunction) {
  // Stop before stop line
  vehicle.plan.blockedAtStop = true;
}
```

### ✅ Queue Correctly
Vehicles maintain safe following distances and queue behind stopped vehicles.

```javascript
// Queuing handled by SimulationEngine
const gap = config.CAR_GAP;  // Minimum gap between vehicles
follower.plan.nx = Math.min(follower.plan.nx, leader.plan.nx - gap - leader.len);
```

### ✅ Proceed on Green
Once signal turns green, vehicles proceed through intersection.

```javascript
// Vehicle proceeds when signal is green
if (signal.isGreen(axis)) {
  // Continue movement
  vehicle.plan.blockedAtStop = false;
}
```

---

## Optimization Use Cases

### 1. Queue-Based Adaptive Control

**Adjust green time based on queue length**

```javascript
function adaptiveSignalControl() {
  for (const junction of world.junctions.values()) {
    const lanes = junction.getLanes();
    
    // Count vehicles per direction
    const ewQueue = lanes.W.getQueueLength() + lanes.E.getQueueLength();
    const nsQueue = lanes.N.getQueueLength() + lanes.S.getQueueLength();
    
    // Adaptive logic
    if (ewQueue > nsQueue * 1.5) {
      junction.signal.updateTimings({ greenMs: 6000 }); // Favor EW
    } else if (nsQueue > ewQueue * 1.5) {
      junction.signal.updateTimings({ greenMs: 6000 }); // Favor NS
    } else {
      junction.signal.updateTimings({ greenMs: 4000 }); // Balanced
    }
  }
}

// Run every 5 seconds
setInterval(adaptiveSignalControl, 5000);
```

---

### 2. Waiting Time Minimization

**Extend green phase when vehicles are waiting**

```javascript
function minimizeWaitingTime() {
  for (const junction of world.junctions.values()) {
    const lanes = junction.getLanes();
    const signal = junction.signal;
    const simTime = world.simTimeMs;
    
    // Calculate average wait time for current green direction
    let avgWait = 0;
    let count = 0;
    
    if (signal.phase === SignalPhase.EW_GREEN) {
      avgWait = (lanes.W.getAverageWaitingTime(simTime) + 
                 lanes.E.getAverageWaitingTime(simTime)) / 2;
      count = lanes.W.getQueueLength() + lanes.E.getQueueLength();
    }
    
    // Extend green if vehicles still waiting
    if (avgWait > 5000 && count > 3) {
      signal.extendCurrentPhase(1000);
      console.log(`Extended green at ${junction.id} (avg wait: ${avgWait}ms)`);
    }
  }
}

setInterval(minimizeWaitingTime, 2000);
```

---

### 3. Emergency Vehicle Priority

**Clear path for emergency vehicles**

```javascript
function emergencyVehiclePriority(direction = 'EW') {
  const targetPhase = direction === 'EW' ? 
    SignalPhase.EW_GREEN : SignalPhase.NS_GREEN;
  
  // Force all signals green for emergency vehicle
  for (const junction of world.junctions.values()) {
    junction.signal.setPhase(targetPhase);
    junction.signal.extendCurrentPhase(5000); // Hold for 5s
  }
  
  console.log('🚨 Emergency vehicle priority activated');
  
  // Resume normal operation after 10 seconds
  setTimeout(() => {
    for (const junction of world.junctions.values()) {
      junction.signal.start(); // Restart normal cycle
    }
    console.log('✅ Normal operation resumed');
  }, 10000);
}

// Activate emergency mode
emergencyVehiclePriority('EW');
```

---

### 4. Time-of-Day Patterns

**Adjust timing based on time of day**

```javascript
function timeOfDayControl() {
  const hour = new Date().getHours();
  
  // Define timing patterns
  let timings;
  if (hour >= 7 && hour <= 9) {
    // Morning rush hour
    timings = { greenMs: 6000, allRedMs: 1000 };
  } else if (hour >= 17 && hour <= 19) {
    // Evening rush hour
    timings = { greenMs: 6000, allRedMs: 1000 };
  } else if (hour >= 22 || hour <= 5) {
    // Night time - minimal traffic
    timings = { greenMs: 2000, allRedMs: 500 };
  } else {
    // Normal operations
    timings = { greenMs: 4000, allRedMs: 2000 };
  }
  
  // Apply to all junctions
  for (const junction of world.junctions.values()) {
    junction.signal.updateTimings(timings);
  }
}

// Update every hour
setInterval(timeOfDayControl, 3600000);
```

---

### 5. Throughput Maximization

**Find optimal timings for maximum throughput**

```javascript
async function optimizeThroughput() {
  const configurations = [
    { greenMs: 2000, allRedMs: 1000 },
    { greenMs: 3000, allRedMs: 1500 },
    { greenMs: 4000, allRedMs: 2000 },
    { greenMs: 5000, allRedMs: 2500 },
    { greenMs: 6000, allRedMs: 3000 }
  ];
  
  let bestConfig = null;
  let bestThroughput = 0;
  
  for (const config of configurations) {
    // Apply configuration
    for (const junction of world.junctions.values()) {
      junction.signal.updateTimings(config);
    }
    
    // Wait for stabilization
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Measure throughput
    const stats = world.getStatsSnapshot();
    const throughput = stats.currentThroughputPerHour;
    
    console.log(`Config (${config.greenMs}/${config.allRedMs}): ${throughput} veh/hr`);
    
    if (throughput > bestThroughput) {
      bestThroughput = throughput;
      bestConfig = config;
    }
  }
  
  // Apply best configuration
  for (const junction of world.junctions.values()) {
    junction.signal.updateTimings(bestConfig);
  }
  
  console.log(`✅ Optimal config: Green ${bestConfig.greenMs}ms, All-red ${bestConfig.allRedMs}ms`);
  console.log(`   Throughput: ${bestThroughput} vehicles/hour`);
}

optimizeThroughput();
```

---

## Integration with Machine Learning

### Reinforcement Learning Interface

```javascript
class TrafficSignalRLAgent {
  constructor(world) {
    this.world = world;
  }
  
  // Get state observation for ML model
  getState(junction) {
    const lanes = junction.getLanes();
    const signal = junction.signal;
    
    return {
      // Queue lengths
      queueNorth: lanes.N.getQueueLength(),
      queueSouth: lanes.S.getQueueLength(),
      queueEast: lanes.E.getQueueLength(),
      queueWest: lanes.W.getQueueLength(),
      
      // Waiting times
      waitNorth: lanes.N.getAverageWaitingTime(this.world.simTimeMs),
      waitSouth: lanes.S.getAverageWaitingTime(this.world.simTimeMs),
      waitEast: lanes.E.getAverageWaitingTime(this.world.simTimeMs),
      waitWest: lanes.W.getAverageWaitingTime(this.world.simTimeMs),
      
      // Current signal state
      currentPhase: signal.phase,
      remainingTime: signal.getRemainingTime(),
      
      // Timing configuration
      timings: signal.getTimings()
    };
  }
  
  // Execute action from ML model
  executeAction(junction, action) {
    const signal = junction.signal;
    
    switch(action.type) {
      case 'EXTEND_GREEN':
        signal.extendCurrentPhase(action.duration);
        break;
        
      case 'ADVANCE_PHASE':
        signal.advanceToNextPhase();
        break;
        
      case 'UPDATE_TIMINGS':
        signal.updateTimings(action.timings);
        break;
        
      case 'SET_PHASE':
        signal.setPhase(action.phase);
        break;
    }
  }
  
  // Calculate reward for RL training
  calculateReward(junction) {
    const lanes = junction.getLanes();
    const simTime = this.world.simTimeMs;
    
    // Reward = negative of total waiting time
    let totalWait = 0;
    for (const lane of Object.values(lanes)) {
      totalWait += lane.getAverageWaitingTime(simTime) * lane.getQueueLength();
    }
    
    return -totalWait; // Lower wait time = higher reward
  }
}

// Usage
const agent = new TrafficSignalRLAgent(world);
const state = agent.getState(junction);
const action = mlModel.predict(state);
agent.executeAction(junction, action);
const reward = agent.calculateReward(junction);
```

---

## Demo Functions

The simulator includes pre-built demo functions accessible via `signalControlDemo`:

```javascript
// Basic control
signalControlDemo.demoBasicTimingControl(world);
signalControlDemo.demoManualPhaseControl(world);

// Adaptive control
signalControlDemo.demoAdaptiveControl(world);
signalControlDemo.demoTimeOfDayControl(world);

// Emergency control
signalControlDemo.demoEmergencyControl(world, 'EW');

// Optimization
signalControlDemo.demoWaitTimeOptimization(world);
signalControlDemo.demoThroughputMaximization(world);

// Monitoring
signalControlDemo.monitorSignalPerformance(world, 30000);
const report = signalControlDemo.getSignalControlReport(world);
```

---

## Best Practices

### 1. Minimum Timing Constraints
- **Green**: Minimum 500ms (safety clearance)
- **Yellow**: Minimum 200ms (reaction time)
- **All-Red**: Minimum 0ms (can be disabled)

### 2. Gradual Changes
Avoid abrupt timing changes that could confuse drivers or cause safety issues:

```javascript
// ✅ Good: Gradual adjustment
const current = signal.getTimings();
signal.updateTimings({ 
  greenMs: current.greenMs + 500 
});

// ❌ Avoid: Extreme jumps
signal.updateTimings({ greenMs: 10000 }); // Too long
```

### 3. Phase Coordination
For adjacent intersections, coordinate phases to create "green waves":

```javascript
function coordinateSignals(junctions) {
  const basePhase = SignalPhase.EW_GREEN;
  const offset = 2000; // 2 second offset
  
  junctions.forEach((junction, index) => {
    junction.signal.setPhase(basePhase);
    setTimeout(() => {
      junction.signal.start();
    }, index * offset);
  });
}
```

### 4. Performance Monitoring
Continuously monitor and log signal performance:

```javascript
function logPerformance() {
  for (const junction of world.junctions.values()) {
    const stats = junction.signal.getCycleStatistics();
    console.log(`Junction ${junction.id}:`, {
      cycles: stats.totalCycles,
      avgCycle: stats.averageCycleTime,
      efficiency: stats.averageGreenTime / stats.averageCycleTime
    });
  }
}

setInterval(logPerformance, 60000); // Every minute
```

---

## Validation

To verify signal control is working:

```javascript
// 1. Check vehicles stop at red
const stoppedVehicles = Array.from(world.vehicles)
  .filter(v => v.isCurrentlyWaiting()).length;
console.log(`${stoppedVehicles} vehicles stopped at red lights`);

// 2. Verify timing changes
const junction = world.junctions.values().next().value;
console.log('Before:', junction.signal.getTimings());
junction.signal.updateTimings({ greenMs: 5000 });
console.log('After:', junction.signal.getTimings());

// 3. Test phase control
console.log('Current phase:', junction.signal.phase);
junction.signal.advanceToNextPhase();
console.log('New phase:', junction.signal.phase);

// 4. Monitor queue lengths
for (const [dir, lane] of Object.entries(junction.getLanes())) {
  console.log(`${dir} lane: ${lane.getQueueLength()} vehicles`);
}
```

---

## Summary

The dynamic traffic signal control system provides:

✅ **Runtime Configuration** - Update timings without restart  
✅ **Adaptive Control** - Respond to real-time traffic conditions  
✅ **Optimization Interface** - APIs for ML/RL algorithms  
✅ **Emergency Override** - Priority control for special cases  
✅ **Performance Tracking** - Comprehensive cycle statistics  
✅ **Research-Ready** - Suitable for academic optimization research  

**Next Steps:**
- Implement custom optimization algorithms
- Train machine learning models
- Conduct comparative studies
- Analyze energy impact of different strategies

**See Also:**
- [ARCHITECTURE.md](../ARCHITECTURE.md) - System architecture
- [QUICK_REFERENCE.md](../QUICK_REFERENCE.md) - API quick reference
- `js/signalControlDemo.js` - Example implementations
