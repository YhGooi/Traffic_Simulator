export class UI {
  constructor(root, opts = {}) {
    this.root = root;

    // The "playground" container (the visible viewport). By default, it's the parent of #world.
    this.container = opts.container || root.parentElement;

    this.zoomSlider = opts.zoomSlider || document.getElementById("zoomSlider");

    const sliderMin = this.zoomSlider ? parseFloat(this.zoomSlider.min) : NaN;
    const sliderMax = this.zoomSlider ? parseFloat(this.zoomSlider.max) : NaN;
    const sliderVal = this.zoomSlider ? parseFloat(this.zoomSlider.value) : NaN;

    this.minZoom = Number.isFinite(sliderMin) ? sliderMin : 0.25;
    this.maxZoom = Number.isFinite(sliderMax) ? sliderMax : 3.0;

    this.zoom = Number.isFinite(sliderVal) ? sliderVal : 1.0;
    this.panX = 0;
    this.panY = 0;

    this.worldW = 0;
    this.worldH = 0;

    // Ensure transforms behave predictably
    this.root.style.transformOrigin = "0 0";

    this._applyTransform();
    this._bindInteractions();
  }

  // Called by World when it knows the base (unscaled) world size
  setWorldSize(w, h) {
    this.worldW = w;
    this.worldH = h;
  }

  getContainerCenter() {
    if (!this.container) return { x: 0, y: 0 };
    return { x: this.container.clientWidth / 2, y: this.container.clientHeight / 2 };
  }

  center() {
    if (!this.container || !this.worldW || !this.worldH) return;

    const c = this.getContainerCenter();
    this.panX = c.x - (this.worldW * this.zoom) / 2;
    this.panY = c.y - (this.worldH * this.zoom) / 2;
    this._applyTransform();
  }

  setZoom(scale, anchor = null) {
    const oldZoom = this.zoom;
    const next = this._clamp(Number(scale), this.minZoom, this.maxZoom);
    if (!Number.isFinite(next)) return;

    if (anchor && Number.isFinite(anchor.x) && Number.isFinite(anchor.y)) {
      // Keep the world point under the cursor stable while zooming.
      const worldX = (anchor.x - this.panX) / oldZoom;
      const worldY = (anchor.y - this.panY) / oldZoom;

      this.zoom = next;
      this.panX = anchor.x - worldX * this.zoom;
      this.panY = anchor.y - worldY * this.zoom;
    } else {
      this.zoom = next;
    }

    if (this.zoomSlider) this.zoomSlider.value = String(this.zoom);
    this._applyTransform();
  }

  clear() {
    this.root.innerHTML = "";
  }

  addDiv(className, style = {}, parent = this.root) {
    const el = document.createElement("div");
    el.className = className;
    Object.assign(el.style, style);
    parent.appendChild(el);
    return el;
  }

  // -------------------------
  // Internal helpers
  // -------------------------

  _bindInteractions() {
    if (!this.container) return;

    // Wheel zoom (only when hovering the playground)
    this.container.addEventListener(
      "wheel",
      (e) => {
        // Don't zoom if user is interacting with a UI control inside the playground
        if (e.target && e.target.closest && e.target.closest("button, input, select, textarea, label")) return;

        e.preventDefault();

        // Smooth zoom factor: deltaY > 0 => zoom out, deltaY < 0 => zoom in
        const factor = Math.exp(-e.deltaY * 0.0015);

        const rect = this.container.getBoundingClientRect();
        const anchor = { x: e.clientX - rect.left, y: e.clientY - rect.top };

        this.setZoom(this.zoom * factor, anchor);
      },
      { passive: false }
    );

    // Click + drag pan
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startPanX = 0;
    let startPanY = 0;

    const onDown = (e) => {
      if (e.button !== 0) return; // left mouse only
      if (e.target && e.target.closest && e.target.closest("button, input, select, textarea, label")) return;

      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startPanX = this.panX;
      startPanY = this.panY;

      this.container.classList.add("grabbing");
      e.preventDefault();
    };

    const onMove = (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      this.panX = startPanX + dx;
      this.panY = startPanY + dy;
      this._applyTransform();
    };

    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      this.container.classList.remove("grabbing");
    };

    this.container.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);

    // Prevent default drag behaviors (e.g., dragging images)
    this.container.addEventListener("dragstart", (e) => e.preventDefault());
  }

  _applyTransform() {
    // translate in screen pixels, then scale
    this.root.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
  }

  _clamp(v, min, max) {
    if (!Number.isFinite(v)) return NaN;
    return Math.max(min, Math.min(max, v));
  }
}
