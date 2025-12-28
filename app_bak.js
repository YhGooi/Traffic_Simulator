import { CFG } from "./config.js";
import { clamp } from "./utils.js";
import { UI } from "./ui.js";
import { World } from "./world.js";

const worldEl = document.getElementById("world");
const ui = new UI(worldEl);

let world = null;

const Simulation = {
  playing: false,
  lastT: performance.now(),
  speed: 1.0,
  simTimeMs: 0,
};

// --------------------
// Stats (per-car, sustainability-friendly)
// --------------------
// Designed for comparing “old system vs new system” fairly:
//
// Per completed car:
// - travel time (s)
// - stopped time (s) (red/yellow stopline or queued behind leader, or no movement)
// - distance (px) and estimated CO2 (g) using a simple, configurable model.
//
// Access/export anytime from DevTools:
//   window.simStats.snapshot()
//   window.simStats.emission.pxToM = ...
const Stats = (() => {
  // Map vehicle object -> per-vehicle counters
  const perVeh = new Map();
  let prevSet = new Set();

  const totals = {
    spawned: 0,
    completed: 0,
    sumTravelMs: 0,
    sumStoppedMs: 0,
    sumDistPx: 0,
    sumCO2g: 0,
  };

  // Emission model (simple, consistent; calibrate later if needed)
  // - idle_g_per_s: CO2 grams per second while stopped
  // - move_g_per_m: CO2 grams per meter while moving
  // - pxToM: pixels-to-meters conversion factor
  const emission = {
    pxToM: 1.0,
    idle_g_per_s: 1.0,
    move_g_per_m: 0.01,
  };

  function reset() {
    perVeh.clear();
    prevSet = new Set();

    totals.spawned = 0;
    totals.completed = 0;
    totals.sumTravelMs = 0;
    totals.sumStoppedMs = 0;
    totals.sumDistPx = 0;
    totals.sumCO2g = 0;
  }

  function _ensure(v) {
    if (!v || perVeh.has(v)) return;
    perVeh.set(v, {
      spawnMs: Simulation.simTimeMs,
      travelMs: 0,
      stoppedMs: 0,
      distPx: 0,
      lastX: v.x,
      lastY: v.y,
    });
    totals.spawned += 1;
  }

  function _isStopped(v, distStepPx) {
    const plan = v && v.plan ? v.plan : null;
    const blocked = !!(plan && (plan.blockedAtStop || plan.blockedByLeader));
    const noMove = distStepPx < 0.05; // px threshold
    return blocked || noMove;
  }

  function _finalize(v) {
    const meta = perVeh.get(v);
    if (!meta) return;

    const stoppedSec = meta.stoppedMs / 1000;
    const distM = meta.distPx * emission.pxToM;
    const co2g = emission.idle_g_per_s * stoppedSec + emission.move_g_per_m * distM;

    totals.completed += 1;
    totals.sumTravelMs += meta.travelMs;
    totals.sumStoppedMs += meta.stoppedMs;
    totals.sumDistPx += meta.distPx;
    totals.sumCO2g += co2g;

    perVeh.delete(v);
  }

  // Call once after world.update(...) so the set reflects removals.
  function tick(worldRef, stepMs) {
    if (!worldRef) return;

    const current = new Set(worldRef.vehicles);

    for (const v of current) {
      _ensure(v);
      const meta = perVeh.get(v);
      if (!meta) continue;

      const dx = v.x - meta.lastX;
      const dy = v.y - meta.lastY;
      const distPx = Math.sqrt(dx * dx + dy * dy);

      meta.lastX = v.x;
      meta.lastY = v.y;

      meta.travelMs += stepMs;
      meta.distPx += distPx;
      if (_isStopped(v, distPx)) meta.stoppedMs += stepMs;
    }

    // vehicles removed this step: prevSet - current
    for (const v of prevSet) {
      if (!current.has(v)) _finalize(v);
    }

    prevSet = current;
  }

  function _avg(sum, n) {
    return n > 0 ? sum / n : 0;
  }

  function snapshot() {
    const n = totals.completed;
    const simMin = Simulation.simTimeMs / 60000;

    return {
      spawned: totals.spawned,
      completed: totals.completed,
      active: prevSet.size,

      avgTravelSec: _avg(totals.sumTravelMs, n) / 1000,
      avgStoppedSec: _avg(totals.sumStoppedMs, n) / 1000,
      avgStopShare: totals.sumTravelMs > 0 ? totals.sumStoppedMs / totals.sumTravelMs : 0,

      avgDistPx: _avg(totals.sumDistPx, n),
      avgCO2g: _avg(totals.sumCO2g, n),

      throughputCarsPerMin: simMin > 0 ? totals.completed / simMin : 0,
      totalCO2g: totals.sumCO2g,

      emissionParams: { ...emission },
    };
  }

  return { reset, tick, snapshot, totals, emission };
})();

window.simStats = Stats;

// --------------------
// Build world
// --------------------
function buildGridFromInputs() {
  const rows = clamp(parseInt(document.getElementById("rowsInput").value, 10) || 2, 1, 10);
  const cols = clamp(parseInt(document.getElementById("colsInput").value, 10) || 2, 1, 10);

  document.getElementById("rowsInput").value = rows;
  document.getElementById("colsInput").value = cols;

  ui.clear();
  if (world) world.destroy();

  world = new World({ cfg: CFG, ui, rows, cols, worldEl });
  ui.center();

  // keep comparisons clean when you rebuild the grid
  Stats.reset();
  renderStats(true);
}

// --------------------
// Speed UI
// --------------------
const speedSlider = document.getElementById("speedSlider");
const speedText =
  document.getElementById("speedValue") ||
  document.getElementById("speedLabel") ||
  document.getElementById("speedReadout");

function updateSpeedFromUI() {
  if (!speedSlider) return;
  const v = parseFloat(speedSlider.value);
  Simulation.speed = clamp(isFinite(v) ? v : 1.0, 0.1, 20);

  if (speedText) speedText.textContent = `${Simulation.speed.toFixed(2)}×`;
}

if (speedSlider) {
  updateSpeedFromUI();
  speedSlider.addEventListener("input", updateSpeedFromUI);
}

// --------------------
// Sim time UI
// --------------------
const simTimeEl =
  document.getElementById("simTimeValue") ||
  document.getElementById("simTime") ||
  document.getElementById("simTimeLabel");

function fmtSimTime(ms) {
  const totalSec = ms / 1000;
  const mm = Math.floor(totalSec / 60);
  const ss = Math.floor(totalSec % 60);
  const tenth = Math.floor((totalSec - Math.floor(totalSec)) * 10);
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}.${tenth}`;
}

function renderSimTime() {
  if (!simTimeEl) return;
  simTimeEl.textContent = fmtSimTime(Simulation.simTimeMs);
}

// --------------------
// Stats display (uses existing .stats if present)
// --------------------
const statsEl = document.querySelector(".stats");
let lastStatsPaintT = 0;

function num(n, digits = 2) {
  return Number.isFinite(n) ? n.toFixed(digits) : "0.00";
}

function pct(n) {
  const v = clamp(n * 100, 0, 999);
  return `${v.toFixed(1)}%`;
}

function renderStats(force = false) {
  if (!statsEl) return;

  const now = performance.now();
  if (!force && now - lastStatsPaintT < 250) return; // limit DOM updates
  lastStatsPaintT = now;

  const s = Stats.snapshot();

  statsEl.innerHTML = `
    <div><b>Cars</b>: ${s.completed} completed • ${s.active} active • ${s.spawned} spawned</div>
    <div><b>Avg travel</b>: ${num(s.avgTravelSec, 1)} s</div>
    <div><b>Avg stopped</b>: ${num(s.avgStoppedSec, 1)} s (${pct(s.avgStopShare)} of travel)</div>
    <div><b>Throughput</b>: ${num(s.throughputCarsPerMin, 2)} cars/min</div>
    <div><b>Avg CO₂</b>: ${num(s.avgCO2g, 2)} g/car</div>
    <div><b>Total CO₂</b>: ${num(s.totalCO2g, 1)} g</div>
  `;
}

// --------------------
// Controls
// --------------------
document.getElementById("playPause").onclick = () => {
  Simulation.playing = !Simulation.playing;
  document.getElementById("playPause").textContent = Simulation.playing ? "⏸ Pause" : "▶ Play";

  // prevent a huge delta jump when resuming
  Simulation.lastT = performance.now();
};

const zoomSliderEl = document.getElementById("zoomSlider");
if (zoomSliderEl) {
  zoomSliderEl.oninput = (e) => {
    const v = parseFloat(e.target.value);
    // Zoom around the center when using the slider
    ui.setZoom(v, ui.getContainerCenter());
  };
}

document.getElementById("buildGridBtn").onclick = buildGridFromInputs;
document.getElementById("spawnCarBtn").onclick = () => world && world.spawnVehicleRandom();

buildGridFromInputs();
renderSimTime();
renderStats(true);

// --------------------
// Main loop
// --------------------
function loop(t) {
  // real frame delta (unscaled)
  const realDeltaMs = clamp(t - Simulation.lastT, 0, 250);
  Simulation.lastT = t;

  // apply speed multiplier to simulation time
  const speed = Simulation.speed || 1.0;
  // cap simDelta to avoid huge teleports at very high speed
  const simDeltaMs = clamp(realDeltaMs * speed, 0, 800);

  // dt used by vehicle movement (CAR_SPEED * dt)
  const dt = clamp(simDeltaMs / 16.6667, 0, 6);

  if (Simulation.playing && world) {
    // Spawn probability scales with sim time (FPS-stable).
    // Poisson arrival: P = 1 - exp(-lambda * dt)
    // Using your previous mean rate: 0.06 per frame @ ~60fps => ~3.6 cars/sec.
    const spawnRatePerSec = 0.06 * 60;
    const dtSec = simDeltaMs / 1000;
    const spawnProb = clamp(1 - Math.exp(-spawnRatePerSec * dtSec), 0, 0.5);
    if (Math.random() < spawnProb) world.spawnVehicleRandom();

    // pass scaled simDeltaMs so traffic lights speed up/slow down too
    world.update(dt, simDeltaMs);

    // update stats based on actual vehicle positions and plans
    Stats.tick(world, simDeltaMs);

    Simulation.simTimeMs += simDeltaMs;
    renderSimTime();
    renderStats();
  } else {
    renderStats();
  }

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
