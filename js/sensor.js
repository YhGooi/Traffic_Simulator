/**
 * Sensing & Data Ingestion Layer
 * Simulates IoT sensors collecting traffic data at intersections.
 * 
 * This module is decoupled from analytics logic and focuses solely on:
 * - Data collection from lanes and intersections
 * - Timestamping and identification
 * - Structured JSON output
 * - Periodic sampling simulation
 * 
 * Part of the Sensing & Data Ingestion layer in the energy-aware architecture.
 */

/**
 * TrafficSensor Class
 * Simulates an IoT sensor at a single lane
 */
export class TrafficSensor {
  constructor({ sensorId, laneId, junctionId, direction, samplingIntervalMs = 1000 }) {
    this.sensorId = sensorId;
    this.laneId = laneId;
    this.junctionId = junctionId;
    this.direction = direction;
    this.samplingIntervalMs = samplingIntervalMs;
    
    // Sensor metadata
    this.metadata = {
      sensorType: 'LANE_TRAFFIC_SENSOR',
      installationDate: new Date().toISOString(),
      location: {
        junctionId: junctionId,
        laneDirection: direction
      }
    };
    
    // Data buffer
    this.dataBuffer = [];
    this.maxBufferSize = 1000; // Keep last 1000 readings
  }

  /**
   * Sense current traffic conditions from lane
   * This simulates a sensor reading at a point in time
   * 
   * @param {Lane} lane - Lane object to read from
   * @param {number} currentSimTime - Current simulation time
   * @returns {Object} Sensor reading
   */
  sense(lane, currentSimTime) {
    const timestamp = new Date().toISOString();
    const simTimestamp = currentSimTime;
    
    const reading = {
      sensorId: this.sensorId,
      timestamp: timestamp,
      simTimestamp: simTimestamp,
      junctionId: this.junctionId,
      laneId: this.laneId,
      direction: this.direction,
      
      // Raw sensor data
      data: {
        vehicleCount: lane.getQueueLength(),
        queueLength: lane.getQueueLength(),
        averageWaitingTime: lane.getAverageWaitingTime(currentSimTime),
        occupancyRate: lane.getOccupancyRate(),
        capacity: lane.capacity,
        isFull: lane.isFull()
      },
      
      // Sensor status
      status: {
        operational: true,
        signalStrength: 1.0,
        batteryLevel: 1.0
      }
    };
    
    // Add to buffer
    this.dataBuffer.push(reading);
    if (this.dataBuffer.length > this.maxBufferSize) {
      this.dataBuffer.shift(); // Remove oldest
    }
    
    return reading;
  }

  /**
   * Get sensor metadata
   * @returns {Object} Sensor metadata
   */
  getMetadata() {
    return {
      ...this.metadata,
      sensorId: this.sensorId,
      samplingIntervalMs: this.samplingIntervalMs,
      bufferSize: this.dataBuffer.length
    };
  }

  /**
   * Get buffered data
   * @param {number} count - Number of recent readings to retrieve
   * @returns {Array} Array of sensor readings
   */
  getBufferedData(count = 10) {
    return this.dataBuffer.slice(-count);
  }

  /**
   * Clear data buffer
   */
  clearBuffer() {
    this.dataBuffer = [];
  }
}

/**
 * IntersectionSensorArray Class
 * Manages multiple sensors at an intersection
 */
export class IntersectionSensorArray {
  constructor({ junctionId, samplingIntervalMs = 1000 }) {
    this.junctionId = junctionId;
    this.samplingIntervalMs = samplingIntervalMs;
    this.sensors = new Map(); // direction -> TrafficSensor
    
    // Array metadata
    this.metadata = {
      arrayId: `SENSOR_ARRAY_${junctionId}`,
      junctionId: junctionId,
      installationDate: new Date().toISOString(),
      sensorCount: 0
    };
  }

  /**
   * Add a sensor for a specific lane direction
   * @param {string} direction - Lane direction (N, S, E, W)
   * @param {string} laneId - Lane identifier
   */
  addSensor(direction, laneId) {
    const sensorId = `SENSOR_${this.junctionId}_${direction}`;
    
    const sensor = new TrafficSensor({
      sensorId: sensorId,
      laneId: laneId,
      junctionId: this.junctionId,
      direction: direction,
      samplingIntervalMs: this.samplingIntervalMs
    });
    
    this.sensors.set(direction, sensor);
    this.metadata.sensorCount = this.sensors.size;
    
    return sensor;
  }

  /**
   * Sense all lanes at this intersection
   * @param {Object} lanes - Map of direction to Lane objects
   * @param {number} currentSimTime - Current simulation time
   * @returns {Object} Aggregated sensor data
   */
  senseAll(lanes, currentSimTime) {
    const timestamp = new Date().toISOString();
    const readings = {};
    
    for (const [direction, sensor] of this.sensors.entries()) {
      const lane = lanes[direction];
      if (lane) {
        readings[direction] = sensor.sense(lane, currentSimTime);
      }
    }
    
    return {
      arrayId: this.metadata.arrayId,
      junctionId: this.junctionId,
      timestamp: timestamp,
      simTimestamp: currentSimTime,
      sensorReadings: readings,
      sensorCount: Object.keys(readings).length
    };
  }

  /**
   * Get array metadata
   * @returns {Object} Array metadata
   */
  getMetadata() {
    return {
      ...this.metadata,
      sensors: Array.from(this.sensors.values()).map(s => s.getMetadata())
    };
  }
}

/**
 * DataIngestionService Class
 * Manages data collection across all intersections
 * Simulates a central data ingestion service for IoT sensors
 */
export class DataIngestionService {
  constructor({ world, samplingIntervalMs = 1000 }) {
    this.world = world;
    this.samplingIntervalMs = samplingIntervalMs;
    
    // Sensor arrays for each junction
    this.sensorArrays = new Map(); // junctionId -> IntersectionSensorArray
    
    // Data streams
    this.dataStream = [];
    this.maxStreamSize = 10000; // Keep last 10000 samples
    
    // Service status
    this.isRunning = false;
    this.intervalId = null;
    this.totalReadings = 0;
    
    // Service metadata
    this.metadata = {
      serviceId: 'TRAFFIC_DATA_INGESTION_SERVICE',
      version: '1.0.0',
      startTime: null,
      samplingIntervalMs: samplingIntervalMs
    };
    
    // Callbacks for data consumers
    this.dataCallbacks = new Set();
    
    this._initialize();
  }

  /**
   * Initialize sensors for all junctions
   * @private
   */
  _initialize() {
    for (const junction of this.world.junctions.values()) {
      const sensorArray = new IntersectionSensorArray({
        junctionId: junction.id,
        samplingIntervalMs: this.samplingIntervalMs
      });
      
      // Add sensors for each lane
      const lanes = junction.getLanes();
      for (const [direction, lane] of Object.entries(lanes)) {
        sensorArray.addSensor(direction, lane.id);
      }
      
      this.sensorArrays.set(junction.id, sensorArray);
    }
  }

  /**
   * Start data collection
   */
  start() {
    if (this.isRunning) {
      console.warn('Data ingestion service already running');
      return;
    }
    
    this.isRunning = true;
    this.metadata.startTime = new Date().toISOString();
    
    // Start periodic sampling
    this.intervalId = setInterval(() => {
      this._collectData();
    }, this.samplingIntervalMs);
    
    console.log(`[DataIngestionService] Started (interval: ${this.samplingIntervalMs}ms)`);
  }

  /**
   * Stop data collection
   */
  stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    console.log('[DataIngestionService] Stopped');
  }

  /**
   * Collect data from all sensors
   * @private
   */
  _collectData() {
    const currentSimTime = this.world.simTimeMs || 0;
    const timestamp = new Date().toISOString();
    
    const sample = {
      sampleId: `SAMPLE_${this.totalReadings}`,
      timestamp: timestamp,
      simTimestamp: currentSimTime,
      intersections: []
    };
    
    // Collect from all junctions
    for (const junction of this.world.junctions.values()) {
      const sensorArray = this.sensorArrays.get(junction.id);
      if (sensorArray) {
        const lanes = junction.getLanes();
        const readings = sensorArray.senseAll(lanes, currentSimTime);
        sample.intersections.push(readings);
      }
    }
    
    // Add to stream
    this.dataStream.push(sample);
    if (this.dataStream.length > this.maxStreamSize) {
      this.dataStream.shift(); // Remove oldest
    }
    
    this.totalReadings++;
    
    // Notify callbacks
    this._notifyCallbacks(sample);
  }

  /**
   * Register a callback to receive data as it's collected
   * @param {Function} callback - Function to call with each sample
   */
  onData(callback) {
    this.dataCallbacks.add(callback);
  }

  /**
   * Unregister a data callback
   * @param {Function} callback - Callback to remove
   */
  offData(callback) {
    this.dataCallbacks.delete(callback);
  }

  /**
   * Notify all registered callbacks
   * @private
   * @param {Object} sample - Data sample
   */
  _notifyCallbacks(sample) {
    for (const callback of this.dataCallbacks) {
      try {
        callback(sample);
      } catch (error) {
        console.error('[DataIngestionService] Callback error:', error);
      }
    }
  }

  /**
   * Get most recent data sample
   * @returns {Object|null} Most recent sample
   */
  getLatestSample() {
    return this.dataStream.length > 0 ? 
      this.dataStream[this.dataStream.length - 1] : null;
  }

  /**
   * Get recent samples
   * @param {number} count - Number of recent samples to retrieve
   * @returns {Array} Array of samples
   */
  getRecentSamples(count = 10) {
    return this.dataStream.slice(-count);
  }

  /**
   * Get samples within a time range
   * @param {number} startSimTime - Start time (simulation ms)
   * @param {number} endSimTime - End time (simulation ms)
   * @returns {Array} Filtered samples
   */
  getSamplesByTimeRange(startSimTime, endSimTime) {
    return this.dataStream.filter(sample => 
      sample.simTimestamp >= startSimTime && 
      sample.simTimestamp <= endSimTime
    );
  }

  /**
   * Export data stream as JSON
   * @param {number} count - Number of recent samples (default: all)
   * @returns {string} JSON string
   */
  exportJSON(count = null) {
    const samples = count ? this.dataStream.slice(-count) : this.dataStream;
    
    const exportData = {
      metadata: {
        ...this.metadata,
        exportTime: new Date().toISOString(),
        sampleCount: samples.length,
        totalReadings: this.totalReadings
      },
      sensorArrays: Array.from(this.sensorArrays.values()).map(arr => arr.getMetadata()),
      samples: samples
    };
    
    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Export data to file (browser download)
   * @param {string} filename - Output filename
   * @param {number} count - Number of recent samples (default: all)
   */
  exportToFile(filename = 'traffic_data.json', count = null) {
    const jsonData = this.exportJSON(count);
    
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    
    console.log(`[DataIngestionService] Exported ${count || 'all'} samples to ${filename}`);
  }

  /**
   * Export data to CSV format
   * @param {number} count - Number of recent samples (default: all)
   * @returns {string} CSV string
   */
  exportCSV(count = null) {
    const samples = count ? this.dataStream.slice(-count) : this.dataStream;
    
    // CSV header
    const headers = [
      'Timestamp',
      'SimTime_ms',
      'JunctionID',
      'Direction',
      'VehicleCount',
      'QueueLength',
      'AvgWaitTime_ms',
      'OccupancyRate',
      'Capacity',
      'IsFull'
    ];
    
    const rows = [headers.join(',')];
    
    // Data rows
    for (const sample of samples) {
      for (const intersection of sample.intersections) {
        for (const [direction, reading] of Object.entries(intersection.sensorReadings)) {
          const row = [
            sample.timestamp,
            sample.simTimestamp,
            intersection.junctionId,
            direction,
            reading.data.vehicleCount,
            reading.data.queueLength,
            reading.data.averageWaitingTime.toFixed(2),
            reading.data.occupancyRate.toFixed(3),
            reading.data.capacity,
            reading.data.isFull
          ];
          rows.push(row.join(','));
        }
      }
    }
    
    return rows.join('\n');
  }

  /**
   * Export CSV to file (browser download)
   * @param {string} filename - Output filename
   * @param {number} count - Number of recent samples (default: all)
   */
  exportCSVToFile(filename = 'traffic_data.csv', count = null) {
    const csvData = this.exportCSV(count);
    
    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    
    console.log(`[DataIngestionService] Exported ${count || 'all'} samples to ${filename}`);
  }

  /**
   * Get service statistics
   * @returns {Object} Service statistics
   */
  getStatistics() {
    return {
      isRunning: this.isRunning,
      totalReadings: this.totalReadings,
      bufferSize: this.dataStream.length,
      sensorArrayCount: this.sensorArrays.size,
      totalSensors: Array.from(this.sensorArrays.values())
        .reduce((sum, arr) => sum + arr.metadata.sensorCount, 0),
      samplingIntervalMs: this.samplingIntervalMs,
      uptime: this.metadata.startTime ? 
        Date.now() - new Date(this.metadata.startTime).getTime() : 0
    };
  }

  /**
   * Clear all buffered data
   */
  clearBuffer() {
    this.dataStream = [];
    for (const sensorArray of this.sensorArrays.values()) {
      for (const sensor of sensorArray.sensors.values()) {
        sensor.clearBuffer();
      }
    }
    console.log('[DataIngestionService] Buffer cleared');
  }

  /**
   * Get aggregated statistics across all sensors
   * @returns {Object} Aggregated statistics
   */
  getAggregatedStatistics() {
    const latest = this.getLatestSample();
    if (!latest) return null;
    
    let totalVehicles = 0;
    let totalQueueLength = 0;
    let totalWaitingTime = 0;
    let sensorCount = 0;
    
    for (const intersection of latest.intersections) {
      for (const reading of Object.values(intersection.sensorReadings)) {
        totalVehicles += reading.data.vehicleCount;
        totalQueueLength += reading.data.queueLength;
        totalWaitingTime += reading.data.averageWaitingTime;
        sensorCount++;
      }
    }
    
    return {
      timestamp: latest.timestamp,
      simTimestamp: latest.simTimestamp,
      totalVehicles: totalVehicles,
      totalQueueLength: totalQueueLength,
      averageWaitingTime: sensorCount > 0 ? totalWaitingTime / sensorCount : 0,
      intersectionCount: latest.intersections.length,
      sensorCount: sensorCount
    };
  }
}

/**
 * Helper function to create and initialize data ingestion service
 * @param {World} world - World instance
 * @param {number} samplingIntervalMs - Sampling interval in milliseconds
 * @returns {DataIngestionService} Initialized service
 */
export function createDataIngestionService(world, samplingIntervalMs = 1000) {
  return new DataIngestionService({ world, samplingIntervalMs });
}
