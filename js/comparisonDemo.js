import { World } from './world.js';
import { UI } from './ui.js';
import { CFG } from './config.js';
import { OptimizationStrategy } from './optimization.js';

export class ComparisonPlayground {
  constructor({ container, gridSize = 2 }) {
    this.container = container;
    this.gridSize = gridSize;
    
    // Create two containers
    this._createLayout();
    
    // Create two worlds
    this.worldBaseline = new World({
      cfg: CFG,
      ui: new UI(this.baselineWorldEl),
      rows: gridSize,
      cols: gridSize,
      worldEl: this.baselineWorldEl
    });
    
    this.worldOptimized = new World({
      cfg: CFG,
      ui: new UI(this.optimizedWorldEl),
      rows: gridSize,
      cols: gridSize,
      worldEl: this.optimizedWorldEl
    });
    
    // Setup both worlds with same junctions
    this._setupIdenticalGrids();
    
    // Start optimization on optimized world
    this.worldOptimized.startOptimization(OptimizationStrategy.ADAPTIVE, 5000);
    
    // Sync state
    this.isPlaying = false;
    this.lastTime = performance.now();
    this.speed = 1.0;
    
    // Auto-spawn configuration
    this.autoSpawn = true;
    this.spawnIntervalMs = 2000; // Spawn every 2 seconds
    this.lastSpawnTime = 0;
    
    this._setupControls();
  }
  
  _createLayout() {
    this.container.innerHTML = `
      <div class="comparison-header">
        <div class="control-panel">
          <button id="comp-play">▶ Play</button>
          <button id="comp-spawn">Spawn Vehicle (Both)</button>
          <label>
            <input type="checkbox" id="comp-auto-spawn" checked> Auto-spawn
          </label>
          <label>Speed: 
            <input type="range" id="comp-speed" min="0.1" max="10" step="0.1" value="1">
            <span id="comp-speed-val">1.0x</span>
          </label>
        </div>
      </div>
      
      <div class="comparison-container">
        <!-- Baseline -->
        <div class="playground-side">
          <div class="side-header">
            <h3>Baseline (Fixed Timing)</h3>
            <div class="timing-info">
              <span>Green: <span id="baseline-green">3000ms</span></span>
              <span>Yellow: <span id="baseline-yellow">400ms</span></span>
            </div>
          </div>
          <div class="workspace-container">
            <div class="workspace" id="playground-baseline">
              <div id="world-baseline"></div>
            </div>
          </div>
          <div class="stats-panel" id="stats-baseline">
            <div class="stat-item">Vehicles: <span id="baseline-vehicles">0</span></div>
            <div class="stat-item">Completed: <span id="baseline-completed">0</span></div>
            <div class="stat-item">Avg Wait: <span id="baseline-wait">0s</span></div>
            <div class="stat-item">CO₂: <span id="baseline-co2">0g</span></div>
            <div class="stat-item">Stop %: <span id="baseline-stop">0%</span></div>
          </div>
        </div>
        
        <!-- Optimized -->
        <div class="playground-side">
          <div class="side-header">
            <h3>Optimized (Adaptive)</h3>
            <div class="timing-info">
              <span>Green: <span id="optimized-green">Dynamic</span></span>
              <span>Strategy: <span id="optimized-strategy">ADAPTIVE</span></span>
            </div>
          </div>
          <div class="workspace-container">
            <div class="workspace" id="playground-optimized">
              <div id="world-optimized"></div>
            </div>
          </div>
          <div class="stats-panel" id="stats-optimized">
            <div class="stat-item">Vehicles: <span id="optimized-vehicles">0</span></div>
            <div class="stat-item">Completed: <span id="optimized-completed">0</span></div>
            <div class="stat-item">Avg Wait: <span id="optimized-wait">0s</span></div>
            <div class="stat-item">CO₂: <span id="optimized-co2">0g</span></div>
            <div class="stat-item">Stop %: <span id="optimized-stop">0%</span></div>
          </div>
        </div>
      </div>
      
      <!-- Comparison Metrics -->
      <div class="comparison-metrics">
        <h3>Performance Comparison (Optimized vs Baseline)</h3>
        <div class="metric-row">
          <span class="metric-label">Avg Wait Time:</span>
          <span class="baseline-val" id="comp-wait-baseline">-</span>
          <span class="vs">vs</span>
          <span class="optimized-val" id="comp-wait-optimized">-</span>
          <span class="improvement" id="comp-wait-improvement">-</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">CO₂ Emissions:</span>
          <span class="baseline-val" id="comp-co2-baseline">-</span>
          <span class="vs">vs</span>
          <span class="optimized-val" id="comp-co2-optimized">-</span>
          <span class="improvement" id="comp-co2-improvement">-</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Stop %:</span>
          <span class="baseline-val" id="comp-stop-baseline">-</span>
          <span class="vs">vs</span>
          <span class="optimized-val" id="comp-stop-optimized">-</span>
          <span class="improvement" id="comp-stop-improvement">-</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Throughput:</span>
          <span class="baseline-val" id="comp-throughput-baseline">-</span>
          <span class="vs">vs</span>
          <span class="optimized-val" id="comp-throughput-optimized">-</span>
          <span class="improvement" id="comp-throughput-improvement">-</span>
        </div>
      </div>
    `;
    
    this.baselineWorldEl = document.getElementById('world-baseline');
    this.optimizedWorldEl = document.getElementById('world-optimized');
  }
  
  _setupIdenticalGrids() {
    // Create same grid layout in both worlds
    for (let r = 0; r < this.gridSize; r++) {
      for (let c = 0; c < this.gridSize; c++) {
        this.worldBaseline.addJunction(r, c);
        this.worldOptimized.addJunction(r, c);
      }
    }
    
    console.log(`[ComparisonPlayground] Created ${this.gridSize}x${this.gridSize} grid in both worlds`);
    console.log(`[ComparisonPlayground] Baseline junctions: ${this.worldBaseline.junctions.size}`);
    console.log(`[ComparisonPlayground] Optimized junctions: ${this.worldOptimized.junctions.size}`);
  }
  
  _setupControls() {
    document.getElementById('comp-play').onclick = () => this.togglePlay();
    document.getElementById('comp-spawn').onclick = () => this.spawnBoth();
    
    document.getElementById('comp-auto-spawn').onchange = (e) => {
      this.autoSpawn = e.target.checked;
      console.log(`[ComparisonPlayground] Auto-spawn: ${this.autoSpawn}`);
    };
    
    document.getElementById('comp-speed').oninput = (e) => {
      this.speed = parseFloat(e.target.value);
      document.getElementById('comp-speed-val').textContent = `${this.speed.toFixed(1)}x`;
    };
  }
  
  togglePlay() {
    this.isPlaying = !this.isPlaying;
    document.getElementById('comp-play').textContent = this.isPlaying ? '⏸ Pause' : '▶ Play';
    
    if (this.isPlaying) {
      this.lastTime = performance.now();
      this.lastSpawnTime = performance.now();
      
      // Spawn initial vehicles when starting
      console.log('[ComparisonPlayground] Starting simulation, spawning initial vehicles...');
      for (let i = 0; i < 3; i++) {
        this.spawnBoth();
      }
      
      this._tick();
    }
  }
  
  spawnBoth() {
    // Spawn vehicles in both worlds
    this.worldBaseline.spawnVehicleRandom({ force: true });
    this.worldOptimized.spawnVehicleRandom({ force: true });
    
    console.log(`[ComparisonPlayground] Spawned vehicles. Baseline: ${this.worldBaseline.vehicles.size}, Optimized: ${this.worldOptimized.vehicles.size}`);
  }
  
  _tick() {
    if (!this.isPlaying) return;
    
    const now = performance.now();
    const dt = (now - this.lastTime) * this.speed;
    this.lastTime = now;
    
    // Auto-spawn vehicles
    if (this.autoSpawn && (now - this.lastSpawnTime) > this.spawnIntervalMs) {
      this.spawnBoth();
      this.lastSpawnTime = now;
    }
    
    // Update both worlds
    this.worldBaseline.update(dt / 16.6667, dt);
    this.worldOptimized.update(dt / 16.6667, dt);
    
    // Update stats displays
    this._updateStats();
    
    // Update comparison metrics
    this._updateComparison();
    
    requestAnimationFrame(() => this._tick());
  }
  
  _updateStats() {
    const statsB = this.worldBaseline.getStatsSnapshot();
    const statsO = this.worldOptimized.getStatsSnapshot();
    
    // Baseline stats
    document.getElementById('baseline-vehicles').textContent = statsB.carCount;
    document.getElementById('baseline-completed').textContent = statsB.totalCompleted;
    
    const avgWaitB = statsB.totalCompleted > 0 
      ? (statsB.completedIdleMs / statsB.totalCompleted / 1000).toFixed(1)
      : '0.0';
    document.getElementById('baseline-wait').textContent = `${avgWaitB}s`;
    document.getElementById('baseline-co2').textContent = `${statsB.totalCo2G.toFixed(0)}g`;
    
    const totalTimeB = statsB.totalIdleMs + statsB.totalMovingMs;
    const stopPctB = totalTimeB > 0 ? ((statsB.totalIdleMs / totalTimeB) * 100).toFixed(1) : '0.0';
    document.getElementById('baseline-stop').textContent = `${stopPctB}%`;
    
    // Optimized stats
    document.getElementById('optimized-vehicles').textContent = statsO.carCount;
    document.getElementById('optimized-completed').textContent = statsO.totalCompleted;
    
    const avgWaitO = statsO.totalCompleted > 0 
      ? (statsO.completedIdleMs / statsO.totalCompleted / 1000).toFixed(1)
      : '0.0';
    document.getElementById('optimized-wait').textContent = `${avgWaitO}s`;
    document.getElementById('optimized-co2').textContent = `${statsO.totalCo2G.toFixed(0)}g`;
    
    const totalTimeO = statsO.totalIdleMs + statsO.totalMovingMs;
    const stopPctO = totalTimeO > 0 ? ((statsO.totalIdleMs / totalTimeO) * 100).toFixed(1) : '0.0';
    document.getElementById('optimized-stop').textContent = `${stopPctO}%`;
  }
  
  _updateComparison() {
    const statsB = this.worldBaseline.getStatsSnapshot();
    const statsO = this.worldOptimized.getStatsSnapshot();
    
    // Only show comparison if both have completed vehicles
    if (statsB.totalCompleted < 1 || statsO.totalCompleted < 1) {
      return;
    }
    
    // Average wait time per completed vehicle
    const avgWaitB = statsB.completedIdleMs / statsB.totalCompleted / 1000;
    const avgWaitO = statsO.completedIdleMs / statsO.totalCompleted / 1000;
    const waitImprovement = this._calcImprovement(avgWaitB, avgWaitO);
    
    document.getElementById('comp-wait-baseline').textContent = `${avgWaitB.toFixed(1)}s`;
    document.getElementById('comp-wait-optimized').textContent = `${avgWaitO.toFixed(1)}s`;
    this._setImprovementDisplay('comp-wait-improvement', waitImprovement);
    
    // CO₂ emissions
    const co2Improvement = this._calcImprovement(statsB.totalCo2G, statsO.totalCo2G);
    document.getElementById('comp-co2-baseline').textContent = `${statsB.totalCo2G.toFixed(0)}g`;
    document.getElementById('comp-co2-optimized').textContent = `${statsO.totalCo2G.toFixed(0)}g`;
    this._setImprovementDisplay('comp-co2-improvement', co2Improvement);
    
    // Stop percentage
    const totalTimeB = statsB.totalIdleMs + statsB.totalMovingMs;
    const totalTimeO = statsO.totalIdleMs + statsO.totalMovingMs;
    const stopPctB = totalTimeB > 0 ? (statsB.totalIdleMs / totalTimeB) * 100 : 0;
    const stopPctO = totalTimeO > 0 ? (statsO.totalIdleMs / totalTimeO) * 100 : 0;
    const stopImprovement = this._calcImprovement(stopPctB, stopPctO);
    
    document.getElementById('comp-stop-baseline').textContent = `${stopPctB.toFixed(1)}%`;
    document.getElementById('comp-stop-optimized').textContent = `${stopPctO.toFixed(1)}%`;
    this._setImprovementDisplay('comp-stop-improvement', stopImprovement);
    
    // Throughput
    const throughputImprovement = this._calcImprovement(
      statsB.currentThroughputPerHour,
      statsO.currentThroughputPerHour,
      true // Higher is better
    );
    
    document.getElementById('comp-throughput-baseline').textContent = `${statsB.currentThroughputPerHour}/h`;
    document.getElementById('comp-throughput-optimized').textContent = `${statsO.currentThroughputPerHour}/h`;
    this._setImprovementDisplay('comp-throughput-improvement', throughputImprovement);
  }
  
  _calcImprovement(baseline, optimized, higherIsBetter = false) {
    if (baseline === 0) return 0;
    
    if (higherIsBetter) {
      // For metrics where higher is better (e.g., throughput)
      return ((optimized - baseline) / baseline) * 100;
    } else {
      // For metrics where lower is better (e.g., wait time, CO₂)
      return ((baseline - optimized) / baseline) * 100;
    }
  }
  
  _setImprovementDisplay(elementId, improvement) {
    const el = document.getElementById(elementId);
    if (!el) return;
    
    const absImprovement = Math.abs(improvement);
    const sign = improvement > 0 ? '↓' : (improvement < 0 ? '↑' : '');
    
    el.textContent = `${sign} ${absImprovement.toFixed(1)}%`;
    el.className = 'improvement';
    
    if (improvement > 5) {
      el.classList.add('positive');
    } else if (improvement < -5) {
      el.classList.add('negative');
    } else {
      el.classList.add('neutral');
    }
  }
  
  start() {
    console.log('[ComparisonPlayground] Starting...');
    this.togglePlay();
  }
  
  destroy() {
    this.isPlaying = false;
    this.worldBaseline.destroy();
    this.worldOptimized.destroy();
  }
}