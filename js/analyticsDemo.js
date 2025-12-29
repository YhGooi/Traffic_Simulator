/**
 * Analytics Demo Module
 * Demonstrates the Traffic Analytics Layer
 * 
 * This module provides examples of how to:
 * - Start traffic analytics
 * - Access traffic density metrics
 * - Monitor congestion levels
 * - Detect peak vs off-peak periods
 * - Get recommendations for optimization
 * - Integrate with optimization modules
 */

import { TrafficAnalyzer, CongestionLevel, TrafficPeriod } from './analytics.js';

/**
 * Demo namespace for analytics functionality
 */
export const analyticsDemo = {

  /**
   * Basic demo: Start analytics and monitor
   * @param {World} world - World instance
   * @param {number} updateIntervalMs - Update interval (default: 1000ms)
   */
  demoBasicAnalytics(world, updateIntervalMs = 1000) {
    console.log('=== Analytics Demo: Basic Traffic Analytics ===');
    
    // Start analytics (automatically starts data ingestion)
    const analyzer = world.startTrafficAnalytics(updateIntervalMs);
    
    console.log(`Analytics started with ${updateIntervalMs}ms interval`);
    console.log('Statistics:', analyzer.getStatistics());
    
    // Monitor for 10 seconds
    setTimeout(() => {
      const snapshot = analyzer.getSnapshot();
      console.log('\nAnalytics Snapshot:');
      console.log('  Network state:', snapshot.network.state);
      console.log('  Intersections analyzed:', Object.keys(snapshot.intersections).length);
      console.log('  Total analyses:', snapshot.metadata.totalAnalyses);
    }, 10000);
    
    return analyzer;
  },

  /**
   * Demo: Real-time congestion monitoring
   * @param {World} world - World instance
   * @param {number} duration - Duration to monitor in ms
   */
  demoRealTimeCongestion(world, duration = 30000) {
    console.log('=== Analytics Demo: Real-Time Congestion Monitoring ===\n');
    
    const analyzer = world.getTrafficAnalyzer();
    
    if (!analyzer.isRunning) {
      analyzer.start();
    }
    
    // Register callback for analytics updates
    const callback = (analyticsData) => {
      const network = analyticsData.network;
      const timestamp = new Date(analyticsData.timestamp).toLocaleTimeString();
      
      console.log(`[${timestamp}] Network State:`);
      console.log(`  Congestion: ${network.networkCongestion}`);
      console.log(`  Traffic Period: ${network.trafficPeriod}`);
      console.log(`  Avg Density: ${(network.avgDensity * 100).toFixed(1)}%`);
      console.log(`  Efficiency: ${network.efficiencyScore.toFixed(1)}/100`);
      
      // Alert on high congestion
      if (network.networkCongestion === CongestionLevel.HIGH ||
          network.networkCongestion === CongestionLevel.CRITICAL) {
        console.warn(`  ⚠️ HIGH CONGESTION DETECTED!`);
        
        if (network.criticalIntersections.length > 0) {
          console.warn(`  Critical intersections: ${network.criticalIntersections.length}`);
          for (const critical of network.criticalIntersections.slice(0, 3)) {
            console.warn(`    - ${critical.junctionId}: Pressure ${critical.pressureScore.toFixed(1)}`);
          }
        }
      }
      console.log('');
    };
    
    analyzer.onAnalytics(callback);
    console.log(`Monitoring network congestion for ${duration/1000} seconds...\n`);
    
    setTimeout(() => {
      analyzer.offAnalytics(callback);
      console.log('Monitoring stopped');
      
      const stats = analyzer.getStatistics();
      console.log(`Total analyses performed: ${stats.totalAnalyses}`);
    }, duration);
    
    return analyzer;
  },

  /**
   * Demo: Traffic density analysis
   * @param {World} world - World instance
   */
  demoDensityAnalysis(world) {
    console.log('=== Analytics Demo: Traffic Density Analysis ===\n');
    
    const analyzer = world.getTrafficAnalyzer();
    const snapshot = analyzer.getSnapshot();
    
    if (!snapshot.network.state) {
      console.log('No data available yet. Start analytics and wait for data collection.');
      return;
    }
    
    console.log('Network Density Analysis:');
    console.log('  Average density:', (snapshot.network.state.avgDensity * 100).toFixed(1), '%');
    console.log('  Total vehicles:', snapshot.network.state.totalVehicles);
    console.log('  Total capacity:', snapshot.network.state.totalCapacity);
    console.log('');
    
    console.log('Per-Intersection Density:');
    for (const [junctionId, data] of Object.entries(snapshot.intersections)) {
      const agg = data.state.metrics.aggregate;
      console.log(`  ${junctionId}:`);
      console.log(`    Density: ${(agg.density * 100).toFixed(1)}%`);
      console.log(`    Vehicles: ${agg.totalVehicles}/${agg.totalCapacity}`);
      console.log(`    Congestion: ${agg.congestionLevel}`);
      
      // Show per-direction density
      for (const [dir, dirMetrics] of Object.entries(data.state.metrics.perDirection)) {
        console.log(`      ${dir}: ${(dirMetrics.density * 100).toFixed(1)}% ` +
                   `(${dirMetrics.vehicleCount} vehicles)`);
      }
    }
    
    return snapshot;
  },

  /**
   * Demo: Peak vs off-peak detection
   * @param {World} world - World instance
   * @param {number} duration - Duration to monitor in ms
   */
  demoPeakDetection(world, duration = 60000) {
    console.log('=== Analytics Demo: Peak vs Off-Peak Detection ===\n');
    
    const analyzer = world.getTrafficAnalyzer();
    
    if (!analyzer.isRunning) {
      analyzer.start();
    }
    
    let periodCounts = {
      [TrafficPeriod.OFF_PEAK]: 0,
      [TrafficPeriod.PEAK]: 0,
      [TrafficPeriod.RUSH_HOUR]: 0
    };
    
    let lastPeriod = null;
    
    const callback = (analyticsData) => {
      const period = analyticsData.network.trafficPeriod;
      periodCounts[period]++;
      
      // Alert on period change
      if (period !== lastPeriod) {
        const timestamp = new Date(analyticsData.timestamp).toLocaleTimeString();
        console.log(`[${timestamp}] Traffic period changed: ${lastPeriod || 'N/A'} → ${period}`);
        console.log(`  Avg density: ${(analyticsData.network.avgDensity * 100).toFixed(1)}%`);
        console.log(`  Total vehicles: ${analyticsData.network.totalVehicles}`);
        console.log('');
        lastPeriod = period;
      }
    };
    
    analyzer.onAnalytics(callback);
    console.log(`Monitoring traffic periods for ${duration/1000} seconds...\n`);
    
    setTimeout(() => {
      analyzer.offAnalytics(callback);
      
      const total = Object.values(periodCounts).reduce((a, b) => a + b, 0);
      console.log('\nPeriod Distribution:');
      for (const [period, count] of Object.entries(periodCounts)) {
        const percent = total > 0 ? (count / total * 100).toFixed(1) : 0;
        console.log(`  ${period}: ${count} samples (${percent}%)`);
      }
      
      const periodDist = analyzer.networkAnalytics.getPeriodDistribution();
      if (periodDist) {
        console.log('\nHistorical Distribution:');
        for (const [period, percent] of Object.entries(periodDist)) {
          console.log(`  ${period}: ${percent.toFixed(1)}%`);
        }
      }
    }, duration);
    
    return analyzer;
  },

  /**
   * Demo: Trend analysis
   * @param {World} world - World instance
   */
  demoTrendAnalysis(world) {
    console.log('=== Analytics Demo: Trend Analysis ===\n');
    
    const analyzer = world.getTrafficAnalyzer();
    const snapshot = analyzer.getSnapshot();
    
    if (!snapshot.network.state) {
      console.log('No data available yet.');
      return;
    }
    
    console.log('Network Trend:');
    const networkTrend = snapshot.network.trend;
    console.log(`  Trend: ${networkTrend.trend}`);
    console.log(`  Change: ${networkTrend.changePercent.toFixed(1)}%`);
    console.log(`  Confidence: ${networkTrend.confidence}`);
    console.log('');
    
    console.log('Per-Intersection Trends:');
    for (const [junctionId, data] of Object.entries(snapshot.intersections)) {
      const trend = data.trend;
      console.log(`  ${junctionId}:`);
      console.log(`    Trend: ${trend.trend}`);
      console.log(`    Change: ${trend.changePercent.toFixed(1)}%`);
      console.log(`    Confidence: ${trend.confidence}`);
    }
    
    return snapshot;
  },

  /**
   * Demo: Statistical analysis
   * @param {World} world - World instance
   */
  demoStatisticalAnalysis(world) {
    console.log('=== Analytics Demo: Statistical Analysis ===\n');
    
    const analyzer = world.getTrafficAnalyzer();
    const snapshot = analyzer.getSnapshot();
    
    if (!snapshot.network.state) {
      console.log('No data available yet.');
      return;
    }
    
    console.log('Network Statistics:');
    const network = snapshot.network.state;
    console.log(`  Avg density: ${(network.avgDensity * 100).toFixed(1)}%`);
    console.log(`  Avg wait time: ${(network.avgWaitTime / 1000).toFixed(1)}s`);
    console.log(`  Avg pressure: ${network.avgPressureScore.toFixed(1)}/100`);
    console.log(`  Efficiency: ${network.efficiencyScore.toFixed(1)}/100`);
    console.log('');
    
    console.log('Congestion Distribution:');
    for (const [level, percent] of Object.entries(network.congestionDistribution)) {
      const bar = '█'.repeat(Math.round(percent / 5));
      console.log(`  ${level.padEnd(10)}: ${bar} ${percent.toFixed(1)}%`);
    }
    console.log('');
    
    console.log('Per-Intersection Statistics:');
    for (const [junctionId, data] of Object.entries(snapshot.intersections)) {
      const stats = data.statistics;
      if (!stats) continue;
      
      console.log(`  ${junctionId}:`);
      console.log(`    Density: mean=${(stats.density.mean * 100).toFixed(1)}%, ` +
                 `stddev=${(stats.density.stdDev * 100).toFixed(1)}%`);
      console.log(`    Wait time: mean=${(stats.waitTime.mean / 1000).toFixed(1)}s, ` +
                 `max=${(stats.waitTime.max / 1000).toFixed(1)}s`);
      
      console.log(`    Congestion breakdown:`);
      for (const [level, percent] of Object.entries(stats.congestionDistribution)) {
        if (percent > 0) {
          console.log(`      ${level}: ${percent.toFixed(1)}%`);
        }
      }
    }
    
    return snapshot;
  },

  /**
   * Demo: Recommendations for optimization
   * @param {World} world - World instance
   * @param {number} duration - Duration to monitor in ms
   */
  demoRecommendations(world, duration = 30000) {
    console.log('=== Analytics Demo: Optimization Recommendations ===\n');
    
    const analyzer = world.getTrafficAnalyzer();
    
    if (!analyzer.isRunning) {
      analyzer.start();
    }
    
    const callback = (analyticsData) => {
      const recommendations = analyzer.getRecommendations();
      
      if (recommendations.length > 0) {
        const timestamp = new Date(analyticsData.timestamp).toLocaleTimeString();
        console.log(`[${timestamp}] Recommendations:`);
        
        for (const rec of recommendations) {
          const priority = rec.priority === 'HIGH' ? '🔴' : '🟡';
          console.log(`  ${priority} [${rec.type}] ${rec.message}`);
          if (rec.junctionId) {
            console.log(`     Junction: ${rec.junctionId}`);
          }
          console.log(`     Metric: ${rec.metric} = ${typeof rec.value === 'number' ? rec.value.toFixed(1) : rec.value}`);
        }
        console.log('');
      }
    };
    
    analyzer.onAnalytics(callback);
    console.log(`Monitoring for recommendations (${duration/1000}s)...\n`);
    
    setTimeout(() => {
      analyzer.offAnalytics(callback);
      console.log('Monitoring stopped');
    }, duration);
    
    return analyzer;
  },

  /**
   * Demo: Critical intersection identification
   * @param {World} world - World instance
   */
  demoCriticalIntersections(world) {
    console.log('=== Analytics Demo: Critical Intersection Identification ===\n');
    
    const analyzer = world.getTrafficAnalyzer();
    const network = analyzer.getNetworkAnalytics();
    
    if (!network) {
      console.log('No data available yet.');
      return;
    }
    
    console.log('Network Overview:');
    console.log(`  Congestion: ${network.networkCongestion}`);
    console.log(`  Efficiency: ${network.efficiencyScore.toFixed(1)}/100`);
    console.log('');
    
    if (network.criticalIntersections.length === 0) {
      console.log('✓ No critical intersections detected');
      console.log('All intersections operating normally.');
      return network;
    }
    
    console.log(`⚠️ Critical Intersections: ${network.criticalIntersections.length}`);
    console.log('');
    
    for (let i = 0; i < network.criticalIntersections.length; i++) {
      const critical = network.criticalIntersections[i];
      console.log(`${i + 1}. ${critical.junctionId}`);
      console.log(`   Congestion Level: ${critical.congestionLevel}`);
      console.log(`   Pressure Score: ${critical.pressureScore.toFixed(1)}/100`);
      console.log(`   Total Queue: ${critical.totalQueue} vehicles`);
      console.log(`   Avg Wait Time: ${(critical.avgWaitTime / 1000).toFixed(1)}s`);
      console.log('');
    }
    
    return network;
  },

  /**
   * Demo: Integration with optimization
   * Shows how optimization modules can consume analytics
   * @param {World} world - World instance
   * @param {number} duration - Duration to run in ms
   */
  demoOptimizationIntegration(world, duration = 60000) {
    console.log('=== Analytics Demo: Optimization Integration ===\n');
    console.log('This demo shows how optimization modules consume analytics data.\n');
    
    const analyzer = world.getTrafficAnalyzer();
    
    if (!analyzer.isRunning) {
      analyzer.start();
    }
    
    let optimizationActions = 0;
    
    // Simulated optimization logic
    const optimizationCallback = (analyticsData) => {
      const network = analyticsData.network;
      
      // Example optimization trigger: High congestion
      if (network.networkCongestion === CongestionLevel.HIGH ||
          network.networkCongestion === CongestionLevel.CRITICAL) {
        
        console.log(`[Optimization] High congestion detected at ${new Date(analyticsData.timestamp).toLocaleTimeString()}`);
        
        // For each critical intersection
        for (const critical of network.criticalIntersections || []) {
          const junctionId = critical.junctionId;
          const junction = world.junctions.get(junctionId);
          
          if (junction) {
            // Get current signal timings
            const currentTimings = junction.signal.getTimings();
            
            // Simple optimization: Increase green time if high congestion
            const newGreenMs = Math.min(currentTimings.greenMs + 2000, 15000);
            
            console.log(`  Optimizing ${junctionId}:`);
            console.log(`    Green time: ${currentTimings.greenMs}ms → ${newGreenMs}ms`);
            console.log(`    Pressure: ${critical.pressureScore.toFixed(1)}/100`);
            
            // Apply optimization
            junction.signal.updateTimings({
              greenMs: newGreenMs,
              yellowMs: currentTimings.yellowMs,
              allRedMs: currentTimings.allRedMs,
              applyImmediately: true
            });
            
            optimizationActions++;
          }
        }
        console.log('');
      }
      
      // Example optimization trigger: Peak period
      if (network.trafficPeriod === TrafficPeriod.RUSH_HOUR) {
        // Could implement coordinated timing here
      }
    };
    
    analyzer.onAnalytics(optimizationCallback);
    console.log(`Running optimization for ${duration/1000} seconds...\n`);
    
    setTimeout(() => {
      analyzer.offAnalytics(optimizationCallback);
      console.log('Optimization stopped');
      console.log(`Total optimization actions: ${optimizationActions}`);
      
      const finalState = analyzer.getNetworkAnalytics();
      console.log('\nFinal State:');
      console.log(`  Congestion: ${finalState.networkCongestion}`);
      console.log(`  Efficiency: ${finalState.efficiencyScore.toFixed(1)}/100`);
    }, duration);
    
    return analyzer;
  },

  /**
   * Demo: Export analytics data
   * @param {World} world - World instance
   */
  demoExportAnalytics(world) {
    console.log('=== Analytics Demo: Export Analytics Data ===\n');
    
    const analyzer = world.getTrafficAnalyzer();
    const snapshot = analyzer.getSnapshot();
    
    if (!snapshot.network.state) {
      console.log('No data available yet.');
      return;
    }
    
    // Prepare export data
    const exportData = {
      timestamp: new Date().toISOString(),
      network: snapshot.network.state,
      intersections: {},
      metadata: snapshot.metadata
    };
    
    for (const [junctionId, data] of Object.entries(snapshot.intersections)) {
      exportData.intersections[junctionId] = {
        currentState: data.state,
        trend: data.trend,
        statistics: data.statistics
      };
    }
    
    const jsonStr = JSON.stringify(exportData, null, 2);
    console.log('Analytics data prepared for export');
    console.log(`Size: ${(new Blob([jsonStr]).size / 1024).toFixed(2)} KB`);
    console.log(`Intersections: ${Object.keys(exportData.intersections).length}`);
    console.log('\nSample data:');
    console.log(JSON.stringify(exportData.network, null, 2));
    
    // Could trigger download here
    // const blob = new Blob([jsonStr], { type: 'application/json' });
    // const url = URL.createObjectURL(blob);
    // const a = document.createElement('a');
    // a.href = url;
    // a.download = 'analytics_export.json';
    // a.click();
    
    return exportData;
  },

  /**
   * Stop all analytics and clean up
   * @param {World} world - World instance
   */
  stopAndClear(world) {
    console.log('=== Stopping Analytics ===');
    
    if (world.trafficAnalyzer) {
      world.trafficAnalyzer.stop();
      console.log('Analytics stopped');
    } else {
      console.log('No analyzer running');
    }
  }
};

// Make available globally for console access
if (typeof window !== 'undefined') {
  window.analyticsDemo = analyticsDemo;
  window.CongestionLevel = CongestionLevel;
  window.TrafficPeriod = TrafficPeriod;
}

console.log('Analytics Demo Module Loaded');
console.log('Available demos:');
console.log('  analyticsDemo.demoBasicAnalytics(world)');
console.log('  analyticsDemo.demoRealTimeCongestion(world)');
console.log('  analyticsDemo.demoDensityAnalysis(world)');
console.log('  analyticsDemo.demoPeakDetection(world)');
console.log('  analyticsDemo.demoOptimizationIntegration(world)');
