/**
 * Vehicle Module
 * Represents a vehicle in the traffic simulation with position, speed, and waiting time tracking.
 * Separates simulation state from UI rendering for research-grade analytics.
 */

import { oppositeDir } from "./utils.js";

export class Vehicle {
  constructor({ cfg, ui, world, route }) {
    this.cfg = cfg;
    this.ui = ui;
    this.world = world;
    
    // Generate unique ID for this vehicle
    this.id = `v_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.route = route; // { nodes[], entryFrom, moves[] }
    this.waypoints = this._buildWaypointsFromRoute(route);
    this.wpIdx = 0;

    // Simulation state (position)
    this.x = this.waypoints[0].x;
    this.y = this.waypoints[0].y;
    
    // Simulation state (velocity and movement)
    this.speed = 0; // current speed in px/frame
    this.targetSpeed = cfg.CAR_SPEED;
    
    // Simulation state (waiting time tracking)
    this.totalWaitingTime = 0; // accumulated waiting time in ms
    this.lastUpdateTime = 0; // last update timestamp
    this.isWaiting = false; // currently waiting flag
    this.stoppedAtSignalTime = null; // timestamp when stopped at signal

    // UI element (can be null for headless simulation)
    this.el = ui ? ui.addDiv("car h", { left: `${this.x}px`, top: `${this.y}px` }) : null;

    // Use rendered size so collision/stopline checks match the pixels on screen.
    const w = this.el ? (this.el.offsetWidth || 0) : cfg.CAR_LEN;
    const h = this.el ? (this.el.offsetHeight || 0) : cfg.CAR_LEN;
    this.len = Math.max(this.cfg.CAR_LEN, w, h);

    this.committedJunction = null;
    this.plan = null;
  }

  destroy() { 
    if (this.el) this.el.remove(); 
  }

  /**
   * Get current position
   * @returns {{x: number, y: number}}
   */
  getPosition() {
    return { x: this.x, y: this.y };
  }

  /**
   * Get current speed (in px/frame or px/ms depending on usage)
   * @returns {number}
   */
  getSpeed() {
    return this.speed;
  }

  /**
   * Get total waiting time accumulated (ms)
   * @param {number} currentSimTime - Optional current simulation time to add current wait
   * @returns {number} Total waiting time in milliseconds
   */
  getWaitingTime(currentSimTime) {
    let total = this.totalWaitingTime;
    
    // If currently waiting, add the current waiting duration
    if (this.isWaiting && this.stoppedAtSignalTime !== null && currentSimTime) {
      total += (currentSimTime - this.stoppedAtSignalTime);
    }
    
    return total;
  }

  /**
   * Check if vehicle is currently stopped/waiting
   * @returns {boolean}
   */
  isCurrentlyWaiting() {
    return this.isWaiting;
  }

  /**
   * Get programmatic state snapshot for analytics
   * @param {number} currentSimTime - Current simulation time
   * @returns {Object} Vehicle state
   */
  getState(currentSimTime) {
    return {
      position: this.getPosition(),
      speed: this.getSpeed(),
      waitingTime: this.getWaitingTime(currentSimTime),
      isWaiting: this.isCurrentlyWaiting(),
      waypointIndex: this.wpIdx,
      totalWaypoints: this.waypoints.length,
      routeCompleted: this.wpIdx >= this.waypoints.length - 1,
      committedJunction: this.committedJunction
    };
  }

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
    if (!this.el) return; // Skip if no UI element
    
    let deg = 0;
    if (axis === "H") deg = sign > 0 ? 0 : 180;
    else deg = sign > 0 ? 90 : 270;

    this.el.style.transform = `rotate(${deg}deg)`;
    this.el.classList.toggle("h", axis === "H");
    this.el.classList.toggle("v", axis === "V");
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
    this.speed = this.cfg.CAR_SPEED; // Set current speed
    
    let nx = this.x + (axis === "H" ? sign * step : 0);
    let ny = this.y + (axis === "V" ? sign * step : 0);

    let blockedAtStop = false;

    // Stop only at entry waypoint (junctionId != null)
    const targetJunctionId = p1.junctionId;
    if (targetJunctionId) {
      const j = this.world.junctions.get(targetJunctionId);
      const stop = axis === "H" ? p1.x : p1.y;
      const green = j.signal.isGreen(axis);

      // must stop before stop line if not green (yellow/red/all-red)
      if (this.committedJunction !== targetJunctionId && !green) {
        if (axis === "H") {
          const front = sign > 0 ? (nx + this.len) : nx;
          const wouldCross = sign > 0 ? (front >= stop) : (front <= stop);
          if (wouldCross) {
            nx = sign > 0 ? (stop - this.len) : stop;
            blockedAtStop = true;
            this.speed = 0; // Vehicle is stopped
          }
        } else {
          const front = sign > 0 ? (ny + this.len) : ny;
          const wouldCross = sign > 0 ? (front >= stop) : (front <= stop);
          if (wouldCross) {
            ny = sign > 0 ? (stop - this.len) : stop;
            blockedAtStop = true;
            this.speed = 0; // Vehicle is stopped
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
      blockedByLeader: false,
    };
  }

  applyStep() {
    if (!this.plan || this.plan.done) return;

    const { axis, sign, p1, blockedAtStop, blockedByLeader } = this.plan;

    // Update waiting state tracking
    const wasMoving = (Math.abs(this.plan.nx - this.x) > 0.001) || (Math.abs(this.plan.ny - this.y) > 0.001);
    const isBlocked = blockedAtStop || blockedByLeader;
    
    if (isBlocked && !this.isWaiting) {
      // Just started waiting
      this.isWaiting = true;
      this.stoppedAtSignalTime = this.world.simTimeMs || 0;
    } else if (!isBlocked && this.isWaiting) {
      // Just stopped waiting, accumulate the waiting time
      if (this.stoppedAtSignalTime !== null) {
        const currentTime = this.world.simTimeMs || 0;
        this.totalWaitingTime += (currentTime - this.stoppedAtSignalTime);
      }
      this.isWaiting = false;
      this.stoppedAtSignalTime = null;
    }

    this.x = this.plan.nx;
    this.y = this.plan.ny;

    // If clamped at red/yellow OR behind a leader, do NOT advance waypoint
    if (!blockedAtStop && !blockedByLeader) {
      if (axis === "H") {
        if ((sign > 0 && this.x >= p1.x) || (sign < 0 && this.x <= p1.x)) this.wpIdx++;
      } else {
        if ((sign > 0 && this.y >= p1.y) || (sign < 0 && this.y <= p1.y)) this.wpIdx++;
      }
    }

    // Update UI only if element exists
    if (this.el) {
      this.el.style.left = `${Math.round(this.x)}px`;
      this.el.style.top = `${Math.round(this.y)}px`;
    }
  }
}
