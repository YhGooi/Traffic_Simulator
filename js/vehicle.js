import { oppositeDir } from "./utils.js";

export class Vehicle {
  constructor({ cfg, ui, world, route }) {
    this.cfg = cfg;
    this.ui = ui;
    this.world = world;

    this.route = route; // { nodes[], entryFrom, moves[] }
    this.waypoints = this._buildWaypointsFromRoute(route);
    this.wpIdx = 0;

    this.x = this.waypoints[0].x;
    this.y = this.waypoints[0].y;

    this.el = ui.addDiv("car h", { left: `${this.x}px`, top: `${this.y}px` });

    // Use rendered size so collision/stopline checks match the pixels on screen.
    const w = this.el.offsetWidth || 0;
    const h = this.el.offsetHeight || 0;
    this.len = Math.max(this.cfg.CAR_LEN, w, h);

    this.committedJunction = null;
    this.plan = null;
  }

  destroy() { this.el.remove(); }

  _buildWaypointsFromRoute(route) {
    const { nodes, entryFrom, moves } = route;
    const pts = [];

    if (!nodes || nodes.length === 0) return [{ x: 0, y: 0, junctionId: null }];

    // First entry point
    const firstId = nodes[0];
    const firstJ = this.world.junctions.get(firstId);
    const firstEntry = firstJ.lanePointForApproach(entryFrom);

    // Spawn outside along same incoming lane line
    const spawn = { x: firstEntry.x, y: firstEntry.y, junctionId: null };
    if (firstEntry.axis === "H") spawn.x -= firstEntry.sign * this.cfg.SPAWN_PAD;
    else spawn.y -= firstEntry.sign * this.cfg.SPAWN_PAD;
    pts.push(spawn);

    // For each node, create entry + pivot(if turn) + exit
    for (let i = 0; i < nodes.length; i++) {
      const curId = nodes[i];
      const curJ = this.world.junctions.get(curId);

      const approachFrom = (i === 0) ? entryFrom : oppositeDir(moves[i - 1]);
      const exitDir = moves[i];

      const entry = curJ.lanePointForApproach(approachFrom);
      const exit = curJ.lanePointForExit(exitDir);

      // stoppable entry point (stop line)
      pts.push({ x: entry.x, y: entry.y, junctionId: curId });

      if (entry.axis === exit.axis) {
        // straight / same-axis
        pts.push({ x: exit.x, y: exit.y, junctionId: null });
      } else {
        // pivot = intersection of lane lines (guarantees perfect lane merge)
        const pivot =
          (entry.axis === "H" && exit.axis === "V")
            ? { x: exit.x,  y: entry.y }
            : { x: entry.x, y: exit.y };

        pts.push({ x: pivot.x, y: pivot.y, junctionId: null });
        pts.push({ x: exit.x,  y: exit.y,  junctionId: null });
      }

      // If this is the last node AND exitDir leaves outside -> extend outside end
      const nextId = this.world._neighborInDir(curId, exitDir);
      if (i === nodes.length - 1 && !nextId) {
        const end = { x: exit.x, y: exit.y, junctionId: null };
        if (exit.axis === "H") end.x += exit.sign * this.cfg.SPAWN_PAD;
        else end.y += exit.sign * this.cfg.SPAWN_PAD;
        pts.push(end);
      }
    }

    // de-dupe consecutive
    const cleaned = [];
    for (const p of pts) {
      const last = cleaned[cleaned.length - 1];
      if (
        !last ||
        Math.abs(last.x - p.x) > 0.01 ||
        Math.abs(last.y - p.y) > 0.01 ||
        last.junctionId !== p.junctionId
      ) cleaned.push(p);
    }
    return cleaned;
  }

  _applyRotation(axis, sign) {
    let deg = 0;
    if (axis === "H") deg = sign > 0 ? 0 : 180;
    else deg = sign > 0 ? 90 : 270;

    this.el.style.transform = `rotate(${deg}deg)`;
    this.el.classList.toggle("h", axis === "H");
    this.el.classList.toggle("v", axis === "V");
  }

  /**
   * Check if there's sufficient space in the downstream lane after crossing this junction
   * @param {string} targetJunctionId - Junction about to cross
   * @param {string} axis - Movement axis (H or V)
   * @param {number} sign - Movement direction sign
   * @returns {boolean} - True if safe to proceed, false if lane is congested
   */
  _hasSpaceDownstream(targetJunctionId, axis, sign) {
    // Find the next waypoint after the junction
    const nextWpIdx = this.wpIdx + 2; // +1 is junction entry, +2 is after junction
    if (nextWpIdx >= this.waypoints.length) return true; // At end of route, always proceed

    const nextWaypoint = this.waypoints[nextWpIdx];
    const junction = this.world.junctions.get(targetJunctionId);
    if (!junction) return true;

    // Define the downstream lane area to check
    const checkDistance = 150; // Check 150px ahead (about 5-6 car lengths)
    const laneTolerance = 35; // Lane width tolerance
    
    // Determine the downstream lane coordinate
    const laneCoord = axis === "H" ? nextWaypoint.y : nextWaypoint.x;
    
    // Count vehicles in the downstream lane segment
    let vehiclesInLane = 0;
    const maxVehiclesAllowed = 4; // Allow max 4 vehicles in the checked segment
    
    for (const v of this.world.vehicles) {
      if (v === this || !v.plan || v.plan.done) continue;
      
      // Check if vehicle is in the same lane
      const vLaneCoord = axis === "H" ? v.y : v.x;
      const vPosition = axis === "H" ? v.x : v.y;
      const myPosition = axis === "H" ? this.x : this.y;
      
      const onSameLane = Math.abs(vLaneCoord - laneCoord) < laneTolerance;
      if (!onSameLane) continue;
      
      // Check if vehicle is ahead in the downstream direction
      const isAhead = sign > 0 ? (vPosition > myPosition && vPosition < myPosition + checkDistance) :
                               (vPosition < myPosition && vPosition > myPosition - checkDistance);
      
      if (isAhead) {
        vehiclesInLane++;
        if (vehiclesInLane >= maxVehiclesAllowed) {
          return false; // Lane is too congested
        }
      }
    }
    
    return true; // Safe to proceed
  }



  planStep(dt) {
    if (this.wpIdx >= this.waypoints.length - 1) {
      this.plan = { done: true };
      return;
    }

    const p0 = this.waypoints[this.wpIdx];
    const p1 = this.waypoints[this.wpIdx + 1];

    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;

    const axis = Math.abs(dx) > Math.abs(dy) ? "H" : "V";
    const sign = axis === "H" ? Math.sign(dx) : Math.sign(dy);

    this._applyRotation(axis, sign);

    // movement step uses dt (which already accounts for simulation speed)
    const step = this.cfg.CAR_SPEED * dt;
    let nx = this.x + (axis === "H" ? sign * step : 0);
    let ny = this.y + (axis === "V" ? sign * step : 0);

    let blockedAtStop = false;
    let blockedByDownstreamCongestion = false;

    // Stop only at entry waypoint (junctionId != null)
    const targetJunctionId = p1.junctionId;
    if (targetJunctionId) {
      const j = this.world.junctions.get(targetJunctionId);
      const stop = axis === "H" ? p1.x : p1.y;
      const green = j.signal.isGreen(axis);

      // Check if downstream lane has space even if light is green
      const hasDownstreamSpace = this._hasSpaceDownstream(targetJunctionId, axis, sign);

      // Stop if: (1) not already committed AND (2) light is not green OR downstream is blocked
      if (this.committedJunction !== targetJunctionId && (!green || !hasDownstreamSpace)) {
        if (axis === "H") {
          const front = sign > 0 ? (nx + this.len) : nx;
          const wouldCross = sign > 0 ? (front >= stop) : (front <= stop);
          if (wouldCross) {
            nx = sign > 0 ? (stop - this.len) : stop;
            blockedAtStop = !green;
            blockedByDownstreamCongestion = green && !hasDownstreamSpace;
          }
        } else {
          const front = sign > 0 ? (ny + this.len) : ny;
          const wouldCross = sign > 0 ? (front >= stop) : (front <= stop);
          if (wouldCross) {
            ny = sign > 0 ? (stop - this.len) : stop;
            blockedAtStop = !green;
            blockedByDownstreamCongestion = green && !hasDownstreamSpace;
          }
        }
      }

      // Commit after crossing stop line (car should not stop after crossing)
      if (this.committedJunction !== targetJunctionId) {
        if (axis === "H") {
          const front = sign > 0 ? (nx + this.len) : nx;
          const crossed = sign > 0 ? (front > stop + this.cfg.EPS) : (front < stop - this.cfg.EPS);
          if (crossed) this.committedJunction = targetJunctionId;
        } else {
          const front = sign > 0 ? (ny + this.len) : ny;
          const crossed = sign > 0 ? (front > stop + this.cfg.EPS) : (front < stop - this.cfg.EPS);
          if (crossed) this.committedJunction = targetJunctionId;
        }
      }
    }

    const laneCoord = axis === "H" ? p0.y : p0.x;

    this.plan = {
      done: false,
      axis,
      sign,
      laneCoord,
      p1,
      nx,
      ny,
      blockedAtStop,
      blockedByDownstreamCongestion,
      blockedByLeader: false,
    };
  }

  applyStep() {
    if (!this.plan || this.plan.done) return;

    const { axis, sign, p1, blockedAtStop, blockedByDownstreamCongestion, blockedByLeader } = this.plan;

    this.x = this.plan.nx;
    this.y = this.plan.ny;

    // If clamped at red/yellow OR behind a leader OR blocked by downstream congestion, do NOT advance waypoint
    if (!blockedAtStop && !blockedByLeader && !blockedByDownstreamCongestion) {
      if (axis === "H") {
        if ((sign > 0 && this.x >= p1.x) || (sign < 0 && this.x <= p1.x)) this.wpIdx++;
      } else {
        if ((sign > 0 && this.y >= p1.y) || (sign < 0 && this.y <= p1.y)) this.wpIdx++;
      }
    }

    this.el.style.left = `${Math.round(this.x)}px`;
    this.el.style.top = `${Math.round(this.y)}px`;
  }
}
