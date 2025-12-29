# Evaluation & Monitoring System

Complete monitoring and evaluation framework for academic analysis and reporting.

## Overview

This system provides comprehensive tools for evaluating traffic signal control strategies:

- **Metrics Collection**: Per-interval tracking of waiting time, idle time, and energy consumption
- **Fixed-Time Baseline**: Reference controller for comparison
- **Adaptive Control**: Smart optimization strategies
- **Energy-Aware Control**: Optimized for reduced fuel/energy consumption
- **Data Export**: CSV/JSON export for academic reporting

## Components

### 1. Metrics Collection (`metrics.js`)

**`MetricsCollector`** - Continuous metrics collection with configurable intervals

```javascript
const collector = new MetricsCollector(world, {
  intervalDuration: 30000, // 30-second intervals
  trackVehicles: true,
  trackEnergy: true
});

collector.start('FIXED_TIME', 'BALANCED');
// ... simulation runs ...
collector.stop();

// Get results
const summary = collector.getSummary();
const intervals = collector.getIntervals();

// Export
collector.downloadJSON('metrics.json');
collector.downloadCSV('metrics.csv');
```

**Tracked Metrics:**
- Average waiting time per vehicle (ms)
- Average idle time per vehicle (ms)
- Total energy consumption (kWh)
- Total fuel consumption (L)
- Total distance traveled (m)
- Number of stops
- Average speed (m/s)
- Congestion level
- Traffic density

### 2. Fixed-Time Controller (`fixedTimeController.js`)

**`FixedTimeSignalController`** - Baseline controller with predetermined timing

```javascript
// Create controller
const controller = new FixedTimeSignalController({
  cycleLength: 120, // seconds
  greenSplit: [0.4, 0.4, 0.1, 0.1], // phase distribution
  yellowDuration: 3,
  allRedDuration: 2
});

controller.initialize(world);
controller.start();
```

**Factory Presets:**
```javascript
// Balanced (equal phases)
const controller = FixedTimeControllerFactory.createBalanced(world);

// Main road priority
const controller = FixedTimeControllerFactory.createMainRoadPriority(world);

// Short cycle (60s)
const controller = FixedTimeControllerFactory.createShortCycle(world);

// Long cycle (180s)
const controller = FixedTimeControllerFactory.createLongCycle(world);
```

### 3. Evaluation Framework (`evaluation.js`)

**`EvaluationFramework`** - Comprehensive comparison system

```javascript
const framework = new EvaluationFramework({
  defaultDuration: 300000, // 5 minutes per run
  intervalDuration: 30000, // 30-second intervals
  warmupTime: 30000 // 30-second warmup
});

// Run comparison
const results = await framework.runComparison(world, [
  'fixed',    // Fixed-time baseline
  'adaptive', // Adaptive control
  'energy'    // Energy-aware
]);

// Export results
framework.downloadJSON('results.json');
framework.downloadCSV('summary.csv');
framework.downloadDetailedCSV('detailed.csv');
```

**Individual Runs:**
```javascript
// Fixed-time baseline
await framework.runFixedTimeBaseline(world);

// Adaptive control
await framework.runAdaptiveControl(world, optimizationEngine);

// Energy-aware
await framework.runEnergyAware(world, optimizationEngine);
```

## Usage Examples

### Basic Metrics Collection

```javascript
import { World } from './world.js';
import { MetricsCollector } from './metrics.js';
import { FixedTimeControllerFactory } from './fixedTimeController.js';

// Setup
const world = new World({ gridSize: 2 });
world.start();

// Create controller and metrics
const controller = FixedTimeControllerFactory.createBalanced(world);
const metrics = new MetricsCollector(world, {
  intervalDuration: 30000
});

// Start collection
controller.start();
metrics.start('FIXED_TIME', 'BALANCED');

// Run for 5 minutes
setTimeout(() => {
  metrics.stop();
  controller.stop();
  
  // View results
  console.log(metrics.getSummary());
  metrics.downloadJSON('results.json');
}, 300000);
```

### Fixed vs Adaptive Comparison

```javascript
import { EvaluationFramework } from './evaluation.js';

const framework = new EvaluationFramework({
  defaultDuration: 180000, // 3 minutes
  intervalDuration: 30000
});

const world = new World({ gridSize: 2 });
world.start();

// Spawn vehicles
for (let i = 0; i < 30; i++) {
  const road = Array.from(world.roads.values())[
    Math.floor(Math.random() * world.roads.size)
  ];
  world.spawnVehicle(road);
}

// Run comparison
const results = await framework.runComparison(world, [
  'fixed',
  'adaptive'
]);

// Export
framework.downloadJSON('comparison.json');
framework.downloadCSV('comparison.csv');
```

### Energy-Aware Evaluation

```javascript
// Full 3-way comparison
const results = await framework.runComparison(world, [
  'fixed',    // Baseline
  'adaptive', // Standard adaptive
  'energy'    // Energy-optimized
]);

// Analyze energy savings
const baseline = results[0].summary;
const energyAware = results[2].summary;

const energySavings = 
  (baseline.totalEnergyConsumption - energyAware.totalEnergyConsumption) /
  baseline.totalEnergyConsumption * 100;

console.log(`Energy savings: ${energySavings.toFixed(1)}%`);
```

## Export Formats

### JSON Export Structure

```json
{
  "metadata": {
    "controllerType": "FIXED_TIME",
    "controllerStrategy": "BALANCED",
    "intervalDuration": 30000,
    "totalIntervals": 10,
    "collectionStartTime": 1704000000000,
    "collectionEndTime": 1704000300000
  },
  "summary": {
    "avgWaitingTimePerVehicle": 1250.5,
    "avgIdleTimePerVehicle": 450.2,
    "totalEnergyConsumption": 12.5,
    "totalFuelConsumption": 1.4,
    "avgStopsPerVehicle": 2.3
  },
  "intervals": [
    {
      "intervalId": 0,
      "vehicleCount": 25,
      "avgWaitingTime": 1200.0,
      "avgIdleTime": 420.0,
      "totalEnergyConsumption": 1.2,
      "congestionLevel": "LOW"
    }
  ]
}
```

### CSV Export Format

Summary CSV:
```csv
runId,runName,controllerType,controllerStrategy,avgWaitingTime,avgIdleTime,totalEnergy,totalFuel
fixed_baseline,Fixed-Time Baseline,FIXED_TIME,BALANCED,1250.50,450.20,12.5000,1.4000
adaptive_control,Adaptive Control,ADAPTIVE,ADAPTIVE,980.30,320.10,10.2000,1.1500
```

Detailed CSV (per-interval):
```csv
runId,controllerType,controllerStrategy,intervalId,avgWaitingTime,avgIdleTime,totalEnergy,vehicleCount,congestion
fixed_baseline,FIXED_TIME,BALANCED,0,1200.00,420.00,1.2000,25,LOW
fixed_baseline,FIXED_TIME,BALANCED,1,1300.00,480.00,1.3000,27,MEDIUM
```

## Demo Scripts

Run demonstration scenarios:

```javascript
// Import demos
import { 
  demoMetricsCollection,
  demoFixedVsAdaptive,
  demoEnergyAware,
  demoDataExport,
  demoFullEvaluation,
  runAllEvaluationDemos
} from './evaluationDemo.js';

// Run individual demos
await demoMetricsCollection();      // Basic metrics
await demoFixedVsAdaptive();        // 2-way comparison
await demoEnergyAware();            // 3-way comparison
await demoDataExport();             // Export formats
await demoFullEvaluation();         // Complete evaluation

// Or run all
await runAllEvaluationDemos();
```

## Academic Reporting

### Methodology Section

```
The evaluation compared three traffic signal control strategies:
1. Fixed-time control (baseline)
2. Adaptive control
3. Energy-aware adaptive control

Each strategy was evaluated over 5-minute simulation runs with
30-second measurement intervals. Metrics included:
- Average vehicle waiting time
- Average vehicle idle time
- Total energy consumption
- Traffic throughput

The simulation used a 2×2 grid network with 30 vehicles.
A 30-second warmup period preceded each evaluation.
```

### Results Presentation

```javascript
const framework = new EvaluationFramework();
const results = await framework.runComparison(world, [
  'fixed', 'adaptive', 'energy'
]);

// Generate comparison table
framework.printComparison(results);

// Calculate improvements
const baseline = results[0].summary;
results.slice(1).forEach(result => {
  const improvement = 
    (baseline.avgWaitingTimePerVehicle - result.summary.avgWaitingTimePerVehicle) /
    baseline.avgWaitingTimePerVehicle * 100;
  
  console.log(`${result.controllerStrategy}: ${improvement.toFixed(1)}% reduction`);
});
```

## Performance Metrics

| Metric | Description | Unit |
|--------|-------------|------|
| Avg Waiting Time | Time with speed < 2 m/s | milliseconds |
| Avg Idle Time | Time completely stopped | milliseconds |
| Total Energy | Estimated energy consumed | kWh |
| Total Fuel | Estimated fuel consumed | liters |
| Avg Speed | Average vehicle speed | m/s |
| Throughput | Vehicles processed | count |
| Stops | Complete stops per vehicle | count |

## Energy Model

Simplified fuel consumption model:
- **Idle**: 0.5 L/hour
- **Dynamic**: 8 L/100km (base) × speed factor
- **Optimal speed**: ~50 km/h (13.9 m/s)
- **Conversion**: 1 L gasoline ≈ 8.9 kWh

## Browser Console Access

```javascript
// Available in browser console
window.MetricsCollector
window.FixedTimeSignalController
window.FixedTimeControllerFactory
window.EvaluationFramework
window.evaluationDemos

// Quick start
await window.evaluationDemos.runAll();
```

## Integration with Existing System

Works seamlessly with:
- `World` class (world.js)
- `OptimizationEngine` (optimization.js)
- `TrafficAnalyzer` (analytics.js)
- Cluster management system

## Best Practices

1. **Warmup Period**: Allow 30-60s warmup before metrics collection
2. **Interval Duration**: Use 20-30s intervals for meaningful statistics
3. **Run Duration**: Minimum 3-5 minutes per strategy
4. **Vehicle Count**: 20-50 vehicles for consistent results
5. **Multiple Runs**: Repeat evaluations for statistical significance
6. **Export Regularly**: Save data after each evaluation run

## Troubleshooting

**No vehicles in intervals:**
- Ensure vehicles are spawned before starting metrics
- Check world.vehicles.size > 0

**Metrics not updating:**
- Call metricsCollector.update() in simulation loop
- Verify world is running

**Export downloads not working:**
- Check browser allows downloads
- Use framework.exportToJSON() to get data directly

## Future Enhancements

Potential additions:
- Real-time visualization
- Statistical significance testing
- Multi-run averaging
- Confidence intervals
- Advanced energy models
- Queue length tracking
- Travel time measurement

---

**Files:**
- `js/metrics.js` - Metrics collection
- `js/fixedTimeController.js` - Fixed-time controller
- `js/evaluation.js` - Evaluation framework
- `js/evaluationDemo.js` - Demo scripts
- `EVALUATION_GUIDE.md` - This guide
