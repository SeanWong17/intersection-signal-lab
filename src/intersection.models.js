// ─── 数据模型（类定义） ────────────────────────────────────────────────────────
// 依赖：intersection.config.js，intersection.geometry.js

// ── Vehicle ───────────────────────────────────────────────────────────────────

class Vehicle {
    constructor(id, arm, turnIntent, spawnTime, baseParams) {
        this.id          = id;
        this.arm         = arm;
        this.turnIntent  = turnIntent;
        this.lane        = turnIntent;         // 初始车道与转向意图相同
        this.segment     = "inbound";          // inbound | crossing | outbound | departed
        this.pos         = 0;                  // 沿臂位移（m），从远端往停车线递增
        this.vel         = random() * 2;
        this.acc         = 0;

        // 车辆参数（高斯个体差异）
        this.length = clamp(randn(4.8, 0.6), 4.0, 6.6);
        this.width  = 2.0;
        this.v0  = clamp(randn(baseParams.v0, 1.5),  8,   22);
        this.T   = clamp(randn(baseParams.T,  0.12), 0.9, 2.4);
        this.a   = clamp(randn(baseParams.a,  0.15), 0.7, 2.0);
        this.b   = clamp(randn(baseParams.b,  0.18), 1.5, 3.0);
        this.s0  = clamp(randn(baseParams.s0, 0.2),  1.5, 3.5);

        this.crossingPath     = geometry.pathCache[laneId(arm, turnIntent)];
        this.crossingDistance = 0;
        this.arrivalTime      = null;
        this.departureTime    = null;
        this.spawnTime        = spawnTime;
        this.wasQueued        = false;
    }

    get laneKey() {
        return laneId(this.arm, this.lane);
    }

    get positionPoint() {
        if (this.segment === "crossing") {
            return pointOnPath(this.crossingPath, this.crossingDistance);
        }
        if (this.segment === "outbound") {
            return getLanePoint(TURN_TO_EXIT[this.arm][this.turnIntent], "straight", this.pos, false);
        }
        return getLanePoint(this.arm, this.lane, this.pos, true);
    }

    get angle() {
        if (this.segment === "crossing") {
            return headingOnPath(this.crossingPath, this.crossingDistance);
        }
        const arm = this.segment === "outbound"
            ? TURN_TO_EXIT[this.arm][this.turnIntent]
            : this.arm;
        const dir = geometry.arms[arm].dir;
        return Math.atan2(dir.y, dir.x);
    }
}

// ── TrafficSignal ─────────────────────────────────────────────────────────────

class TrafficSignal {
    constructor() {
        this.phaseIndex  = 0;
        this.stage       = "green";   // green | yellow | allred
        this.stageTimer  = 0;
        this.offset      = 0;
        this.greenTimes  = [32, 24, 32, 16];
        this.yellow      = CONFIG.yellowTime;
        this.allRed      = CONFIG.allRedTime;
        this.cycleLength = 120;
        this.laneState   = {};
        this.countdown   = 0;
        this.applyLaneStates();
    }

    setPlan(greenTimes, cycleLength, offset) {
        this.greenTimes  = greenTimes.slice();
        this.cycleLength = cycleLength;
        this.offset      = offset;
    }

    getLostTimePerPhase() {
        return this.yellow + this.allRed;
    }

    getActualCycleLength() {
        return this.greenTimes.reduce((sum, green) => sum + green, 0)
            + PHASES.length * this.getLostTimePerPhase();
    }

    getPhaseStartOffset(phaseIndex) {
        let offset = 0;
        for (let i = 0; i < phaseIndex; i++) {
            offset += this.greenTimes[i] + this.yellow + this.allRed;
        }
        return offset;
    }

    getStateAt(simTime) {
        const cycle = this.getActualCycleLength();
        const cycleTime = ((simTime + this.offset) % cycle + cycle) % cycle;
        let cursor = 0;

        for (let phaseIndex = 0; phaseIndex < PHASES.length; phaseIndex++) {
            const green = this.greenTimes[phaseIndex];
            if (cycleTime < cursor + green) {
                return {
                    phaseIndex,
                    stage: "green",
                    stageTimer: cycleTime - cursor,
                    countdown: cursor + green - cycleTime
                };
            }
            cursor += green;

            if (cycleTime < cursor + this.yellow) {
                return {
                    phaseIndex,
                    stage: "yellow",
                    stageTimer: cycleTime - cursor,
                    countdown: cursor + this.yellow - cycleTime
                };
            }
            cursor += this.yellow;

            if (cycleTime < cursor + this.allRed) {
                return {
                    phaseIndex,
                    stage: "allred",
                    stageTimer: cycleTime - cursor,
                    countdown: cursor + this.allRed - cycleTime
                };
            }
            cursor += this.allRed;
        }

        return {
            phaseIndex: 0,
            stage: "green",
            stageTimer: 0,
            countdown: this.greenTimes[0]
        };
    }

    syncToTime(simTime) {
        const snapshot = this.getStateAt(simTime);
        this.phaseIndex = snapshot.phaseIndex;
        this.stage = snapshot.stage;
        this.stageTimer = snapshot.stageTimer;
        this.countdown = snapshot.countdown;
        this.applyLaneStates();
    }

    getPhaseGreenWindows(phaseIndex, startTime, endTime) {
        const cycle = this.getActualCycleLength();
        const phaseStart = this.getPhaseStartOffset(phaseIndex) - this.offset;
        const windows = [];
        let n = Math.floor((startTime - phaseStart) / cycle) - 1;
        while (true) {
            const start = phaseStart + n * cycle;
            const end = start + this.greenTimes[phaseIndex];
            if (start > endTime) break;
            if (end >= startTime && start <= endTime) {
                windows.push({ start, end });
            }
            n += 1;
        }
        return windows;
    }

    applyLaneStates() {
        // 默认全部为红，右转常绿
        for (const arm of DIRS) {
            for (const lane of ["left", "straight", "right"]) {
                this.laneState[laneId(arm, lane)] = lane === "right" ? "green" : "red";
            }
        }
        // 当前相位绿/黄
        if (this.stage === "green" || this.stage === "yellow") {
            for (const lane of PHASES[this.phaseIndex].lanes) {
                this.laneState[lane] = this.stage;
            }
        }
        this.countdown = this.getStageDuration() - this.stageTimer;
    }

    getStageDuration() {
        if (this.stage === "green")  return this.greenTimes[this.phaseIndex];
        if (this.stage === "yellow") return this.yellow;
        return this.allRed;
    }

    isLanePermitted(vehicle) {
        if (vehicle.turnIntent === "right") return true;
        const key = vehicle.segment === "inbound"
            ? vehicle.laneKey
            : laneId(vehicle.arm, vehicle.lane);
        return this.laneState[key] === "green";
    }

    update(simTime) {
        this.syncToTime(simTime);
    }
}

// ── QueueDetector ─────────────────────────────────────────────────────────────

class QueueDetector {
    constructor(arm) {
        this.arm          = arm;
        this.currentQueue = 0;
        this.maxQueue     = 0;
        this.spillback    = false;
    }

    update(vehicles) {
        const inbound = vehicles
            .filter(v => v.segment === "inbound" && v.arm === this.arm)
            .sort((a, b) => b.pos - a.pos);
        let farthest = 0;
        for (const v of inbound) {
            const distToStop = CONFIG.approachLengthM - v.pos;
            if (distToStop < 80 && v.vel < 1.2) {
                farthest = Math.max(farthest, distToStop + v.length);
            }
        }
        this.currentQueue = farthest;
        this.maxQueue     = Math.max(this.maxQueue, farthest);
        this.spillback    = farthest > CONFIG.approachLengthM * 0.72;
    }
}

// ── PerformanceMonitor ────────────────────────────────────────────────────────

class PerformanceMonitor {
    constructor() {
        this.delaySamples    = [];
        this.departed        = [];
        this.queuedHeadways  = [];
        this.lastQueuedDepartureByLane = {};
        this.lastLOS         = losFromDelay(0);
    }

    recordDeparture(vehicle, simTime) {
        const freeFlowTime = (CONFIG.approachLengthM + CONFIG.exitLengthM + vehicle.crossingPath.lengthMeters)
                             / Math.max(vehicle.v0, 1);
        const delay = Math.max(0, (simTime - vehicle.spawnTime) - freeFlowTime);
        this.delaySamples.push(delay);
        if (this.delaySamples.length > 600) this.delaySamples.shift();
        this.departed.push({ t: simTime, delay });
        while (this.departed.length && simTime - this.departed[0].t > 3600) this.departed.shift();
    }

    recordQueuedDischarge(laneKey, simTime) {
        const previous = this.lastQueuedDepartureByLane[laneKey];
        this.lastQueuedDepartureByLane[laneKey] = simTime;
        if (typeof previous !== "number") return;

        const headway = simTime - previous;
        if (headway < 0.8 || headway > 5) return;

        this.queuedHeadways.push({ t: simTime, headway, laneKey });
        while (this.queuedHeadways.length && simTime - this.queuedHeadways[0].t > 300) {
            this.queuedHeadways.shift();
        }
    }

    getAverageDelay() {
        if (!this.delaySamples.length) return 0;
        return this.delaySamples.reduce((s, d) => s + d, 0) / this.delaySamples.length;
    }

    getThroughputPerHour(simTime) {
        const window = Math.min(Math.max(simTime, 0), 3600);
        if (window <= 0) return 0;
        return (this.departed.length / window) * 3600;
    }

    getMeasuredSaturation() {
        return estimateLaneSaturationFromHeadways(this.queuedHeadways.map(sample => sample.headway));
    }
}
