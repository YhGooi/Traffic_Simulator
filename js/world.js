import { GridGeometry } from "./geometry.js";
import { Router } from "./router.js";
import { Junction } from "./junction.js";
import { Vehicle } from "./vehicle.js";
import { keyRC, nowMs, DIRS, oppositeDir } from "./utils.js";

export class World {
  constructor({ cfg, ui, rows, cols, worldEl }) {
    this.cfg = cfg;
    this.ui = ui;
    this.rows = rows;
    this.cols = cols;
    this.worldEl = worldEl;

    this.geom = new GridGeometry(cfg, rows, cols);

    this.junctions = new Map();
    this.vehicles = new Set();
    this.router = new Router(this);

    this._roadEls = new Map();
    this._cellEls = new Map();
    this._lastSpawn = 0;

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

      lastTickSimDeltaMs: 0,
      lastTickDistancePx: 0,
      lastTickCo2G: 0,
      co2RateGPerMin: 0,
    };

    this._buildGridUI();
  }

  destroy() {
    for (const j of this.junctions.values()) j.destroy();
    for (const v of this.vehicles) v.destroy();
    for (const el of this._roadEls.values()) el.remove();
    for (const el of this._cellEls.values()) el.remove();

    this.junctions.clear();
    this.vehicles.clear();
    this._roadEls.clear();
    this._cellEls.clear();
    this._vehMeta = new WeakMap();
  }

  _buildGridUI() {
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
    const thickness = this.cfg.ROAD_THICK;

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

  spawnVehicleRandom() {
    const t = nowMs();
    if (t - this._lastSpawn < this.cfg.SPAWN_COOLDOWN_MS) return;
    this._lastSpawn = t;

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

  _applyNoOverlapPerLane() {
    // Group by the actual lane centerline so cars don't overlap even across different segments.
    const groups = new Map();
    const snap = 2;

    for (const v of this.vehicles) {
      if (!v.plan || v.plan.done) continue;
      const { axis, sign, laneCoord } = v.plan;
      const snapped = Math.round(laneCoord / snap) * snap;
      const k = `${axis}|${sign}|${snapped}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(v);
    }

    for (const arr of groups.values()) {
      if (arr.length <= 1) continue;

      const axis = arr[0].plan.axis;
      const sign = arr[0].plan.sign;

      // sort leader -> follower
      arr.sort((a, b) => {
        const pa = axis === "H" ? a.plan.nx : a.plan.ny;
        const pb = axis === "H" ? b.plan.nx : b.plan.ny;
        return sign > 0 ? (pb - pa) : (pa - pb);
      });

      for (let i = 1; i < arr.length; i++) {
        const lead = arr[i - 1];
        const fol = arr[i];
        const gap = this.cfg.CAR_GAP;

        if (axis === "H") {
          const original = fol.plan.nx;
          if (sign > 0) {
            const maxX = lead.plan.nx - gap - fol.len;
            fol.plan.nx = Math.min(fol.plan.nx, maxX);
            fol.plan.nx = Math.max(fol.plan.nx, fol.x);
          } else {
            const minX = lead.plan.nx + lead.len + gap;
            fol.plan.nx = Math.max(fol.plan.nx, minX);
            fol.plan.nx = Math.min(fol.plan.nx, fol.x);
          }
          if (Math.abs(fol.plan.nx - original) > 0.001) fol.plan.blockedByLeader = true;
        } else {
          const original = fol.plan.ny;
          if (sign > 0) {
            const maxY = lead.plan.ny - gap - fol.len;
            fol.plan.ny = Math.min(fol.plan.ny, maxY);
            fol.plan.ny = Math.max(fol.plan.ny, fol.y);
          } else {
            const minY = lead.plan.ny + lead.len + gap;
            fol.plan.ny = Math.max(fol.plan.ny, minY);
            fol.plan.ny = Math.min(fol.plan.ny, fol.y);
          }
          if (Math.abs(fol.plan.ny - original) > 0.001) fol.plan.blockedByLeader = true;
        }
      }
    }
  }

  _applyQueuing() {
    this._applyNoOverlapPerLane();
  }

  // -------------------------
  // Stats helpers (NEW)
  // -------------------------
  _recordCompletion(v) {
    const meta = this._vehMeta.get(v);
    this.stats.totalCompleted++;

    if (!meta) return;

    const tripMs = Math.max(0, this.simTimeMs - (meta.spawnSimMs || 0));
    this.stats.totalTripMs += tripMs;

    this.stats.completedDistancePx += meta.distancePx || 0;
    this.stats.completedIdleMs += meta.idleMs || 0;
    this.stats.completedCo2G += meta.co2G || 0;
  }

  getStatsSnapshot() {
    return {
      simTimeMs: this.simTimeMs,
      carCount: this.vehicles.size,
      ...this.stats,
    };
  }

  update(dt, deltaMs) {
    // Tick traffic lights using simulation time so Pause freezes signals.
    const simDeltaMs = typeof deltaMs === "number" ? deltaMs : dt * 16.6667;

    // track sim time
    this.simTimeMs += simDeltaMs;

    for (const j of this.junctions.values()) {
      j.signal.update(simDeltaMs);
    }

    for (const v of this.vehicles) v.planStep(dt);

    // no overlap
    this._applyQueuing();

    // -------------------------
    // Telemetry tick (NEW)
    // -------------------------
    const minutes = simDeltaMs / 60000;

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
        if (!meta) {
          meta = { spawnSimMs: this.simTimeMs, distancePx: 0, idleMs: 0, movingMs: 0, co2G: 0 };
          this._vehMeta.set(v, meta);
        }

        // use planned movement (after queuing/clamps) to count distance
        const dx = (v.plan.nx ?? v.x) - v.x;
        const dy = (v.plan.ny ?? v.y) - v.y;
        const movedPx = Math.hypot(dx, dy);

        if (movedPx < 0.01) {
          meta.idleMs += simDeltaMs;
          this.stats.totalIdleMs += simDeltaMs;

          const g = idleGPerMin * minutes;
          meta.co2G += g;
          this.stats.totalCo2G += g;
          tickCo2G += g;
        } else {
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

    // -------------------------
    // Apply + cleanup (existing)
    // -------------------------
    const toRemove = [];
    for (const v of this.vehicles) {
      if (v.plan && v.plan.done) toRemove.push(v);
      else v.applyStep();
    }

    // record completion stats BEFORE removal
    for (const v of toRemove) this._recordCompletion(v);

    toRemove.forEach((v) => this.removeVehicle(v));
  }
}
