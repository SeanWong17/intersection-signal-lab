const canvas = document.getElementById("simCanvas");
        const ctx = canvas.getContext("2d");

        const DIRS = ["N", "E", "S", "W"];
        const DIR_INDEX = { N: 0, E: 1, S: 2, W: 3 };
        const DIR_VECTORS = {
            N: { x: 0, y: 1 },
            E: { x: -1, y: 0 },
            S: { x: 0, y: -1 },
            W: { x: 1, y: 0 }
        };
        const SIDE_VECTORS = {
            N: { x: 1, y: 0 },
            E: { x: 0, y: 1 },
            S: { x: -1, y: 0 },
            W: { x: 0, y: -1 }
        };
        const TURN_TO_EXIT = {
            N: { left: "E", straight: "S", right: "W" },
            E: { left: "S", straight: "W", right: "N" },
            S: { left: "W", straight: "N", right: "E" },
            W: { left: "N", straight: "E", right: "S" }
        };
        const PHASES = [
            { arm: "N", label: "北向相位", lanes: ["N-left", "N-straight"] },
            { arm: "S", label: "南向相位", lanes: ["S-left", "S-straight"] },
            { arm: "E", label: "东向相位", lanes: ["E-left", "E-straight"] },
            { arm: "W", label: "西向相位", lanes: ["W-left", "W-straight"] }
        ];

        const CONFIG = {
            pixelPerMeter: 1.5,
            center: { x: 550, y: 400 },
            stopLinePx: 60,
            approachLengthM: 200,
            exitLengthM: 120,
            laneWidthPx: 18,
            crosswalkWidthPx: 18,
            yellowTime: 3,
            allRedTime: 1,
            crossingSpeed: 8,
            satFlowPerLane: 1800,
            maxVehiclesPerLane: 45,
            dt: 0.05,
            timeWarp: 1,
            freeFlowReferenceMps: 13.89,
            ghostLength: 0,
            speedColorMin: 0,
            speedColorMax: 120
        };

        const ui = {
            flow: {
                N: document.getElementById("flowNorth"),
                E: document.getElementById("flowEast"),
                S: document.getElementById("flowSouth"),
                W: document.getElementById("flowWest")
            },
            flowValue: {
                N: document.getElementById("flowNorthValue"),
                E: document.getElementById("flowEastValue"),
                S: document.getElementById("flowSouthValue"),
                W: document.getElementById("flowWestValue")
            },
            cycle: document.getElementById("cycleLength"),
            cycleValue: document.getElementById("cycleValue"),
            green: [
                document.getElementById("green0"),
                document.getElementById("green1"),
                document.getElementById("green2"),
                document.getElementById("green3")
            ],
            greenValue: [
                document.getElementById("green0Value"),
                document.getElementById("green1Value"),
                document.getElementById("green2Value"),
                document.getElementById("green3Value")
            ],
            offset: document.getElementById("offset"),
            offsetValue: document.getElementById("offsetValue"),
            desiredSpeed: document.getElementById("desiredSpeed"),
            desiredSpeedValue: document.getElementById("desiredSpeedValue"),
            headway: document.getElementById("headway"),
            headwayValue: document.getElementById("headwayValue"),
            losDisplay: document.getElementById("losDisplay"),
            delayDisplay: document.getElementById("delayDisplay"),
            throughputDisplay: document.getElementById("throughputDisplay"),
            saturationDisplay: document.getElementById("saturationDisplay"),
            approachStats: document.getElementById("approachStats"),
            alerts: document.getElementById("alerts"),
            btnRun: document.getElementById("btnRun"),
            btnPause: document.getElementById("btnPause"),
            btnReset: document.getElementById("btnReset"),
            btnSpeed: document.getElementById("btnSpeed"),
            btnWebster: document.getElementById("btnWebster"),
            btnOversat: document.getElementById("btnOversat"),
            btnGreenWave: document.getElementById("btnGreenWave"),
            showQueue: document.getElementById("showQueue"),
            showSat: document.getElementById("showSat"),
            showSpaceTime: document.getElementById("showSpaceTime")
        };

        function clamp(value, min, max) {
            return Math.min(Math.max(value, min), max);
        }

        function lerp(a, b, t) {
            return a + (b - a) * t;
        }

        function randn(mean, sd) {
            let u = 0;
            let v = 0;
            while (u === 0) u = Math.random();
            while (v === 0) v = Math.random();
            const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
            return mean + z * sd;
        }

        function expSample(rate) {
            if (rate <= 0) return Number.POSITIVE_INFINITY;
            return -Math.log(Math.max(1e-6, Math.random())) / rate;
        }

        function speedToColor(speed, v0) {
            const ratio = clamp(speed / Math.max(v0, 1), 0, 1);
            const hue = lerp(CONFIG.speedColorMin, CONFIG.speedColorMax, ratio);
            return `hsl(${hue}, 90%, 50%)`;
        }

        function roundedRectPath(context, x, y, w, h, r) {
            const radius = Math.min(r, w * 0.5, h * 0.5);
            context.beginPath();
            context.moveTo(x + radius, y);
            context.arcTo(x + w, y, x + w, y + h, radius);
            context.arcTo(x + w, y + h, x, y + h, radius);
            context.arcTo(x, y + h, x, y, radius);
            context.arcTo(x, y, x + w, y, radius);
            context.closePath();
        }

        function losFromDelay(delay) {
            if (delay <= 10) return { grade: "A", color: "#22c55e" };
            if (delay <= 20) return { grade: "B", color: "#84cc16" };
            if (delay <= 35) return { grade: "C", color: "#facc15" };
            if (delay <= 55) return { grade: "D", color: "#fb923c" };
            if (delay <= 80) return { grade: "E", color: "#ef4444" };
            return { grade: "F", color: "#991b1b" };
        }

        function laneId(arm, lane) {
            return `${arm}-${lane}`;
        }

        function formatMeters(m) {
            return `${Math.round(m)}m`;
        }

        const geometry = {
            arms: {},
            lanePolygons: {},
            stopLines: {},
            signalHeads: {},
            pathCache: {}
        };

        function computeGeometry() {
            const c = CONFIG.center;
            const inner = CONFIG.stopLinePx;
            const armLengthPx = CONFIG.approachLengthM * CONFIG.pixelPerMeter;
            const exitLengthPx = CONFIG.exitLengthM * CONFIG.pixelPerMeter;
            const laneOffsets = { left: -CONFIG.laneWidthPx * 0.5, straight: CONFIG.laneWidthPx * 0.5, right: CONFIG.laneWidthPx * 1.5 };

            for (const arm of DIRS) {
                const dir = DIR_VECTORS[arm];
                const side = SIDE_VECTORS[arm];
                const inboundStop = {
                    x: c.x - dir.x * inner,
                    y: c.y - dir.y * inner
                };
                const inboundFar = {
                    x: c.x - dir.x * (inner + armLengthPx),
                    y: c.y - dir.y * (inner + armLengthPx)
                };
                const outboundNear = {
                    x: c.x + dir.x * inner,
                    y: c.y + dir.y * inner
                };
                const outboundFar = {
                    x: c.x + dir.x * (inner + exitLengthPx),
                    y: c.y + dir.y * (inner + exitLengthPx)
                };

                geometry.arms[arm] = {
                    dir,
                    side,
                    inboundStop,
                    inboundFar,
                    outboundNear,
                    outboundFar,
                    laneOffsets
                };

                for (const lane of ["left", "straight", "right"]) {
                    const offset = laneOffsets[lane];
                    geometry.stopLines[laneId(arm, lane)] = {
                        a: {
                            x: inboundStop.x + side.x * (offset - CONFIG.laneWidthPx * 0.45),
                            y: inboundStop.y + side.y * (offset - CONFIG.laneWidthPx * 0.45)
                        },
                        b: {
                            x: inboundStop.x + side.x * (offset + CONFIG.laneWidthPx * 0.45),
                            y: inboundStop.y + side.y * (offset + CONFIG.laneWidthPx * 0.45)
                        },
                        point: {
                            x: inboundStop.x + side.x * offset,
                            y: inboundStop.y + side.y * offset
                        }
                    };

                    geometry.signalHeads[laneId(arm, lane)] = {
                        x: inboundStop.x + side.x * offset - dir.x * 18,
                        y: inboundStop.y + side.y * offset - dir.y * 18
                    };
                }
            }

            geometry.intersectionBox = {
                x: c.x - inner,
                y: c.y - inner,
                w: inner * 2,
                h: inner * 2
            };

            for (const arm of DIRS) {
                for (const turn of ["left", "straight", "right"]) {
                    geometry.pathCache[`${arm}-${turn}`] = buildCrossingPath(arm, turn);
                }
            }
        }

        function getLanePoint(arm, lane, posMeters, inbound = true) {
            const armGeo = geometry.arms[arm];
            const offset = armGeo.laneOffsets[lane];
            const side = armGeo.side;
            const dir = inbound ? armGeo.dir : { x: -armGeo.dir.x, y: -armGeo.dir.y };
            const base = inbound ? armGeo.inboundFar : armGeo.outboundNear;
            const posPx = posMeters * CONFIG.pixelPerMeter;
            return {
                x: base.x + armGeo.side.x * offset + dir.x * posPx,
                y: base.y + armGeo.side.y * offset + dir.y * posPx
            };
        }

        function bezierQuadratic(p0, p1, p2, t) {
            const mt = 1 - t;
            return {
                x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
                y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y
            };
        }

        function bezierCubic(p0, p1, p2, p3, t) {
            const mt = 1 - t;
            return {
                x: mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x,
                y: mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y
            };
        }

        function sampleArcLength(points) {
            let total = 0;
            const arc = [{ s: 0, t: 0, p: points[0] }];
            for (let i = 1; i < points.length; i += 1) {
                const dx = points[i].x - points[i - 1].x;
                const dy = points[i].y - points[i - 1].y;
                total += Math.hypot(dx, dy);
                arc.push({ s: total, t: i / (points.length - 1), p: points[i] });
            }
            return { total, arc };
        }

        function buildCrossingPath(arm, turn) {
            const start = geometry.stopLines[laneId(arm, turn === "right" ? "right" : turn)].point;
            const exitArm = TURN_TO_EXIT[arm][turn];
            const exitGeo = geometry.arms[exitArm];
            const exitLane = turn === "left" ? "straight" : "straight";
            const end = {
                x: exitGeo.outboundNear.x + exitGeo.side.x * exitGeo.laneOffsets[exitLane],
                y: exitGeo.outboundNear.y + exitGeo.side.y * exitGeo.laneOffsets[exitLane]
            };
            const center = CONFIG.center;
            const armGeo = geometry.arms[arm];
            const exitSide = exitGeo.side;
            let points = [];

            if (turn === "straight") {
                const control = {
                    x: center.x + (armGeo.side.x - exitSide.x) * 6,
                    y: center.y + (armGeo.side.y - exitSide.y) * 6
                };
                for (let i = 0; i <= 100; i += 1) {
                    points.push(bezierQuadratic(start, control, end, i / 100));
                }
            } else if (turn === "left") {
                const p1 = {
                    x: start.x + armGeo.dir.x * 20 + armGeo.side.x * 8,
                    y: start.y + armGeo.dir.y * 20 + armGeo.side.y * 8
                };
                const p2 = {
                    x: center.x - exitGeo.dir.x * 20 + exitGeo.side.x * 8,
                    y: center.y - exitGeo.dir.y * 20 + exitGeo.side.y * 8
                };
                for (let i = 0; i <= 100; i += 1) {
                    points.push(bezierCubic(start, p1, p2, end, i / 100));
                }
            } else {
                const control = {
                    x: center.x - armGeo.dir.x * 18 + armGeo.side.x * 14,
                    y: center.y - armGeo.dir.y * 18 + armGeo.side.y * 14
                };
                for (let i = 0; i <= 100; i += 1) {
                    points.push(bezierQuadratic(start, control, end, i / 100));
                }
            }

            const { total, arc } = sampleArcLength(points);
            return { points, arc, lengthMeters: total / CONFIG.pixelPerMeter };
        }

        function pointOnPath(path, distanceMeters) {
            const sPx = clamp(distanceMeters * CONFIG.pixelPerMeter, 0, path.arc[path.arc.length - 1].s);
            for (let i = 1; i < path.arc.length; i += 1) {
                if (path.arc[i].s >= sPx) {
                    const prev = path.arc[i - 1];
                    const next = path.arc[i];
                    const ratio = next.s === prev.s ? 0 : (sPx - prev.s) / (next.s - prev.s);
                    return {
                        x: lerp(prev.p.x, next.p.x, ratio),
                        y: lerp(prev.p.y, next.p.y, ratio)
                    };
                }
            }
            return path.arc[path.arc.length - 1].p;
        }

        function headingOnPath(path, distanceMeters) {
            const p0 = pointOnPath(path, distanceMeters);
            const p1 = pointOnPath(path, Math.min(distanceMeters + 2, path.lengthMeters));
            return Math.atan2(p1.y - p0.y, p1.x - p0.x);
        }

        class Vehicle {
            constructor(id, arm, turnIntent, spawnTime, baseParams) {
                this.id = id;
                this.arm = arm;
                this.turnIntent = turnIntent;
                this.lane = turnIntent;
                this.segment = "inbound";
                this.pos = 0;
                this.vel = Math.random() * 2;
                this.acc = 0;
                this.length = clamp(randn(4.8, 0.6), 4.0, 6.6);
                this.width = 2.0;
                this.v0 = clamp(randn(baseParams.v0, 1.5), 8, 22);
                this.T = clamp(randn(baseParams.T, 0.12), 0.9, 2.4);
                this.a = clamp(randn(baseParams.a, 0.15), 0.7, 2.0);
                this.b = clamp(randn(baseParams.b, 0.18), 1.5, 3.0);
                this.s0 = clamp(randn(baseParams.s0, 0.2), 1.5, 3.5);
                this.crossingPath = geometry.pathCache[`${arm}-${turnIntent}`];
                this.crossingT = 0;
                this.crossingDistance = 0;
                this.arrivalTime = null;
                this.departureTime = null;
                this.spawnTime = spawnTime;
                this.delay = 0;
                this.stopCount = 0;
                this.wasStopped = false;
                this.queueJoinTime = null;
                this.lastSignalClearTime = null;
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
                const dir = this.segment === "outbound" ? geometry.arms[TURN_TO_EXIT[this.arm][this.turnIntent]].dir : geometry.arms[this.arm].dir;
                return Math.atan2(dir.y, dir.x);
            }
        }

        class TrafficSignal {
            constructor() {
                this.phaseIndex = 0;
                this.stage = "green";
                this.stageTimer = 0;
                this.offset = 0;
                this.greenTimes = [16, 16, 16, 16];
                this.yellow = CONFIG.yellowTime;
                this.allRed = CONFIG.allRedTime;
                this.cycleLength = 80;
                this.laneState = {};
                this.countdown = 0;
                this.applyLaneStates();
            }

            setPlan(greenTimes, cycleLength, offset) {
                this.greenTimes = greenTimes.slice();
                this.cycleLength = cycleLength;
                this.offset = offset;
            }

            applyLaneStates() {
                for (const arm of DIRS) {
                    for (const lane of ["left", "straight", "right"]) {
                        this.laneState[laneId(arm, lane)] = lane === "right" ? "green" : "red";
                    }
                }
                if (this.stage === "green" || this.stage === "yellow") {
                    const current = PHASES[this.phaseIndex];
                    for (const lane of current.lanes) {
                        this.laneState[lane] = this.stage;
                    }
                }
                this.countdown = this.getStageDuration() - this.stageTimer;
            }

            getStageDuration() {
                if (this.stage === "green") return this.greenTimes[this.phaseIndex];
                if (this.stage === "yellow") return this.yellow;
                return this.allRed;
            }

            isLanePermitted(vehicle) {
                const key = vehicle.segment === "inbound" ? vehicle.laneKey : laneId(vehicle.arm, vehicle.lane);
                if (vehicle.turnIntent === "right") return true;
                return this.laneState[key] === "green";
            }

            timeToNextGreen(arm) {
                let t = 0;
                let phase = this.phaseIndex;
                let stage = this.stage;
                let remaining = this.getStageDuration() - this.stageTimer;
                while (t < 240) {
                    if (stage === "green" && PHASES[phase].arm === arm) return t;
                    t += remaining;
                    if (stage === "green") {
                        stage = "yellow";
                        remaining = this.yellow;
                    } else if (stage === "yellow") {
                        stage = "allred";
                        remaining = this.allRed;
                    } else {
                        phase = (phase + 1) % PHASES.length;
                        stage = "green";
                        remaining = this.greenTimes[phase];
                    }
                }
                return t;
            }

            update(dt) {
                this.stageTimer += dt;
                const duration = this.getStageDuration();
                if (this.stageTimer >= duration) {
                    this.stageTimer -= duration;
                    if (this.stage === "green") {
                        this.stage = "yellow";
                    } else if (this.stage === "yellow") {
                        this.stage = "allred";
                    } else {
                        this.stage = "green";
                        this.phaseIndex = (this.phaseIndex + 1) % PHASES.length;
                    }
                    this.applyLaneStates();
                } else {
                    this.countdown = duration - this.stageTimer;
                }
            }
        }

        class QueueDetector {
            constructor(arm) {
                this.arm = arm;
                this.currentQueue = 0;
                this.maxQueue = 0;
                this.spillback = false;
            }

            update(vehicles) {
                const inbound = vehicles
                    .filter(v => v.segment === "inbound" && v.arm === this.arm)
                    .sort((a, b) => b.pos - a.pos);
                let farthestQueued = 0;
                for (const v of inbound) {
                    const distToStop = CONFIG.approachLengthM - v.pos;
                    if (distToStop < 80 && v.vel < 1.2) {
                        farthestQueued = Math.max(farthestQueued, distToStop + v.length);
                    }
                }
                this.currentQueue = farthestQueued;
                this.maxQueue = Math.max(this.maxQueue, this.currentQueue);
                this.spillback = this.currentQueue > CONFIG.approachLengthM * 0.72;
            }
        }

        class PerformanceMonitor {
            constructor() {
                this.delaySamples = [];
                this.departed = [];
                this.phaseDepartures = [];
                this.currentHourEquivalent = 0;
                this.lastLOS = losFromDelay(0);
            }

            recordDeparture(vehicle, simTime) {
                const freeFlowTime = (CONFIG.approachLengthM + CONFIG.exitLengthM + vehicle.crossingPath.lengthMeters) / Math.max(vehicle.v0, 1);
                const actual = simTime - vehicle.spawnTime;
                const delay = Math.max(0, actual - freeFlowTime);
                vehicle.delay = delay;
                this.delaySamples.push(delay);
                if (this.delaySamples.length > 600) this.delaySamples.shift();
                this.departed.push({ t: simTime, arm: vehicle.arm, delay });
                while (this.departed.length && simTime - this.departed[0].t > 3600) this.departed.shift();
            }

            recordSaturation(vehicle, simTime, stage) {
                if (stage !== "green") return;
                this.phaseDepartures.push(simTime);
                while (this.phaseDepartures.length && simTime - this.phaseDepartures[0] > 30) this.phaseDepartures.shift();
            }

            getAverageDelay() {
                if (!this.delaySamples.length) return 0;
                return this.delaySamples.reduce((sum, d) => sum + d, 0) / this.delaySamples.length;
            }

            getThroughputPerHour() {
                return this.departed.length;
            }

            getMeasuredSaturation() {
                if (this.phaseDepartures.length < 2) return 0;
                const duration = this.phaseDepartures[this.phaseDepartures.length - 1] - this.phaseDepartures[0];
                if (duration <= 0) return 0;
                return (this.phaseDepartures.length / duration) * 3600;
            }
        }

        const state = {
            running: true,
            simTime: 0,
            lastFrame: 0,
            accumulator: 0,
            vehicleId: 1,
            vehicles: [],
            lanes: {},
            signal: new TrafficSignal(),
            queueDetectors: {
                N: new QueueDetector("N"),
                E: new QueueDetector("E"),
                S: new QueueDetector("S"),
                W: new QueueDetector("W")
            },
            performance: new PerformanceMonitor(),
            generator: {},
            armFlow: { N: 800, E: 600, S: 800, W: 400 },
            laneShares: { left: 0.2, straight: 0.6, right: 0.2 },
            baseVehicleParams: {
                v0: 13.89,
                T: 1.5,
                a: 1.2,
                b: 2.0,
                s0: 2.0
            },
            crossingReservations: [],
            overlays: [],
            spaceTime: [],
            demo: {
                greenWave: false,
                oversat: false
            }
        };

        function resetLaneBuckets() {
            state.lanes = {};
            for (const arm of DIRS) {
                for (const lane of ["left", "straight", "right"]) {
                    state.lanes[laneId(arm, lane)] = [];
                }
            }
        }

        function resetGenerators() {
            state.generator = {};
            for (const arm of DIRS) {
                for (const turn of ["left", "straight", "right"]) {
                    state.generator[laneId(arm, turn)] = state.simTime + expSample(getLaneArrivalRate(arm, turn));
                }
            }
        }

        function resetSimulation() {
            state.simTime = 0;
            state.accumulator = 0;
            state.vehicleId = 1;
            state.vehicles = [];
            state.crossingReservations = [];
            state.overlays = [];
            state.spaceTime = [];
            state.performance = new PerformanceMonitor();
            for (const arm of DIRS) {
                state.queueDetectors[arm] = new QueueDetector(arm);
            }
            state.signal = new TrafficSignal();
            applySignalSettings();
            resetLaneBuckets();
            resetGenerators();
            updateUI();
        }

        function getLaneArrivalRate(arm, turn) {
            const flow = state.armFlow[arm];
            return (flow * state.laneShares[turn]) / 3600;
        }

        function spawnVehicle(arm, turn) {
            const key = laneId(arm, turn);
            const laneVehicles = state.lanes[key];
            if (laneVehicles.length >= CONFIG.maxVehiclesPerLane) {
                state.overlays.push({ type: "overflow", text: `${arm} 进口排队溢出`, ttl: 3.5 });
                return;
            }
            const first = laneVehicles[0];
            if (first && first.pos < 10) return;
            const vehicle = new Vehicle(state.vehicleId++, arm, turn, state.simTime, state.baseVehicleParams);
            state.vehicles.push(vehicle);
            laneVehicles.unshift(vehicle);
        }

        function generateArrivals() {
            for (const arm of DIRS) {
                for (const turn of ["left", "straight", "right"]) {
                    const key = laneId(arm, turn);
                    if (state.simTime >= state.generator[key]) {
                        spawnVehicle(arm, turn);
                        state.generator[key] = state.simTime + expSample(getLaneArrivalRate(arm, turn));
                    }
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

        function getLeader(vehicle, laneVehicles) {
            const idx = laneVehicles.indexOf(vehicle);
            if (idx >= 0 && idx < laneVehicles.length - 1) {
                const leader = laneVehicles[idx + 1];
                return { pos: leader.pos, vel: leader.vel, length: leader.length };
            }

            const distanceToStop = CONFIG.approachLengthM - vehicle.pos;
            const signalAllowed = state.signal.isLanePermitted(vehicle);
            const ghostNeeded = !signalAllowed;

            if (ghostNeeded) {
                return { pos: CONFIG.approachLengthM, vel: 0, length: CONFIG.ghostLength };
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
                const sStar = vehicle.s0 + Math.max(0, vehicle.vel * vehicle.T + (vehicle.vel * deltaV) / (2 * Math.sqrt(vehicle.a * vehicle.b)));
                acc = vehicle.a * (1 - Math.pow(vehicle.vel / vehicle.v0, 4) - Math.pow(sStar / gap, 2));
            }
            acc = clamp(acc, -10, vehicle.a);
            const prevV = vehicle.vel;
            vehicle.acc = acc;
            vehicle.vel = Math.max(0, vehicle.vel + acc * dt);
            vehicle.pos += (prevV + vehicle.vel) * 0.5 * dt;
            if (vehicle.vel < 0.2 && !vehicle.wasStopped) {
                vehicle.stopCount += 1;
                vehicle.wasStopped = true;
            }
            if (vehicle.vel > 0.5) {
                vehicle.wasStopped = false;
            }
        }

        function conflictZoneForTurn(turn) {
            if (turn === "left") return "full";
            if (turn === "straight") return "core";
            return "edge";
        }

        function reservationDuration(vehicle) {
            return vehicle.crossingPath.lengthMeters / CONFIG.crossingSpeed + 1.2;
        }

        function canEnterIntersection(vehicle) {
            const buffer = vehicle.turnIntent === "right" ? 0.5 : 0.8;
            if (CONFIG.approachLengthM - vehicle.pos > buffer) return true;
            const zone = conflictZoneForTurn(vehicle.turnIntent);
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
                id: vehicle.id,
                arm: vehicle.arm,
                zone: conflictZoneForTurn(vehicle.turnIntent),
                enterAt: state.simTime,
                leaveAt: state.simTime + reservationDuration(vehicle)
            });
        }

        function updateInboundVehicles(dt) {
            for (const key of Object.keys(state.lanes)) {
                const laneVehicles = state.lanes[key];
                for (const vehicle of laneVehicles) {
                    const leader = getLeader(vehicle, laneVehicles);
                    computeIDM(vehicle, leader, dt);
                    if (vehicle.pos >= CONFIG.approachLengthM) {
                        if (vehicle.arrivalTime === null) vehicle.arrivalTime = state.simTime;
                        if (state.signal.isLanePermitted(vehicle) && canEnterIntersection(vehicle)) {
                            vehicle.segment = "crossing";
                            vehicle.crossingDistance = 0;
                            vehicle.vel = Math.min(Math.max(vehicle.vel, 3), CONFIG.crossingSpeed);
                            reserveIntersection(vehicle);
                        } else {
                            vehicle.pos = CONFIG.approachLengthM - 0.1;
                            vehicle.vel = 0;
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
                    vehicle.segment = "outbound";
                    vehicle.pos = 0;
                    vehicle.departureTime = state.simTime;
                    state.performance.recordSaturation(vehicle, state.simTime, state.signal.stage);
                }
            }
        }

        function updateOutboundVehicles(dt) {
            for (const vehicle of state.vehicles) {
                if (vehicle.segment !== "outbound") continue;
                vehicle.vel = Math.min(vehicle.v0, vehicle.vel + vehicle.a * dt);
                vehicle.pos += vehicle.vel * dt;
                if (vehicle.pos >= CONFIG.exitLengthM) {
                    vehicle.segment = "departed";
                    state.performance.recordDeparture(vehicle, state.simTime);
                }
            }
        }

        function cleanupVehicles() {
            state.vehicles = state.vehicles.filter(v => v.segment !== "departed");
            state.crossingReservations = state.crossingReservations.filter(r => r.leaveAt > state.simTime);
            state.overlays = state.overlays.filter(o => {
                o.ttl -= CONFIG.dt * CONFIG.timeWarp;
                return o.ttl > 0;
            });
        }

        function updateQueues() {
            for (const arm of DIRS) {
                state.queueDetectors[arm].update(state.vehicles);
            }
        }

        function updateSpaceTime() {
            const northVehicles = state.vehicles.filter(v => v.arm === "N" && v.segment === "inbound");
            for (const v of northVehicles) {
                state.spaceTime.push({
                    t: state.simTime,
                    x: v.pos,
                    speed: v.vel
                });
            }
            while (state.spaceTime.length && state.simTime - state.spaceTime[0].t > 80) {
                state.spaceTime.shift();
            }
        }

        function applySignalSettings() {
            const greens = ui.green.map(el => parseFloat(el.value));
            const cycle = parseFloat(ui.cycle.value);
            const offset = parseFloat(ui.offset.value);
            state.signal.setPlan(greens, cycle, offset);
            state.signal.applyLaneStates();
        }

        function runWebsterOptimization() {
            const L = 4 * PHASES.length;
            const saturation = CONFIG.satFlowPerLane;
            const criticalFlows = [
                state.armFlow.N * (state.laneShares.left + state.laneShares.straight),
                state.armFlow.S * (state.laneShares.left + state.laneShares.straight),
                state.armFlow.E * (state.laneShares.left + state.laneShares.straight),
                state.armFlow.W * (state.laneShares.left + state.laneShares.straight)
            ];
            const Y = criticalFlows.map(q => q / saturation);
            const Ysum = clamp(Y.reduce((a, b) => a + b, 0), 0.01, 0.92);
            const Copt = clamp(Math.ceil((1.5 * L + 5) / (1 - Ysum)), 30, 120);
            const effectiveGreen = Math.max(Copt - L, 24);
            const greens = Y.map(y => Math.max(8, Math.round((effectiveGreen * y) / Ysum)));
            const adjustedCycle = greens.reduce((a, b) => a + b, 0) + L;
            ui.cycle.value = adjustedCycle;
            ui.cycleValue.textContent = adjustedCycle;
            greens.forEach((g, idx) => {
                ui.green[idx].value = g;
                ui.greenValue[idx].textContent = g;
            });
            applySignalSettings();
            state.overlays.push({
                type: "webster",
                text: `Webster 最优: C=${adjustedCycle}s, 北${greens[0]} 南${greens[1]} 东${greens[2]} 西${greens[3]}`,
                ttl: 5
            });
        }

        function setOversaturatedDemo() {
            state.demo.oversat = true;
            const flows = { N: 1700, E: 1500, S: 1700, W: 1400 };
            for (const arm of DIRS) {
                state.armFlow[arm] = flows[arm];
                ui.flow[arm].value = flows[arm];
                ui.flowValue[arm].textContent = flows[arm];
            }
            ui.cycle.value = 110;
            ui.cycleValue.textContent = 110;
            [18, 18, 16, 16].forEach((g, idx) => {
                ui.green[idx].value = g;
                ui.greenValue[idx].textContent = g;
            });
            applySignalSettings();
            state.overlays.push({ type: "overflow", text: "过饱和场景已加载: v/c > 1", ttl: 5 });
        }

        function setGreenWaveDemo() {
            state.demo.greenWave = !state.demo.greenWave;
            const offset = state.demo.greenWave ? 8 : 0;
            ui.offset.value = offset;
            ui.offsetValue.textContent = offset;
            if (state.demo.greenWave) {
                state.armFlow.N = 900;
                state.armFlow.S = 900;
                ui.flow.N.value = 900;
                ui.flow.S.value = 900;
                ui.flowValue.N.textContent = 900;
                ui.flowValue.S.textContent = 900;
                [22, 22, 12, 12].forEach((g, idx) => {
                    ui.green[idx].value = g;
                    ui.greenValue[idx].textContent = g;
                });
                ui.cycle.value = 84;
                ui.cycleValue.textContent = 84;
                state.overlays.push({ type: "greenwave", text: "绿波协调启用: 主走廊偏移 8s", ttl: 5 });
            } else {
                state.overlays.push({ type: "greenwave", text: "绿波协调已关闭", ttl: 3 });
            }
            applySignalSettings();
        }

        function updatePerformanceUI() {
            const avgDelay = state.performance.getAverageDelay();
            const los = losFromDelay(avgDelay);
            state.performance.lastLOS = los;
            ui.losDisplay.textContent = los.grade;
            ui.losDisplay.style.color = los.color;
            ui.delayDisplay.textContent = avgDelay.toFixed(1);
            ui.throughputDisplay.textContent = Math.round(state.performance.getThroughputPerHour());
            ui.saturationDisplay.textContent = Math.round(state.performance.getMeasuredSaturation());

            const statsHtml = DIRS.map(arm => {
                const q = state.queueDetectors[arm].currentQueue;
                const vc = (state.armFlow[arm] / CONFIG.satFlowPerLane).toFixed(2);
                const width = clamp((q / 80) * 100, 0, 100);
                return `
                    <div class="approach-row">
                        <span class="badge">${arm}</span>
                        <div class="bar"><span style="width:${width}%"></span></div>
                        <span>${formatMeters(q)}</span>
                        <span>v/c ${vc}</span>
                    </div>
                `;
            }).join("");
            ui.approachStats.innerHTML = statsHtml;

            const alerts = [];
            if (los.grade === "E" || los.grade === "F") {
                alerts.push({ cls: "danger", text: `严重拥堵: 平均延误 ${avgDelay.toFixed(1)} s/辆，服务水平 ${los.grade}` });
            }
            const highVC = DIRS.find(arm => state.armFlow[arm] / CONFIG.satFlowPerLane > 0.9);
            if (highVC) {
                alerts.push({ cls: "warn", text: `${highVC} 进口 v/c > 0.9，接近过饱和，队列将持续增长` });
            }
            const spill = DIRS.find(arm => state.queueDetectors[arm].spillback);
            if (spill) {
                alerts.push({ cls: "danger", text: `${spill} 进口发生排队溢出，已干扰上游路段` });
            }
            if (ui.showSat.checked && state.performance.getMeasuredSaturation() > 0) {
                alerts.push({ cls: "info", text: `饱和流率实测: ${Math.round(state.performance.getMeasuredSaturation())} 辆/h` });
            }
            const popup = state.overlays[state.overlays.length - 1];
            if (popup && ["webster", "greenwave", "overflow"].includes(popup.type)) {
                alerts.push({ cls: popup.type === "overflow" ? "warn" : "info", text: popup.text });
            }
            ui.alerts.innerHTML = alerts.slice(0, 4).map(item => `<div class="alert ${item.cls}">${item.text}</div>`).join("");
        }

        function updateUI() {
            for (const arm of DIRS) {
                ui.flowValue[arm].textContent = ui.flow[arm].value;
            }
            ui.cycleValue.textContent = ui.cycle.value;
            ui.offsetValue.textContent = ui.offset.value;
            ui.desiredSpeedValue.textContent = ui.desiredSpeed.value;
            ui.headwayValue.textContent = ui.headway.value;
            ui.green.forEach((el, idx) => {
                ui.greenValue[idx].textContent = el.value;
            });
        }

        function syncModelFromUI() {
            for (const arm of DIRS) {
                state.armFlow[arm] = parseFloat(ui.flow[arm].value);
            }
            state.baseVehicleParams.v0 = parseFloat(ui.desiredSpeed.value) / 3.6;
            state.baseVehicleParams.T = parseFloat(ui.headway.value);
            applySignalSettings();
        }

        function stepSimulation(dt) {
            syncModelFromUI();
            generateArrivals();
            rebuildLaneBuckets();
            state.signal.update(dt);
            updateInboundVehicles(dt);
            updateCrossingVehicles(dt);
            updateOutboundVehicles(dt);
            cleanupVehicles();
            updateQueues();
            updateSpaceTime();
            state.simTime += dt;
            updatePerformanceUI();
        }

        function drawBackground() {
            ctx.fillStyle = "#0f172a";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const gradient = ctx.createRadialGradient(CONFIG.center.x, CONFIG.center.y, 80, CONFIG.center.x, CONFIG.center.y, 420);
            gradient.addColorStop(0, "rgba(56, 189, 248, 0.08)");
            gradient.addColorStop(1, "rgba(15, 23, 42, 0)");
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        function drawRoadSurface() {
            const c = CONFIG.center;
            const roadHalf = CONFIG.laneWidthPx * 3.4;
            const armLen = CONFIG.approachLengthM * CONFIG.pixelPerMeter;
            const exitLen = CONFIG.exitLengthM * CONFIG.pixelPerMeter;
            ctx.fillStyle = state.demo.oversat ? "#414141" : "#374151";

            ctx.fillRect(c.x - roadHalf, c.y - CONFIG.stopLinePx - armLen, roadHalf * 2, armLen + CONFIG.stopLinePx + exitLen);
            ctx.fillRect(c.x - CONFIG.stopLinePx - armLen, c.y - roadHalf, armLen + CONFIG.stopLinePx + exitLen, roadHalf * 2);

            ctx.fillStyle = "#4b5563";
            ctx.fillRect(geometry.intersectionBox.x, geometry.intersectionBox.y, geometry.intersectionBox.w, geometry.intersectionBox.h);
        }

        function drawMarkings() {
            const c = CONFIG.center;
            const roadHalf = CONFIG.laneWidthPx * 3.2;
            ctx.save();
            ctx.lineWidth = 2;
            ctx.setLineDash([10, 8]);
            ctx.strokeStyle = "rgba(251, 191, 36, 0.9)";
            ctx.beginPath();
            ctx.moveTo(c.x, c.y - CONFIG.stopLinePx - CONFIG.approachLengthM * CONFIG.pixelPerMeter);
            ctx.lineTo(c.x, c.y + CONFIG.stopLinePx + CONFIG.exitLengthM * CONFIG.pixelPerMeter);
            ctx.moveTo(c.x - CONFIG.stopLinePx - CONFIG.approachLengthM * CONFIG.pixelPerMeter, c.y);
            ctx.lineTo(c.x + CONFIG.stopLinePx + CONFIG.exitLengthM * CONFIG.pixelPerMeter, c.y);
            ctx.stroke();
            ctx.restore();

            ctx.strokeStyle = "rgba(255,255,255,0.78)";
            ctx.lineWidth = 1.2;
            ctx.setLineDash([]);
            for (const arm of DIRS) {
                const armGeo = geometry.arms[arm];
                for (const lane of ["left", "straight", "right"]) {
                    const offset = armGeo.laneOffsets[lane] - CONFIG.laneWidthPx;
                    const p1 = {
                        x: armGeo.inboundFar.x + armGeo.side.x * offset,
                        y: armGeo.inboundFar.y + armGeo.side.y * offset
                    };
                    const p2 = {
                        x: armGeo.outboundFar.x + armGeo.side.x * offset,
                        y: armGeo.outboundFar.y + armGeo.side.y * offset
                    };
                    ctx.beginPath();
                    ctx.moveTo(p1.x, p1.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.stroke();
                }
            }

            ctx.lineWidth = 3;
            for (const key of Object.keys(geometry.stopLines)) {
                const line = geometry.stopLines[key];
                ctx.strokeStyle = "#ffffff";
                ctx.beginPath();
                ctx.moveTo(line.a.x, line.a.y);
                ctx.lineTo(line.b.x, line.b.y);
                ctx.stroke();
            }

            drawCrosswalk(c.x - roadHalf, c.y - CONFIG.stopLinePx - CONFIG.crosswalkWidthPx, roadHalf * 2, 12, "h");
            drawCrosswalk(c.x - roadHalf, c.y + CONFIG.stopLinePx + 6, roadHalf * 2, 12, "h");
            drawCrosswalk(c.x - CONFIG.stopLinePx - CONFIG.crosswalkWidthPx, c.y - roadHalf, 12, roadHalf * 2, "v");
            drawCrosswalk(c.x + CONFIG.stopLinePx + 6, c.y - roadHalf, 12, roadHalf * 2, "v");
        }

        function drawCrosswalk(x, y, w, h, orientation) {
            ctx.fillStyle = "rgba(248, 250, 252, 0.62)";
            const stripes = 5;
            for (let i = 0; i < stripes; i += 1) {
                if (orientation === "h") {
                    ctx.fillRect(x + i * (w / stripes), y, w / (stripes * 1.8), h);
                } else {
                    ctx.fillRect(x, y + i * (h / stripes), w, h / (stripes * 1.8));
                }
            }
        }

        function drawSignals() {
            for (const phase of PHASES) {
                for (const lane of ["left", "straight"]) {
                    const key = laneId(phase.arm, lane);
                    const head = geometry.signalHeads[key];
                    const stateName = state.signal.laneState[key];
                    drawSignalHead(head.x, head.y, stateName, Math.ceil(state.signal.countdown));
                }
                const rightHead = geometry.signalHeads[laneId(phase.arm, "right")];
                drawSignalHead(rightHead.x, rightHead.y, "green", null, true);
            }
        }

        function drawSignalHead(x, y, active, countdown, rightTurn = false) {
            ctx.save();
            ctx.translate(x, y);
            ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
            ctx.strokeStyle = "rgba(148,163,184,0.35)";
            ctx.lineWidth = 1;
            roundedRectPath(ctx, -12, -24, 24, 52, 8);
            ctx.fill();
            ctx.stroke();

            const colors = ["red", "yellow", "green"];
            const yPos = [-12, 0, 12];
            colors.forEach((name, idx) => {
                const on = name === active || (rightTurn && name === "green");
                ctx.beginPath();
                ctx.fillStyle = on
                    ? name === "red" ? "#ef4444" : name === "yellow" ? "#facc15" : "#22c55e"
                    : "rgba(71, 85, 105, 0.45)";
                if (on) {
                    ctx.shadowBlur = 10;
                    ctx.shadowColor = ctx.fillStyle;
                } else {
                    ctx.shadowBlur = 0;
                }
                ctx.arc(0, yPos[idx], 5, 0, Math.PI * 2);
                ctx.fill();
            });
            ctx.shadowBlur = 0;

            if (countdown !== null && !rightTurn) {
                ctx.fillStyle = "#dbeafe";
                ctx.font = "10px sans-serif";
                ctx.textAlign = "center";
                ctx.fillText(`${countdown}`, 0, 26);
            } else if (rightTurn) {
                ctx.fillStyle = "#a7f3d0";
                ctx.font = "9px sans-serif";
                ctx.textAlign = "center";
                ctx.fillText("RT", 0, 26);
            }
            ctx.restore();
        }

        function drawQueueOverlays() {
            if (!ui.showQueue.checked) return;
            for (const arm of DIRS) {
                const queue = state.queueDetectors[arm];
                if (queue.currentQueue <= 0.5) continue;
                const stop = geometry.arms[arm].inboundStop;
                const dir = geometry.arms[arm].dir;
                const side = geometry.arms[arm].side;
                const halfWidth = CONFIG.laneWidthPx * 2.8;
                const len = queue.currentQueue * CONFIG.pixelPerMeter;
                ctx.save();
                ctx.fillStyle = queue.spillback ? "rgba(239, 68, 68, 0.28)" : "rgba(248, 113, 113, 0.16)";
                const x = stop.x - side.x * halfWidth;
                const y = stop.y - side.y * halfWidth;
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x + side.x * halfWidth * 2, y + side.y * halfWidth * 2);
                ctx.lineTo(x + side.x * halfWidth * 2 - dir.x * len, y + side.y * halfWidth * 2 - dir.y * len);
                ctx.lineTo(x - dir.x * len, y - dir.y * len);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }
        }

        function drawVehicles() {
            const ordered = state.vehicles
                .filter(v => v.segment !== "departed")
                .slice()
                .sort((a, b) => {
                    const layerA = a.segment === "crossing" ? 2 : a.segment === "inbound" ? 1 : 0;
                    const layerB = b.segment === "crossing" ? 2 : b.segment === "inbound" ? 1 : 0;
                    return layerA - layerB || a.pos - b.pos;
                });

            for (const vehicle of ordered) {
                const p = vehicle.positionPoint;
                const angle = vehicle.angle;
                const lengthPx = vehicle.length * CONFIG.pixelPerMeter;
                const widthPx = vehicle.width * CONFIG.pixelPerMeter * 1.25;
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(angle + Math.PI / 2);
                ctx.fillStyle = speedToColor(vehicle.vel, vehicle.v0);
                ctx.strokeStyle = "rgba(15, 23, 42, 0.7)";
                ctx.lineWidth = 1;
                roundedRectPath(ctx, -widthPx / 2, -lengthPx / 2, widthPx, lengthPx, 4);
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = "rgba(255,255,255,0.85)";
                ctx.fillRect(-widthPx / 4, -lengthPx / 2 + 2, widthPx / 2, 2);
                if (vehicle.acc < -1.5 || vehicle.vel < 0.5) {
                    ctx.fillStyle = "rgba(255, 80, 80, 0.9)";
                    ctx.beginPath();
                    ctx.arc(-widthPx / 4, lengthPx / 2 - 2, 1.8, 0, Math.PI * 2);
                    ctx.arc(widthPx / 4, lengthPx / 2 - 2, 1.8, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.restore();
            }
        }

        function drawGreenWaveGuides() {
            if (!state.demo.greenWave) return;
            ["N", "S"].forEach(arm => {
                const line = geometry.stopLines[laneId(arm, "straight")];
                const dir = geometry.arms[arm].dir;
                ctx.save();
                ctx.strokeStyle = "rgba(125, 211, 252, 0.8)";
                ctx.fillStyle = "rgba(125, 211, 252, 0.9)";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(line.point.x - dir.x * 10, line.point.y - dir.y * 10);
                ctx.lineTo(line.point.x - dir.x * 45, line.point.y - dir.y * 45);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(line.point.x - dir.x * 45, line.point.y - dir.y * 45);
                ctx.lineTo(line.point.x - dir.x * 38 + geometry.arms[arm].side.x * 6, line.point.y - dir.y * 38 + geometry.arms[arm].side.y * 6);
                ctx.lineTo(line.point.x - dir.x * 38 - geometry.arms[arm].side.x * 6, line.point.y - dir.y * 38 - geometry.arms[arm].side.y * 6);
                ctx.closePath();
                ctx.fill();
                ctx.font = "12px sans-serif";
                ctx.fillText(`理想到达 ${Math.round(ui.offset.value)}s`, line.point.x - dir.x * 72, line.point.y - dir.y * 50);
                ctx.restore();
            });
        }

        function drawEducationLabels() {
            ctx.save();
            ctx.font = "13px sans-serif";
            ctx.textAlign = "left";
            let y = 34;
            const lines = [
                `仿真时钟 ${state.simTime.toFixed(1)} s`,
                `当前相位 ${PHASES[state.signal.phaseIndex].label} ${state.signal.stage.toUpperCase()}`,
                `车辆数 ${state.vehicles.length}`
            ];
            ctx.fillStyle = "rgba(230, 237, 248, 0.92)";
            for (const line of lines) {
                ctx.fillText(line, 24, y);
                y += 18;
            }
            for (const arm of DIRS) {
                const stop = geometry.stopLines[laneId(arm, "straight")].point;
                ctx.fillStyle = state.queueDetectors[arm].spillback ? "#f87171" : "#e5e7eb";
                ctx.fillText(`${arm}: ${Math.round(state.queueDetectors[arm].currentQueue)}m`, stop.x + 14, stop.y - 12);
            }

            if (ui.showSat.checked) {
                const nStop = geometry.stopLines["N-straight"].point;
                ctx.fillStyle = "#86efac";
                ctx.fillText(`s≈${Math.round(state.performance.getMeasuredSaturation())} 辆/h`, nStop.x + 32, nStop.y + 18);
            }
            ctx.restore();

            if (!state.overlays.length) return;
            const overlay = state.overlays[state.overlays.length - 1];
            ctx.save();
            ctx.fillStyle = overlay.type === "overflow" ? "rgba(239,68,68,0.22)" : "rgba(59,130,246,0.18)";
            ctx.strokeStyle = overlay.type === "overflow" ? "rgba(248,113,113,0.6)" : "rgba(125,211,252,0.5)";
            ctx.lineWidth = 1;
            roundedRectPath(ctx, 26, canvas.height - 92, 360, 44, 12);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = "#e6edf8";
            ctx.font = "14px sans-serif";
            ctx.fillText(overlay.text, 42, canvas.height - 64);
            ctx.restore();
        }

        function drawSpaceTimeWindow() {
            if (!ui.showSpaceTime.checked) return;
            const w = 280;
            const h = 160;
            const x = canvas.width - w - 18;
            const y = canvas.height - h - 18;
            ctx.save();
            ctx.fillStyle = "rgba(2, 6, 23, 0.82)";
            ctx.strokeStyle = "rgba(148,163,184,0.34)";
            ctx.lineWidth = 1;
            roundedRectPath(ctx, x, y, w, h, 14);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = "#cbd5e1";
            ctx.font = "12px sans-serif";
            ctx.fillText("北进口时空图", x + 12, y + 18);

            const pad = 14;
            const gx = x + pad;
            const gy = y + 28;
            const gw = w - pad * 2;
            const gh = h - 42;

            ctx.strokeStyle = "rgba(148,163,184,0.22)";
            ctx.strokeRect(gx, gy, gw, gh);

            const history = 80;
            const t0 = Math.max(0, state.simTime - history);
            for (let sec = Math.floor(t0 / 5) * 5; sec <= state.simTime; sec += 5) {
                const px = gx + ((sec - t0) / history) * gw;
                ctx.strokeStyle = "rgba(148,163,184,0.12)";
                ctx.beginPath();
                ctx.moveTo(px, gy);
                ctx.lineTo(px, gy + gh);
                ctx.stroke();
            }

            const greenWindows = estimateNorthGreenWindows(t0, state.simTime);
            for (const win of greenWindows) {
                const sx = gx + ((win.start - t0) / history) * gw;
                const ex = gx + ((win.end - t0) / history) * gw;
                ctx.fillStyle = "rgba(34,197,94,0.12)";
                ctx.fillRect(sx, gy, ex - sx, gh);
            }

            for (const point of state.spaceTime) {
                if (point.t < t0) continue;
                const px = gx + ((point.t - t0) / history) * gw;
                const py = gy + gh - (point.x / CONFIG.approachLengthM) * gh;
                ctx.fillStyle = speedToColor(point.speed, state.baseVehicleParams.v0);
                ctx.fillRect(px, py, 2, 2);
            }

            ctx.fillStyle = "#94a3b8";
            ctx.font = "10px sans-serif";
            ctx.fillText("时间", gx + gw - 24, gy + gh + 12);
            ctx.save();
            ctx.translate(gx - 8, gy + gh / 2);
            ctx.rotate(-Math.PI / 2);
            ctx.fillText("距上游入口", 0, 0);
            ctx.restore();
            ctx.restore();
        }

        function estimateNorthGreenWindows(startTime, endTime) {
            const windows = [];
            const green = state.signal.greenTimes[0];
            const cycle = state.signal.greenTimes.reduce((a, b) => a + b, 0) + CONFIG.yellowTime * 4 + CONFIG.allRedTime * 4;
            let t = -cycle * 2;
            while (t < endTime + cycle) {
                const start = t;
                const end = t + green;
                if (end >= startTime && start <= endTime) {
                    windows.push({ start, end });
                }
                t += cycle;
            }
            return windows;
        }

        function draw() {
            drawBackground();
            drawRoadSurface();
            drawMarkings();
            drawSignals();
            drawQueueOverlays();
            drawGreenWaveGuides();
            drawVehicles();
            drawSpaceTimeWindow();
            drawEducationLabels();
        }

        function resizeCanvas() {
            const rect = document.getElementById("canvas-wrap").getBoundingClientRect();
            canvas.width = rect.width;
            canvas.height = rect.height;
            CONFIG.center.x = Math.max(420, rect.width * 0.5);
            CONFIG.center.y = rect.height * 0.5;
            computeGeometry();
        }

        function frame(ts) {
            if (!state.lastFrame) state.lastFrame = ts;
            const elapsed = Math.min((ts - state.lastFrame) / 1000, 0.1);
            state.lastFrame = ts;
            if (state.running) {
                state.accumulator += elapsed * CONFIG.timeWarp;
                while (state.accumulator >= CONFIG.dt) {
                    stepSimulation(CONFIG.dt);
                    state.accumulator -= CONFIG.dt;
                }
            }
            draw();
            requestAnimationFrame(frame);
        }

        function bindRange(input, onChange) {
            input.addEventListener("input", () => {
                updateUI();
                if (onChange) onChange();
            });
        }

        function bindUI() {
            for (const arm of DIRS) {
                bindRange(ui.flow[arm], () => {
                    state.armFlow[arm] = parseFloat(ui.flow[arm].value);
                });
            }
            bindRange(ui.cycle, applySignalSettings);
            bindRange(ui.offset, applySignalSettings);
            ui.green.forEach(el => bindRange(el, applySignalSettings));
            bindRange(ui.desiredSpeed);
            bindRange(ui.headway);

            ui.btnRun.addEventListener("click", () => { state.running = true; });
            ui.btnPause.addEventListener("click", () => { state.running = false; });
            ui.btnReset.addEventListener("click", resetSimulation);
            ui.btnSpeed.addEventListener("click", () => {
                CONFIG.timeWarp = CONFIG.timeWarp === 1 ? 2 : CONFIG.timeWarp === 2 ? 4 : 1;
                ui.btnSpeed.textContent = `⚡${CONFIG.timeWarp}x`;
            });
            ui.btnWebster.addEventListener("click", runWebsterOptimization);
            ui.btnOversat.addEventListener("click", setOversaturatedDemo);
            ui.btnGreenWave.addEventListener("click", setGreenWaveDemo);
            window.addEventListener("resize", resizeCanvas);
        }

        resizeCanvas();
        bindUI();
        updateUI();
        resetSimulation();
        requestAnimationFrame(frame);
