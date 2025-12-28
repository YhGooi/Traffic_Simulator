import { CFG } from "./config.js";
import { clamp } from "./utils.js";
import { UI } from "./ui.js";
import { World } from "./world.js";

const worldEl = document.getElementById("world");
const ui = new UI(worldEl);

let world = null;

function buildGridFromInputs() {
  const rows = clamp(parseInt(document.getElementById("rowsInput").value, 10) || 2, 1, 10);
  const cols = clamp(parseInt(document.getElementById("colsInput").value, 10) || 2, 1, 10);

  document.getElementById("rowsInput").value = rows;
  document.getElementById("colsInput").value = cols;

  ui.clear();
  if (world) world.destroy();

  world = new World({ cfg: CFG, ui, rows, cols, worldEl });
  // After rebuilding, center the view based on the new world size
  ui.center();
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
  Simulation.speed = clamp(isFinite(v) ? v : 1.0, 0.1, 20);
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
  avgSpeedAll: document.getElementById("statAvgSpeedAll"),
  distance: document.getElementById("statTotalDistance"),
  co2Rate: document.getElementById("statCo2PerMin"),
  co2Total: document.getElementById("statCo2Total"),
  avgCo2Trip: document.getElementById("statAvgCo2Trip"),
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
  const avgSpeedAllKmh = simHr > 0 ? (totalDistKm / simHr) : 0;

  const tickHr = (s.lastTickSimDeltaMs || 0) / 3600000;
  const tickDistKm = ((s.lastTickDistancePx || 0) / PX_PER_M) / 1000;
  const avgSpeedNowKmh = (tickHr > 0 && (s.carCount || 0) > 0) ? ((tickDistKm / tickHr) / s.carCount) : 0;

  const totalMove = (s.totalIdleMs || 0) + (s.totalMovingMs || 0);
  const stopPct = totalMove > 0 ? ((s.totalIdleMs || 0) / totalMove) * 100 : 0;

  const throughput = simMin > 0 ? (s.totalCompleted / simMin) : 0;
  const avgTripMs = s.totalCompleted > 0 ? (s.totalTripMs / s.totalCompleted) : 0;
  const avgIdleMs = s.totalCompleted > 0 ? (s.completedIdleMs / s.totalCompleted) : 0;

  const co2Rate = (s.co2RateGPerMin || 0);
  const co2TotalG = (s.totalCo2G || 0);
  const avgCo2TripG = s.totalCompleted > 0 ? (s.completedCo2G / s.totalCompleted) : 0;

  _setStat(StatEls.carCount, _fmtNumber(s.carCount || 0));
  _setStat(StatEls.spawned, _fmtNumber(s.totalSpawned || 0));
  _setStat(StatEls.completed, _fmtNumber(s.totalCompleted || 0));
  _setStat(StatEls.throughput, `${_fmtNumber(throughput, 2)} / min`);
  _setStat(StatEls.avgTrip, s.totalCompleted > 0 ? _fmtSec(avgTripMs) : "-");
  _setStat(StatEls.avgIdle, s.totalCompleted > 0 ? _fmtSec(avgIdleMs) : "-");
  _setStat(StatEls.stopPct, totalMove > 0 ? `${_fmtNumber(stopPct, 1)}%` : "-");
  _setStat(StatEls.avgSpeedNow, `${_fmtNumber(avgSpeedNowKmh, 1)} km/h`);
  _setStat(StatEls.avgSpeedAll, `${_fmtNumber(avgSpeedAllKmh, 1)} km/h`);
  _setStat(StatEls.distance, `${_fmtNumber(totalDistKm, 3)} km`);
  _setStat(StatEls.co2Rate, `${_fmtNumber(co2Rate, 1)} g/min`);
  _setStat(StatEls.co2Total, `${_fmtNumber(co2TotalG, 0)} g (${_fmtNumber(co2TotalG / 1000, 2)} kg)`);
  _setStat(StatEls.avgCo2Trip, s.totalCompleted > 0 ? `${_fmtNumber(avgCo2TripG, 0)} g` : "-");
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

buildGridFromInputs();
renderSimTime();
renderStats();

function loop(t) {
  const realDeltaMs = clamp(t - Simulation.lastT, 0, 250);
  Simulation.lastT = t;

  const speed = Simulation.speed || 1.0;
  const simDeltaMs = clamp(realDeltaMs * speed, 0, 800);
  const dt = clamp(simDeltaMs / 16.6667, 0, 6);

  if (Simulation.playing && world) {
    const spawnRatePerSec = 0.06 * 60; // old 0.06 per frame @ ~60fps
    const spawnProb = clamp(spawnRatePerSec * (simDeltaMs / 1000), 0, 0.5);
    if (Math.random() < spawnProb) world.spawnVehicleRandom();

    world.update(dt, simDeltaMs);

    Simulation.simTimeMs += simDeltaMs;
    renderSimTime();
  }

  // Stats can still render while paused (car count, totals stay stable)
  renderStats();

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
