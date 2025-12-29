# Sensing & Data Ingestion Layer

## Overview

The Sensing & Data Ingestion Layer simulates IoT sensors at traffic intersections, collecting real-time traffic data for analytics, optimization, and monitoring. This layer is completely decoupled from analytics logic, focusing solely on data collection and structured output.

**Purpose**: Simulate real-world traffic sensor networks that collect and stream data to central systems for processing.

## Architecture

The sensing layer consists of three hierarchical components:

```
DataIngestionService (Central Service)
    └── IntersectionSensorArray (Per-Junction)
            └── TrafficSensor (Per-Lane)
```

### Component Responsibilities

| Component | Responsibility | Analogy |
|-----------|---------------|---------|
| `TrafficSensor` | Lane-level data collection | Individual sensor device |
| `IntersectionSensorArray` | Coordinate sensors at one intersection | Local sensor hub |
| `DataIngestionService` | Network-wide data collection & streaming | Central IoT platform |

## Data Collection

### What Data is Collected

Per lane, per sampling interval:

- **Vehicle Count**: Number of vehicles currently in lane
- **Queue Length**: Number of vehicles waiting at intersection
- **Average Waiting Time**: Mean waiting time for vehicles in queue (ms)
- **Occupancy Rate**: Lane utilization (0.0 - 1.0)
- **Capacity**: Maximum lane capacity
- **Full Status**: Boolean indicating if lane is at capacity

### Data Format

Each sensor reading is a structured JSON object:

```json
{
  "sensorId": "SENSOR_junction_0_N",
  "timestamp": "2025-12-30T10:30:45.123Z",
  "simTimestamp": 45123,
  "junctionId": "junction_0",
  "laneId": "lane_junction_0_N",
  "direction": "N",
  "data": {
    "vehicleCount": 3,
    "queueLength": 3,
    "averageWaitingTime": 2345.67,
    "occupancyRate": 0.300,
    "capacity": 10,
    "isFull": false
  },
  "status": {
    "operational": true,
    "signalStrength": 1.0,
    "batteryLevel": 1.0
  }
}
```

### Aggregated Sample Format

Data from all sensors is aggregated into samples:

```json
{
  "sampleId": "SAMPLE_42",
  "timestamp": "2025-12-30T10:30:45.123Z",
  "simTimestamp": 45123,
  "intersections": [
    {
      "arrayId": "SENSOR_ARRAY_junction_0",
      "junctionId": "junction_0",
      "timestamp": "2025-12-30T10:30:45.123Z",
      "simTimestamp": 45123,
      "sensorReadings": {
        "N": { /* sensor reading */ },
        "S": { /* sensor reading */ },
        "E": { /* sensor reading */ },
        "W": { /* sensor reading */ }
      },
      "sensorCount": 4
    }
  ]
}
```

## API Reference

### TrafficSensor

#### Constructor

```javascript
const sensor = new TrafficSensor({
  sensorId: 'SENSOR_J0_N',
  laneId: 'lane_0',
  junctionId: 'junction_0',
  direction: 'N',
  samplingIntervalMs: 1000
});
```

#### Methods

**`sense(lane, currentSimTime)`**
- Collect current traffic data from lane
- Returns: Sensor reading object
- Automatically buffers data

**`getMetadata()`**
- Returns: Sensor metadata (type, location, installation date)

**`getBufferedData(count)`**
- Get recent buffered readings
- Parameters: `count` - number of readings (default: 10)
- Returns: Array of sensor readings

**`clearBuffer()`**
- Clear buffered data

### IntersectionSensorArray

#### Constructor

```javascript
const array = new IntersectionSensorArray({
  junctionId: 'junction_0',
  samplingIntervalMs: 1000
});
```

#### Methods

**`addSensor(direction, laneId)`**
- Add sensor for a specific lane direction
- Parameters:
  - `direction`: 'N', 'S', 'E', or 'W'
  - `laneId`: Lane identifier
- Returns: Created TrafficSensor

**`senseAll(lanes, currentSimTime)`**
- Collect data from all sensors at intersection
- Parameters:
  - `lanes`: Object mapping direction to Lane objects
  - `currentSimTime`: Current simulation time (ms)
- Returns: Aggregated sensor data object

**`getMetadata()`**
- Returns: Array metadata including all sensor metadata

### DataIngestionService

#### Initialization

```javascript
// Through World (recommended)
const service = world.startDataIngestion(1000); // 1 second interval

// Direct instantiation
import { DataIngestionService } from './sensor.js';
const service = new DataIngestionService({
  world: world,
  samplingIntervalMs: 1000
});
```

#### Core Methods

**`start()`**
- Start periodic data collection
- Begins sampling at configured interval

**`stop()`**
- Stop data collection
- Clears interval timer

**`getLatestSample()`**
- Returns: Most recent data sample
- Returns `null` if no data collected

**`getRecentSamples(count)`**
- Get recent samples
- Parameters: `count` - number of samples (default: 10)
- Returns: Array of samples

**`getSamplesByTimeRange(startSimTime, endSimTime)`**
- Query samples within time window
- Parameters: Simulation time range in ms
- Returns: Filtered array of samples

#### Data Export Methods

**`exportJSON(count)`**
- Export data as JSON string
- Parameters: `count` - number of samples (default: all)
- Returns: JSON string with metadata and samples

**`exportToFile(filename, count)`**
- Download data as JSON file
- Parameters:
  - `filename`: Output filename (default: 'traffic_data.json')
  - `count`: Number of samples (default: all)
- Triggers browser download

**`exportCSV(count)`**
- Export data as CSV string
- Parameters: `count` - number of samples (default: all)
- Returns: CSV string with headers

**`exportCSVToFile(filename, count)`**
- Download data as CSV file
- Parameters:
  - `filename`: Output filename (default: 'traffic_data.csv')
  - `count`: Number of samples (default: all)
- Triggers browser download

#### Real-Time Streaming

**`onData(callback)`**
- Register callback for real-time data stream
- Parameters: `callback(sample)` - function receiving each sample
- Callback invoked on every data collection

**`offData(callback)`**
- Unregister data callback
- Parameters: `callback` - function to remove

Example:
```javascript
const callback = (sample) => {
  console.log('New data:', sample);
  // Process data in real-time
};

service.onData(callback);

// Later...
service.offData(callback);
```

#### Statistics Methods

**`getStatistics()`**
- Get service operational statistics
- Returns: Object with runtime metrics

```javascript
{
  isRunning: true,
  totalReadings: 1234,
  bufferSize: 1000,
  sensorArrayCount: 4,
  totalSensors: 16,
  samplingIntervalMs: 1000,
  uptime: 61234  // milliseconds
}
```

**`getAggregatedStatistics()`**
- Get network-wide aggregated metrics from latest sample
- Returns: Aggregated statistics object

```javascript
{
  timestamp: "2025-12-30T10:30:45.123Z",
  simTimestamp: 45123,
  totalVehicles: 24,
  totalQueueLength: 18,
  averageWaitingTime: 3456.78,
  intersectionCount: 4,
  sensorCount: 16
}
```

**`clearBuffer()`**
- Clear all buffered data (service and all sensors)

## Usage Examples

### Example 1: Basic Data Collection

```javascript
// Start data collection
const service = world.startDataIngestion(1000); // 1 second intervals

// Wait for data to accumulate...
setTimeout(() => {
  const latest = service.getLatestSample();
  console.log('Latest traffic data:', latest);
  
  // Export to file
  service.exportToFile('traffic_snapshot.json');
}, 10000);
```

### Example 2: Real-Time Monitoring

```javascript
const service = world.getDataIngestionService();
service.start();

// Monitor for congestion
service.onData((sample) => {
  for (const intersection of sample.intersections) {
    for (const [direction, reading] of Object.entries(intersection.sensorReadings)) {
      if (reading.data.queueLength > 5) {
        console.warn(`Congestion at ${intersection.junctionId} ${direction}`);
        // Trigger optimization algorithm
        optimizeSignalTiming(intersection.junctionId);
      }
    }
  }
});
```

### Example 3: Historical Analysis

```javascript
const service = world.getDataIngestionService();

// Query last 5 minutes of data
const currentTime = world.simTimeMs;
const fiveMinutesAgo = currentTime - (5 * 60 * 1000);
const samples = service.getSamplesByTimeRange(fiveMinutesAgo, currentTime);

// Analyze patterns
let maxWaitTime = 0;
let totalVehicles = 0;

for (const sample of samples) {
  for (const intersection of sample.intersections) {
    for (const reading of Object.values(intersection.sensorReadings)) {
      maxWaitTime = Math.max(maxWaitTime, reading.data.averageWaitingTime);
      totalVehicles += reading.data.vehicleCount;
    }
  }
}

console.log(`Peak wait time: ${maxWaitTime}ms`);
console.log(`Total vehicles observed: ${totalVehicles}`);
```

### Example 4: Export for ML Training

```javascript
const service = world.getDataIngestionService();

// Collect data for 10 minutes
setTimeout(() => {
  // Export all data
  service.exportToFile('ml_training_data.json');
  service.exportCSVToFile('ml_training_data.csv');
  
  console.log(`Collected ${service.getStatistics().totalReadings} samples`);
}, 10 * 60 * 1000);
```

### Example 5: Multi-Intersection Comparison

```javascript
const service = world.getDataIngestionService();
const latest = service.getLatestSample();

const intersectionMetrics = {};

for (const intersection of latest.intersections) {
  let totalQueue = 0;
  let avgWait = 0;
  let sensorCount = 0;
  
  for (const reading of Object.values(intersection.sensorReadings)) {
    totalQueue += reading.data.queueLength;
    avgWait += reading.data.averageWaitingTime;
    sensorCount++;
  }
  
  intersectionMetrics[intersection.junctionId] = {
    totalQueue: totalQueue,
    avgWait: avgWait / sensorCount
  };
}

console.log('Intersection comparison:', intersectionMetrics);
```

## Demo Functions

The `sensorDemo` namespace provides ready-to-use demonstrations:

### Available Demos

| Function | Description | Usage |
|----------|-------------|-------|
| `demoBasicCollection(world, intervalMs)` | Start collection and show basic usage | `sensorDemo.demoBasicCollection(world, 1000)` |
| `demoRealTimeStreaming(world, duration)` | Stream data with callback | `sensorDemo.demoRealTimeStreaming(world, 30000)` |
| `demoExportJSON(world, filename)` | Export data to JSON file | `sensorDemo.demoExportJSON(world, 'data.json')` |
| `demoExportCSV(world, filename)` | Export data to CSV file | `sensorDemo.demoExportCSV(world, 'data.csv')` |
| `demoQueryHistoricalData(world, lookbackMs)` | Query and analyze historical data | `sensorDemo.demoQueryHistoricalData(world, 60000)` |
| `demoMonitorIntersection(world, junctionId, duration)` | Monitor specific intersection | `sensorDemo.demoMonitorIntersection(world, 'junction_0', 30000)` |
| `demoAggregatedStatistics(world, intervalMs)` | Show network-wide statistics | `sensorDemo.demoAggregatedStatistics(world, 5000)` |
| `demoDataQualityMonitoring(world, duration)` | Monitor sensor health and timing | `sensorDemo.demoDataQualityMonitoring(world, 30000)` |
| `demoPrepareMLData(world, windowSize)` | Prepare features for ML pipeline | `sensorDemo.demoPrepareMLData(world, 100)` |
| `stopAndClear(world)` | Stop service and clear all data | `sensorDemo.stopAndClear(world)` |

### Quick Start

```javascript
// In browser console after opening index.html

// 1. Build a traffic network
// (Use UI to create junctions and spawn vehicles)

// 2. Start data collection
sensorDemo.demoBasicCollection(world, 1000);

// 3. Monitor in real-time
sensorDemo.demoRealTimeStreaming(world, 60000);

// 4. Export data
sensorDemo.demoExportJSON(world, 'traffic_data.json');
```

## Integration with Analytics

The sensing layer is designed to feed data to analytics and optimization systems:

### Data Pipeline Flow

```
IoT Sensors (TrafficSensor)
    ↓
Data Ingestion (DataIngestionService)
    ↓
[Your Analytics Layer]
    ↓
Optimization Algorithms
    ↓
Signal Control (updateTimings)
```

### Integration Example

```javascript
// Setup data pipeline
const service = world.startDataIngestion(1000);

// Analytics callback
service.onData((sample) => {
  // 1. Analyze traffic patterns
  const analysis = analyzeTrafficPatterns(sample);
  
  // 2. Detect congestion
  if (analysis.isCongested) {
    // 3. Optimize signal timings
    const newTimings = optimizeSignalTiming(analysis);
    
    // 4. Apply changes
    const junction = world.junctions.get(analysis.junctionId);
    junction.signal.updateTimings(newTimings);
  }
});
```

### Machine Learning Integration

```javascript
// Prepare training data
const mlData = sensorDemo.demoPrepareMLData(world, 1000);

// mlData.features contains feature vectors
// mlData.labels contains congestion labels

// Use with your ML framework:
// - TensorFlow.js
// - Brain.js
// - ML5.js
// - Export to Python for scikit-learn, PyTorch, etc.

// Example: Export for Python
const service = world.getDataIngestionService();
service.exportCSVToFile('training_data.csv');
```

## Best Practices

### 1. Sampling Interval Selection

Choose appropriate intervals based on use case:

| Use Case | Recommended Interval | Reason |
|----------|---------------------|--------|
| Real-time control | 500-1000ms | Quick response to changes |
| Analytics/ML | 1000-5000ms | Balance data volume and patterns |
| Long-term monitoring | 5000-10000ms | Reduce storage requirements |
| Pattern analysis | 1000-2000ms | Capture traffic dynamics |

### 2. Buffer Management

- Monitor buffer size: `service.getStatistics().bufferSize`
- Clear periodically for long simulations: `service.clearBuffer()`
- Export data before clearing if needed

### 3. Real-Time Callbacks

- Keep callbacks lightweight and fast
- Offload heavy processing to Web Workers if needed
- Use try-catch in callbacks to prevent service disruption
- Unregister callbacks when no longer needed

### 4. Data Export

- Export periodically for long simulations
- Use CSV for compatibility with analysis tools
- Use JSON for complex data structures and metadata
- Consider compression for large datasets

### 5. Performance Optimization

```javascript
// Good: Appropriate interval
const service = world.startDataIngestion(1000);

// Avoid: Too frequent sampling (performance impact)
const service = world.startDataIngestion(100);

// Good: Query specific time range
const samples = service.getSamplesByTimeRange(start, end);

// Avoid: Processing entire buffer repeatedly
const samples = service.dataStream; // Direct access
```

## Troubleshooting

### No Data Collected

```javascript
const service = world.getDataIngestionService();

// Check if service is running
console.log(service.isRunning); // Should be true

// If not, start it
if (!service.isRunning) {
  service.start();
}

// Wait for data
setTimeout(() => {
  console.log(service.getStatistics());
}, 2000);
```

### Missing Intersections in Data

```javascript
// Ensure junctions exist
console.log(world.junctions.size); // Should be > 0

// Reinitialize service after adding junctions
if (world.dataIngestionService) {
  world.dataIngestionService.stop();
  world.dataIngestionService = null;
}
world.startDataIngestion(1000);
```

### Timestamp Mismatch

- **timestamp**: Real-world time (ISO 8601)
- **simTimestamp**: Simulation time (milliseconds)

Use `simTimestamp` for analysis within simulation context.
Use `timestamp` for logging and external systems.

### Memory Usage

For very long simulations:

```javascript
const service = world.getDataIngestionService();

// Export and clear periodically
setInterval(() => {
  service.exportToFile(`data_${Date.now()}.json`, 1000);
  service.clearBuffer();
}, 5 * 60 * 1000); // Every 5 minutes
```

## CSV Export Format

The CSV export includes the following columns:

| Column | Description | Type |
|--------|-------------|------|
| Timestamp | Real-world timestamp | ISO 8601 string |
| SimTime_ms | Simulation time | Number (ms) |
| JunctionID | Intersection identifier | String |
| Direction | Lane direction | N/S/E/W |
| VehicleCount | Vehicles in lane | Integer |
| QueueLength | Vehicles waiting | Integer |
| AvgWaitTime_ms | Average waiting time | Float (ms) |
| OccupancyRate | Lane utilization | Float (0-1) |
| Capacity | Max lane capacity | Integer |
| IsFull | Lane at capacity | Boolean |

Perfect for importing into:
- Excel / Google Sheets
- Pandas (Python)
- R data frames
- Tableau / Power BI
- Database systems

## World Integration

The sensing layer is fully integrated with the World class:

### World Methods

```javascript
// Start data collection
world.startDataIngestion(samplingIntervalMs);

// Get or create service
const service = world.getDataIngestionService(samplingIntervalMs);

// Stop data collection
world.stopDataIngestion();
```

### Automatic Cleanup

The service is automatically stopped when world is destroyed:

```javascript
// Cleanup is automatic
world.destroy(); // Stops data ingestion service
```

## Summary

The Sensing & Data Ingestion Layer provides:

✅ **IoT Sensor Simulation**: Realistic traffic sensor behavior  
✅ **Structured Data Output**: JSON and CSV formats  
✅ **Real-Time Streaming**: Callback-based data pipeline  
✅ **Historical Queries**: Time-range based data retrieval  
✅ **Export Capabilities**: Download data for offline analysis  
✅ **Decoupled Architecture**: No analytics logic in sensing layer  
✅ **ML/Analytics Ready**: Feature extraction and data preparation  
✅ **Performance Optimized**: Configurable sampling and buffering  

This layer forms the foundation for advanced traffic analytics, optimization algorithms, and machine learning applications while maintaining clear separation of concerns in the system architecture.
