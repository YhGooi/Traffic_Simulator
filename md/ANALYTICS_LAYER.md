# Traffic Analytics Layer

## Overview

The Traffic Analytics Layer processes raw sensor data and derives higher-level traffic states including traffic density, congestion classification, and peak/off-peak detection. This layer uses simple rule-based and statistical methods to provide actionable insights for optimization modules.

**Purpose**: Transform low-level sensor readings into high-level traffic intelligence that optimization algorithms can use to make informed decisions.

## Architecture Position

```
Optimization Layer (Uses analytics output)
    ↓
Traffic Analytics Layer ← YOU ARE HERE
    ↓
Sensing & Data Ingestion Layer (Provides raw data)
```

**Key Principle**: Analytics layer contains NO optimization logic. It only analyzes and classifies traffic state.

## Core Components

### 1. IntersectionAnalytics
Analyzes traffic at a single intersection.

**Responsibilities**:
- Calculate traffic density per direction
- Classify congestion level (LOW/MEDIUM/HIGH/CRITICAL)
- Identify dominant flow direction
- Compute pressure score (0-100)
- Track trends and statistics

### 2. NetworkAnalytics
Analyzes traffic across the entire network.

**Responsibilities**:
- Aggregate network-wide metrics
- Classify traffic period (OFF_PEAK/PEAK/RUSH_HOUR)
- Calculate network efficiency score
- Identify critical intersections
- Learn baseline patterns

### 3. TrafficAnalyzer
Main orchestration engine.

**Responsibilities**:
- Subscribe to sensor data
- Coordinate intersection and network analytics
- Provide unified API for consumers
- Generate optimization recommendations
- Stream analytics to callbacks

## Traffic States

### Congestion Levels

| Level | Queue Length | Wait Time | Density | Description |
|-------|-------------|-----------|---------|-------------|
| **LOW** | < 3 | < 5s | < 50% | Light traffic, free flow |
| **MEDIUM** | 3-7 | 5-15s | 50-75% | Moderate traffic, some delays |
| **HIGH** | 7-10 | 15-20s | 75-90% | Heavy traffic, significant delays |
| **CRITICAL** | > 10 | > 20s | > 90% | Severe congestion, near gridlock |

### Traffic Periods

| Period | Condition | Description |
|--------|-----------|-------------|
| **OFF_PEAK** | Density ≤ baseline * 1.2 | Normal traffic conditions |
| **PEAK** | Density > baseline * 1.2 | Above-normal traffic |
| **RUSH_HOUR** | Density > baseline * 1.5 | Significantly elevated traffic |

*Baseline is learned over time (exponential moving average)*

### Traffic Density

- **Definition**: Ratio of current vehicles to lane capacity
- **Scale**: 0.0 (empty) to 1.0 (full capacity)
- **Calculated**: Per direction, per intersection, and network-wide

## API Reference

### TrafficAnalyzer

#### Initialization

```javascript
// Through World (recommended)
const analyzer = world.startTrafficAnalytics(1000); // 1 second interval

// Direct instantiation
import { TrafficAnalyzer } from './analytics.js';
const analyzer = new TrafficAnalyzer({
  dataIngestionService: dataService,
  updateIntervalMs: 1000
});
```

#### Core Methods

**`start()`**
- Start periodic analysis
- Automatically starts data ingestion if needed
- Begins analyzing at configured interval

**`stop()`**
- Stop analysis engine
- Callbacks remain registered

**`getIntersectionAnalytics(junctionId)`**
- Get analytics for specific intersection
- Parameters: `junctionId` - Junction identifier
- Returns: Intersection state object or `null`

**`getNetworkAnalytics()`**
- Get network-wide analytics
- Returns: Network state object or `null`

**`getSnapshot()`**
- Get complete analytics snapshot
- Returns: Object with all analytics data

```javascript
{
  intersections: {
    "junction_0": {
      state: { /* current state */ },
      trend: { /* trend analysis */ },
      statistics: { /* stats */ }
    }
  },
  network: {
    state: { /* network state */ },
    trend: { /* network trend */ },
    periodDistribution: { /* period breakdown */ }
  },
  metadata: {
    totalAnalyses: 1234,
    isRunning: true,
    updateIntervalMs: 1000
  }
}
```

**`getRecommendations()`**
- Get optimization recommendations
- Returns: Array of recommendation objects

```javascript
[
  {
    type: 'NETWORK' | 'INTERSECTION',
    junctionId: 'junction_0', // if type is INTERSECTION
    priority: 'HIGH' | 'MEDIUM',
    message: 'Human-readable recommendation',
    metric: 'pressureScore',
    value: 85.3
  }
]
```

**`onAnalytics(callback)`**
- Register callback for analytics updates
- Parameters: `callback(analyticsData)` - Function receiving each update
- Use for real-time integration with optimization

**`offAnalytics(callback)`**
- Unregister callback
- Parameters: `callback` - Function to remove

**`getStatistics()`**
- Get analyzer operational statistics
- Returns: Statistics object

### Intersection State Structure

```javascript
{
  junctionId: "junction_0",
  timestamp: 45123,
  metrics: {
    perDirection: {
      N: {
        vehicleCount: 3,
        queueLength: 3,
        waitingTime: 2345,
        occupancy: 0.3,
        density: 0.3,
        congestionLevel: 'LOW',
        isCongested: false,
        isBlocked: false
      },
      // S, E, W...
    },
    aggregate: {
      totalVehicles: 12,
      totalCapacity: 40,
      totalQueue: 8,
      avgWaitTime: 3456,
      avgOccupancy: 0.25,
      density: 0.3,
      congestionLevel: 'MEDIUM',
      dominantFlow: 'N',
      pressureScore: 45.2
    }
  }
}
```

### Network State Structure

```javascript
{
  intersectionCount: 4,
  timestamp: 45123,
  totalVehicles: 48,
  totalCapacity: 160,
  avgDensity: 0.3,
  avgQueueLength: 6,
  avgWaitTime: 4500,
  avgPressureScore: 52.3,
  networkCongestion: 'MEDIUM',
  congestionDistribution: {
    LOW: 25,      // 25% of intersections
    MEDIUM: 50,   // 50%
    HIGH: 25,     // 25%
    CRITICAL: 0   // 0%
  },
  trafficPeriod: 'PEAK',
  efficiencyScore: 65.4,
  criticalIntersections: [
    {
      junctionId: 'junction_2',
      congestionLevel: 'HIGH',
      pressureScore: 78.5,
      totalQueue: 12,
      avgWaitTime: 8900
    }
  ]
}
```

## Usage Examples

### Example 1: Basic Analytics

```javascript
// Start analytics
const analyzer = world.startTrafficAnalytics(1000);

// Wait for data...
setTimeout(() => {
  const network = analyzer.getNetworkAnalytics();
  console.log('Network congestion:', network.networkCongestion);
  console.log('Traffic period:', network.trafficPeriod);
  console.log('Avg density:', network.avgDensity);
}, 5000);
```

### Example 2: Real-Time Monitoring

```javascript
const analyzer = world.getTrafficAnalyzer();
analyzer.start();

analyzer.onAnalytics((analyticsData) => {
  const network = analyticsData.network;
  
  console.log(`Congestion: ${network.networkCongestion}`);
  console.log(`Density: ${(network.avgDensity * 100).toFixed(1)}%`);
  console.log(`Efficiency: ${network.efficiencyScore.toFixed(1)}/100`);
  
  if (network.criticalIntersections.length > 0) {
    console.warn('Critical intersections:', network.criticalIntersections.length);
  }
});
```

### Example 3: Integration with Optimization

```javascript
const analyzer = world.getTrafficAnalyzer();
analyzer.start();

analyzer.onAnalytics((analyticsData) => {
  // Get recommendations
  const recommendations = analyzer.getRecommendations();
  
  for (const rec of recommendations) {
    if (rec.type === 'INTERSECTION' && rec.priority === 'HIGH') {
      const junction = world.junctions.get(rec.junctionId);
      
      // Apply optimization based on analytics
      const currentTimings = junction.signal.getTimings();
      junction.signal.updateTimings({
        greenMs: currentTimings.greenMs + 2000, // Increase green
        yellowMs: currentTimings.yellowMs,
        allRedMs: currentTimings.allRedMs
      });
      
      console.log(`Optimized ${rec.junctionId}`);
    }
  }
});
```

### Example 4: Density Analysis

```javascript
const analyzer = world.getTrafficAnalyzer();
const snapshot = analyzer.getSnapshot();

// Network density
console.log('Network density:', (snapshot.network.state.avgDensity * 100).toFixed(1), '%');

// Per-intersection density
for (const [junctionId, data] of Object.entries(snapshot.intersections)) {
  const density = data.state.metrics.aggregate.density;
  console.log(`${junctionId}: ${(density * 100).toFixed(1)}%`);
}
```

### Example 5: Peak Detection

```javascript
const analyzer = world.getTrafficAnalyzer();
analyzer.start();

analyzer.onAnalytics((analyticsData) => {
  const period = analyticsData.network.trafficPeriod;
  
  if (period === TrafficPeriod.RUSH_HOUR) {
    console.log('RUSH HOUR: Activating coordinated timing');
    // Implement rush hour optimization strategy
  } else if (period === TrafficPeriod.OFF_PEAK) {
    console.log('OFF-PEAK: Using standard timing');
    // Use normal signal timing
  }
});
```

### Example 6: Trend Analysis

```javascript
const analyzer = world.getTrafficAnalyzer();
const snapshot = analyzer.getSnapshot();

// Network trend
const networkTrend = snapshot.network.trend;
console.log(`Network trend: ${networkTrend.trend}`);
console.log(`Change: ${networkTrend.changePercent.toFixed(1)}%`);

// Per-intersection trends
for (const [junctionId, data] of Object.entries(snapshot.intersections)) {
  const trend = data.trend;
  if (trend.trend === 'INCREASING') {
    console.log(`${junctionId} congestion increasing by ${trend.changePercent.toFixed(1)}%`);
  }
}
```

## Analytics Algorithms

### Congestion Classification (Rule-Based)

```
if (queue > 10 OR waitTime > 20s OR density > 0.9):
    return CRITICAL
else if (queue > 7 OR waitTime > 15s OR density > 0.75):
    return HIGH
else if (queue > 3 OR waitTime > 5s OR density > 0.5):
    return MEDIUM
else:
    return LOW
```

### Peak Period Classification

With baseline (learned):
```
densityRatio = currentDensity / baselineDensity

if (densityRatio > 1.5):
    return RUSH_HOUR
else if (densityRatio > 1.2):
    return PEAK
else:
    return OFF_PEAK
```

Without baseline (initial):
```
if (density > 0.6 OR congestion >= HIGH):
    return RUSH_HOUR
else if (density > 0.4 OR congestion == MEDIUM):
    return PEAK
else:
    return OFF_PEAK
```

### Pressure Score Calculation

```
pressureScore = 
    density * 40 +
    min((totalQueue / 20) * 30, 30) +
    min((avgWaitTime / 30000) * 30, 30)

// Result: 0-100 scale
```

### Efficiency Score Calculation

```
waitTimeScore = max(0, 100 - avgWaitTime / 200)
congestionScore = 100 (LOW), 60 (MEDIUM), 30 (HIGH), 10 (CRITICAL)
densityScore = max(0, 100 - (density - 0.8) * 500)  // penalty above 80%

efficiencyScore = 
    waitTimeScore * 0.4 +
    congestionScore * 0.4 +
    densityScore * 0.2
```

### Baseline Learning (Exponential Moving Average)

```
alpha = 0.1  // Learning rate

baseline_vehicles = baseline_vehicles * (1 - alpha) + current_vehicles * alpha
baseline_density = baseline_density * (1 - alpha) + current_density * alpha
```

## Demo Functions

The `analyticsDemo` namespace provides comprehensive demonstrations:

| Function | Description | Usage |
|----------|-------------|-------|
| `demoBasicAnalytics(world, intervalMs)` | Start and monitor basic analytics | `analyticsDemo.demoBasicAnalytics(world)` |
| `demoRealTimeCongestion(world, duration)` | Real-time congestion monitoring | `analyticsDemo.demoRealTimeCongestion(world)` |
| `demoDensityAnalysis(world)` | Traffic density analysis | `analyticsDemo.demoDensityAnalysis(world)` |
| `demoPeakDetection(world, duration)` | Peak vs off-peak detection | `analyticsDemo.demoPeakDetection(world)` |
| `demoTrendAnalysis(world)` | Trend analysis | `analyticsDemo.demoTrendAnalysis(world)` |
| `demoStatisticalAnalysis(world)` | Statistical metrics | `analyticsDemo.demoStatisticalAnalysis(world)` |
| `demoRecommendations(world, duration)` | Optimization recommendations | `analyticsDemo.demoRecommendations(world)` |
| `demoCriticalIntersections(world)` | Critical intersection identification | `analyticsDemo.demoCriticalIntersections(world)` |
| `demoOptimizationIntegration(world, duration)` | Integration with optimization | `analyticsDemo.demoOptimizationIntegration(world)` |
| `demoExportAnalytics(world)` | Export analytics data | `analyticsDemo.demoExportAnalytics(world)` |

### Quick Start with Demos

```javascript
// In browser console after opening index.html

// 1. Build traffic network and spawn vehicles

// 2. Start basic analytics
analyticsDemo.demoBasicAnalytics(world, 1000);

// 3. Monitor real-time congestion
analyticsDemo.demoRealTimeCongestion(world, 60000);

// 4. See recommendations
analyticsDemo.demoRecommendations(world, 30000);
```

## Integration Patterns

### Pattern 1: Reactive Optimization

```javascript
// Optimization reacts to analytics insights
analyzer.onAnalytics((data) => {
  for (const critical of data.network.criticalIntersections) {
    optimizeIntersection(critical.junctionId, critical.pressureScore);
  }
});
```

### Pattern 2: Periodic Optimization

```javascript
// Run optimization every N analytics cycles
let cycleCount = 0;
analyzer.onAnalytics((data) => {
  cycleCount++;
  if (cycleCount % 10 === 0) {
    runNetworkOptimization(data.network);
  }
});
```

### Pattern 3: Threshold-Based Triggers

```javascript
// Trigger optimization at specific thresholds
analyzer.onAnalytics((data) => {
  if (data.network.efficiencyScore < 50) {
    console.log('Low efficiency - running optimization');
    optimizeNetwork();
  }
  
  if (data.network.trafficPeriod === TrafficPeriod.RUSH_HOUR) {
    console.log('Rush hour detected - adaptive mode');
    enableAdaptiveTiming();
  }
});
```

### Pattern 4: ML Feature Engineering

```javascript
// Extract features for machine learning
const features = [];
const labels = [];

analyzer.onAnalytics((data) => {
  for (const [junctionId, intersectionData] of Object.entries(data.intersections)) {
    const agg = intersectionData.metrics.aggregate;
    
    // Feature vector
    features.push({
      density: agg.density,
      queueLength: agg.totalQueue,
      waitTime: agg.avgWaitTime,
      pressureScore: agg.pressureScore,
      dominantFlow: encodeDirection(agg.dominantFlow)
    });
    
    // Label: needs optimization?
    labels.push(agg.congestionLevel === 'HIGH' || agg.congestionLevel === 'CRITICAL' ? 1 : 0);
  }
});
```

## Best Practices

### 1. Update Interval Selection

| Scenario | Recommended Interval | Reason |
|----------|---------------------|--------|
| Real-time optimization | 1000ms | Quick response to changes |
| Trend analysis | 2000-5000ms | Smooth out noise |
| Statistical analysis | 5000-10000ms | Aggregate longer periods |

### 2. Baseline Learning

- Allow 20+ samples for reliable baseline
- Baseline reflects typical traffic patterns
- Use for peak detection and anomaly identification

### 3. Callback Management

```javascript
// Good: Keep callbacks lightweight
analyzer.onAnalytics((data) => {
  if (data.network.networkCongestion === 'CRITICAL') {
    triggerEmergencyOptimization();
  }
});

// Avoid: Heavy computation in callback
analyzer.onAnalytics((data) => {
  // Don't do this!
  runComplexMLModel(data); // Blocks analytics engine
});
```

### 4. Data Access Patterns

```javascript
// Good: Use specific queries
const network = analyzer.getNetworkAnalytics();
const intersection = analyzer.getIntersectionAnalytics('junction_0');

// Good: Use snapshot for complete view
const snapshot = analyzer.getSnapshot();

// Avoid: Repeated snapshot calls
for (let i = 0; i < 100; i++) {
  const snapshot = analyzer.getSnapshot(); // Inefficient
}
```

### 5. Optimization Integration

```javascript
// Good: Separate analytics from optimization
analyzer.onAnalytics((data) => {
  const recommendations = analyzer.getRecommendations();
  optimizationEngine.apply(recommendations); // Separate module
});

// Bad: Mix analytics with optimization
// DON'T put optimization logic in analytics layer!
```

## Troubleshooting

### No Analytics Data

```javascript
const analyzer = world.getTrafficAnalyzer();

// Check if running
console.log(analyzer.isRunning); // Should be true

// Check if data ingestion is running
console.log(analyzer.dataIngestionService.isRunning); // Should be true

// Start if needed
if (!analyzer.isRunning) {
  analyzer.start();
}
```

### Baseline Not Learning

- Requires 20+ samples for reliable baseline
- Check: `analyzer.networkAnalytics.baseline.sampleCount`
- Wait longer or reduce update interval

### Critical Intersections Not Detected

```javascript
const network = analyzer.getNetworkAnalytics();

// Check thresholds
console.log('Avg pressure:', network.avgPressureScore);
console.log('Congestion:', network.networkCongestion);

// Critical threshold: pressure > 70 OR congestion HIGH/CRITICAL
```

### Callbacks Not Firing

```javascript
// Verify callback is registered
console.log('Callbacks:', analyzer.analyticsCallbacks.size);

// Check analyzer is running
console.log('Running:', analyzer.isRunning);

// Verify data ingestion
const latest = analyzer.dataIngestionService.getLatestSample();
console.log('Latest sample:', latest);
```

## Performance Considerations

- **Update Interval**: 1000ms is optimal for most cases
- **Memory Usage**: Each analytics instance stores 100 historical samples
- **CPU Impact**: Minimal - simple rule-based calculations
- **Scalability**: Handles dozens of intersections efficiently

## Enumerations

### CongestionLevel

```javascript
import { CongestionLevel } from './analytics.js';

CongestionLevel.LOW       // Light traffic
CongestionLevel.MEDIUM    // Moderate traffic
CongestionLevel.HIGH      // Heavy traffic
CongestionLevel.CRITICAL  // Severe congestion
```

### TrafficPeriod

```javascript
import { TrafficPeriod } from './analytics.js';

TrafficPeriod.OFF_PEAK   // Normal conditions
TrafficPeriod.PEAK       // Above-normal traffic
TrafficPeriod.RUSH_HOUR  // Significantly elevated
```

## World Integration

The analytics layer is fully integrated with the World class:

```javascript
// Start analytics
world.startTrafficAnalytics(intervalMs);

// Get analyzer
const analyzer = world.getTrafficAnalyzer();

// Stop analytics
world.stopTrafficAnalytics();

// Automatic cleanup
world.destroy(); // Stops analytics automatically
```

## Summary

The Traffic Analytics Layer provides:

✅ **Traffic Density**: Per-direction, per-intersection, network-wide  
✅ **Congestion Classification**: LOW/MEDIUM/HIGH/CRITICAL levels  
✅ **Peak Detection**: OFF_PEAK/PEAK/RUSH_HOUR classification  
✅ **Trend Analysis**: INCREASING/DECREASING/STABLE trends  
✅ **Statistical Metrics**: Mean, median, std dev, distributions  
✅ **Pressure Scoring**: 0-100 composite stress metric  
✅ **Efficiency Scoring**: 0-100 network performance metric  
✅ **Critical Identification**: Automatically finds problem intersections  
✅ **Recommendations**: Rule-based optimization suggestions  
✅ **Real-Time Streaming**: Callback-based integration  
✅ **Decoupled Design**: No optimization logic, pure analysis  

This layer transforms raw sensor data into actionable intelligence that optimization modules can use to make informed traffic management decisions.
