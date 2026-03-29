// ─── 仿真状态与物理步进 ────────────────────────────────────────────────────────
// 依赖：intersection.config.js，intersection.geometry.js，intersection.models.js

// ── 全局仿真状态 ───────────────────────────────────────────────────────────────

const state = {
    running:    false,
    simTime:    0,
    lastFrame:  0,
    accumulator: 0,
    vehicleId:  1,
    vehicles:   [],
    lanes:      {},
    signal:     new TrafficSignal(),
    queueDetectors: {
        N: new QueueDetector("N"),
        E: new QueueDetector("E"),
        S: new QueueDetector("S"),
        W: new QueueDetector("W"),
    },
    performance: new PerformanceMonitor(),
    generator:   {},
    pendingArrivals: {},
    armFlow:     { N: 800, E: 600, S: 800, W: 400 },
    laneShares:  { left: 0.2, straight: 0.6, right: 0.2 },
    baseVehicleParams: {
        v0: 13.89,   // m/s（≈50 km/h）
        T: 1.5,
        a: 1.2,
        b: 2.0,
        s0: 2.0,
    },
    crossingReservations: [],
    overlays:    [],
    spaceTime:   [],
    demo: {
        greenWave: false,
        greenWaveSnapshot: null,
        oversat:   false,
    },
};

// ── 车道桶 ────────────────────────────────────────────────────────────────────

function resetLaneBuckets() {
    state.lanes = {};
    for (const arm of DIRS) {
        for (const lane of ["left", "straight", "right"]) {
            state.lanes[laneId(arm, lane)] = [];
        }
    }
}

function rebuildLaneBuckets() {
    resetLaneBuckets();
    for (const vehicle of state.vehicles) {
        if (vehicle.segment === "inbound") {
            state.lanes[vehicle.laneKey].push(vehicle);
        }
    }
    for (const key of Object.keys(state.lanes)) {
        state.lanes[key].sort((a, b) => a.pos - b.pos);
    }
}

// ── 到达生成 ──────────────────────────────────────────────────────────────────

function getLaneArrivalRate(arm, turn) {
    return (state.armFlow[arm] * state.laneShares[turn]) / 3600;
}

function resetGenerators() {
    state.generator = {};
    state.pendingArrivals = {};
    for (const arm of DIRS) {
        for (const turn of ["left", "straight", "right"]) {
            const key = laneId(arm, turn);
            state.generator[key] = state.simTime + expSample(getLaneArrivalRate(arm, turn));
            state.pendingArrivals[key] = 0;
        }
    }
}

function spawnVehicle(arm, turn) {
    const key = laneId(arm, turn);
    const laneVehicles = state.lanes[key];
    if (laneVehicles.length >= CONFIG.maxVehiclesPerLane) {
        state.overlays.push({
            type: "overflow",
            messageKey: "overlay.overflow",
            messageParams: { arm },
            ttl: 3.5
        });
        return false;
    }
    const first = laneVehicles[0];
    if (first && first.pos < 10) return false;
    const vehicle = new Vehicle(state.vehicleId++, arm, turn, state.simTime, state.baseVehicleParams);
    state.vehicles.push(vehicle);
    laneVehicles.unshift(vehicle);
    return true;
}

function generateArrivals() {
    for (const arm of DIRS) {
        for (const turn of ["left", "straight", "right"]) {
            const key = laneId(arm, turn);
            while (state.simTime >= state.generator[key]) {
                state.pendingArrivals[key] += 1;
                state.generator[key] = state.simTime + expSample(getLaneArrivalRate(arm, turn));
            }
        }
    }
}

function releasePendingArrivals() {
    for (const arm of DIRS) {
        for (const turn of ["left", "straight", "right"]) {
            const key = laneId(arm, turn);
            while (state.pendingArrivals[key] > 0) {
                if (!spawnVehicle(arm, turn)) break;
                state.pendingArrivals[key] -= 1;
            }
        }
    }
}

// ── IDM 跟驰 ──────────────────────────────────────────────────────────────────

function conflictZoneForTurn(turn) {
    if (turn === "left")     return "full";
    if (turn === "straight") return "core";
    return "edge";
}

function reservationDuration(vehicle) {
    return vehicle.crossingPath.lengthMeters / CONFIG.crossingSpeed + 1.2;
}

function getOpposingStraightVehicle(vehicle) {
    if (vehicle.turnIntent !== "left") return null;
    const opposingLane = state.lanes[laneId(OPPOSITE_ARM[vehicle.arm], "straight")] || [];
    if (!opposingLane.length) return null;
    return opposingLane[opposingLane.length - 1];
}

function shouldYieldToOpposingStraight(vehicle) {
    if (vehicle.turnIntent !== "left") return false;
    const opposing = getOpposingStraightVehicle(vehicle);
    if (!opposing) return false;
    if (!state.signal.isLanePermitted(opposing)) return false;

    const opposingDistToStop = CONFIG.approachLengthM - opposing.pos;
    if (opposingDistToStop < 0) return false;

    const waited = Math.max(0, state.simTime - (vehicle.arrivalTime ?? state.simTime));
    const courtesyThreshold = waited >= CONFIG.leftTurnCourtesyYieldS
        ? CONFIG.leftTurnImmediateHazardM
        : CONFIG.leftTurnYieldLookaheadM;

    return opposingDistToStop <= courtesyThreshold && opposing.vel > 0.5 && canEnterIntersection(opposing);
}

function canVehicleAdvanceIntoIntersection(vehicle) {
    return state.signal.isLanePermitted(vehicle)
        && !shouldYieldToOpposingStraight(vehicle)
        && canEnterIntersection(vehicle);
}

function canEnterIntersection(vehicle) {
    const buffer = vehicle.turnIntent === "right" ? 0.5 : 0.8;
    if (CONFIG.approachLengthM - vehicle.pos > buffer) return true;
    const zone    = conflictZoneForTurn(vehicle.turnIntent);
    const enterAt = state.simTime;
    const leaveAt = state.simTime + reservationDuration(vehicle);
    for (const res of state.crossingReservations) {
        if (res.leaveAt < enterAt || res.enterAt > leaveAt) continue;
        if (zone === "edge" && res.zone === "edge" && res.arm !== vehicle.arm) continue;
        if (vehicle.turnIntent === "right" && res.arm === vehicle.arm) continue;
        return false;
    }
    return true;
}

function reserveIntersection(vehicle) {
    state.crossingReservations.push({
        id:      vehicle.id,
        arm:     vehicle.arm,
        zone:    conflictZoneForTurn(vehicle.turnIntent),
        enterAt: state.simTime,
        leaveAt: state.simTime + reservationDuration(vehicle),
    });
}

function getLeader(vehicle, laneVehicles) {
    const idx = laneVehicles.indexOf(vehicle);
    if (idx >= 0 && idx < laneVehicles.length - 1) {
        const leader = laneVehicles[idx + 1];
        return { pos: leader.pos, vel: leader.vel, length: leader.length };
    }
    if (!state.signal.isLanePermitted(vehicle)) {
        return { pos: CONFIG.approachLengthM, vel: 0, length: CONFIG.ghostLength };
    }
    if (shouldYieldToOpposingStraight(vehicle)) {
        return { pos: CONFIG.approachLengthM + 1, vel: 0, length: CONFIG.ghostLength };
    }
    if (!canEnterIntersection(vehicle)) {
        return { pos: CONFIG.approachLengthM + 2, vel: 0, length: CONFIG.ghostLength };
    }
    return null;
}

function computeIDM(vehicle, leader, dt) {
    let acc = vehicle.a * (1 - Math.pow(vehicle.vel / vehicle.v0, 4));
    if (leader) {
        let gap = leader.pos - leader.length * 0.5 - vehicle.pos - vehicle.length * 0.5;
        gap = Math.max(gap, 0.5);
        const deltaV = vehicle.vel - leader.vel;
        const sStar  = vehicle.s0 + Math.max(0,
            vehicle.vel * vehicle.T + (vehicle.vel * deltaV) / (2 * Math.sqrt(vehicle.a * vehicle.b)));
        acc = vehicle.a * (1 - Math.pow(vehicle.vel / vehicle.v0, 4) - Math.pow(sStar / gap, 2));
    }
    acc = clamp(acc, -10, vehicle.a);
    const prevV = vehicle.vel;
    vehicle.acc = acc;
    vehicle.vel = Math.max(0, vehicle.vel + acc * dt);
    vehicle.pos += (prevV + vehicle.vel) * 0.5 * dt;
}

// ── 各段车辆更新 ───────────────────────────────────────────────────────────────

function updateInboundVehicles(dt) {
    for (const key of Object.keys(state.lanes)) {
        const laneVehicles = state.lanes[key];
        for (const vehicle of laneVehicles) {
            const leader = getLeader(vehicle, laneVehicles);
            computeIDM(vehicle, leader, dt);
            if (CONFIG.approachLengthM - vehicle.pos < 15 && vehicle.vel < 0.5) {
                vehicle.wasQueued = true;
            }
            if (vehicle.pos >= CONFIG.approachLengthM) {
                if (vehicle.arrivalTime === null) vehicle.arrivalTime = state.simTime;
                if (canVehicleAdvanceIntoIntersection(vehicle)) {
                    vehicle.segment         = "crossing";
                    vehicle.crossingDistance = 0;
                    vehicle.vel             = clamp(vehicle.vel, 3, CONFIG.crossingSpeed);
                    reserveIntersection(vehicle);
                    if (vehicle.wasQueued) {
                        state.performance.recordQueuedDischarge(vehicle.laneKey, state.simTime);
                    }
                } else {
                    vehicle.pos = CONFIG.approachLengthM - 0.1;
                    vehicle.vel = 0;
                    vehicle.wasQueued = true;
                }
            }
        }
    }
}

function updateCrossingVehicles(dt) {
    for (const vehicle of state.vehicles) {
        if (vehicle.segment !== "crossing") continue;
        vehicle.crossingDistance += CONFIG.crossingSpeed * dt;
        vehicle.vel = CONFIG.crossingSpeed;
        if (vehicle.crossingDistance >= vehicle.crossingPath.lengthMeters) {
            vehicle.segment       = "outbound";
            vehicle.pos           = 0;
            vehicle.departureTime = state.simTime;
        }
    }
}

function updateOutboundVehicles(dt) {
    for (const vehicle of state.vehicles) {
        if (vehicle.segment !== "outbound") continue;
        vehicle.vel  = Math.min(vehicle.v0, vehicle.vel + vehicle.a * dt);
        vehicle.pos += vehicle.vel * dt;
        if (vehicle.pos >= CONFIG.exitLengthM) {
            vehicle.segment = "departed";
            state.performance.recordDeparture(vehicle, state.simTime);
        }
    }
}

function cleanupVehicles() {
    state.vehicles             = state.vehicles.filter(v => v.segment !== "departed");
    state.crossingReservations = state.crossingReservations.filter(r => r.leaveAt > state.simTime);
    state.overlays             = state.overlays.filter(o => { o.ttl -= CONFIG.dt; return o.ttl > 0; });
}

function updateQueues() {
    for (const arm of DIRS) state.queueDetectors[arm].update(state.vehicles);
}

function updateSpaceTime() {
    for (const v of state.vehicles) {
        if (v.arm === "N" && v.segment === "inbound") {
            state.spaceTime.push({ t: state.simTime, x: v.pos, speed: v.vel });
        }
    }
    while (state.spaceTime.length && state.simTime - state.spaceTime[0].t > 80) {
        state.spaceTime.shift();
    }
}

// ── 重置 ──────────────────────────────────────────────────────────────────────

function resetSimulation() {
    state.simTime    = 0;
    state.lastFrame  = 0;
    state.accumulator = 0;
    state.vehicleId  = 1;
    state.vehicles   = [];
    state.crossingReservations = [];
    state.overlays   = [];
    state.spaceTime  = [];
    state.demo.oversat   = false;
    state.demo.greenWave = false;
    state.demo.greenWaveSnapshot = null;
    state.performance    = new PerformanceMonitor();
    resetRandomSeed();
    for (const arm of DIRS) state.queueDetectors[arm] = new QueueDetector(arm);
    state.signal = new TrafficSignal();
    applySignalSettings();
    state.signal.syncToTime(state.simTime);
    resetLaneBuckets();
    resetGenerators();
    updateUI();
    updatePerformanceUI();
}

// ── 物理主步进 ────────────────────────────────────────────────────────────────

function stepSimulation(dt) {
    generateArrivals();
    rebuildLaneBuckets();
    releasePendingArrivals();
    updateInboundVehicles(dt);
    updateCrossingVehicles(dt);
    updateOutboundVehicles(dt);
    cleanupVehicles();
    updateQueues();
    updateSpaceTime();
    state.simTime += dt;
    state.signal.update(state.simTime);
}
