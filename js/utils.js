export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const nowMs = () => performance.now();
export const keyRC = (r, c) => `${r},${c}`;

export const DIRS = Object.freeze(["N", "E", "S", "W"]);

export function oppositeDir(d) {
  if (d === "N") return "S";
  if (d === "S") return "N";
  if (d === "E") return "W";
  return "E";
}
