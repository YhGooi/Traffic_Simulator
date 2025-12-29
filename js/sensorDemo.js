/**
 * Sensor Demo Module
 * Demonstrates the Sensing & Data Ingestion Layer
 * 
 * This module provides examples of how to:
 * - Initialize and start data collection
 * - Access real-time sensor data
 * - Export data in JSON/CSV formats
 * - Monitor sensor performance
 * - Integrate with analytics pipelines
 */

import { DataIngestionService } from './sensor.js';

/**
 * Demo namespace for sensor functionality
 */
export const sensorDemo = {
  
  /**
   * Basic demo: Start data collection and monitor
   * @param {World} world - World instance
   * @param {number} samplingIntervalMs - Sampling interval (default: 1000ms)
   */
  demoBasicCollection(world, samplingIntervalMs = 1000) {
    console.log('=== Sensor Demo: Basic Data Collection ===');
    
    // Start data ingestion
    const service = world.startDataIngestion(samplingIntervalMs);
    
    console.log(`Data collection started with ${samplingIntervalMs}ms interval`);
    console.log('Service statistics:', service.getStatistics());
    
    // Monitor for 10 seconds
    setTimeout(() => {
      const latest = service.getLatestSample();
      console.log('Latest sample:', JSON.stringify(latest, null, 2));
      
      const stats = service.getStatistics();
      console.log(`Collected ${stats.totalReadings} samples`);
    }, 10000);
    
    return service;
  },

  /**
   * Demo: Real-time data streaming with callback
   * @param {World} world - World instance
   * @param {number} duration - Duration to monitor in ms
   */
  demoRealTimeStreaming(world, duration = 30000) {
    console.log('=== Sensor Demo: Real-Time Streaming ===');
    
    const service = world.getDataIngestionService();
    
    if (!service.isRunning) {
      service.start();
    }
    
    // Register callback for real-time data
    const callback = (sample) => {
      console.log(`[${new Date(sample.timestamp).toLocaleTimeString()}] Sample received:`,
        `${sample.intersections.length} intersections`);
      
      // Example: Check for congestion
      for (const intersection of sample.intersections) {
        for (const [direction, reading] of Object.entries(intersection.sensorReadings)) {
          if (reading.data.queueLength > 5) {
            console.warn(`  ⚠️ Congestion at ${intersection.junctionId} ${direction}: ${reading.data.queueLength} vehicles`);
          }
        }
      }
    };
    
    service.onData(callback);
    console.log(`Monitoring for ${duration/1000} seconds...`);
    
    // Stop after duration
    setTimeout(() => {
      service.offData(callback);
      console.log('Monitoring stopped');
      console.log('Final statistics:', service.getStatistics());
    }, duration);
    
    return service;
  },

  /**
   * Demo: Data export to JSON
   * @param {World} world - World instance
   * @param {string} filename - Output filename
   */
  demoExportJSON(world, filename = 'traffic_data.json') {
    console.log('=== Sensor Demo: Export to JSON ===');
    
    const service = world.getDataIngestionService();
    
    if (service.dataStream.length === 0) {
      console.warn('No data collected yet. Start data ingestion first.');
      return;
    }
    
    // Export all data
    service.exportToFile(filename);
    console.log(`Exported ${service.dataStream.length} samples to ${filename}`);
    
    // Also log sample to console
    const jsonStr = service.exportJSON(1); // Last sample
    console.log('Sample JSON structure:', jsonStr);
    
    return service;
  },

  /**
   * Demo: Data export to CSV
   * @param {World} world - World instance
   * @param {string} filename - Output filename
   */
  demoExportCSV(world, filename = 'traffic_data.csv') {
    console.log('=== Sensor Demo: Export to CSV ===');
    
    const service = world.getDataIngestionService();
    
    if (service.dataStream.length === 0) {
      console.warn('No data collected yet. Start data ingestion first.');
      return;
    }
    
    // Export to CSV
    service.exportCSVToFile(filename);
    console.log(`Exported ${service.dataStream.length} samples to ${filename}`);
    
    // Show sample CSV rows
    const csvStr = service.exportCSV(3); // Last 3 samples
    const lines = csvStr.split('\n');
    console.log('Sample CSV rows:');
    lines.slice(0, 5).forEach(line => console.log(line));
    
    return service;
  },

  /**
   * Demo: Query historical data
   * @param {World} world - World instance
   * @param {number} lookbackMs - Time window to analyze (default: 60000ms = 1 minute)
   */
  demoQueryHistoricalData(world, lookbackMs = 60000) {
    console.log('=== Sensor Demo: Query Historical Data ===');
    
    const service = world.getDataIngestionService();
    const currentTime = world.simTimeMs;
    const startTime = currentTime - lookbackMs;
    
    const samples = service.getSamplesByTimeRange(startTime, currentTime);
    console.log(`Found ${samples.length} samples in last ${lookbackMs/1000} seconds`);
    
    if (samples.length === 0) {
      console.log('No historical data available');
      return;
    }
    
    // Analyze data
    let totalVehicles = 0;
    let totalWaiting = 0;
    let maxQueue = 0;
    let sampleCount = 0;
    
    for (const sample of samples) {
      for (const intersection of sample.intersections) {
        for (const reading of Object.values(intersection.sensorReadings)) {
          totalVehicles += reading.data.vehicleCount;
          totalWaiting += reading.data.averageWaitingTime;
          maxQueue = Math.max(maxQueue, reading.data.queueLength);
          sampleCount++;
        }
      }
    }
    
    console.log('Historical Analysis:');
    console.log(`  Total vehicles observed: ${totalVehicles}`);
    console.log(`  Average waiting time: ${(totalWaiting / sampleCount).toFixed(2)} ms`);
    console.log(`  Maximum queue length: ${maxQueue}`);
    console.log(`  Samples analyzed: ${samples.length}`);
    
    return { samples, totalVehicles, avgWaitingTime: totalWaiting / sampleCount, maxQueue };
  },

  /**
   * Demo: Monitor specific intersection
   * @param {World} world - World instance
   * @param {string} junctionId - Junction ID to monitor
   * @param {number} duration - Duration to monitor in ms
   */
  demoMonitorIntersection(world, junctionId, duration = 30000) {
    console.log(`=== Sensor Demo: Monitor Intersection ${junctionId} ===`);
    
    const service = world.getDataIngestionService();
    
    if (!service.isRunning) {
      service.start();
    }
    
    const callback = (sample) => {
      const intersection = sample.intersections.find(i => i.junctionId === junctionId);
      if (intersection) {
        console.log(`[${new Date(sample.timestamp).toLocaleTimeString()}] ${junctionId}:`);
        for (const [direction, reading] of Object.entries(intersection.sensorReadings)) {
          console.log(`  ${direction}: ${reading.data.queueLength} vehicles, ` +
                     `${reading.data.averageWaitingTime.toFixed(0)}ms avg wait`);
        }
      }
    };
    
    service.onData(callback);
    console.log(`Monitoring ${junctionId} for ${duration/1000} seconds...`);
    
    setTimeout(() => {
      service.offData(callback);
      console.log('Monitoring stopped');
    }, duration);
    
    return service;
  },

  /**
   * Demo: Aggregated network statistics
   * @param {World} world - World instance
   * @param {number} updateIntervalMs - Update interval (default: 5000ms)
   */
  demoAggregatedStatistics(world, updateIntervalMs = 5000) {
    console.log('=== Sensor Demo: Aggregated Network Statistics ===');
    
    const service = world.getDataIngestionService();
    
    if (!service.isRunning) {
      service.start();
    }
    
    const intervalId = setInterval(() => {
      const aggStats = service.getAggregatedStatistics();
      if (aggStats) {
        console.log(`[${new Date(aggStats.timestamp).toLocaleTimeString()}] Network Statistics:`);
        console.log(`  Total vehicles: ${aggStats.totalVehicles}`);
        console.log(`  Total queue length: ${aggStats.totalQueueLength}`);
        console.log(`  Average waiting time: ${aggStats.averageWaitingTime.toFixed(2)} ms`);
        console.log(`  Active intersections: ${aggStats.intersectionCount}`);
        console.log(`  Active sensors: ${aggStats.sensorCount}`);
      }
    }, updateIntervalMs);
    
    console.log(`Monitoring network statistics every ${updateIntervalMs/1000} seconds...`);
    console.log('Call clearInterval(intervalId) to stop');
    
    return { service, intervalId };
  },

  /**
   * Demo: Data quality monitoring
   * @param {World} world - World instance
   * @param {number} duration - Duration to monitor in ms
   */
  demoDataQualityMonitoring(world, duration = 30000) {
    console.log('=== Sensor Demo: Data Quality Monitoring ===');
    
    const service = world.getDataIngestionService();
    
    if (!service.isRunning) {
      service.start();
    }
    
    let samplesReceived = 0;
    let lastSampleTime = Date.now();
    const expectedInterval = service.samplingIntervalMs;
    
    const callback = (sample) => {
      samplesReceived++;
      const now = Date.now();
      const actualInterval = now - lastSampleTime;
      lastSampleTime = now;
      
      // Check for timing drift
      const drift = Math.abs(actualInterval - expectedInterval);
      if (drift > expectedInterval * 0.1) { // 10% tolerance
        console.warn(`⚠️ Timing drift detected: ${drift}ms (expected ${expectedInterval}ms)`);
      }
      
      // Check sensor health
      for (const intersection of sample.intersections) {
        for (const [direction, reading] of Object.entries(intersection.sensorReadings)) {
          if (!reading.status.operational) {
            console.error(`❌ Sensor failure: ${intersection.junctionId} ${direction}`);
          }
        }
      }
    };
    
    service.onData(callback);
    console.log(`Monitoring data quality for ${duration/1000} seconds...`);
    
    setTimeout(() => {
      service.offData(callback);
      console.log('Data quality monitoring stopped');
      console.log(`Total samples received: ${samplesReceived}`);
      const expectedSamples = Math.floor(duration / expectedInterval);
      const completeness = (samplesReceived / expectedSamples * 100).toFixed(1);
      console.log(`Data completeness: ${completeness}%`);
    }, duration);
    
    return service;
  },

  /**
   * Demo: Prepare data for ML/analytics pipeline
   * @param {World} world - World instance
   * @param {number} windowSize - Number of recent samples to prepare
   */
  demoPrepareMLData(world, windowSize = 100) {
    console.log('=== Sensor Demo: Prepare ML/Analytics Data ===');
    
    const service = world.getDataIngestionService();
    const samples = service.getRecentSamples(windowSize);
    
    if (samples.length === 0) {
      console.warn('No data available');
      return null;
    }
    
    // Transform data into feature matrix
    const features = [];
    const labels = [];
    
    for (const sample of samples) {
      for (const intersection of sample.intersections) {
        const featureRow = {
          timestamp: sample.simTimestamp,
          junctionId: intersection.junctionId,
          
          // Features
          totalVehicles: 0,
          totalQueueLength: 0,
          avgWaitingTime: 0,
          maxOccupancy: 0,
          
          // Per-direction features
          directions: {}
        };
        
        let dirCount = 0;
        for (const [direction, reading] of Object.entries(intersection.sensorReadings)) {
          featureRow.totalVehicles += reading.data.vehicleCount;
          featureRow.totalQueueLength += reading.data.queueLength;
          featureRow.avgWaitingTime += reading.data.averageWaitingTime;
          featureRow.maxOccupancy = Math.max(featureRow.maxOccupancy, reading.data.occupancyRate);
          
          featureRow.directions[direction] = {
            vehicleCount: reading.data.vehicleCount,
            queueLength: reading.data.queueLength,
            waitingTime: reading.data.averageWaitingTime,
            occupancy: reading.data.occupancyRate
          };
          
          dirCount++;
        }
        
        featureRow.avgWaitingTime /= dirCount;
        
        features.push(featureRow);
        
        // Example label: congested = avg waiting time > 10 seconds
        labels.push(featureRow.avgWaitingTime > 10000 ? 1 : 0);
      }
    }
    
    console.log(`Prepared ${features.length} feature vectors from ${samples.length} samples`);
    console.log('Sample feature vector:', features[0]);
    console.log(`Congestion labels: ${labels.filter(l => l === 1).length} congested, ${labels.filter(l => l === 0).length} clear`);
    
    return { features, labels };
  },

  /**
   * Stop all active demos and clear data
   * @param {World} world - World instance
   */
  stopAndClear(world) {
    console.log('=== Stopping Sensor Service and Clearing Data ===');
    
    if (world.dataIngestionService) {
      world.dataIngestionService.stop();
      world.dataIngestionService.clearBuffer();
      console.log('Service stopped and buffer cleared');
    } else {
      console.log('No service running');
    }
  }
};

// Make available globally for console access
if (typeof window !== 'undefined') {
  window.sensorDemo = sensorDemo;
}
