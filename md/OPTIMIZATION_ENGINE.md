# Energy-Aware Traffic Signal Optimization Engine

## Core Research Contribution

This module represents the **core research contribution** of the Traffic Simulator: an intelligent, energy-aware optimization engine for traffic signal timing that minimizes vehicle idling, reduces unnecessary stops, and maintains signal stability through sophisticated cost-based optimization.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Cost Function](#cost-function)
4. [Optimization Strategies](#optimization-strategies)
5. [API Reference](#api-reference)
6. [Integration Guide](#integration-guide)
7. [Performance Metrics](#performance-metrics)
8. [Research Applications](#research-applications)
9. [Best Practices](#best-practices)

---

## Overview

### Purpose

The Optimization Engine automatically adjusts traffic signal timings based on real-time traffic conditions to:

- **Minimize vehicle idle time** (reducing fuel consumption and emissions)
- **Reduce unnecessary stops** (improving traffic flow)
- **Maintain signal stability** (avoiding frequent timing changes)
- **Coordinate network-wide** (enabling green waves)
- **Adapt to congestion** (dynamic response to traffic patterns)

### Key Features

- **Cost-Based Optimization**: Uses configurable 3-component cost function
- **Multiple Strategies**: 5 distinct optimization approaches (GREEDY, ADAPTIVE, COORDINATED, PRESSURE_BASED, BALANCED)
- **Rule-Based**: No machine learning or reinforcement learning - pure heuristics
- **Real-Time**: Continuous optimization during simulation
- **Energy-Aware**: Focuses on reducing fuel consumption and CO2 emissions
- **Analytics Integration**: Seamless integration with Traffic Analytics layer
- **Performance Tracking**: Comprehensive metrics and historical analysis

### Design Philosophy

1. **Simplicity**: Rule-based algorithms that are explainable and debuggable
2. **Flexibility**: Configurable strategies and cost weights for research
3. **Modularity**: Clear separation between cost calculation, optimization, and application
4. **Efficiency**: Low computational overhead for real-time operation
5. **Research-Oriented**: Designed for experimentation and academic study

---

## Architecture

### Component Hierarchy

```
OptimizationEngine (Main Orchestrator)
├── NetworkOptimizer (Network-wide optimization)
│   └── SignalOptimizer (Per-intersection optimization)
│       └── CostCalculator (Cost function evaluation)
└── TrafficAnalyzer (Traffic state input)
```

### Data Flow

```
Sensors → Analytics → Optimization → Signal Control
   ↓          ↓            ↓              ↓
 Raw      Traffic      Optimized      Applied
 Data      State       Timings        Timings
```

### Class Structure

#### 1. CostCalculator

Evaluates the cost of signal timing configurations.

**Responsibilities:**
- Calculate idle time cost
- Calculate stop penalty cost
- Calculate signal switch cost
- Apply configurable weights
- Normalize costs to 0-100 scale

**Key Method:**
```javascript
calculateCost(trafficState, currentTimings, proposedTimings)
// Returns: { totalCost, components, weighted }
```

#### 2. SignalOptimizer

Optimizes signal timings for individual intersections.

**Responsibilities:**
- Apply optimization strategy
- Generate timing adjustments
- Enforce timing constraints
- Evaluate cost improvements

**Key Methods:**
```javascript
optimize(intersectionState, currentTimings)
// Returns: optimized timing configuration
```

#### 3. NetworkOptimizer

Coordinates optimization across multiple intersections.

**Responsibilities:**
- Network-wide optimization
- Green wave coordination
- Priority management
- Performance aggregation

**Key Method:**
```javascript
optimizeNetwork(analyticsSnapshot, junctions)
// Returns: network optimization results
```

#### 4. OptimizationEngine

Main orchestrator that runs the optimization loop.

**Responsibilities:**
- Periodic optimization execution
- Component coordination
- Metrics tracking
- History management

**Key Methods:**
```javascript
start()              // Begin optimization loop
stop()               // Stop optimization
getPerformanceMetrics()  // Get metrics
getOptimizationHistory() // Get history
```

---

## Cost Function

### Mathematical Formulation

The total cost function combines three components:

```
TotalCost = w₁·IdleCost + w₂·StopCost + w₃·SwitchCost
```

Where:
- `w₁`, `w₂`, `w₃` = Configurable weights
- All costs normalized to [0, 100] range

### Component Breakdown

#### 1. Idle Time Cost

Measures cumulative vehicle idle time (engine running while stationary).

**Formula:**
```
IdleCost = normalize(QueueCost + WaitCost)

QueueCost = Σ(queue_length_i × avg_wait_time_i)
WaitCost = Σ(total_wait_time_i)
```

**Purpose:** Minimize fuel consumption and emissions

**Weight:** Default = 1.0

#### 2. Stop Penalty Cost

Penalizes vehicle stops and high-density queues.

**Formula:**
```
StopCost = normalize(QueuePenalty + DensityPenalty)

QueuePenalty = Σ(queue_length_i²)
DensityPenalty = Σ(density_i × vehicle_count_i)
```

**Purpose:** Improve traffic flow and reduce stop-and-go patterns

**Weight:** Default = 0.8

#### 3. Signal Switch Cost

Penalizes frequent changes to signal timings.

**Formula:**
```
SwitchCost = normalize(GreenDiff + YellowDiff + AllRedDiff)

GreenDiff = |proposed_green - current_green|
YellowDiff = |proposed_yellow - current_yellow|
AllRedDiff = |proposed_allRed - current_allRed|
```

**Purpose:** Maintain signal stability and driver predictability

**Weight:** Default = 0.3

### Weight Configuration

#### Default Configuration
```javascript
{
  idleTime: 1.0,      // Balanced emphasis on idle reduction
  stopPenalty: 0.8,   // Moderate flow improvement
  switchPenalty: 0.3  // Allow necessary adjustments
}
```

#### Energy-Focused Configuration
```javascript
{
  idleTime: 1.5,      // Strong emphasis on idle reduction
  stopPenalty: 0.5,   // Less concern for stops
  switchPenalty: 0.2  // Allow aggressive adjustments
}
```

#### Smooth-Flow Configuration
```javascript
{
  idleTime: 0.8,      // Moderate idle concern
  stopPenalty: 1.2,   // Strong emphasis on flow
  switchPenalty: 0.1  // Allow frequent adjustments
}
```

#### Stability-Focused Configuration
```javascript
{
  idleTime: 0.7,      // Lower idle concern
  stopPenalty: 0.7,   // Moderate flow concern
  switchPenalty: 1.0  // Strong stability preference
}
```

---

## Optimization Strategies

### 1. GREEDY Strategy

**Approach:** Maximize green time for the most congested direction.

**Algorithm:**
```
1. Find direction with highest queue length
2. Increase green time for that direction
3. Decrease green time for others proportionally
4. Enforce min/max constraints
```

**Best For:**
- High congestion scenarios
- Single bottleneck situations
- Simple, predictable behavior

**Characteristics:**
- Fast execution
- Simple logic
- May create oscillations

### 2. ADAPTIVE Strategy

**Approach:** Adjust green time based on congestion level classification.

**Algorithm:**
```
For each direction:
  if congestion = CRITICAL: green = maxGreen
  if congestion = HIGH:     green += 4000ms
  if congestion = MEDIUM:   green += 2000ms
  if congestion = LOW:      green -= 1000ms
```

**Best For:**
- Varying congestion levels
- General-purpose optimization
- Balanced performance

**Characteristics:**
- Uses analytics classification
- Smooth transitions
- Prevents over-correction

### 3. COORDINATED Strategy

**Approach:** Create green waves along arterial routes.

**Algorithm:**
```
1. Identify primary arterial direction
2. Calculate phase offsets based on distance
3. Synchronize green times
4. Adjust for local conditions
```

**Best For:**
- Linear/grid networks
- Arterial corridors
- Commuter routes

**Characteristics:**
- Network-aware
- Progressive timing
- Requires coordination

### 4. PRESSURE_BASED Strategy

**Approach:** Use traffic pressure score to determine green time.

**Algorithm:**
```
For each direction:
  pressure = density × queue_length / capacity
  green_time = min + (pressure / 100) × (max - min)
```

**Best For:**
- Variable demand patterns
- Fair resource allocation
- Dynamic response

**Characteristics:**
- Proportional allocation
- Fair distribution
- Responsive to changes

### 5. BALANCED Strategy

**Approach:** Minimize total cost function through systematic search.

**Algorithm:**
```
1. Generate adjustment candidates: [-2s, -1s, 0, +1s, +2s, +3s, +4s]
2. Calculate cost for each candidate
3. Select candidate with minimum cost
4. Apply if cost < current cost
```

**Best For:**
- Complex intersections
- Research experiments
- Cost minimization focus

**Characteristics:**
- Exhaustive search
- Cost-optimal
- Computationally intensive

---

## API Reference

### OptimizationEngine

#### Constructor

```javascript
new OptimizationEngine({
  trafficAnalyzer: TrafficAnalyzer,  // Required
  world: World,                       // Required (for junctions)
  strategy: 'ADAPTIVE',               // Default: ADAPTIVE
  autoRun: false                      // Default: false
})
```

#### Methods

##### start()
Begin the optimization loop.

```javascript
engine.start();
```

##### stop()
Stop the optimization loop.

```javascript
engine.stop();
```

##### getPerformanceMetrics()
Get comprehensive performance metrics.

```javascript
const metrics = engine.getPerformanceMetrics();
// Returns:
// {
//   totalOptimizations: number,
//   currentCost: number,
//   averageCost: number,
//   minCost: number,
//   maxCost: number,
//   improvements: number,
//   degradations: number
// }
```

##### getOptimizationHistory()
Get historical optimization results (last 50).

```javascript
const history = engine.getOptimizationHistory();
// Returns: Array of optimization records
```

##### setStrategy(strategy)
Change optimization strategy at runtime.

```javascript
engine.setStrategy('COORDINATED');
```

#### Properties

```javascript
engine.strategy              // Current strategy
engine.optimizationIntervalMs // Optimization interval (default: 5000ms)
engine.isRunning             // Running state
engine.costCalculator        // CostCalculator instance
engine.signalOptimizer       // SignalOptimizer instance
engine.networkOptimizer      // NetworkOptimizer instance
```

### CostCalculator

#### Constructor

```javascript
new CostCalculator({
  weights: {
    idleTime: 1.0,
    stopPenalty: 0.8,
    switchPenalty: 0.3
  }
})
```

#### Methods

##### calculateCost(trafficState, currentTimings, proposedTimings)

Calculate cost for a timing configuration.

```javascript
const cost = calculator.calculateCost(
  intersectionState,
  currentTimings,
  proposedTimings
);
// Returns:
// {
//   totalCost: number,
//   components: { idleCost, stopCost, switchCost },
//   weighted: { idleCost, stopCost, switchCost }
// }
```

### SignalOptimizer

#### Constructor

```javascript
new SignalOptimizer({
  costCalculator: CostCalculator,
  strategy: 'ADAPTIVE'
})
```

#### Methods

##### optimize(intersectionState, currentTimings)

Optimize signal timings for an intersection.

```javascript
const optimized = optimizer.optimize(
  intersectionState,
  currentTimings
);
// Returns: { green, yellow, allRed } for each direction
```

### NetworkOptimizer

#### Constructor

```javascript
new NetworkOptimizer({
  signalOptimizer: SignalOptimizer
})
```

#### Methods

##### optimizeNetwork(analyticsSnapshot, junctions)

Optimize entire network.

```javascript
const results = networkOptimizer.optimizeNetwork(
  analyticsSnapshot,
  junctions
);
// Returns: {
//   totalCost,
//   intersectionResults: Map,
//   timestamp
// }
```

---

## Integration Guide

### Basic Setup

```javascript
// 1. Create world
const world = new World({ gridSize: 3, roadLength: 200 });

// 2. Start simulation
world.start();

// 3. Start optimization
const optimizer = world.startOptimization('ADAPTIVE', 5000);

// 4. Monitor performance
setInterval(() => {
  const metrics = optimizer.getPerformanceMetrics();
  console.log('Cost:', metrics.currentCost);
}, 1000);

// 5. Stop optimization
world.stopOptimization();
```

### Advanced Configuration

```javascript
// Create engine with custom configuration
const optimizer = world.getOptimizationEngine('BALANCED');

// Customize cost weights
optimizer.costCalculator.weights = {
  idleTime: 1.5,
  stopPenalty: 0.5,
  switchPenalty: 0.2
};

// Set optimization interval
optimizer.optimizationIntervalMs = 3000;

// Start optimization
optimizer.start();
```

### Strategy Switching

```javascript
const optimizer = world.startOptimization('ADAPTIVE');

// Switch to coordinated after 30 seconds
setTimeout(() => {
  optimizer.setStrategy('COORDINATED');
  console.log('Switched to coordinated strategy');
}, 30000);
```

### Manual Optimization

```javascript
const optimizer = world.getOptimizationEngine();

// Run single optimization cycle
const results = optimizer.networkOptimizer.optimizeNetwork(
  world.trafficAnalyzer.getSnapshot(),
  world.junctions
);

console.log('Optimization cost:', results.totalCost);
```

---

## Performance Metrics

### Available Metrics

| Metric | Description | Unit |
|--------|-------------|------|
| totalOptimizations | Number of optimization cycles | count |
| currentCost | Most recent cost value | 0-300 |
| averageCost | Mean cost across all cycles | 0-300 |
| minCost | Best cost achieved | 0-300 |
| maxCost | Worst cost encountered | 0-300 |
| improvements | Cycles that reduced cost | count |
| degradations | Cycles that increased cost | count |

### Success Rate Calculation

```javascript
const metrics = optimizer.getPerformanceMetrics();
const successRate = (metrics.improvements / metrics.totalOptimizations) * 100;
console.log(`Success rate: ${successRate.toFixed(1)}%`);
```

### Cost Evolution Tracking

```javascript
const history = optimizer.getOptimizationHistory();
const costTrend = history.map(entry => ({
  time: entry.timestamp,
  cost: entry.cost
}));

// Analyze trend
const firstCost = costTrend[0].cost;
const lastCost = costTrend[costTrend.length - 1].cost;
const improvement = ((firstCost - lastCost) / firstCost) * 100;
console.log(`Total improvement: ${improvement.toFixed(1)}%`);
```

---

## Research Applications

### 1. Strategy Comparison Studies

Compare different optimization strategies under various conditions:

```javascript
const strategies = ['GREEDY', 'ADAPTIVE', 'PRESSURE_BASED', 'BALANCED'];
const results = {};

for (const strategy of strategies) {
  const world = createWorld();
  const optimizer = world.startOptimization(strategy);
  
  // Run for 60 seconds
  await sleep(60000);
  
  results[strategy] = optimizer.getPerformanceMetrics();
  world.destroy();
}

// Analyze results
analyzeStrategyPerformance(results);
```

### 2. Cost Weight Optimization

Find optimal cost function weights:

```javascript
const weightConfigurations = [
  { idle: 1.0, stop: 0.8, switch: 0.3 },
  { idle: 1.5, stop: 0.5, switch: 0.2 },
  { idle: 0.8, stop: 1.2, switch: 0.1 },
  // ... more configurations
];

for (const weights of weightConfigurations) {
  const optimizer = createOptimizer();
  optimizer.costCalculator.weights = weights;
  
  // Test configuration
  const performance = await runExperiment(optimizer);
  recordResults(weights, performance);
}
```

### 3. Congestion Response Analysis

Study optimization behavior under different congestion levels:

```javascript
const congestionLevels = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

for (const level of congestionLevels) {
  const world = createWorld();
  spawnVehiclesForCongestion(world, level);
  
  const optimizer = world.startOptimization('ADAPTIVE');
  
  // Monitor response
  const response = await monitorOptimization(optimizer, 30000);
  
  analyzeResponse(level, response);
  world.destroy();
}
```

### 4. Network Coordination Studies

Evaluate green wave effectiveness:

```javascript
// Test 1: Independent optimization
const world1 = createGridWorld(4, 4);
const optimizer1 = world1.startOptimization('ADAPTIVE');
const independentResults = await runTest(optimizer1, 60000);

// Test 2: Coordinated optimization
const world2 = createGridWorld(4, 4);
const optimizer2 = world2.startOptimization('COORDINATED');
const coordinatedResults = await runTest(optimizer2, 60000);

// Compare results
compareCoordinationBenefit(independentResults, coordinatedResults);
```

### 5. Real-Time Adaptation Studies

Test dynamic response to changing conditions:

```javascript
const optimizer = world.startOptimization('ADAPTIVE');

// Phase 1: Light traffic
spawnVehicles(15);
const phase1Metrics = await captureMetrics(10000);

// Phase 2: Add congestion
spawnVehicles(30);
const phase2Metrics = await captureMetrics(10000);

// Phase 3: Peak traffic
spawnVehicles(50);
const phase3Metrics = await captureMetrics(10000);

// Analyze adaptation
analyzeAdaptationSpeed([phase1Metrics, phase2Metrics, phase3Metrics]);
```

---

## Best Practices

### 1. Strategy Selection

| Scenario | Recommended Strategy | Reason |
|----------|---------------------|---------|
| General purpose | ADAPTIVE | Balanced performance |
| Heavy congestion | GREEDY | Quick response |
| Grid networks | COORDINATED | Green wave benefits |
| Variable demand | PRESSURE_BASED | Fair allocation |
| Research/tuning | BALANCED | Cost-optimal |

### 2. Optimization Interval

- **Light traffic:** 5-10 seconds (less frequent optimization needed)
- **Medium traffic:** 3-5 seconds (balanced responsiveness)
- **Heavy traffic:** 2-3 seconds (quick adaptation required)
- **Research:** 4-6 seconds (stable metrics collection)

### 3. Cost Weight Tuning

**For Energy Efficiency:**
- Increase `idleTime` weight (1.2-1.5)
- Decrease `stopPenalty` weight (0.5-0.7)
- Lower `switchPenalty` weight (0.1-0.2)

**For Traffic Flow:**
- Decrease `idleTime` weight (0.7-0.9)
- Increase `stopPenalty` weight (1.0-1.3)
- Lower `switchPenalty` weight (0.1-0.2)

**For Signal Stability:**
- Moderate `idleTime` weight (0.8-1.0)
- Moderate `stopPenalty` weight (0.7-0.9)
- Increase `switchPenalty` weight (0.8-1.2)

### 4. Performance Monitoring

```javascript
// Set up comprehensive monitoring
setInterval(() => {
  const metrics = optimizer.getPerformanceMetrics();
  const snapshot = world.trafficAnalyzer.getSnapshot();
  
  logMetrics({
    timestamp: Date.now(),
    cost: metrics.currentCost,
    congestion: snapshot.network.congestionLevel,
    successRate: metrics.improvements / metrics.totalOptimizations,
    avgQueueLength: snapshot.network.averageQueueLength
  });
}, 1000);
```

### 5. Debugging

```javascript
// Enable detailed logging
optimizer.networkOptimizer.signalOptimizer.debug = true;

// Track optimization history
const history = optimizer.getOptimizationHistory();
console.log('Recent optimizations:', history.slice(-5));

// Analyze cost breakdown
const latest = history[history.length - 1];
if (latest.costBreakdown) {
  console.log('Cost components:', latest.costBreakdown.components);
  console.log('Weighted costs:', latest.costBreakdown.weighted);
}
```

### 6. Testing Scenarios

```javascript
// Create reproducible test scenario
function createTestScenario(name) {
  const world = new World({
    gridSize: 3,
    roadLength: 200,
    seed: name  // Reproducible randomness
  });
  
  world.start();
  spawnTestVehicles(world, 40);
  
  return world;
}

// Run controlled experiment
async function runExperiment(strategy, duration) {
  const world = createTestScenario('experiment-1');
  const optimizer = world.startOptimization(strategy, 5000);
  
  await sleep(duration);
  
  const results = optimizer.getPerformanceMetrics();
  world.destroy();
  
  return results;
}
```

---

## Conclusion

The Energy-Aware Optimization Engine provides a sophisticated yet explainable approach to traffic signal control. Its rule-based design, configurable cost function, and multiple optimization strategies make it ideal for research applications while maintaining real-time performance.

Key advantages:
- ✅ Explainable (no black-box ML)
- ✅ Configurable (weights, strategies, intervals)
- ✅ Energy-aware (CO2/fuel reduction focus)
- ✅ Real-time capable (low computational overhead)
- ✅ Research-ready (comprehensive metrics and history)

For quick reference, see [OPTIMIZATION_QUICK.md](OPTIMIZATION_QUICK.md).

For implementation details, see [OPTIMIZATION_IMPLEMENTATION.md](OPTIMIZATION_IMPLEMENTATION.md).
