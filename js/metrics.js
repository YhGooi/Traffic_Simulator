/**
 * Metrics Collection Module
 * 
 * Collects and logs per-interval metrics for academic evaluation:
 * - Average waiting time per vehicle
 * - Idle time (vehicles stopped)
 * - Estimated energy consumption
 * 
 * Supports comparison between control strategies and export for analysis.
 */

/**
 * Vehicle Metrics Tracker
 * Tracks individual vehicle metrics for aggregation
 */
export class VehicleMetrics {
  constructor(vehicleId) {
    this.vehicleId = vehicleId;
    this.totalWaitingTime = 0; // ms spent waiting (speed < threshold)
    this.totalIdleTime = 0; // ms spent completely stopped (speed = 0)
    this.totalDistance = 0; // meters traveled
    this.totalFuelConsumed = 0; // estimated liters
    this.stops = 0; // number of complete stops
    this.lastSpeed = 0;
    this.lastUpdateTime = Date.now();
  }

  update(speed, distance, deltaTime) {
    const now = Date.now();
    const dt = deltaTime || (now - this.lastUpdateTime) / 1000; // seconds

    // Waiting time: speed below 2 m/s (7.2 km/h)
    if (speed < 2) {
      this.totalWaitingTime += dt * 1000; // convert to ms
    }

    // Idle time: completely stopped
    if (speed === 0) {
      this.totalIdleTime += dt * 1000;
      if (this.lastSpeed > 0) {
        this.stops++;
      }
    }

    // Distance tracking
    this.totalDistance += distance || (speed * dt);

    // Fuel consumption estimation (simplified model)
    // Based on: idle ~0.5 L/h, city driving ~8 L/100km
    if (speed === 0) {
      // Idle consumption: 0.5 L/hour
      this.totalFuelConsumed += (0.5 / 3600) * dt;
    } else {
      // Dynamic consumption based on speed
      // Consumption increases with acceleration and at high speeds
      const baseConsumption = 8.0; // L/100km at steady speed
      const speedFactor = 1 + Math.abs(speed - 13.9) / 20; // optimal at ~50 km/h
      const consumption = (baseConsumption * speedFactor) / 100000; // L/meter
      this.totalFuelConsumed += consumption * (speed * dt);
    }

    this.lastSpeed = speed;
    this.lastUpdateTime = now;
  }

  getMetrics() {
    return {
      vehicleId: this.vehicleId,
      totalWaitingTime: this.totalWaitingTime,
      totalIdleTime: this.totalIdleTime,
      totalDistance: this.totalDistance,
      totalFuelConsumed: this.totalFuelConsumed,
      stops: this.stops,
      avgSpeed: this.totalDistance / ((this.totalWaitingTime + this.totalIdleTime) / 1000 || 1)
    };
  }
}

/**
 * Interval Metrics Snapshot
 * Captures aggregated metrics for a time interval
 */
export class IntervalMetrics {
  constructor(intervalId, startTime, endTime) {
    this.intervalId = intervalId;
    this.startTime = startTime;
    this.endTime = endTime;
    this.duration = endTime - startTime;

    // Aggregate metrics
    this.vehicleCount = 0;
    this.avgWaitingTime = 0; // ms per vehicle
    this.avgIdleTime = 0; // ms per vehicle
    this.totalWaitingTime = 0;
    this.totalIdleTime = 0;
    this.totalEnergyConsumption = 0; // estimated kWh (converted from fuel)
    this.totalFuelConsumption = 0; // liters
    this.totalDistance = 0; // meters
    this.totalStops = 0;
    this.avgSpeed = 0; // m/s
    this.throughput = 0; // vehicles processed

    // Traffic state
    this.congestionLevel = 'UNKNOWN';
    this.avgDensity = 0;
    this.signalOptimizations = 0;

    // Controller info
    this.controllerType = 'UNKNOWN';
    this.controllerStrategy = 'UNKNOWN';
  }

  static fromVehicleMetrics(intervalId, startTime, endTime, vehicleMetricsList, trafficState = {}) {
    const interval = new IntervalMetrics(intervalId, startTime, endTime);
    
    interval.vehicleCount = vehicleMetricsList.length;

    if (vehicleMetricsList.length > 0) {
      vehicleMetricsList.forEach(vm => {
        interval.totalWaitingTime += vm.totalWaitingTime;
        interval.totalIdleTime += vm.totalIdleTime;
        interval.totalFuelConsumption += vm.totalFuelConsumed;
        interval.totalDistance += vm.totalDistance;
        interval.totalStops += vm.stops;
      });

      interval.avgWaitingTime = interval.totalWaitingTime / interval.vehicleCount;
      interval.avgIdleTime = interval.totalIdleTime / interval.vehicleCount;
      interval.avgSpeed = interval.totalDistance / (interval.duration / 1000) / interval.vehicleCount;
      
      // Convert fuel to energy (approximate: 1L gasoline ≈ 8.9 kWh)
      interval.totalEnergyConsumption = interval.totalFuelConsumption * 8.9;
    }

    // Add traffic state
    interval.congestionLevel = trafficState.congestionLevel || 'UNKNOWN';
    interval.avgDensity = trafficState.avgDensity || 0;
    interval.signalOptimizations = trafficState.signalOptimizations || 0;
    interval.controllerType = trafficState.controllerType || 'UNKNOWN';
    interval.controllerStrategy = trafficState.controllerStrategy || 'UNKNOWN';
    interval.throughput = trafficState.throughput || interval.vehicleCount;

    return interval;
  }

  toJSON() {
    return {
      intervalId: this.intervalId,
      startTime: this.startTime,
      endTime: this.endTime,
      duration: this.duration,
      vehicleCount: this.vehicleCount,
      avgWaitingTime: this.avgWaitingTime,
      avgIdleTime: this.avgIdleTime,
      totalWaitingTime: this.totalWaitingTime,
      totalIdleTime: this.totalIdleTime,
      totalEnergyConsumption: this.totalEnergyConsumption,
      totalFuelConsumption: this.totalFuelConsumption,
      totalDistance: this.totalDistance,
      totalStops: this.totalStops,
      avgSpeed: this.avgSpeed,
      throughput: this.throughput,
      congestionLevel: this.congestionLevel,
      avgDensity: this.avgDensity,
      signalOptimizations: this.signalOptimizations,
      controllerType: this.controllerType,
      controllerStrategy: this.controllerStrategy
    };
  }

  toCSVRow() {
    return [
      this.intervalId,
      this.startTime,
      this.endTime,
      this.duration,
      this.vehicleCount,
      this.avgWaitingTime.toFixed(2),
      this.avgIdleTime.toFixed(2),
      this.totalWaitingTime.toFixed(2),
      this.totalIdleTime.toFixed(2),
      this.totalEnergyConsumption.toFixed(4),
      this.totalFuelConsumption.toFixed(4),
      this.totalDistance.toFixed(2),
      this.totalStops,
      this.avgSpeed.toFixed(2),
      this.throughput,
      this.congestionLevel,
      this.avgDensity.toFixed(4),
      this.signalOptimizations,
      this.controllerType,
      this.controllerStrategy
    ];
  }

  static csvHeader() {
    return [
      'intervalId',
      'startTime',
      'endTime',
      'duration',
      'vehicleCount',
      'avgWaitingTime',
      'avgIdleTime',
      'totalWaitingTime',
      'totalIdleTime',
      'totalEnergyConsumption',
      'totalFuelConsumption',
      'totalDistance',
      'totalStops',
      'avgSpeed',
      'throughput',
      'congestionLevel',
      'avgDensity',
      'signalOptimizations',
      'controllerType',
      'controllerStrategy'
    ];
  }
}

/**
 * Metrics Collector
 * Continuously collects metrics from the simulation
 */
export class MetricsCollector {
  constructor(world, config = {}) {
    this.world = world;
    this.config = {
      intervalDuration: config.intervalDuration || 30000, // 30 seconds default
      trackVehicles: config.trackVehicles !== false,
      trackEnergy: config.trackEnergy !== false,
      autoExport: config.autoExport || false,
      ...config
    };

    // State
    this.vehicleTrackers = new Map(); // vehicleId -> VehicleMetrics
    this.intervals = []; // Array of IntervalMetrics
    this.currentIntervalId = 0;
    this.intervalStartTime = null;
    this.isCollecting = false;
    this.collectionTimer = null;

    // Additional context
    this.controllerType = 'UNKNOWN';
    this.controllerStrategy = 'UNKNOWN';
  }

  start(controllerType = 'UNKNOWN', controllerStrategy = 'UNKNOWN') {
    if (this.isCollecting) {
      console.warn('MetricsCollector already collecting');
      return;
    }

    this.isCollecting = true;
    this.controllerType = controllerType;
    this.controllerStrategy = controllerStrategy;
    this.intervalStartTime = Date.now();
    this.currentIntervalId = 0;
    this.intervals = [];
    this.vehicleTrackers.clear();

    console.log(`MetricsCollector started: ${controllerType} (${controllerStrategy})`);
    console.log(`Interval duration: ${this.config.intervalDuration}ms`);

    // Start periodic collection
    this.collectionTimer = setInterval(() => {
      this.collectInterval();
    }, this.config.intervalDuration);
  }

  stop() {
    if (!this.isCollecting) {
      return;
    }

    // Collect final interval
    this.collectInterval();

    // Stop timer
    if (this.collectionTimer) {
      clearInterval(this.collectionTimer);
      this.collectionTimer = null;
    }

    this.isCollecting = false;
    console.log(`MetricsCollector stopped. Collected ${this.intervals.length} intervals.`);
  }

  update() {
    if (!this.isCollecting) {
      return;
    }

    // Update vehicle trackers
    for (const vehicle of this.world.vehicles) {
      let tracker = this.vehicleTrackers.get(vehicle.id);
      
      if (!tracker) {
        tracker = new VehicleMetrics(vehicle.id);
        this.vehicleTrackers.set(vehicle.id, tracker);
      }

      // Update with current speed and estimated distance
      const speed = vehicle.speed || 0;
      const deltaTime = 0.016; // Approximate frame time (60 FPS)
      tracker.update(speed, speed * deltaTime, deltaTime);
    }

    // Clean up trackers for removed vehicles
    for (const [vehicleId, tracker] of this.vehicleTrackers.entries()) {
      if (!Array.from(this.world.vehicles).find(v => v.id === vehicleId)) {
        this.vehicleTrackers.delete(vehicleId);
      }
    }
  }

  collectInterval() {
    const endTime = Date.now();
    const startTime = this.intervalStartTime;

    // Gather vehicle metrics
    const vehicleMetricsList = Array.from(this.vehicleTrackers.values())
      .map(tracker => tracker.getMetrics());

    // Get traffic state
    const trafficState = this.getTrafficState();

    // Create interval snapshot
    const interval = IntervalMetrics.fromVehicleMetrics(
      this.currentIntervalId,
      startTime,
      endTime,
      vehicleMetricsList,
      trafficState
    );

    this.intervals.push(interval);

    // Log summary
    console.log(`[Interval ${this.currentIntervalId}] Metrics collected:`);
    console.log(`  Vehicles: ${interval.vehicleCount}`);
    console.log(`  Avg Waiting Time: ${interval.avgWaitingTime.toFixed(2)}ms`);
    console.log(`  Avg Idle Time: ${interval.avgIdleTime.toFixed(2)}ms`);
    console.log(`  Energy Consumption: ${interval.totalEnergyConsumption.toFixed(4)} kWh`);
    console.log(`  Avg Speed: ${interval.avgSpeed.toFixed(2)} m/s`);
    console.log(`  Congestion: ${interval.congestionLevel}`);

    // Reset for next interval
    this.currentIntervalId++;
    this.intervalStartTime = endTime;
    // Don't clear trackers - keep tracking vehicles across intervals
    // Just reset their metrics for the next interval
    for (const tracker of this.vehicleTrackers.values()) {
      tracker.totalWaitingTime = 0;
      tracker.totalIdleTime = 0;
      tracker.totalDistance = 0;
      tracker.totalFuelConsumed = 0;
      tracker.stops = 0;
      tracker.lastSpeed = 0;
      tracker.lastUpdateTime = Date.now();
    }
  }

  getTrafficState() {
    const state = {
      controllerType: this.controllerType,
      controllerStrategy: this.controllerStrategy,
      congestionLevel: 'LOW',
      avgDensity: 0,
      signalOptimizations: 0,
      throughput: this.world.vehicles.size
    };

    // Try to get analytics data
    if (this.world.trafficAnalyzer) {
      const networkState = this.world.trafficAnalyzer.getNetworkAnalytics();
      if (networkState) {
        state.congestionLevel = networkState.overallCongestion || 'LOW';
        state.avgDensity = networkState.metrics?.avgDensity || 0;
      }
    }

    // Try to get optimization count
    if (this.world.optimizationEngine) {
      const engineMetrics = this.world.optimizationEngine.getMetrics?.();
      if (engineMetrics) {
        state.signalOptimizations = engineMetrics.totalOptimizations || 0;
      }
    }

    return state;
  }

  getIntervals() {
    return this.intervals;
  }

  getSummary() {
    if (this.intervals.length === 0) {
      return {
        totalIntervals: 0,
        message: 'No intervals collected'
      };
    }

    const totals = this.intervals.reduce((acc, interval) => {
      acc.totalVehicles += interval.vehicleCount;
      acc.totalWaitingTime += interval.totalWaitingTime;
      acc.totalIdleTime += interval.totalIdleTime;
      acc.totalEnergy += interval.totalEnergyConsumption;
      acc.totalFuel += interval.totalFuelConsumption;
      acc.totalDistance += interval.totalDistance;
      acc.totalStops += interval.totalStops;
      return acc;
    }, {
      totalVehicles: 0,
      totalWaitingTime: 0,
      totalIdleTime: 0,
      totalEnergy: 0,
      totalFuel: 0,
      totalDistance: 0,
      totalStops: 0
    });

    const avgVehiclesPerInterval = totals.totalVehicles / this.intervals.length;

    return {
      controllerType: this.controllerType,
      controllerStrategy: this.controllerStrategy,
      totalIntervals: this.intervals.length,
      totalDuration: this.intervals.reduce((sum, i) => sum + i.duration, 0),
      avgVehiclesPerInterval,
      avgWaitingTimePerVehicle: totals.totalWaitingTime / totals.totalVehicles,
      avgIdleTimePerVehicle: totals.totalIdleTime / totals.totalVehicles,
      totalEnergyConsumption: totals.totalEnergy,
      totalFuelConsumption: totals.totalFuel,
      avgEnergyPerInterval: totals.totalEnergy / this.intervals.length,
      avgFuelPerInterval: totals.totalFuel / this.intervals.length,
      totalDistance: totals.totalDistance,
      totalStops: totals.totalStops,
      avgStopsPerVehicle: totals.totalStops / totals.totalVehicles
    };
  }

  exportToJSON() {
    return {
      metadata: {
        controllerType: this.controllerType,
        controllerStrategy: this.controllerStrategy,
        intervalDuration: this.config.intervalDuration,
        totalIntervals: this.intervals.length,
        collectionStartTime: this.intervals[0]?.startTime,
        collectionEndTime: this.intervals[this.intervals.length - 1]?.endTime
      },
      summary: this.getSummary(),
      intervals: this.intervals.map(i => i.toJSON())
    };
  }

  exportToCSV() {
    const rows = [IntervalMetrics.csvHeader()];
    this.intervals.forEach(interval => {
      rows.push(interval.toCSVRow());
    });

    return rows.map(row => row.join(',')).join('\n');
  }

  downloadJSON(filename = 'metrics.json') {
    const data = this.exportToJSON();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  downloadCSV(filename = 'metrics.csv') {
    const csv = this.exportToCSV();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}

// Auto-expose to window for browser console
if (typeof window !== 'undefined') {
  window.MetricsCollector = MetricsCollector;
  window.VehicleMetrics = VehicleMetrics;
  window.IntervalMetrics = IntervalMetrics;
}
