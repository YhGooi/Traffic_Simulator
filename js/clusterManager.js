/**
 * Cluster Manager Module
 * 
 * Coordinates multiple intersections (junctions) for scalable traffic management.
 * Manages local sensing, local analytics, and coordinated optimization across
 * N intersections.
 * 
 * Architecture:
 * - Each intersection has local sensing (TrafficSensor)
 * - Each intersection has local analytics (IntersectionAnalytics)
 * - Cluster Manager coordinates network-wide optimization
 * - Demonstrates architectural scalability (not distributed systems)
 * 
 * Scalability tested: 1, 5, 10+ intersections
 */

import { DataIngestionService, IntersectionSensorArray } from './sensor.js';
import { TrafficAnalyzer, IntersectionAnalytics } from './analytics.js';
import { OptimizationEngine } from './optimization.js';

/**
 * IntersectionController Class
 * Manages a single intersection with local sensing and analytics
 */
export class IntersectionController {
  constructor(junctionId, junction, config = {}) {
    this.junctionId = junctionId;
    this.junction = junction;
    this.config = {
      sensingInterval: config.sensingInterval || 1000,
      analyticsInterval: config.analyticsInterval || 1000,
      enableLocalControl: config.enableLocalControl !== false,
      ...config
    };

    // Local sensing
    this.sensorArray = new IntersectionSensorArray(junctionId, junction);
    this.sensorArray.startContinuous(this.config.sensingInterval);

    // Local analytics
    this.analytics = new IntersectionAnalytics(junctionId);

    // Local state
    this.state = {
      status: 'active',
      lastUpdate: Date.now(),
      cyclesProcessed: 0,
      localOptimizations: 0
    };

    console.log(`[IntersectionController] Initialized for ${junctionId}`);
  }

  /**
   * Update local analytics with latest sensor data
   */
  update() {
    const sensorData = this.sensorArray.getLatestReading();
    if (!sensorData) return null;

    // Update local analytics
    this.analytics.update({
      timestamp: sensorData.timestamp,
      intersectionId: this.junctionId,
      state: sensorData,
      signal: {
        currentPhase: this.junction.signal.phase,
        timings: this.junction.signal.getTimings()
      }
    });

    this.state.lastUpdate = Date.now();
    this.state.cyclesProcessed++;

    return {
      junctionId: this.junctionId,
      sensorData: sensorData,
      analytics: this.analytics.getAnalytics(),
      state: { ...this.state }
    };
  }

  /**
   * Get local metrics
   */
  getMetrics() {
    return {
      junctionId: this.junctionId,
      status: this.state.status,
      cyclesProcessed: this.state.cyclesProcessed,
      localOptimizations: this.state.localOptimizations,
      analytics: this.analytics.getAnalytics(),
      sensorData: this.sensorArray.getLatestReading()
    };
  }

  /**
   * Apply signal timing locally
   */
  applyTiming(timings) {
    const result = this.junction.signal.updateTimings({
      ...timings,
      validateSafety: true,
      applyImmediately: false
    });

    if (result.success) {
      this.state.localOptimizations++;
    }

    return result;
  }

  /**
   * Stop local controller
   */
  stop() {
    this.sensorArray.stopContinuous();
    this.state.status = 'stopped';
    console.log(`[IntersectionController] Stopped ${this.junctionId}`);
  }
}

/**
 * ClusterManager Class
 * Coordinates multiple intersections for scalable traffic management
 */
export class ClusterManager {
  constructor(config = {}) {
    this.config = {
      sensingInterval: config.sensingInterval || 1000,
      analyticsInterval: config.analyticsInterval || 1000,
      optimizationInterval: config.optimizationInterval || 5000,
      optimizationStrategy: config.optimizationStrategy || 'ADAPTIVE',
      enableCoordination: config.enableCoordination !== false,
      maxIntersections: config.maxIntersections || 100,
      ...config
    };

    // Intersection controllers (one per intersection)
    this.controllers = new Map();

    // Network-wide analytics
    this.networkAnalytics = null;

    // Network-wide optimization
    this.optimizationEngine = null;

    // Cluster state
    this.state = {
      status: 'initialized',
      totalIntersections: 0,
      activeIntersections: 0,
      startTime: null,
      totalCycles: 0,
      totalOptimizations: 0
    };

    // Performance metrics
    this.metrics = {
      avgUpdateTime: 0,
      maxUpdateTime: 0,
      updateCount: 0,
      optimizationTime: 0,
      optimizationCount: 0
    };

    console.log('[ClusterManager] Initialized');
  }

  /**
   * Add intersection to cluster
   * @param {string} junctionId - Junction identifier
   * @param {Junction} junction - Junction object
   * @returns {IntersectionController} Controller for this intersection
   */
  addIntersection(junctionId, junction) {
    if (this.controllers.has(junctionId)) {
      console.warn(`[ClusterManager] Intersection ${junctionId} already exists`);
      return this.controllers.get(junctionId);
    }

    if (this.controllers.size >= this.config.maxIntersections) {
      throw new Error(`[ClusterManager] Maximum intersections (${this.config.maxIntersections}) reached`);
    }

    const controller = new IntersectionController(junctionId, junction, {
      sensingInterval: this.config.sensingInterval,
      analyticsInterval: this.config.analyticsInterval
    });

    this.controllers.set(junctionId, controller);
    this.state.totalIntersections++;
    this.state.activeIntersections++;

    console.log(`[ClusterManager] Added intersection ${junctionId} (total: ${this.state.totalIntersections})`);

    return controller;
  }

  /**
   * Add multiple intersections from World
   * @param {Map} junctions - Map of junction objects
   * @returns {number} Number of intersections added
   */
  addIntersections(junctions) {
    let added = 0;
    for (const [junctionId, junction] of junctions.entries()) {
      try {
        this.addIntersection(junctionId, junction);
        added++;
      } catch (error) {
        console.error(`[ClusterManager] Failed to add ${junctionId}:`, error.message);
      }
    }
    return added;
  }

  /**
   * Remove intersection from cluster
   */
  removeIntersection(junctionId) {
    const controller = this.controllers.get(junctionId);
    if (!controller) return false;

    controller.stop();
    this.controllers.delete(junctionId);
    this.state.activeIntersections--;

    console.log(`[ClusterManager] Removed intersection ${junctionId}`);
    return true;
  }

  /**
   * Start cluster management
   * @param {TrafficAnalyzer} trafficAnalyzer - Network-wide traffic analyzer
   * @param {World} world - World instance for optimization
   */
  start(trafficAnalyzer, world) {
    if (this.state.status === 'running') {
      console.warn('[ClusterManager] Already running');
      return;
    }

    this.networkAnalytics = trafficAnalyzer;
    this.world = world;

    // Start optimization engine
    if (this.config.enableCoordination && world) {
      this.optimizationEngine = new OptimizationEngine({
        trafficAnalyzer: trafficAnalyzer,
        world: world,
        strategy: this.config.optimizationStrategy,
        autoRun: false
      });

      this.optimizationEngine.optimizationIntervalMs = this.config.optimizationInterval;
      this.optimizationEngine.start();
    }

    this.state.status = 'running';
    this.state.startTime = Date.now();

    console.log(`[ClusterManager] Started with ${this.state.totalIntersections} intersections`);
    console.log(`  Coordination: ${this.config.enableCoordination ? 'Enabled' : 'Disabled'}`);
    console.log(`  Strategy: ${this.config.optimizationStrategy}`);
  }

  /**
   * Stop cluster management
   */
  stop() {
    if (this.state.status !== 'running') return;

    // Stop all intersection controllers
    for (const controller of this.controllers.values()) {
      controller.stop();
    }

    // Stop optimization engine
    if (this.optimizationEngine) {
      this.optimizationEngine.stop();
    }

    this.state.status = 'stopped';
    console.log('[ClusterManager] Stopped');
  }

  /**
   * Update all intersections (call periodically)
   */
  update() {
    if (this.state.status !== 'running') return null;

    const updateStart = Date.now();
    const results = {
      timestamp: updateStart,
      intersections: {},
      summary: {
        total: this.state.totalIntersections,
        updated: 0,
        failed: 0
      }
    };

    // Update each intersection controller
    for (const [junctionId, controller] of this.controllers.entries()) {
      try {
        const update = controller.update();
        if (update) {
          results.intersections[junctionId] = update;
          results.summary.updated++;
        }
      } catch (error) {
        console.error(`[ClusterManager] Update failed for ${junctionId}:`, error);
        results.summary.failed++;
      }
    }

    // Update metrics
    const updateTime = Date.now() - updateStart;
    this.metrics.updateCount++;
    this.metrics.avgUpdateTime = (this.metrics.avgUpdateTime * (this.metrics.updateCount - 1) + updateTime) / this.metrics.updateCount;
    this.metrics.maxUpdateTime = Math.max(this.metrics.maxUpdateTime, updateTime);

    this.state.totalCycles++;

    return results;
  }

  /**
   * Get cluster metrics
   */
  getMetrics() {
    const uptime = this.state.startTime ? Date.now() - this.state.startTime : 0;

    return {
      cluster: {
        status: this.state.status,
        totalIntersections: this.state.totalIntersections,
        activeIntersections: this.state.activeIntersections,
        uptime: uptime,
        totalCycles: this.state.totalCycles,
        cyclesPerSecond: uptime > 0 ? (this.state.totalCycles / (uptime / 1000)).toFixed(2) : 0
      },
      performance: {
        avgUpdateTime: this.metrics.avgUpdateTime.toFixed(2) + 'ms',
        maxUpdateTime: this.metrics.maxUpdateTime.toFixed(2) + 'ms',
        updateCount: this.metrics.updateCount
      },
      optimization: this.optimizationEngine ? this.optimizationEngine.getMetrics() : null,
      intersections: Array.from(this.controllers.values()).map(c => c.getMetrics())
    };
  }

  /**
   * Get intersection controller
   */
  getController(junctionId) {
    return this.controllers.get(junctionId);
  }

  /**
   * Get all controllers
   */
  getAllControllers() {
    return Array.from(this.controllers.values());
  }

  /**
   * Get cluster statistics
   */
  getStatistics() {
    const stats = {
      totalIntersections: this.state.totalIntersections,
      activeIntersections: this.state.activeIntersections,
      totalCycles: this.state.totalCycles,
      avgCongestion: 0,
      congestionDistribution: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 },
      avgDensity: 0,
      totalVehicles: 0
    };

    let congestionSum = 0;
    let densitySum = 0;

    for (const controller of this.controllers.values()) {
      const metrics = controller.getMetrics();
      const analytics = metrics.analytics;

      if (analytics) {
        densitySum += analytics.density || 0;

        if (analytics.congestionLevel) {
          stats.congestionDistribution[analytics.congestionLevel]++;
        }

        if (analytics.totalVehicles) {
          stats.totalVehicles += analytics.totalVehicles;
        }
      }
    }

    if (this.state.activeIntersections > 0) {
      stats.avgDensity = densitySum / this.state.activeIntersections;
    }

    return stats;
  }

  /**
   * Get detailed status report
   */
  getStatusReport() {
    const metrics = this.getMetrics();
    const stats = this.getStatistics();

    return {
      timestamp: Date.now(),
      cluster: metrics.cluster,
      performance: metrics.performance,
      statistics: stats,
      optimization: metrics.optimization,
      intersectionDetails: metrics.intersections.map(m => ({
        id: m.junctionId,
        status: m.status,
        congestion: m.analytics?.congestionLevel || 'UNKNOWN',
        density: m.analytics?.density?.toFixed(2) || 'N/A',
        cycles: m.cyclesProcessed,
        optimizations: m.localOptimizations
      }))
    };
  }
}

/**
 * Create cluster manager with world
 * @param {World} world - World instance
 * @param {Object} config - Configuration
 * @returns {ClusterManager} Cluster manager instance
 */
export function createClusterManager(world, config = {}) {
  const clusterManager = new ClusterManager(config);

  // Add all junctions from world
  const added = clusterManager.addIntersections(world.junctions);

  console.log(`[ClusterManager] Created with ${added} intersections from world`);

  return clusterManager;
}

/**
 * Scalability test helper
 * Tests cluster with N intersections
 */
export async function testClusterScalability(N, duration = 30000) {
  console.log(`\n=== Testing Cluster Scalability: ${N} Intersections ===\n`);

  // Dynamic import to avoid circular dependency
  const { World } = await import('./world.js');

  // Calculate grid size for N intersections
  const gridSize = Math.ceil(Math.sqrt(N));

  const world = new World({
    gridSize: gridSize,
    roadLength: 200
  });

  world.start();

  // Spawn vehicles
  const vehiclesPerIntersection = 5;
  const totalVehicles = Math.min(N * vehiclesPerIntersection, 100);

  console.log(`Creating ${gridSize}×${gridSize} grid (${world.junctions.size} intersections)`);
  console.log(`Spawning ${totalVehicles} vehicles`);

  const roads = Array.from(world.roads.values());
  for (let i = 0; i < totalVehicles; i++) {
    const road = roads[Math.floor(Math.random() * roads.length)];
    try {
      world.spawnVehicle(road);
    } catch (e) {
      // Road full, continue
    }
  }

  // Create cluster manager
  const clusterManager = createClusterManager(world, {
    sensingInterval: 1000,
    analyticsInterval: 1000,
    optimizationInterval: 5000,
    optimizationStrategy: 'ADAPTIVE',
    enableCoordination: true
  });

  // Start analytics and cluster
  const trafficAnalyzer = world.getTrafficAnalyzer(1000);
  trafficAnalyzer.start();

  clusterManager.start(trafficAnalyzer, world);

  // Monitor for duration
  const startTime = Date.now();
  const checkInterval = 5000;

  console.log(`\nMonitoring for ${duration / 1000} seconds...\n`);

  return new Promise((resolve) => {
    const intervalId = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const report = clusterManager.getStatusReport();

      console.log(`[${Math.floor(elapsed / 1000)}s] Cluster Status:`);
      console.log(`  Active Intersections: ${report.cluster.activeIntersections}`);
      console.log(`  Total Cycles: ${report.cluster.totalCycles}`);
      console.log(`  Avg Update Time: ${report.performance.avgUpdateTime}`);
      console.log(`  Avg Density: ${report.statistics.avgDensity.toFixed(2)}`);
      console.log(`  Total Vehicles: ${report.statistics.totalVehicles}`);

      if (elapsed >= duration) {
        clearInterval(intervalId);

        console.log(`\n=== Test Complete ===`);
        console.log(`Final Metrics:`);
        console.log(`  Intersections: ${report.cluster.totalIntersections}`);
        console.log(`  Total Cycles: ${report.cluster.totalCycles}`);
        console.log(`  Avg Update Time: ${report.performance.avgUpdateTime}`);
        console.log(`  Max Update Time: ${report.performance.maxUpdateTime}`);

        if (report.optimization) {
          console.log(`  Optimizations: ${report.optimization.totalOptimizations}`);
        }

        // Cleanup
        clusterManager.stop();
        world.destroy();

        resolve(report);
      }
    }, checkInterval);
  });
}
