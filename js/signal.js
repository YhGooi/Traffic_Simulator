export class SignalController {
  constructor(cfg) {
    this.cfg = cfg;

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
    if (phase === "EW_GREEN" || phase === "NS_GREEN") return this.cfg.GREEN_MS;
    if (phase === "EW_YELLOW" || phase === "NS_YELLOW") return this.cfg.YELLOW_MS;
    return this.cfg.ALLRED_MS; // ALL_RED
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
