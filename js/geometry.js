export class GridGeometry {
  constructor(cfg, rows, cols) {
    this.cfg = cfg;
    this.rows = rows;
    this.cols = cols;
    this.originX = cfg.ORIGIN_PAD_X;
    this.originY = cfg.ORIGIN_PAD_Y;
  }

  worldSize() {
    return {
      w: this.originX * 2 + this.cols * this.cfg.CELL_W,
      h: this.originY * 2 + this.rows * this.cfg.CELL_H,
    };
  }

  cellTopLeft(r, c) {
    return {
      x: this.originX + c * this.cfg.CELL_W,
      y: this.originY + r * this.cfg.CELL_H,
    };
  }

  cellCenter(r, c) {
    const tl = this.cellTopLeft(r, c);
    return { x: tl.x + this.cfg.CELL_W / 2, y: tl.y + this.cfg.CELL_H / 2 };
  }

  junctionBoxAt(r, c) {
    const { x: cx, y: cy } = this.cellCenter(r, c);
    const half = this.cfg.JUNC_SIZE / 2;
    const innerHalf = half - this.cfg.JUNC_BORDER;

    return {
      cx, cy,
      left: cx - half,
      right: cx + half,
      top: cy - half,
      bottom: cy + half,
      innerLeft: cx - innerHalf,
      innerRight: cx + innerHalf,
      innerTop: cy - innerHalf,
      innerBottom: cy + innerHalf,
    };
  }
}
