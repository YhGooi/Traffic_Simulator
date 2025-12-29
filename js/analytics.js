/**
 * Traffic Analytics Module
 * Consumes raw sensing data and derives higher-level traffic states.
 * 
 * This module provides:
 * - Traffic density calculation
 * - Congestion level classification (low/medium/high)
 * - Peak vs off-peak detection
 * - Network-wide traffic state analysis
 * 
 * Uses simple rule-based and statistical methods.
 * Decoupled from optimization logic.
 * 
 * Part of the Traffic Analytics layer in the energy-aware architecture.
 */

/**
 * Congestion Level Enumeration
 */
export const CongestionLevel = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL'
};

/**
 * Traffic Period Classification
 */
export const TrafficPeriod = {
  OFF_PEAK: 'OFF_PEAK',
  PEAK: 'PEAK',
  RUSH_HOUR: 'RUSH_HOUR'
};

/**
 * IntersectionAnalytics Class
 * Analyzes traffic at a single intersection
 */
export class IntersectionAnalytics {
  constructor(junctionId) {
    this.junctionId = junctionId;
    
    // Current state
    this.currentState = null;
    
    // Historical metrics for trend analysis
    this.history = {
      densities: [],
      congestionLevels: [],
      avgWaitTimes: [],
      timestamps: [],
      maxHistory: 100 // Keep last 100 readings
    };
  }

  /**
   * Analyze sensor readings for this intersection
   * @param {Object} sensorReadings - Sensor data from all directions
   * @param {number} simTimestamp - Current simulation time
   * @returns {Object} Analyzed traffic state
   */
  analyze(sensorReadings, simTimestamp) {
    const directions = Object.keys(sensorReadings);
    const metrics = {
      perDirection: {},
      aggregate: {}
    };

    // Analyze each direction
    let totalVehicles = 0;
    let totalCapacity = 0;
    let totalQueue = 0;
    let totalWaitTime = 0;
    let totalOccupancy = 0;
    let directionCount = 0;

    for (const [direction, reading] of Object.entries(sensorReadings)) {
      const dirMetrics = this._analyzeDirection(reading);
      metrics.perDirection[direction] = dirMetrics;

      totalVehicles += reading.data.vehicleCount;
      totalCapacity += reading.data.capacity;
      totalQueue += reading.data.queueLength;
      totalWaitTime += reading.data.averageWaitingTime;
      totalOccupancy += reading.data.occupancyRate;
      directionCount++;
    }

    // Aggregate metrics
    metrics.aggregate.totalVehicles = totalVehicles;
    metrics.aggregate.totalCapacity = totalCapacity;
    metrics.aggregate.totalQueue = totalQueue;
    metrics.aggregate.avgWaitTime = totalWaitTime / directionCount;
    metrics.aggregate.avgOccupancy = totalOccupancy / directionCount;

    // Calculate traffic density (0-1 scale)
    metrics.aggregate.density = totalCapacity > 0 ? totalVehicles / totalCapacity : 0;

    // Classify congestion level
    metrics.aggregate.congestionLevel = this._classifyCongestion(
      totalQueue / directionCount,
      metrics.aggregate.avgWaitTime,
      metrics.aggregate.density
    );

    // Determine dominant flow direction
    metrics.aggregate.dominantFlow = this._getDominantFlow(metrics.perDirection);

    // Calculate pressure score (0-100)
    metrics.aggregate.pressureScore = this._calculatePressureScore(metrics.aggregate);

    // Store current state
    this.currentState = {
      junctionId: this.junctionId,
      timestamp: simTimestamp,
      metrics: metrics
    };

    // Update history
    this._updateHistory(metrics.aggregate, simTimestamp);

    return this.currentState;
  }

  /**
   * Analyze a single direction
   * @private
   */
  _analyzeDirection(reading) {
    const queueLength = reading.data.queueLength;
    const waitTime = reading.data.averageWaitingTime;
    const occupancy = reading.data.occupancyRate;
    const capacity = reading.data.capacity;
    const vehicleCount = reading.data.vehicleCount;

    return {
      vehicleCount: vehicleCount,
      queueLength: queueLength,
      waitingTime: waitTime,
      occupancy: occupancy,
      density: capacity > 0 ? vehicleCount / capacity : 0,
      congestionLevel: this._classifyCongestion(queueLength, waitTime, occupancy),
      isCongested: queueLength > 5 || waitTime > 10000,
      isBlocked: occupancy > 0.9 || reading.data.isFull
    };
  }

  /**
   * Classify congestion level based on metrics
   * @private
   */
  _classifyCongestion(queueLength, avgWaitTime, density) {
    // Rule-based classification
    const waitTimeSec = avgWaitTime / 1000;

    // Critical: Very high queue or wait time
    if (queueLength > 10 || waitTimeSec > 20 || density > 0.9) {
      return CongestionLevel.CRITICAL;
    }

    // High: High queue or wait time
    if (queueLength > 7 || waitTimeSec > 15 || density > 0.75) {
      return CongestionLevel.HIGH;
    }

    // Medium: Moderate queue or wait time
    if (queueLength > 3 || waitTimeSec > 5 || density > 0.5) {
      return CongestionLevel.MEDIUM;
    }

    // Low: Light traffic
    return CongestionLevel.LOW;
  }

  /**
   * Get dominant flow direction (most congested)
   * @private
   */
  _getDominantFlow(perDirection) {
    let maxQueue = 0;
    let dominantDir = null;

    for (const [direction, metrics] of Object.entries(perDirection)) {
      if (metrics.queueLength > maxQueue) {
        maxQueue = metrics.queueLength;
        dominantDir = direction;
      }
    }

    return dominantDir;
  }

  /**
   * Calculate pressure score (0-100)
   * Composite metric indicating overall intersection stress
   * @private
   */
  _calculatePressureScore(aggregate) {
    // Weighted combination of factors
    const densityScore = aggregate.density * 40;
    const queueScore = Math.min((aggregate.totalQueue / 20) * 30, 30);
    const waitScore = Math.min((aggregate.avgWaitTime / 30000) * 30, 30);

    return Math.min(densityScore + queueScore + waitScore, 100);
  }

  /**
   * Update historical metrics
   * @private
   */
  _updateHistory(aggregate, timestamp) {
    this.history.densities.push(aggregate.density);
    this.history.congestionLevels.push(aggregate.congestionLevel);
    this.history.avgWaitTimes.push(aggregate.avgWaitTime);
    this.history.timestamps.push(timestamp);

    // Trim history if too long
    const maxHistory = this.history.maxHistory;
    if (this.history.densities.length > maxHistory) {
      this.history.densities.shift();
      this.history.congestionLevels.shift();
      this.history.avgWaitTimes.shift();
      this.history.timestamps.shift();
    }
  }

  /**
   * Get current state
   * @returns {Object} Current traffic state
   */
  getCurrentState() {
    return this.currentState;
  }

  /**
   * Get trend analysis
   * @returns {Object} Trend metrics
   */
  getTrend() {
    if (this.history.densities.length < 2) {
      return { trend: 'STABLE', confidence: 'LOW' };
    }

    const recentCount = Math.min(10, this.history.densities.length);
    const recent = this.history.densities.slice(-recentCount);
    const older = this.history.densities.slice(-recentCount * 2, -recentCount);

    if (older.length === 0) {
      return { trend: 'STABLE', confidence: 'LOW' };
    }

    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;

    const change = recentAvg - olderAvg;
    const changePercent = olderAvg > 0 ? (change / olderAvg) * 100 : 0;

    let trend = 'STABLE';
    if (changePercent > 10) trend = 'INCREASING';
    else if (changePercent < -10) trend = 'DECREASING';

    return {
      trend: trend,
      changePercent: changePercent,
      confidence: this.history.densities.length >= 20 ? 'HIGH' : 'MEDIUM'
    };
  }

  /**
   * Get statistical summary
   * @returns {Object} Statistical metrics
   */
  getStatistics() {
    if (this.history.densities.length === 0) {
      return null;
    }

    const densities = this.history.densities;
    const waitTimes = this.history.avgWaitTimes;

    return {
      density: {
        mean: this._mean(densities),
        median: this._median(densities),
        stdDev: this._stdDev(densities),
        min: Math.min(...densities),
        max: Math.max(...densities)
      },
      waitTime: {
        mean: this._mean(waitTimes),
        median: this._median(waitTimes),
        min: Math.min(...waitTimes),
        max: Math.max(...waitTimes)
      },
      congestionDistribution: this._getCongestionDistribution()
    };
  }

  /**
   * Get congestion level distribution
   * @private
   */
  _getCongestionDistribution() {
    const dist = {
      [CongestionLevel.LOW]: 0,
      [CongestionLevel.MEDIUM]: 0,
      [CongestionLevel.HIGH]: 0,
      [CongestionLevel.CRITICAL]: 0
    };

    for (const level of this.history.congestionLevels) {
      dist[level]++;
    }

    const total = this.history.congestionLevels.length;
    for (const level in dist) {
      dist[level] = total > 0 ? (dist[level] / total) * 100 : 0;
    }

    return dist;
  }

  // Statistical helpers
  _mean(arr) {
    return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  }

  _median(arr) {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }

  _stdDev(arr) {
    const mean = this._mean(arr);
    const variance = arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length;
    return Math.sqrt(variance);
  }
}

/**
 * NetworkAnalytics Class
 * Analyzes traffic across the entire network
 */
export class NetworkAnalytics {
  constructor() {
    // Current network state
    this.currentState = null;

    // Historical network metrics
    this.history = {
      totalVehicles: [],
      avgDensity: [],
      trafficPeriod: [],
      timestamps: [],
      maxHistory: 100
    };

    // Baseline for peak detection (learned over time)
    this.baseline = {
      avgVehicles: 0,
      avgDensity: 0,
      sampleCount: 0
    };
  }

  /**
   * Analyze network-wide traffic
   * @param {Array} intersectionStates - Array of analyzed intersection states
   * @param {number} simTimestamp - Current simulation time
   * @returns {Object} Network traffic state
   */
  analyze(intersectionStates, simTimestamp) {
    const metrics = {
      intersectionCount: intersectionStates.length,
      timestamp: simTimestamp
    };

    // Aggregate across all intersections
    let totalVehicles = 0;
    let totalCapacity = 0;
    let totalQueue = 0;
    let totalWaitTime = 0;
    let totalPressure = 0;

    const congestionCounts = {
      [CongestionLevel.LOW]: 0,
      [CongestionLevel.MEDIUM]: 0,
      [CongestionLevel.HIGH]: 0,
      [CongestionLevel.CRITICAL]: 0
    };

    for (const state of intersectionStates) {
      const agg = state.metrics.aggregate;
      totalVehicles += agg.totalVehicles;
      totalCapacity += agg.totalCapacity;
      totalQueue += agg.totalQueue;
      totalWaitTime += agg.avgWaitTime;
      totalPressure += agg.pressureScore;
      congestionCounts[agg.congestionLevel]++;
    }

    const intersectionCount = intersectionStates.length;

    // Network-wide metrics
    metrics.totalVehicles = totalVehicles;
    metrics.totalCapacity = totalCapacity;
    metrics.avgDensity = totalCapacity > 0 ? totalVehicles / totalCapacity : 0;
    metrics.avgQueueLength = totalQueue / intersectionCount;
    metrics.avgWaitTime = totalWaitTime / intersectionCount;
    metrics.avgPressureScore = totalPressure / intersectionCount;

    // Network congestion level (based on majority)
    metrics.networkCongestion = this._getNetworkCongestionLevel(congestionCounts);

    // Congestion distribution
    metrics.congestionDistribution = {};
    for (const level in congestionCounts) {
      metrics.congestionDistribution[level] = (congestionCounts[level] / intersectionCount) * 100;
    }

    // Peak vs off-peak classification
    metrics.trafficPeriod = this._classifyTrafficPeriod(metrics);

    // Network efficiency score (0-100, higher is better)
    metrics.efficiencyScore = this._calculateEfficiencyScore(metrics);

    // Critical intersections
    metrics.criticalIntersections = this._identifyCriticalIntersections(intersectionStates);

    // Store current state
    this.currentState = metrics;

    // Update history and baseline
    this._updateHistory(metrics);
    this._updateBaseline(metrics);

    return this.currentState;
  }

  /**
   * Get network congestion level based on intersection distribution
   * @private
   */
  _getNetworkCongestionLevel(congestionCounts) {
    // Weighted scoring
    const score = 
      congestionCounts[CongestionLevel.LOW] * 1 +
      congestionCounts[CongestionLevel.MEDIUM] * 2 +
      congestionCounts[CongestionLevel.HIGH] * 3 +
      congestionCounts[CongestionLevel.CRITICAL] * 4;

    const total = Object.values(congestionCounts).reduce((a, b) => a + b, 0);
    const avgScore = total > 0 ? score / total : 1;

    if (avgScore >= 3.5) return CongestionLevel.CRITICAL;
    if (avgScore >= 2.5) return CongestionLevel.HIGH;
    if (avgScore >= 1.5) return CongestionLevel.MEDIUM;
    return CongestionLevel.LOW;
  }

  /**
   * Classify traffic period (peak vs off-peak)
   * @private
   */
  _classifyTrafficPeriod(metrics) {
    // Use baseline if available
    if (this.baseline.sampleCount > 20) {
      const densityRatio = this.baseline.avgDensity > 0 ? 
        metrics.avgDensity / this.baseline.avgDensity : 1;

      const vehicleRatio = this.baseline.avgVehicles > 0 ?
        metrics.totalVehicles / this.baseline.avgVehicles : 1;

      // Rush hour: significantly above baseline
      if (densityRatio > 1.5 || vehicleRatio > 1.5) {
        return TrafficPeriod.RUSH_HOUR;
      }

      // Peak: above baseline
      if (densityRatio > 1.2 || vehicleRatio > 1.2) {
        return TrafficPeriod.PEAK;
      }

      // Off-peak: at or below baseline
      return TrafficPeriod.OFF_PEAK;
    }

    // Simple rule-based classification without baseline
    if (metrics.avgDensity > 0.6 || metrics.networkCongestion === CongestionLevel.HIGH ||
        metrics.networkCongestion === CongestionLevel.CRITICAL) {
      return TrafficPeriod.RUSH_HOUR;
    }

    if (metrics.avgDensity > 0.4 || metrics.networkCongestion === CongestionLevel.MEDIUM) {
      return TrafficPeriod.PEAK;
    }

    return TrafficPeriod.OFF_PEAK;
  }

  /**
   * Calculate network efficiency score
   * @private
   */
  _calculateEfficiencyScore(metrics) {
    // Factors: low wait time, low congestion, good throughput
    const waitTimeScore = Math.max(0, 100 - (metrics.avgWaitTime / 200)); // 20s = 0 score
    const congestionScore = this._congestionToScore(metrics.networkCongestion);
    const densityScore = metrics.avgDensity < 0.8 ? 100 : Math.max(0, 100 - (metrics.avgDensity - 0.8) * 500);

    return (waitTimeScore * 0.4 + congestionScore * 0.4 + densityScore * 0.2);
  }

  /**
   * Convert congestion level to score
   * @private
   */
  _congestionToScore(level) {
    switch (level) {
      case CongestionLevel.LOW: return 100;
      case CongestionLevel.MEDIUM: return 60;
      case CongestionLevel.HIGH: return 30;
      case CongestionLevel.CRITICAL: return 10;
      default: return 50;
    }
  }

  /**
   * Identify critical intersections that need attention
   * @private
   */
  _identifyCriticalIntersections(intersectionStates) {
    return intersectionStates
      .filter(state => {
        const agg = state.metrics.aggregate;
        return agg.congestionLevel === CongestionLevel.HIGH ||
               agg.congestionLevel === CongestionLevel.CRITICAL ||
               agg.pressureScore > 70;
      })
      .map(state => ({
        junctionId: state.junctionId,
        congestionLevel: state.metrics.aggregate.congestionLevel,
        pressureScore: state.metrics.aggregate.pressureScore,
        totalQueue: state.metrics.aggregate.totalQueue,
        avgWaitTime: state.metrics.aggregate.avgWaitTime
      }))
      .sort((a, b) => b.pressureScore - a.pressureScore);
  }

  /**
   * Update historical metrics
   * @private
   */
  _updateHistory(metrics) {
    this.history.totalVehicles.push(metrics.totalVehicles);
    this.history.avgDensity.push(metrics.avgDensity);
    this.history.trafficPeriod.push(metrics.trafficPeriod);
    this.history.timestamps.push(metrics.timestamp);

    // Trim history
    const maxHistory = this.history.maxHistory;
    if (this.history.totalVehicles.length > maxHistory) {
      this.history.totalVehicles.shift();
      this.history.avgDensity.shift();
      this.history.trafficPeriod.shift();
      this.history.timestamps.shift();
    }
  }

  /**
   * Update baseline (running average)
   * @private
   */
  _updateBaseline(metrics) {
    const alpha = 0.1; // Learning rate
    this.baseline.avgVehicles = this.baseline.avgVehicles * (1 - alpha) + metrics.totalVehicles * alpha;
    this.baseline.avgDensity = this.baseline.avgDensity * (1 - alpha) + metrics.avgDensity * alpha;
    this.baseline.sampleCount++;
  }

  /**
   * Get current network state
   * @returns {Object} Current state
   */
  getCurrentState() {
    return this.currentState;
  }

  /**
   * Get network trend
   * @returns {Object} Trend analysis
   */
  getTrend() {
    if (this.history.avgDensity.length < 10) {
      return { trend: 'STABLE', confidence: 'LOW' };
    }

    const recent = this.history.avgDensity.slice(-10);
    const older = this.history.avgDensity.slice(-20, -10);

    if (older.length < 10) {
      return { trend: 'STABLE', confidence: 'LOW' };
    }

    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;

    const change = recentAvg - olderAvg;
    const changePercent = olderAvg > 0 ? (change / olderAvg) * 100 : 0;

    let trend = 'STABLE';
    if (changePercent > 15) trend = 'WORSENING';
    else if (changePercent < -15) trend = 'IMPROVING';

    return {
      trend: trend,
      changePercent: changePercent,
      confidence: 'HIGH'
    };
  }

  /**
   * Get period distribution
   * @returns {Object} Distribution of traffic periods
   */
  getPeriodDistribution() {
    if (this.history.trafficPeriod.length === 0) {
      return null;
    }

    const dist = {
      [TrafficPeriod.OFF_PEAK]: 0,
      [TrafficPeriod.PEAK]: 0,
      [TrafficPeriod.RUSH_HOUR]: 0
    };

    for (const period of this.history.trafficPeriod) {
      dist[period]++;
    }

    const total = this.history.trafficPeriod.length;
    for (const period in dist) {
      dist[period] = (dist[period] / total) * 100;
    }

    return dist;
  }
}

/**
 * TrafficAnalyzer Class
 * Main analytics engine that orchestrates analysis
 */
export class TrafficAnalyzer {
  constructor({ dataIngestionService, updateIntervalMs = 1000 }) {
    this.dataIngestionService = dataIngestionService;
    this.updateIntervalMs = updateIntervalMs;

    // Analytics for each intersection
    this.intersectionAnalytics = new Map();

    // Network-wide analytics
    this.networkAnalytics = new NetworkAnalytics();

    // Analysis state
    this.isRunning = false;
    this.intervalId = null;
    this.totalAnalyses = 0;

    // Callbacks for analytics consumers (e.g., optimization modules)
    this.analyticsCallbacks = new Set();
  }

  /**
   * Start analytics engine
   */
  start() {
    if (this.isRunning) {
      console.warn('[TrafficAnalyzer] Already running');
      return;
    }

    // Ensure data ingestion is running
    if (!this.dataIngestionService.isRunning) {
      console.warn('[TrafficAnalyzer] Starting data ingestion service');
      this.dataIngestionService.start();
    }

    this.isRunning = true;

    // Start periodic analysis
    this.intervalId = setInterval(() => {
      this._performAnalysis();
    }, this.updateIntervalMs);

    console.log(`[TrafficAnalyzer] Started (interval: ${this.updateIntervalMs}ms)`);
  }

  /**
   * Stop analytics engine
   */
  stop() {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    console.log('[TrafficAnalyzer] Stopped');
  }

  /**
   * Perform analysis on latest sensor data
   * @private
   */
  _performAnalysis() {
    const latestSample = this.dataIngestionService.getLatestSample();
    if (!latestSample) return;

    const intersectionStates = [];

    // Analyze each intersection
    for (const intersection of latestSample.intersections) {
      const junctionId = intersection.junctionId;

      // Get or create intersection analytics
      if (!this.intersectionAnalytics.has(junctionId)) {
        this.intersectionAnalytics.set(junctionId, new IntersectionAnalytics(junctionId));
      }

      const analytics = this.intersectionAnalytics.get(junctionId);
      const state = analytics.analyze(intersection.sensorReadings, latestSample.simTimestamp);
      intersectionStates.push(state);
    }

    // Analyze network
    const networkState = this.networkAnalytics.analyze(intersectionStates, latestSample.simTimestamp);

    this.totalAnalyses++;

    // Notify callbacks
    this._notifyCallbacks({
      timestamp: latestSample.timestamp,
      simTimestamp: latestSample.simTimestamp,
      intersections: intersectionStates,
      network: networkState
    });
  }

  /**
   * Register callback for analytics updates
   * @param {Function} callback - Callback function
   */
  onAnalytics(callback) {
    this.analyticsCallbacks.add(callback);
  }

  /**
   * Unregister callback
   * @param {Function} callback - Callback function
   */
  offAnalytics(callback) {
    this.analyticsCallbacks.delete(callback);
  }

  /**
   * Notify all callbacks
   * @private
   */
  _notifyCallbacks(analyticsData) {
    for (const callback of this.analyticsCallbacks) {
      try {
        callback(analyticsData);
      } catch (error) {
        console.error('[TrafficAnalyzer] Callback error:', error);
      }
    }
  }

  /**
   * Get analytics for specific intersection
   * @param {string} junctionId - Junction identifier
   * @returns {Object|null} Intersection analytics state
   */
  getIntersectionAnalytics(junctionId) {
    const analytics = this.intersectionAnalytics.get(junctionId);
    return analytics ? analytics.getCurrentState() : null;
  }

  /**
   * Get network analytics
   * @returns {Object|null} Network analytics state
   */
  getNetworkAnalytics() {
    return this.networkAnalytics.getCurrentState();
  }

  /**
   * Get complete analytics snapshot
   * @returns {Object} Complete analytics data
   */
  getSnapshot() {
    const intersections = {};
    for (const [junctionId, analytics] of this.intersectionAnalytics.entries()) {
      intersections[junctionId] = {
        state: analytics.getCurrentState(),
        trend: analytics.getTrend(),
        statistics: analytics.getStatistics()
      };
    }

    return {
      intersections: intersections,
      network: {
        state: this.networkAnalytics.getCurrentState(),
        trend: this.networkAnalytics.getTrend(),
        periodDistribution: this.networkAnalytics.getPeriodDistribution()
      },
      metadata: {
        totalAnalyses: this.totalAnalyses,
        isRunning: this.isRunning,
        updateIntervalMs: this.updateIntervalMs
      }
    };
  }

  /**
   * Get recommendations for optimization
   * Simple rule-based recommendations
   * @returns {Array} Array of recommendation objects
   */
  getRecommendations() {
    const recommendations = [];
    const networkState = this.networkAnalytics.getCurrentState();

    if (!networkState) return recommendations;

    // Network-level recommendations
    if (networkState.trafficPeriod === TrafficPeriod.RUSH_HOUR) {
      recommendations.push({
        type: 'NETWORK',
        priority: 'HIGH',
        message: 'Rush hour detected - consider adaptive signal timing',
        metric: 'trafficPeriod',
        value: networkState.trafficPeriod
      });
    }

    if (networkState.efficiencyScore < 50) {
      recommendations.push({
        type: 'NETWORK',
        priority: 'MEDIUM',
        message: 'Low network efficiency - optimize signal coordination',
        metric: 'efficiencyScore',
        value: networkState.efficiencyScore
      });
    }

    // Intersection-level recommendations
    for (const critical of networkState.criticalIntersections || []) {
      recommendations.push({
        type: 'INTERSECTION',
        junctionId: critical.junctionId,
        priority: 'HIGH',
        message: `High congestion at ${critical.junctionId} - increase green time`,
        metric: 'pressureScore',
        value: critical.pressureScore
      });
    }

    return recommendations;
  }

  /**
   * Get statistics
   * @returns {Object} Analyzer statistics
   */
  getStatistics() {
    return {
      isRunning: this.isRunning,
      totalAnalyses: this.totalAnalyses,
      intersectionCount: this.intersectionAnalytics.size,
      updateIntervalMs: this.updateIntervalMs,
      callbackCount: this.analyticsCallbacks.size
    };
  }
}

/**
 * Helper function to create traffic analyzer
 * @param {DataIngestionService} dataIngestionService - Data ingestion service
 * @param {number} updateIntervalMs - Update interval
 * @returns {TrafficAnalyzer} Analyzer instance
 */
export function createTrafficAnalyzer(dataIngestionService, updateIntervalMs = 1000) {
  return new TrafficAnalyzer({ dataIngestionService, updateIntervalMs });
}
