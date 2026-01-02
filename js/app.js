import { CFG } from "./config.js";
import { clamp } from "./utils.js";
import { UI } from "./ui.js";
import { World } from "./world.js";

const worldEl = document.getElementById("world");
const ui = new UI(worldEl);

let world = null;

// --- New: bottom playground variables ---
const world2El = document.getElementById("world2");
let ui2 = null;
let world2 = null;
let junctionSyncIntervalId = null;

// Track optimization state (starts disabled)
let isOptimizationEnabled = false;

function buildGridFromInputs() {
  const rows = clamp(parseInt(document.getElementById("rowsInput").value, 10) || 2, 1, 10);
  const cols = clamp(parseInt(document.getElementById("colsInput").value, 10) || 2, 1, 10);

  document.getElementById("rowsInput").value = rows;
  document.getElementById("colsInput").value = cols;

  ui.clear();
  if (world) world.destroy();

  // Left playground: baseline (no optimization)
  world = new World({ cfg: CFG, ui, rows, cols, worldEl, enableOptimization: false, isRightPlayground: false });
  // After rebuilding, center the view based on the new world size
  ui.center();

  // --- New: build right playground with same rows/cols ---
  if (ui2) ui2.clear();
  if (world2) {
    if (typeof world2.destroy === "function") world2.destroy();
    world2 = null;
  }
  ui2 = new UI(world2El);
  // Right playground: with optimization based on current toggle state
  world2 = new World({ cfg: CFG, ui: ui2, rows, cols, worldEl: world2El, enableOptimization: isOptimizationEnabled, isRightPlayground: true });
  ui2.center();

  // Set up mirroring: left world mirrors to right world
  world.mirrorWorld = world2;

  // If a junction API URL is set and sync was running, restart it against the new world2
  const apiUrl = document.getElementById("junctionApiUrl")?.value;
  if (apiUrl) {
    stopJunctionSync();
    startJunctionSync(apiUrl, world2);
  }
}

function startJunctionSync(apiUrl, targetWorld, intervalMs = 5000) {
  if (!apiUrl || !targetWorld) return;
  stopJunctionSync();

  // one-shot immediate sync then periodic
  const syncOnce = async () => {
    // Look for obvious container of junctions
    let junctions = null;
    if (Array.isArray(targetWorld.junctions)) junctions = targetWorld.junctions;
    else if (Array.isArray(targetWorld.cells)) junctions = targetWorld.cells;
    else if (typeof targetWorld.getJunctions === "function") junctions = targetWorld.getJunctions();
    else {
      // try to discover numerically keyed properties
      junctions = [];
      for (const k in targetWorld) {
        if (k.toLowerCase().includes("junction")) {
          const v = targetWorld[k];
          if (Array.isArray(v)) junctions = junctions.concat(v);
        }
      }
    }

    if (!junctions || junctions.length === 0) return;

    for (let i = 0; i < junctions.length; i++) {
      const j = junctions[i];
      const payload = { world: "world2", index: i, ...collectJunctionPayload(j) };
      postJunction(apiUrl, payload);
    }
  };

  // immediate
  syncOnce();
  // periodic
  junctionSyncIntervalId = setInterval(syncOnce, intervalMs);
}

function stopJunctionSync() {
  if (junctionSyncIntervalId) {
    clearInterval(junctionSyncIntervalId);
    junctionSyncIntervalId = null;
  }
}

// Wire the Start Sync button
const startSyncBtn = document.getElementById("startJunctionSyncBtn");
if (startSyncBtn) {
  startSyncBtn.onclick = () => {
    const url = document.getElementById("junctionApiUrl")?.value;
    if (!url) return alert("Provide a junction API URL");
    startJunctionSync(url, world2);
    startSyncBtn.textContent = "Syncing...";
  };
}

// --- Adjust spawn button to apply to both worlds ---
const spawnBtn = document.getElementById("spawnCarBtn");
if (spawnBtn) {
  spawnBtn.onclick = () => {
    if (world && typeof world.spawnVehicleRandom === "function") world.spawnVehicleRandom();
    if (world2 && typeof world2.spawnVehicleRandom === "function") world2.spawnVehicleRandom();
  };
}

const Simulation = {
  playing: false,
  lastT: performance.now(),
  speed: 1.0,
  simTimeMs: 0,
};

// ---------- Speed UI (optional, but if present we wire it) ----------
const speedSlider = document.getElementById("speedSlider");
const speedText =
  document.getElementById("speedValue") ||
  document.getElementById("speedLabel") ||
  document.getElementById("speedReadout");

function updateSpeedFromUI() {
  if (!speedSlider) return;
  const v = parseFloat(speedSlider.value);
  Simulation.speed = clamp(isFinite(v) ? v : 1.0, 0.1, 40);
  if (speedText) speedText.textContent = `${Simulation.speed.toFixed(2)}x`;
}

if (speedSlider) {
  updateSpeedFromUI();
  speedSlider.addEventListener("input", updateSpeedFromUI);
}

// ---------- Sim time UI ----------
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

// ---------- Stats UI (NEW, safe) ----------
// Only updates elements that exist; if your HTML doesn't have them, nothing breaks.
const StatEls = {
  carCount: document.getElementById("statCarCount"),
  spawned: document.getElementById("statTotalSpawned"),
  completed: document.getElementById("statCompleted"),
  throughput: document.getElementById("statThroughput"),
  avgTrip: document.getElementById("statAvgTripTime"),
  avgIdle: document.getElementById("statAvgIdleTime"),
  stopPct: document.getElementById("statStopPct"),
  avgSpeedNow: document.getElementById("statAvgSpeedNow"),
  distance: document.getElementById("statTotalDistance"),
  co2Rate: document.getElementById("statCo2PerMin"),
  co2Total: document.getElementById("statCo2Total"),
  avgCo2Trip: document.getElementById("statAvgCo2Trip"),
};

const StatEls2 = {
  carCount: document.getElementById("statCarCount2"),
  spawned: document.getElementById("statTotalSpawned2"),
  completed: document.getElementById("statCompleted2"),
  throughput: document.getElementById("statThroughput2"),
  avgTrip: document.getElementById("statAvgTripTime2"),
  avgIdle: document.getElementById("statAvgIdleTime2"),
  stopPct: document.getElementById("statStopPct2"),
  avgSpeedNow: document.getElementById("statAvgSpeedNow2"),
  distance: document.getElementById("statTotalDistance2"),
  co2Rate: document.getElementById("statCo2PerMin2"),
  co2Total: document.getElementById("statCo2Total2"),
  avgCo2Trip: document.getElementById("statAvgCo2Trip2"),
};

function _setStat(el, text) {
  if (!el) return;
  el.textContent = text;
}

function _fmtNumber(n, digits = 0) {
  if (!isFinite(n)) return "0";
  return Number(n).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function _fmtSec(ms) {
  const s = Math.max(0, ms) / 1000;
  if (s < 60) return `${_fmtNumber(s, 1)} s`;
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}m ${_fmtNumber(r, 0)}s`;
}

function renderStats() {
  if (!world || typeof world.getStatsSnapshot !== "function") return;

  const s = world.getStatsSnapshot();

  const PX_PER_M = (typeof CFG.PX_PER_M === "number") ? CFG.PX_PER_M : 10;

  const simMin = (s.simTimeMs || 0) / 60000;
  const simHr = (s.simTimeMs || 0) / 3600000;

  const totalDistKm = ((s.totalDistancePx || 0) / PX_PER_M) / 1000;

  // Average per car overall: total distance divided by total vehicle-hours (includes idle time)
  const totalVehicleHours = (((s.totalIdleMs || 0) + (s.totalMovingMs || 0)) / 3600000);
  const avgSpeedPerCarKmh = totalVehicleHours > 0 ? (totalDistKm / totalVehicleHours) : 0;

  const totalMove = (s.totalIdleMs || 0) + (s.totalMovingMs || 0);
  const stopPct = totalMove > 0 ? ((s.totalIdleMs || 0) / totalMove) * 100 : 0;

  // current throughput provided by the world snapshot (completions last 1 minute scaled to trips/hour)
  const throughput = s.currentThroughputPerHour || 0;
  const avgTripMs = s.totalCompleted > 0 ? (s.totalTripMs / s.totalCompleted) : 0;
  const avgIdleMs = s.totalCompleted > 0 ? (s.completedIdleMs / s.totalCompleted) : 0;

  // CO₂ rate: total CO₂ emitted from start divided by total simulated minutes (g/min)
  const co2TotalG = (s.totalCo2G || 0);
  const co2Rate = simMin > 0 ? (co2TotalG / simMin) : 0;
  const avgCo2TripG = s.totalCompleted > 0 ? (s.completedCo2G / s.totalCompleted) : 0;

  _setStat(StatEls.carCount, _fmtNumber(s.carCount || 0));
  _setStat(StatEls.spawned, _fmtNumber(s.totalSpawned || 0));
  _setStat(StatEls.completed, _fmtNumber(s.totalCompleted || 0));
  _setStat(StatEls.throughput, `${_fmtNumber(throughput, 0)}`);
  _setStat(StatEls.avgTrip, s.totalCompleted > 0 ? _fmtSec(avgTripMs) : "-");
  _setStat(StatEls.avgIdle, s.totalCompleted > 0 ? _fmtSec(avgIdleMs) : "-");
  _setStat(StatEls.stopPct, totalMove > 0 ? `${_fmtNumber(stopPct, 1)}%` : "-");
  _setStat(StatEls.avgSpeedNow, `${_fmtNumber(avgSpeedPerCarKmh, 1)} km/h`);
  _setStat(StatEls.distance, `${_fmtNumber(totalDistKm, 3)} km`);
  _setStat(StatEls.co2Rate, `${_fmtNumber(co2Rate, 1)} g/min`);
  _setStat(StatEls.co2Total, `${_fmtNumber(co2TotalG, 0)} g (${_fmtNumber(co2TotalG / 1000, 2)} kg)`);
  _setStat(StatEls.avgCo2Trip, s.totalCompleted > 0 ? `${_fmtNumber(avgCo2TripG, 0)} g` : "-");
}

function renderStats2() {
  if (!world2 || typeof world2.getStatsSnapshot !== "function") return;
  const s2 = world2.getStatsSnapshot();
  
  // Get baseline stats from world 1 for comparison
  const s1 = world && typeof world.getStatsSnapshot === "function" ? world.getStatsSnapshot() : null;

  const PX_PER_M = (typeof CFG.PX_PER_M === "number") ? CFG.PX_PER_M : 10;
  const simMin = (s2.simTimeMs || 0) / 60000;
  const totalDistKm = ((s2.totalDistancePx || 0) / PX_PER_M) / 1000;
  const totalVehicleHours = (((s2.totalIdleMs || 0) + (s2.totalMovingMs || 0)) / 3600000);
  const avgSpeedPerCarKmh = totalVehicleHours > 0 ? (totalDistKm / totalVehicleHours) : 0;
  const totalMove = (s2.totalIdleMs || 0) + (s2.totalMovingMs || 0);
  const stopPct = totalMove > 0 ? ((s2.totalIdleMs || 0) / totalMove) * 100 : 0;
  const throughput = s2.currentThroughputPerHour || 0;
  const avgTripMs = s2.totalCompleted > 0 ? (s2.totalTripMs / s2.totalCompleted) : 0;
  const avgIdleMs = s2.totalCompleted > 0 ? (s2.completedIdleMs / s2.totalCompleted) : 0;
  const co2TotalG = (s2.totalCo2G || 0);
  const co2Rate = simMin > 0 ? (co2TotalG / simMin) : 0;
  const avgCo2TripG = s2.totalCompleted > 0 ? (s2.completedCo2G / s2.totalCompleted) : 0;

  // Calculate baseline values for comparison
  let baseline = null;
  if (s1) {
    const simMin1 = (s1.simTimeMs || 0) / 60000;
    const totalDistKm1 = ((s1.totalDistancePx || 0) / PX_PER_M) / 1000;
    const totalVehicleHours1 = (((s1.totalIdleMs || 0) + (s1.totalMovingMs || 0)) / 3600000);
    const avgSpeedPerCarKmh1 = totalVehicleHours1 > 0 ? (totalDistKm1 / totalVehicleHours1) : 0;
    const totalMove1 = (s1.totalIdleMs || 0) + (s1.totalMovingMs || 0);
    const stopPct1 = totalMove1 > 0 ? ((s1.totalIdleMs || 0) / totalMove1) * 100 : 0;
    const throughput1 = s1.currentThroughputPerHour || 0;
    const avgTripMs1 = s1.totalCompleted > 0 ? (s1.totalTripMs / s1.totalCompleted) : 0;
    const avgIdleMs1 = s1.totalCompleted > 0 ? (s1.completedIdleMs / s1.totalCompleted) : 0;
    const co2TotalG1 = (s1.totalCo2G || 0);
    const co2Rate1 = simMin1 > 0 ? (co2TotalG1 / simMin1) : 0;
    const avgCo2TripG1 = s1.totalCompleted > 0 ? (s1.completedCo2G / s1.totalCompleted) : 0;
    
    baseline = {
      throughput: throughput1,
      avgTripMs: avgTripMs1,
      avgIdleMs: avgIdleMs1,
      stopPct: stopPct1,
      avgSpeedPerCarKmh: avgSpeedPerCarKmh1,
      co2Rate: co2Rate1,
      avgCo2TripG: avgCo2TripG1
    };
  }

  _setStat(StatEls2.carCount, _fmtNumber(s2.carCount || 0));
  _setStat(StatEls2.spawned, _fmtNumber(s2.totalSpawned || 0));
  _setStat(StatEls2.completed, _fmtNumber(s2.totalCompleted || 0));
  _setStatWithComparison(StatEls2.throughput, throughput, baseline?.throughput, true, 0, '');
  _setStatWithComparison(StatEls2.avgTrip, avgTripMs, baseline?.avgTripMs, false, null, '', true);
  _setStatWithComparison(StatEls2.avgIdle, avgIdleMs, baseline?.avgIdleMs, false, null, '', true);
  _setStatWithComparison(StatEls2.stopPct, stopPct, baseline?.stopPct, false, 1, '%');
  _setStatWithComparison(StatEls2.avgSpeedNow, avgSpeedPerCarKmh, baseline?.avgSpeedPerCarKmh, true, 1, ' km/h');
  _setStat(StatEls2.distance, `${_fmtNumber(totalDistKm, 3)} km`);
  _setStatWithComparison(StatEls2.co2Rate, co2Rate, baseline?.co2Rate, false, 1, ' g/min');
  _setStat(StatEls2.co2Total, `${_fmtNumber(co2TotalG, 0)} g (${_fmtNumber(co2TotalG / 1000, 2)} kg)`);
  _setStatWithComparison(StatEls2.avgCo2Trip, avgCo2TripG, baseline?.avgCo2TripG, false, 0, ' g');
}

// Helper function to set stat with color-coded comparison
function _setStatWithComparison(el, value, baseline, higherIsBetter, decimals = 1, unit = '', isTime = false) {
  if (!el) return;
  
  // Get the parent card element
  const card = el.closest('.statCard');
  
  // Handle no data case
  if ((isTime && value <= 0) || (!isTime && !value && value !== 0)) {
    el.textContent = '-';
    el.style.color = '';
    if (card) {
      card.classList.remove('improved', 'worsened');
    }
    return;
  }
  
  // Format the main value
  let displayValue;
  if (isTime) {
    displayValue = _fmtSec(value);
  } else if (decimals !== null) {
    displayValue = _fmtNumber(value, decimals) + unit;
  } else {
    displayValue = value + unit;
  }
  
  // If no baseline, just show the value
  if (!baseline || baseline === 0) {
    el.textContent = displayValue;
    el.style.color = '';
    if (card) {
      card.classList.remove('improved', 'worsened');
    }
    return;
  }
  
  // Calculate percentage difference
  const pctDiff = ((value - baseline) / baseline) * 100;
  const isImprovement = higherIsBetter ? (pctDiff > 0) : (pctDiff < 0);
  
  // Only show comparison if difference is significant (> 0.5%)
  if (Math.abs(pctDiff) > 0.5) {
    const sign = pctDiff > 0 ? '+' : '';
    el.textContent = `${displayValue} (${sign}${pctDiff.toFixed(1)}%)`;
    el.style.color = isImprovement ? '#2e7d32' : '#c62828';
    el.style.fontWeight = '600';
    
    // Apply background color to card
    if (card) {
      card.classList.remove('improved', 'worsened');
      card.classList.add(isImprovement ? 'improved' : 'worsened');
    }
  } else {
    el.textContent = displayValue;
    el.style.color = '#666';
    
    // Remove background classes for neutral changes
    if (card) {
      card.classList.remove('improved', 'worsened');
    }
  }
}

function renderOptimizationStats() {
  if (!world2 || !world2.signalOptimizer || !world2.signalOptimizer.enabled) return;
  
  const stats = world2.signalOptimizer.getStats();
  
  const totalEl = document.getElementById("optTotal");
  const successEl = document.getElementById("optSuccess");
  const savedEl = document.getElementById("optSaved");
  const statusEl = document.getElementById("optStatusText");
  
  if (totalEl) totalEl.textContent = stats.totalOptimizations;
  if (successEl) successEl.textContent = stats.successfulOptimizations;
  if (savedEl) savedEl.textContent = _fmtNumber(stats.totalEnergySaved, 0);
  
  if (statusEl && stats.lastOptimizationResult) {
    const last = stats.lastOptimizationResult;
    if (last.deployed) {
      statusEl.textContent = `✅ ${last.reason}`;
      statusEl.style.color = "#2e7d32";
    } else if (last.triggered) {
      statusEl.textContent = `⚠️ ${last.reason}`;
      statusEl.style.color = "#f57c00";
    } else {
      statusEl.textContent = `⏸️ ${last.reason}`;
      statusEl.style.color = "#757575";
    }
  }
}

// --- New: helper to call junction API for every junction of a world ---
// Defensive: checks various property names that junction objects commonly use.
async function postJunction(apiUrl, payload) {
  try {
    await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.warn("junction API post failed", err);
  }
}

function collectJunctionPayload(j) {
  // defensive extraction
  return {
    id: j.id || j._id || j.key || null,
    row: j.r ?? j.row ?? j.rowIdx ?? null,
    col: j.c ?? j.col ?? j.colIdx ?? null,
    state: j.state ?? j.signalState ?? null,
    meta: j.meta ?? null,
  };
}

// ---------- Controls ----------
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

// Optimization toggle button
const toggleOptBtn = document.getElementById("toggleOptimizationBtn");
if (toggleOptBtn) {
  // Initialize button state
  toggleOptBtn.textContent = isOptimizationEnabled ? "Disable (Right)" : "Enable (Right)";
  toggleOptBtn.classList.toggle("active", isOptimizationEnabled);
  
  toggleOptBtn.onclick = () => {
    if (world2 && world2.signalOptimizer) {
      const newState = !world2.signalOptimizer.enabled;
      isOptimizationEnabled = newState; // Save state
      world2.signalOptimizer.setEnabled(newState);
      toggleOptBtn.textContent = newState ? "Disable (Right)" : "Enable (Right)";
      toggleOptBtn.classList.toggle("active", newState);
      
      // Show/hide optimization status bar
      const statusBar = document.getElementById("optimizationStatus");
      if (statusBar) {
        statusBar.style.display = newState ? "flex" : "none";
      }
      
      console.log('[Optimization]', newState ? 'ENABLED' : 'DISABLED');
    }
  };
}

buildGridFromInputs();
renderSimTime();
renderStats();

function loop(t) {
  const realDeltaMs = clamp(t - Simulation.lastT, 0, 250);
  Simulation.lastT = t;

  const speed = Simulation.speed || 1.0;
  const simDeltaMs = realDeltaMs * speed;
  const dt = simDeltaMs / 16.6667;

  if (Simulation.playing) {
    // --- top world update ---
    if (world && typeof world.update === "function") {
      // probabilistic spawn (same logic as before)
      const spawnRatePerSec = 0.06 * 60;
      const spawnProb = clamp(spawnRatePerSec * (simDeltaMs / 1000), 0, 0.5);
      if (Math.random() < spawnProb && typeof world.spawnVehicleRandom === "function") {
        world.spawnVehicleRandom();
      }

      world.simSpeed = Simulation.speed || 1.0;

      const maxDt = 6;
      const steps = Math.max(1, Math.ceil(dt / maxDt));
      const subDt = dt / steps;
      const subSimDeltaMs = simDeltaMs / steps;
      for (let i = 0; i < steps; i++) world.update(subDt, subSimDeltaMs);
    }

    // --- bottom world update (was missing, causing zero stats) ---
    if (world2 && typeof world2.update === "function") {
      // same spawn logic for world2
      const spawnRatePerSec2 = 0.06 * 60;
      const spawnProb2 = clamp(spawnRatePerSec2 * (simDeltaMs / 1000), 0, 0.5);
      if (Math.random() < spawnProb2 && typeof world2.spawnVehicleRandom === "function") {
        world2.spawnVehicleRandom();
      }

      world2.simSpeed = Simulation.speed || 1.0;

      const maxDt2 = 6;
      const steps2 = Math.max(1, Math.ceil(dt / maxDt2));
      const subDt2 = dt / steps2;
      const subSimDeltaMs2 = simDeltaMs / steps2;
      for (let i = 0; i < steps2; i++) world2.update(subDt2, subSimDeltaMs2);
    }

    Simulation.simTimeMs += simDeltaMs;
    renderSimTime();
  }

  // Stats render for both worlds (safe)
  renderStats();
  renderStats2();
  renderOptimizationStats();

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
