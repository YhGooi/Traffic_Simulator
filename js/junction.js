import { keyRC } from "./utils.js";
import { SignalController } from "./signal.js";

export class Junction {
  constructor({ cfg, ui, geom, r, c }) {
    this.cfg = cfg;
    this.ui = ui;
    this.geom = geom;
    this.r = r;
    this.c = c;
    this.id = keyRC(r, c);

    this.box = this.geom.junctionBoxAt(r, c);

    this.el = ui.addDiv("junction", {
      left: `${this.box.left}px`,
      top: `${this.box.top}px`,
    });

    this.stopLines = this._createStopLines();
    this.lights = this._createLights();

    // Exit toggles (per direction).
    // If enabled, new vehicles may choose this lane as a sink to exit the playground.
    this.exits = { N: false, S: false, E: false, W: false };
    this.exitButtons = this._createExitButtons();

    this.signal = new SignalController(cfg);
    this.signal.onChange(() => this._renderLights());
    this.signal.start();
    this._renderLights();
  }

  destroy() {
    this.signal.stop();
    this.el.remove();
    Object.values(this.stopLines).forEach(el => el.remove());
    Object.values(this.lights).forEach(el => el.remove());
    Object.values(this.exitButtons || {}).forEach(btn => btn.remove());
  }

  center() { return { x: this.box.cx, y: this.box.cy }; }

  // ✅ IMPORTANT: lane center must match 2-way road rendering
  // For a road thickness T, each lane center is at +/- T/4 from road centerline
  _laneOffset() {
    return Math.round((this.cfg.ROAD_THICK || 120) / 4); // 120/4 = 30
  }

  // Canonical ONE lane per direction
  // W approach => moving East => y = cy - o
  // E approach => moving West => y = cy + o
  // N approach => moving South => x = cx + o
  // S approach => moving North => x = cx - o
  lanePointForApproach(approachDir) {
    const b = this.box;
    const o = this._laneOffset();

    if (approachDir === "W") return { x: b.innerLeft,  y: b.cy - o, axis: "H", sign: +1, stop: b.innerLeft };
    if (approachDir === "E") return { x: b.innerRight, y: b.cy + o, axis: "H", sign: -1, stop: b.innerRight };
    if (approachDir === "N") return { x: b.cx + o,     y: b.innerTop, axis: "V", sign: +1, stop: b.innerTop };
    return { x: b.cx - o,     y: b.innerBottom, axis: "V", sign: -1, stop: b.innerBottom };
  }

  // Exit E => eastbound lane => y = cy - o
  // Exit W => westbound lane => y = cy + o
  // Exit S => southbound lane => x = cx + o
  // Exit N => northbound lane => x = cx - o
  lanePointForExit(exitDir) {
    const b = this.box;
    const o = this._laneOffset();

    if (exitDir === "E") return { x: b.innerRight, y: b.cy - o, axis: "H", sign: +1 };
    if (exitDir === "W") return { x: b.innerLeft,  y: b.cy + o, axis: "H", sign: -1 };
    if (exitDir === "S") return { x: b.cx + o,     y: b.innerBottom, axis: "V", sign: +1 };
    return { x: b.cx - o,     y: b.innerTop, axis: "V", sign: -1 };
  }

  _createStopLines() {
    const b = this.box;
    const t = this.cfg.STOPLINE_THICK;

    return {
      W: this.ui.addDiv("stopLine", {
        left: `${b.innerLeft}px`,
        top: `${b.innerTop}px`,
        width: `${t}px`,
        height: `${b.innerBottom - b.innerTop}px`,
      }),
      E: this.ui.addDiv("stopLine", {
        left: `${b.innerRight}px`,
        top: `${b.innerTop}px`,
        width: `${t}px`,
        height: `${b.innerBottom - b.innerTop}px`,
      }),
      N: this.ui.addDiv("stopLine", {
        left: `${b.innerLeft}px`,
        top: `${b.innerTop}px`,
        width: `${b.innerRight - b.innerLeft}px`,
        height: `${t}px`,
      }),
      S: this.ui.addDiv("stopLine", {
        left: `${b.innerLeft}px`,
        top: `${b.innerBottom}px`,
        width: `${b.innerRight - b.innerLeft}px`,
        height: `${t}px`,
      }),
    };
  }

  _mkTrafficLight(x, y) {
    const el = this.ui.addDiv("tl", { left: `${x}px`, top: `${y}px` });
    el.innerHTML = `
      <div class="bulb red"></div>
      <div class="bulb yellow"></div>
      <div class="bulb green"></div>
    `;
    return el;
  }

  _createLights() {
    const b = this.box;
    return {
      N: this._mkTrafficLight(b.cx - 10, b.innerTop - 40),
      S: this._mkTrafficLight(b.cx - 10, b.innerBottom + 8),
      W: this._mkTrafficLight(b.innerLeft - 30, b.cy - 22),
      E: this._mkTrafficLight(b.innerRight + 10, b.cy - 22),
    };
  }

  isExitEnabled(dir) {
    return !!this.exits?.[dir];
  }

  _toggleExit(dir) {
    this.exits[dir] = !this.exits[dir];
    this._renderExitButtons();
  }

  _mkExitBtn(left, top, dir) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Exit";
    btn.className = "exitBtn";
    Object.assign(btn.style, {
      position: "absolute",
      left: `${left}px`,
      top: `${top}px`,
      padding: "2px 6px",
      fontSize: "11px",
      borderRadius: "10px",
      border: "1px solid #333",
      cursor: "pointer",
      userSelect: "none",
      zIndex: 9999, // ✅ ONLY CHANGE: bring Exit button to the front
    });
    btn.onclick = () => this._toggleExit(dir);
    this.ui.root.appendChild(btn);
    return btn;
  }

  _createExitButtons() {
    const b = this.box;
    // Place buttons near the outgoing lane side of the junction.
    // These are absolute in world coordinates (same as stop lines & lights).
    return {
      N: this._mkExitBtn(b.cx - 16, b.innerTop - 58, "N"),
      S: this._mkExitBtn(b.cx - 16, b.innerBottom + 69, "S"),
      W: this._mkExitBtn(b.innerLeft - 60, b.cy - 10, "W"),
      E: this._mkExitBtn(b.innerRight + 35, b.cy - 10, "E"),
    };
  }

  _renderExitButtons() {
    for (const dir of ["N", "S", "E", "W"]) {
      const btn = this.exitButtons?.[dir];
      if (!btn) continue;
      const on = !!this.exits[dir];
      btn.style.background = on ? "#2e7d32" : "#777";
      btn.style.color = "#fff";
      btn.style.opacity = on ? "1" : "0.55";
      btn.textContent = on ? `Exit ✓` : "Exit";
    }
  }

  _setLight(el, color) {
    const bulbs = el.querySelectorAll(".bulb");
    bulbs.forEach(b => b.classList.remove("on"));
    if (color === "RED") bulbs[0].classList.add("on");
    if (color === "YELLOW") bulbs[1].classList.add("on");
    if (color === "GREEN") bulbs[2].classList.add("on");
  }

  _renderLights() {
    const p = this.signal.phase;
    const ew = p === "EW_GREEN" ? "GREEN" : (p === "EW_YELLOW" ? "YELLOW" : "RED");
    const ns = p === "NS_GREEN" ? "GREEN" : (p === "NS_YELLOW" ? "YELLOW" : "RED");

    this._setLight(this.lights.W, ew);
    this._setLight(this.lights.E, ew);
    this._setLight(this.lights.N, ns);
    this._setLight(this.lights.S, ns);

    this._renderExitButtons();
  }
}
