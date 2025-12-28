import { keyRC } from "./utils.js";

export class Router {
  constructor(world) { this.world = world; }

  neighbors(rc) {
    const [r, c] = rc.split(",").map(Number);
    const out = [];
    const deltas = [[-1,0],[1,0],[0,-1],[0,1]];
    for (const [dr, dc] of deltas) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= this.world.rows || nc >= this.world.cols) continue;
      const k = keyRC(nr, nc);
      if (this.world.junctions.has(k)) out.push(k);
    }
    return out;
  }

  bfsPath(start, goal) {
    if (start === goal) return [start];
    const q = [start];
    const prev = new Map();
    prev.set(start, null);

    while (q.length) {
      const cur = q.shift();
      for (const nb of this.neighbors(cur)) {
        if (prev.has(nb)) continue;
        prev.set(nb, cur);
        if (nb === goal) {
          const path = [];
          let x = nb;
          while (x !== null) { path.push(x); x = prev.get(x); }
          path.reverse();
          return path;
        }
        q.push(nb);
      }
    }
    return null;
  }
}
