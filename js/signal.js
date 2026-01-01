export class SignalController {
  constructor(cfg) {
    this.cfg = cfg;

    // Mutable timing properties (can be updated by optimizer)
    // Initialize from cfg but store separately to allow modification
    // Calculate adaptive yellow time based on car speed and intersection
    this.GREEN_MS = cfg.GREEN_MS || 45000; // 45 seconds
    this.YELLOW_MS = this._calculateYellowTime(cfg); // Adaptive yellow time (3-6s)
    this.ALLRED_MS = cfg.ALLRED_MS || 2000; // 2 seconds

    // Keep phase names stable for the rest of the codebase.
    this.phase = "EW_GREEN";

    this._listeners = new Set();

    // Tick-driven timing (no setTimeout). Pause works naturally.
    this._running = false;
    this._remainingMs = 0;

    // Track which direction we were serving before ALL_RED, so we alternate.
    this._lastAllRedFromNS = false;
  }

  onChange(fn) {
    this._listeners.add(fn);
  }

  /**
   * Calculate optimal yellow light duration based on car speed and intersection width
   * Uses standard traffic engineering formula:
   * Yellow = perception_time + (speed / 2*deceleration) + (clearance_distance / speed)
   * 
   * @param {Object} cfg - Configuration object
   * @returns {number} - Yellow time in milliseconds
   */
  _calculateYellowTime(cfg) {
    const carSpeed = cfg.CAR_SPEED || 1.4; // pixels per frame (16.67ms)
    const junctionSize = cfg.JUNC_SIZE || 110; // pixels
    const roadThick = cfg.ROAD_THICK || 120; // pixels
    
    // Convert car speed to pixels per second (assuming 60fps)
    const speedPxPerSec = carSpeed * 60; // ~84 px/s at default speed
    
    // Perception-reaction time (human standard: ~1.5 seconds)
    const perceptionTime = 1.5; // seconds
    
    // Deceleration distance: time to comfortably stop
    // Assume comfortable deceleration of ~3 m/s² (using pixel scale)
    const decelTime = speedPxPerSec / (3 * 10); // simplified deceleration time (~2.8s)
    
    // Clearance time: time to cross intersection from stop line
    // Distance = half junction + road thickness (to clear the intersection)
    const clearanceDistance = (junctionSize / 2) + (roadThick / 2);
    const clearanceTime = clearanceDistance / speedPxPerSec; // ~2.4 seconds
    
    // Total yellow time = max of (stop time, clearance time) + perception time
    const yellowTimeSec = perceptionTime + Math.max(decelTime, clearanceTime);
    
    // Convert to milliseconds and ensure minimum 3 seconds for safety
    const yellowTimeMs = Math.max(3000, Math.round(yellowTimeSec * 1000));
    
    return yellowTimeMs;
  }

  _emit() {
    for (const fn of this._listeners) fn(this.phase);
  }

  start() {
    // Initialize to a known state; after this, update(deltaMs) drives the cycle.
    this._running = true;
    this.phase = "EW_GREEN";
    this._remainingMs = this._durFor(this.phase);
    this._emit();
  }

  stop() {
    // Stop advancing, but keep the current phase (useful for pause UI).
    this._running = false;
  }

  resume() {
    // Resume advancing from the current phase.
    if (this._remainingMs <= 0) this._remainingMs = this._durFor(this.phase);
    this._running = true;
  }

  _durFor(phase) {
    if (phase === "EW_GREEN" || phase === "NS_GREEN") return this.GREEN_MS;
    if (phase === "EW_YELLOW" || phase === "NS_YELLOW") return this.YELLOW_MS;
    return this.ALLRED_MS; // ALL_RED
  }

  _advancePhase() {
    switch (this.phase) {
      case "EW_GREEN":
        this.phase = "EW_YELLOW";
        break;
      case "EW_YELLOW":
        this._lastAllRedFromNS = false;
        this.phase = "ALL_RED";
        break;
      case "NS_GREEN":
        this.phase = "NS_YELLOW";
        break;
      case "NS_YELLOW":
        this._lastAllRedFromNS = true;
        this.phase = "ALL_RED";
        break;
      case "ALL_RED":
      default:
        // After ALL_RED, serve the opposite direction next
        this.phase = this._lastAllRedFromNS ? "EW_GREEN" : "NS_GREEN";
        break;
    }

    this._remainingMs = this._durFor(this.phase);
    this._emit();
  }

  update(deltaMs) {
    if (!this._running) return;
    if (!deltaMs || deltaMs <= 0) return;

    let d = deltaMs;
    while (d > 0) {
      if (d < this._remainingMs) {
        this._remainingMs -= d;
        break;
      }

      d -= this._remainingMs;
      this._advancePhase();
    }
  }

  // Only GREEN lets crossing; yellow/red/all-red => stop.
  isGreen(axis) {
    return axis === "H" ? this.phase === "EW_GREEN" : this.phase === "NS_GREEN";
  }
}
