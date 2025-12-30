/**
 * World Module
 * Coordinates between simulation engine and UI rendering.
 * Part of the layered architecture coordinating all components.
 */

import { GridGeometry } from "./geometry.js";
import { Router } from "./router.js";
import { Junction } from "./junction.js";
import { Vehicle } from "./vehicle.js";
import { keyRC, DIRS, oppositeDir } from "./utils.js";
import { SimulationEngine } from "./simulationEngine.js";
import { DataIngestionService } from "./sensor.js";
import { TrafficAnalyzer } from "./analytics.js";
import { OptimizationEngine } from "./optimization.js";
import { CFG } from "./config.js";

export class World {
  constructor({ cfg, ui, rows, cols, worldEl, gridSize, roadLength } = {}) {
    // Support simplified constructor for demos: { gridSize: 2 }
    if (gridSize !== undefined) {
      rows = gridSize;
      cols = gridSize;
    }
    
    // Use default CFG if not provided
    this.cfg = cfg || CFG;
    this.ui = ui || null;
    this.rows = rows || 2;
    this.cols = cols || 2;
    this.worldEl = worldEl || null;

    this.geom = new GridGeometry(this.cfg, this.rows, this.cols);

    this.junctions = new Map();
    this.roads = new Map(); // Added for evaluation demos
    this.vehicles = new Set();
    this.router = new Router(this);

    this._roadEls = new Map();
    this._cellEls = new Map();
    // last spawn times: keep both real-time and sim-time if needed
    this._lastSpawn = 0;
    this._lastSpawnSimMs = 0;

    // Initialize simulation engine
    this.simulationEngine = new SimulationEngine({ config: this.cfg });
    this.simulationEngine.initialize(this.junctions, this.vehicles);

    // Initialize data ingestion service (sensing layer)
    this.dataIngestionService = null; // Created on demand

    // Initialize traffic analyzer (analytics layer)
    this.trafficAnalyzer = null; // Created on demand

    // Initialize optimization engine (optimization layer)
    this.optimizationEngine = null; // Created on demand

    // -------------------------
    // Stats / telemetry (NEW)
    // -------------------------
    // Uses simulation time (scaled by Speed slider), passed in update(dt, deltaMs)
    this.simTimeMs = 0;

    // per-vehicle meta, kept outside Vehicle to avoid changing behavior
    this._vehMeta = new WeakMap();

    this.stats = {
      totalSpawned: 0,
      totalCompleted: 0,
      totalTripMs: 0,

      totalDistancePx: 0,
      totalIdleMs: 0,
      totalMovingMs: 0,

      totalCo2G: 0,

      completedDistancePx: 0,
      completedIdleMs: 0,
      completedCo2G: 0,

      // timestamps (simulation ms) of recent completions — used to compute current throughput
      completionTimestamps: [],

      lastTickSimDeltaMs: 0,
      lastTickDistancePx: 0,
      lastTickCo2G: 0,
      co2RateGPerMin: 0,
    };

    this._buildGridUI();
  }

  destroy() {
    // Stop optimization if running
    if (this.optimizationEngine) {
      this.optimizationEngine.stop();
    }
    
    // Stop analytics if running
    if (this.trafficAnalyzer) {
      this.trafficAnalyzer.stop();
    }
    
    // Stop data ingestion if running
    if (this.dataIngestionService) {
      this.dataIngestionService.stop();
    }
    
    for (const j of this.junctions.values()) j.destroy();
    for (const v of this.vehicles) v.destroy();
    for (const el of this._roadEls.values()) el.remove();
    for (const el of this._cellEls.values()) el.remove();

    this.junctions.clear();
    this.vehicles.clear();
    this.roads.clear();
    this._roadEls.clear();
    this._cellEls.clear();
    this._vehMeta = new WeakMap();
  }

  /**
   * Start the world - creates grid of junctions automatically
   * Used by demos that don't have UI
   */
  start() {
    // If no UI, auto-create all junctions in grid
    if (!this.ui) {
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          this.addJunction(r, c);
        }
      }
    }
  }

  _buildGridUI() {
    // Skip UI building if no worldEl (headless mode for demos)
    if (!this.worldEl || !this.ui) return;
    
    const { w, h } = this.geom.worldSize();
    this.worldEl.style.width = `${w}px`;
    this.worldEl.style.height = `${h}px`;

    // Inform UI of world size so it can center correctly (your UI.js supports this)
    if (this.ui && typeof this.ui.setWorldSize === "function") {
      this.ui.setWorldSize(w, h);
    }

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const tl = this.geom.cellTopLeft(r, c);

        const cell = this.ui.addDiv("gridCell", {
          left: `${tl.x}px`,
          top: `${tl.y}px`,
          width: `${this.cfg.CELL_W}px`,
          height: `${this.cfg.CELL_H}px`,
        });

        const btn = document.createElement("button");
        btn.className = "cellBtn";
        btn.textContent = "+ Add Junction";
        btn.onclick = () => this.addJunction(r, c);

        cell.appendChild(btn);
        this._cellEls.set(keyRC(r, c), cell);
      }
    }
  }

  _updateCellButtonState(r, c) {
    const cell = this._cellEls.get(keyRC(r, c));
    if (!cell) return;
    const btn = cell.querySelector(".cellBtn");
    if (!btn) return;

    const exists = this.junctions.has(keyRC(r, c));
    btn.disabled = exists;
    btn.textContent = exists ? "Junction Added ✅" : "+ Add Junction";
  }

  addJunction(r, c) {
    const id = keyRC(r, c);
    if (this.junctions.has(id)) return;

    const j = new Junction({ cfg: this.cfg, ui: this.ui, geom: this.geom, r, c });
    this.junctions.set(id, j);

    this._updateCellButtonState(r, c);
    this._refreshRoads();
  }

  _refreshRoads() {
    for (const el of this._roadEls.values()) el.remove();
    this._roadEls.clear();

    for (const id of this.junctions.keys()) {
      const [r, c] = id.split(",").map(Number);

      const rightId = (c + 1 < this.cols) ? keyRC(r, c + 1) : null;
      const downId = (r + 1 < this.rows) ? keyRC(r + 1, c) : null;

      if (rightId && this.junctions.has(rightId)) this._addRoadBetween(id, rightId);
      if (downId && this.junctions.has(downId)) this._addRoadBetween(id, downId);
    }
  }

  _addRoadBetween(idA, idB) {
    const a = this.junctions.get(idA).center();
    const b = this.junctions.get(idB).center();
    const isH = Math.abs(a.x - b.x) > Math.abs(a.y - b.y);

    const roadKey = `${idA}<->${idB}`;
    
    // Store road reference for demos
    const roadData = {
      id: roadKey,
      from: idA,
      to: idB,
      horizontal: isH,
      start: a,
      end: b
    };
    this.roads.set(roadKey, roadData);
    
    const thickness = this.cfg.ROAD_THICK;

    // Only create visual elements if UI exists
    if (!this.ui) return;

    if (isH) {
      const left = Math.min(a.x, b.x) - (this.cfg.CELL_W / 2) + 80;
      const right = Math.max(a.x, b.x) + (this.cfg.CELL_W / 2) - 80;
      const w = right - left;
      const top = a.y - thickness / 2;

      const el = this.ui.addDiv("roadSeg roadH", {
        left: `${left}px`, top: `${top}px`,
        width: `${w}px`, height: `${thickness}px`,
      });
      this._roadEls.set(roadKey, el);
    } else {
      const top = Math.min(a.y, b.y) - (this.cfg.CELL_H / 2) + 80;
      const bottom = Math.max(a.y, b.y) + (this.cfg.CELL_H / 2) - 80;
      const h = bottom - top;
      const left = a.x - thickness / 2;

      const el = this.ui.addDiv("roadSeg roadV", {
        left: `${left}px`, top: `${top}px`,
        width: `${thickness}px`, height: `${h}px`,
      });
      this._roadEls.set(roadKey, el);
    }
  }

  /* =========================
     Random-turn traffic (spawn only if there is a connected lane)
     ========================= */

  _neighborInDir(junctionId, dir) {
    const [r, c] = junctionId.split(",").map(Number);
    let nr = r, nc = c;
    if (dir === "N") nr -= 1;
    if (dir === "S") nr += 1;
    if (dir === "W") nc -= 1;
    if (dir === "E") nc += 1;

    if (nr < 0 || nc < 0 || nr >= this.rows || nc >= this.cols) return null;

    const nid = keyRC(nr, nc);
    return this.junctions.has(nid) ? nid : null;
  }

  _hasAnyConnectedRoad(junctionId) {
    return DIRS.some(d => this._neighborInDir(junctionId, d) !== null);
  }

  _possibleEntryDirsFromOutside(junctionId) {
    const [r, c] = junctionId.split(",").map(Number);
    const dirs = [];
    if (r === 0) dirs.push("N");
    if (r === this.rows - 1) dirs.push("S");
    if (c === 0) dirs.push("W");
    if (c === this.cols - 1) dirs.push("E");
    return dirs;
  }

  _randomChoice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  _buildRandomTurnRoute() {
    const ids = [...this.junctions.keys()];
    if (ids.length === 0) return null;

    // Boundary junctions that can spawn from outside + have at least one connected road
    const boundary = ids.filter(id =>
      this._possibleEntryDirsFromOutside(id).length > 0 &&
      this._hasAnyConnectedRoad(id)
    );
    if (boundary.length < 1) return null;

    const dirBetween = (aId, bId) => {
      const [ar, ac] = aId.split(",").map(Number);
      const [br, bc] = bId.split(",").map(Number);
      if (br === ar - 1 && bc === ac) return "N";
      if (br === ar + 1 && bc === ac) return "S";
      if (br === ar && bc === ac - 1) return "W";
      if (br === ar && bc === ac + 1) return "E";
      return null;
    };

    let startId = null;
    let endId = null;
    let path = null;

    for (let tries = 0; tries < 20; tries++) {
      startId = this._randomChoice(boundary);
      endId = this._randomChoice(boundary);
      if (boundary.length > 1 && endId === startId) continue;

      // ✅ router.js provides bfsPath
      path = this.router.bfsPath(startId, endId);
      if (path && path.length >= 1) break;
    }

    if (!path) return null;

    const nodes = path;
    const entryFrom = this._randomChoice(this._possibleEntryDirsFromOutside(startId));

    const moves = [];
    for (let i = 0; i < nodes.length - 1; i++) {
      const d = dirBetween(nodes[i], nodes[i + 1]);
      if (!d) return null;
      moves.push(d);
    }

    // Force final move to exit outside from the last boundary junction
    const last = nodes[nodes.length - 1];
    const approachFromLast = nodes.length === 1 ? entryFrom : oppositeDir(moves[moves.length - 1]);
    let outsideDirs = this._possibleEntryDirsFromOutside(last);

    // avoid U-turn if possible
    let candidates = outsideDirs.filter(d => d !== approachFromLast);
    if (candidates.length === 0) candidates = outsideDirs;
    if (candidates.length === 0) return null;

    moves.push(this._randomChoice(candidates));

    return { nodes, entryFrom, moves };
  }

  spawnVehicleRandom({ force = false } = {}) {
    // use simulation time for programmatic spawns so spawn rate scales with sim speed
    if (!force) {
      if (this.simTimeMs - (this._lastSpawnSimMs || 0) < this.cfg.SPAWN_COOLDOWN_MS) return;
    }
    this._lastSpawnSimMs = this.simTimeMs;

    const route = this._buildRandomTurnRoute();
    if (!route) return;

    const v = new Vehicle({ cfg: this.cfg, ui: this.ui, world: this, route });
    this.vehicles.add(v);

    // ---- stats init ----
    this.stats.totalSpawned++;
    this._vehMeta.set(v, {
      spawnSimMs: this.simTimeMs,
      distancePx: 0,
      idleMs: 0,
      movingMs: 0,
      co2G: 0,
    });
  }

  removeVehicle(v) {
    v.destroy();
    this.vehicles.delete(v);
    this._vehMeta.delete(v);
  }

  // Note: _applyQueuing logic moved to SimulationEngine
  // Kept here as a stub for backwards compatibility if needed
  _applyQueuing() {
    // Now handled by simulationEngine.update()
    // This method kept for potential custom extensions
  }

  // -------------------------
  // Stats helpers (NEW)
  // -------------------------
  _recordCompletion(v) {
    const meta = this._vehMeta.get(v);
    this.stats.totalCompleted++;

    // record completion timestamp (simulation time) for recent-throughput calculations
    this.stats.completionTimestamps = this.stats.completionTimestamps || [];
    this.stats.completionTimestamps.push(this.simTimeMs);

    // debug: log completion recording
    try { console.debug("[world] completion recorded", { simTimeMs: this.simTimeMs, totalCompleted: this.stats.totalCompleted, timestamps: this.stats.completionTimestamps.length }); } catch (e) {}

    if (!meta) return;

    const tripMs = Math.max(0, this.simTimeMs - (meta.spawnSimMs || 0));
    this.stats.totalTripMs += tripMs;

    this.stats.completedDistancePx += meta.distancePx || 0;
    this.stats.completedIdleMs += meta.idleMs || 0;
    this.stats.completedCo2G += meta.co2G || 0;
  }

  getStatsSnapshot() {
    // Compute actual completed trips within the last hour (raw count)
    const windowMs = 60 * 60 * 1000; // 1 hour
    const now = this.simTimeMs || 0;
    const completionsWindow = (this.stats.completionTimestamps || []).filter((t) => t > now - windowMs).length;
    const currentThroughputPerHour = completionsWindow; // raw count of trips in the last hour

    return {
      simTimeMs: this.simTimeMs,
      carCount: this.vehicles.size,
      currentThroughputPerHour,
      ...this.stats,
    };
  }

  update(dt, deltaMs) {
  // Tick traffic lights using simulation time so Pause freezes signals.
  const simDeltaMs = typeof deltaMs === "number" ? deltaMs : dt * 16.6667;

  // track sim time
  this.simTimeMs += simDeltaMs;

  // -------------------------
  // Store previous positions BEFORE update
  // -------------------------
  const minutes = simDeltaMs / 60000;
  
  if (minutes > 0) {
    for (const v of this.vehicles) {
      if (!v.plan || v.plan.done) continue;
      
      let meta = this._vehMeta.get(v);
      if (!meta) {
        meta = { spawnSimMs: this.simTimeMs, distancePx: 0, idleMs: 0, movingMs: 0, co2G: 0 };
        this._vehMeta.set(v, meta);
      }
      
      // Store previous position for movement calculation
      meta.prevX = v.x;
      meta.prevY = v.y;
    }
  }
  
  // Update simulation engine (core simulation logic)
  this.simulationEngine.simTimeMs = this.simTimeMs;
  this.simulationEngine.update(dt, simDeltaMs);

  // The simulation engine handles:
  // - Signal updates
  // - Vehicle planning
  // - Queuing logic
  // - Movement application
  
  // World continues to handle telemetry and stats
  // This maintains backwards compatibility while adding modular architecture

  // -------------------------
  // Telemetry tick (NEW) - Calculate AFTER update
  // -------------------------

  // Use defaults if not present in config.js (so we don't need to change config.js)
  const PX_PER_M = (typeof this.cfg.PX_PER_M === "number") ? this.cfg.PX_PER_M : 10;
  const CO2_PER_KM = (typeof this.cfg.CO2_PER_KM === "number") ? this.cfg.CO2_PER_KM : 249;
  const IDLE_GAL_PER_HR = (typeof this.cfg.IDLE_GAL_PER_HR === "number") ? this.cfg.IDLE_GAL_PER_HR : 0.35;
  const CO2_G_PER_GAL = (typeof this.cfg.CO2_G_PER_GAL === "number") ? this.cfg.CO2_G_PER_GAL : 8887;

  const idleGPerMin = (IDLE_GAL_PER_HR * CO2_G_PER_GAL) / 60;

  let tickCo2G = 0;
  let tickDistPx = 0;

  if (minutes > 0) {
    for (const v of this.vehicles) {
      if (!v.plan || v.plan.done) continue;

      let meta = this._vehMeta.get(v);
      if (!meta) continue; // Should have been created above

      // Calculate actual movement (current position - previous position)
      const dx = v.x - (meta.prevX ?? v.x);
      const dy = v.y - (meta.prevY ?? v.y);
      const movedPx = Math.hypot(dx, dy);

      if (movedPx < 0.01) {
        // Vehicle is idle/stopped
        meta.idleMs += simDeltaMs;
        this.stats.totalIdleMs += simDeltaMs;

        const g = idleGPerMin * minutes;
        meta.co2G += g;
        this.stats.totalCo2G += g;
        tickCo2G += g;
      } else {
        // Vehicle is moving
        meta.movingMs += simDeltaMs;
        meta.distancePx += movedPx;

        this.stats.totalMovingMs += simDeltaMs;
        this.stats.totalDistancePx += movedPx;

        tickDistPx += movedPx;

        const distKm = (movedPx / PX_PER_M) / 1000;
        const g = distKm * CO2_PER_KM;

        meta.co2G += g;
        this.stats.totalCo2G += g;
        tickCo2G += g;
      }
    }
  }

  this.stats.lastTickSimDeltaMs = simDeltaMs;
  this.stats.lastTickDistancePx = tickDistPx;
  this.stats.lastTickCo2G = tickCo2G;
  this.stats.co2RateGPerMin = minutes > 0 ? (tickCo2G / minutes) : 0;

  // prune old completion timestamps to keep memory bounded (keep last 60 minutes)
  const retentionMs = 60 * 60000;
  const cutoff = this.simTimeMs - retentionMs;
  if (this.stats.completionTimestamps && this.stats.completionTimestamps.length > 0) {
    this.stats.completionTimestamps = this.stats.completionTimestamps.filter(t => t >= cutoff);
  }

  // -------------------------
  // Cleanup completed vehicles (existing)
  // -------------------------
  const toRemove = [];
  for (const v of this.vehicles) {
    if (v.plan && v.plan.done) toRemove.push(v);
  }

  // record completion stats BEFORE removal
  for (const v of toRemove) this._recordCompletion(v);

  toRemove.forEach((v) => this.removeVehicle(v));
}

  /**
   * Get programmatic state snapshot (delegates to simulation engine)
   * @returns {Object} Complete simulation state
   */
  getSimulationState() {
    return this.simulationEngine.getState();
  }

  // -------------------------
  // Data Ingestion / Sensing Layer Methods
  // -------------------------

  /**
   * Initialize and start data ingestion service
   * @param {number} samplingIntervalMs - Sampling interval (default: 1000ms)
   * @returns {DataIngestionService} The created service
   */
  startDataIngestion(samplingIntervalMs = 1000) {
    if (this.dataIngestionService) {
      console.warn('[World] Data ingestion service already exists');
      return this.dataIngestionService;
    }

    this.dataIngestionService = new DataIngestionService({
      world: this,
      samplingIntervalMs: samplingIntervalMs
    });

    this.dataIngestionService.start();
    console.log(`[World] Data ingestion started (interval: ${samplingIntervalMs}ms)`);

    return this.dataIngestionService;
  }

  /**
   * Stop data ingestion service
   */
  stopDataIngestion() {
    if (!this.dataIngestionService) {
      console.warn('[World] No data ingestion service to stop');
      return;
    }

    this.dataIngestionService.stop();
    console.log('[World] Data ingestion stopped');
  }

  /**
   * Get data ingestion service (creates if doesn't exist)
   * @param {number} samplingIntervalMs - Sampling interval if creating new
   * @returns {DataIngestionService} The service instance
   */
  getDataIngestionService(samplingIntervalMs = 1000) {
    if (!this.dataIngestionService) {
      this.dataIngestionService = new DataIngestionService({
        world: this,
        samplingIntervalMs: samplingIntervalMs
      });
    }
    return this.dataIngestionService;
  }

  // -------------------------
  // Traffic Analytics Methods
  // -------------------------

  /**
   * Start traffic analytics
   * Automatically starts data ingestion if not already running
   * @param {number} updateIntervalMs - Analysis update interval (default: 1000ms)
   * @returns {TrafficAnalyzer} The created analyzer
   */
  startTrafficAnalytics(updateIntervalMs = 1000) {
    if (this.trafficAnalyzer) {
      console.warn('[World] Traffic analyzer already exists');
      return this.trafficAnalyzer;
    }

    // Ensure data ingestion is running
    const dataService = this.getDataIngestionService(updateIntervalMs);
    if (!dataService.isRunning) {
      dataService.start();
    }

    this.trafficAnalyzer = new TrafficAnalyzer({
      dataIngestionService: dataService,
      updateIntervalMs: updateIntervalMs
    });

    this.trafficAnalyzer.start();
    console.log(`[World] Traffic analytics started (interval: ${updateIntervalMs}ms)`);

    return this.trafficAnalyzer;
  }

  /**
   * Stop traffic analytics
   */
  stopTrafficAnalytics() {
    if (!this.trafficAnalyzer) {
      console.warn('[World] No traffic analyzer to stop');
      return;
    }

    this.trafficAnalyzer.stop();
    console.log('[World] Traffic analytics stopped');
  }

  /**
   * Get traffic analyzer (creates if doesn't exist)
   * @param {number} updateIntervalMs - Update interval if creating new
   * @returns {TrafficAnalyzer} The analyzer instance
   */
  getTrafficAnalyzer(updateIntervalMs = 1000) {
    if (!this.trafficAnalyzer) {
      const dataService = this.getDataIngestionService(updateIntervalMs);
      this.trafficAnalyzer = new TrafficAnalyzer({
        dataIngestionService: dataService,
        updateIntervalMs: updateIntervalMs
      });
    }
    return this.trafficAnalyzer;
  }

  // -------------------------
  // Optimization Engine Methods
  // -------------------------

  /**
   * Start optimization engine
   * Automatically starts analytics and data ingestion if needed
   * @param {string} strategy - Optimization strategy (ADAPTIVE, GREEDY, etc.)
   * @param {number} intervalMs - Optimization interval (default: 5000ms)
   * @returns {OptimizationEngine} The created engine
   */
  startOptimization(strategy = 'ADAPTIVE', intervalMs = 5000) {
    if (this.optimizationEngine) {
      console.warn('[World] Optimization engine already exists');
      return this.optimizationEngine;
    }

    // Ensure analytics is running
    const analyzer = this.getTrafficAnalyzer();
    if (!analyzer.isRunning) {
      analyzer.start();
    }

    this.optimizationEngine = new OptimizationEngine({
      trafficAnalyzer: analyzer,
      world: this,
      strategy: strategy,
      autoRun: false
    });

    this.optimizationEngine.optimizationIntervalMs = intervalMs;
    this.optimizationEngine.start();
    
    console.log(`[World] Optimization started (strategy: ${strategy}, interval: ${intervalMs}ms)`);

    return this.optimizationEngine;
  }

  /**
   * Stop optimization engine
   */
  stopOptimization() {
    if (!this.optimizationEngine) {
      console.warn('[World] No optimization engine to stop');
      return;
    }

    this.optimizationEngine.stop();
    console.log('[World] Optimization stopped');
  }

  /**
   * Get optimization engine (creates if doesn't exist)
   * @param {string} strategy - Optimization strategy if creating new
   * @returns {OptimizationEngine} The engine instance
   */
  getOptimizationEngine(strategy = 'ADAPTIVE') {
    if (!this.optimizationEngine) {
      const analyzer = this.getTrafficAnalyzer();
      this.optimizationEngine = new OptimizationEngine({
        trafficAnalyzer: analyzer,
        world: this,
        strategy: strategy,
        autoRun: false
      });
    }
    return this.optimizationEngine;
  }
}
