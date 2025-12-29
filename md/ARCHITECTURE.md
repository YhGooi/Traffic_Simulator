# Traffic Simulator - Research-Grade Modular Architecture

## Architecture Overview

This traffic simulator has been refactored to support a **layered, energy-aware, and scalable software architecture** suitable for Master's-level Software Engineering research. The system follows these architectural layers:

### 1. Sensing & Data Ingestion Layer
- **Lane Module** (`lane.js`): Manages vehicle queues, capacity tracking, and lane state
- **Vehicle Module** (`vehicle.js`): Tracks position, speed, and waiting time

### 2. Traffic Analytics Layer
- **Junction/Intersection Module** (`junction.js`): Aggregates lane data and intersection metrics
- **World Module** (`world.js`): Coordinates global traffic state and statistics

### 3. Energy-Aware Optimization Engine
- Emissions tracking (CO₂ calculations based on idle time and distance)
- Fuel consumption modeling
- Energy efficiency metrics

### 4. Signal Control & Monitoring Layer
- **TrafficSignal Module** (`signal.js`): Finite state machine for signal control
- Phase management and timing control
- State monitoring and history tracking

### 5. Simulation Core
- **SimulationEngine Module** (`simulationEngine.js`): Core simulation logic separated from UI
- Collision avoidance and queuing algorithms
- Performance metrics tracking

### 6. Presentation Layer
- **UI Module** (`ui.js`): Rendering and visualization
- **App Module** (`app.js`): User interaction and control

---

## Module Descriptions

### Lane (`js/lane.js`)
Represents a single traffic lane with vehicle queue management.

**Key Features:**
- Vehicle queue tracking (ordered from leader to follower)
- Capacity management
- Occupancy rate calculation
- Average waiting time computation
- Programmatic state access via `getState()`

**API:**
```javascript
const lane = new Lane({
  id: 'junction_0,0_W',
  axis: 'H',
  sign: +1,
  laneCoord: 150,
  entryPoint: {x: 100, y: 150},
  exitPoint: {x: 500, y: 150},
  capacity: 10
});

lane.addVehicle(vehicle);
const state = lane.getState(currentSimTime);
console.log(state.occupancyRate, state.averageWaitTime);
```

### Vehicle (`js/vehicle.js`)
Represents a vehicle with simulation state separated from rendering.

**Key Features:**
- Position and speed tracking
- Waiting time accumulation
- State machine for waiting/moving
- Null-safe rendering (supports headless simulation)
- Programmatic state access via `getState()`

**API:**
```javascript
const vehicle = new Vehicle({cfg, ui, world, route});

// Get current state
const state = vehicle.getState(currentSimTime);
console.log(state.position, state.speed, state.waitingTime, state.isWaiting);

// Check if vehicle is waiting
if (vehicle.isCurrentlyWaiting()) {
  console.log('Vehicle stopped at signal');
}
```

### TrafficSignal (`js/signal.js`)
Finite state machine for traffic signal control.

**States:** RED, YELLOW, GREEN
**Phases:** EW_GREEN, EW_YELLOW, NS_GREEN, NS_YELLOW, ALL_RED

**Key Features:**
- Explicit state machine with clear transitions
- Phase history tracking
- Programmatic state access via `getStateSnapshot()`
- Pause/resume support

**API:**
```javascript
const signal = new SignalController(config);

signal.start();
signal.update(deltaMs);

// Get signal state
const state = signal.getStateSnapshot();
console.log(state.phase, state.horizontalState, state.verticalState);

// Check if can cross
if (signal.canCross('H')) {
  console.log('Horizontal traffic can proceed');
}
```

### Junction/Intersection (`js/junction.js`)
Represents a traffic intersection with lanes and signal control.

**Key Features:**
- Lane collection management (N, S, E, W lanes)
- Signal controller integration
- Intersection-level metrics
- Programmatic state access via `getState()`

**API:**
```javascript
const junction = new Junction({cfg, ui, geom, r, c});

// Get lanes
const lanes = junction.getLanes();
const westLane = junction.getLane('W');

// Get intersection state
const state = junction.getState(currentSimTime);
console.log(state.totalVehicles, state.signalState);

// Get metrics
const metrics = junction.getMetrics();
console.log(metrics.averageOccupancyRate, metrics.utilizationRate);
```

### SimulationEngine (`js/simulationEngine.js`)
Core simulation logic separated from UI rendering.

**Key Features:**
- Headless simulation support (UI-independent)
- Signal update management
- Vehicle movement planning
- Collision avoidance and queuing
- Performance metrics
- Programmatic state access via `getState()`

**API:**
```javascript
const engine = new SimulationEngine({config: CFG});
engine.initialize(junctions, vehicles);

// Update simulation
engine.update(dt, deltaMs);

// Control simulation
engine.pause();
engine.resume();
engine.stop();

// Get complete state
const state = engine.getState();
console.log(state.junctions, state.vehicles, state.vehicleCount);

// Get performance metrics
const perf = engine.getPerformanceMetrics();
console.log(perf.averageStepTime, perf.fps);
```

### World (`js/world.js`)
Coordinates between simulation engine and UI rendering.

**Key Features:**
- Junction and vehicle management
- Route generation and spawning
- Statistics and telemetry
- Energy/emissions tracking
- Integration with SimulationEngine

**API:**
```javascript
const world = new World({cfg, ui, rows, cols, worldEl});

// Add junction
world.addJunction(row, col);

// Spawn vehicle
world.spawnVehicleRandom();

// Update simulation
world.update(dt, deltaMs);

// Get stats
const stats = world.getStatsSnapshot();

// Get simulation state (delegates to engine)
const simState = world.getSimulationState();
```

---

## Separation of Concerns

### Simulation Logic vs. UI Rendering

The architecture clearly separates simulation logic from UI rendering:

**Simulation State:**
- Managed by `SimulationEngine`, `Vehicle`, `Lane`, `Junction`
- Accessible programmatically without UI
- Can run headless (no UI elements required)

**UI Rendering:**
- Handled by `UI` module and DOM element management
- Vehicle class checks for `this.el` existence before UI operations
- Junction rendering is separate from state management

**Example - Headless Simulation:**
```javascript
// Create vehicle without UI
const vehicle = new Vehicle({
  cfg: config,
  ui: null,  // No UI
  world: world,
  route: route
});

// Vehicle still tracks state
vehicle.planStep(dt);
vehicle.applyStep();
const state = vehicle.getState(simTime);
console.log('Position:', state.position);
```

---

## Energy-Aware Features

### CO₂ Emissions Tracking
- Idle emissions: Based on gallons/hour and CO₂ per gallon
- Movement emissions: Based on distance traveled and CO₂ per km
- Real-time emission rates
- Per-vehicle and aggregate tracking

### Configuration (in `config.js`):
```javascript
PX_PER_M: 10,           // Pixels per meter
CO2_PER_KM: 249,        // Grams CO₂ per km
IDLE_GAL_PER_HR: 0.35,  // Gallons per hour when idling
CO2_G_PER_GAL: 8887     // Grams CO₂ per gallon
```

### Metrics Available:
- Total CO₂ emitted (grams)
- CO₂ emission rate (g/min)
- Average CO₂ per trip
- Idle time percentage
- Total distance traveled

---

## Scalability Support

### Multi-Intersection Simulation
- Grid-based junction layout (configurable rows × cols)
- Dynamic junction addition
- Routing between arbitrary intersections
- BFS pathfinding for vehicle routes

### Performance Considerations
- Efficient lane grouping for collision detection
- Spatial partitioning by lane
- Bounded history (phase history, completion timestamps)
- Sub-step updates for stability

---

## Programmatic State Access

All major components provide programmatic state access:

```javascript
// Get complete simulation state
const worldState = world.getSimulationState();
console.log(JSON.stringify(worldState, null, 2));

// Output structure:
{
  "simTimeMs": 125000,
  "isRunning": true,
  "isPaused": false,
  "junctions": [
    {
      "id": "0,0",
      "position": {"r": 0, "c": 0},
      "signalState": {
        "phase": "EW_GREEN",
        "horizontalState": "GREEN",
        "verticalState": "RED",
        "remainingMs": 2500
      },
      "lanes": {
        "W": {
          "vehicleCount": 3,
          "occupancyRate": 0.3,
          "averageWaitTime": 1200
        }
      },
      "totalVehicles": 7
    }
  ],
  "vehicles": [
    {
      "position": {"x": 250, "y": 150},
      "speed": 1.4,
      "waitingTime": 3500,
      "isWaiting": false
    }
  ],
  "vehicleCount": 15,
  "junctionCount": 4
}
```

---

## Usage for Research

### Data Collection
All simulation state is accessible programmatically for research analysis:

```javascript
// Collect data every N frames
setInterval(() => {
  const state = world.getSimulationState();
  const stats = world.getStatsSnapshot();
  
  // Store for analysis
  dataCollector.record({
    timestamp: state.simTimeMs,
    vehicleCount: state.vehicleCount,
    avgWaitTime: stats.avgTripTime,
    co2Rate: stats.co2RateGPerMin,
    throughput: stats.currentThroughputPerHour
  });
}, 1000);
```

### Energy Analysis
```javascript
const stats = world.getStatsSnapshot();

console.log('Energy Metrics:');
console.log(`Total CO₂: ${stats.totalCo2G} grams`);
console.log(`CO₂ Rate: ${stats.co2RateGPerMin} g/min`);
console.log(`Avg CO₂ per Trip: ${stats.completedCo2G / stats.totalCompleted} g`);
console.log(`Stop Percentage: ${(stats.totalIdleMs / (stats.totalIdleMs + stats.totalMovingMs)) * 100}%`);
```

### Signal Optimization Research
```javascript
// Access signal timing and adjust for experiments
const junction = world.junctions.get('0,0');
const signalState = junction.signal.getStateSnapshot();

// Modify timing (research scenarios)
junction.signal.cfg.GREEN_MS = 5000;  // Longer green
junction.signal.cfg.ALLRED_MS = 1000; // Shorter all-red

// Track phase history
console.log(signalState.cycleHistory);
```

---

## File Structure

```
Traffic_Simulator/
├── index.html                  # Entry point
├── style.css                   # Styling
├── README.md                   # Original readme
├── ARCHITECTURE.md             # This file
└── js/
    ├── app.js                  # Application entry, UI integration
    ├── config.js               # Configuration parameters
    ├── lane.js                 # ✨ NEW: Lane management
    ├── vehicle.js              # ✨ ENHANCED: State tracking
    ├── signal.js               # ✨ ENHANCED: State machine
    ├── junction.js             # ✨ ENHANCED: Intersection with lanes
    ├── simulationEngine.js     # ✨ NEW: Core simulation logic
    ├── world.js                # ✨ ENHANCED: Coordinator with engine
    ├── ui.js                   # UI rendering
    ├── utils.js                # Utility functions
    ├── geometry.js             # Geometric calculations
    └── router.js               # Pathfinding
```

---

## Testing the Architecture

### 1. Verify Modular State Access
```javascript
// In browser console
const junction = world.junctions.values().next().value;
console.log(junction.getState(world.simTimeMs));
console.log(junction.getMetrics());
```

### 2. Test Headless Simulation
```javascript
// Vehicle without UI still works
const testVehicle = new Vehicle({
  cfg: CFG,
  ui: null,
  world: world,
  route: testRoute
});
```

### 3. Verify Energy Tracking
```javascript
// Check emissions calculations
const stats = world.getStatsSnapshot();
console.log('CO₂ per km:', stats.totalCo2G / (stats.totalDistancePx / CFG.PX_PER_M / 1000));
```

---

## Future Extensions

The modular architecture supports:
1. **Machine Learning Integration**: Train on simulation state snapshots
2. **Adaptive Signal Control**: Implement RL-based timing optimization
3. **Multi-Agent Systems**: Add vehicle-to-vehicle communication
4. **Energy Optimization**: Experiment with eco-routing algorithms
5. **Scalability Testing**: Benchmark with large grids (10×10+)

---

## References

**Architectural Principles Applied:**
- Separation of Concerns (SoC)
- Single Responsibility Principle (SRP)
- Dependency Inversion (SimulationEngine ← World)
- Observer Pattern (Signal listeners)
- State Pattern (TrafficSignal FSM)

**Research Context:**
This architecture supports the research prototype for "An Energy-Aware Scalable Architecture for Optimizing Traffic Signal Timing in Smart Cities" by providing:
- Clear layered architecture
- Energy-aware metrics
- Scalable multi-intersection support
- Programmatic state access for analytics
- Modular components for experimentation
