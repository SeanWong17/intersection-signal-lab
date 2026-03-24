// ─── 路口几何计算 ──────────────────────────────────────────────────────────────
// 依赖：intersection.config.js（CONFIG, DIRS, DIR_VECTORS, SIDE_VECTORS,
//        TURN_TO_EXIT, laneId, clamp, lerp）

const geometry = {
    arms: {},
    stopLines: {},
    signalHeads: {},
    intersectionBox: {},
    pathCache: {},
};

function getInboundLaneOffsets() {
    return {
        left: -CONFIG.laneWidthPx * 0.5,
        straight: -CONFIG.laneWidthPx * 1.5,
        right: -CONFIG.laneWidthPx * 2.5,
    };
}

function getOutboundLaneOffsets() {
    return {
        left: CONFIG.laneWidthPx * 0.5,
        straight: CONFIG.laneWidthPx * 1.5,
        right: CONFIG.laneWidthPx * 2.5,
    };
}

function getBoundaryOffsets() {
    return [-2, -1, 1, 2].map(value => value * CONFIG.laneWidthPx);
}

function computeGeometry() {
    const c = CONFIG.center;
    const inner = CONFIG.stopLinePx;
    const armLengthPx = CONFIG.approachLengthM * CONFIG.pixelPerMeter;
    const exitLengthPx = CONFIG.exitLengthM * CONFIG.pixelPerMeter;
    const inboundLaneOffsets = getInboundLaneOffsets();
    const outboundLaneOffsets = getOutboundLaneOffsets();
    const signalPullback = {
        left: 56,
        straight: 28,
        right: 0,
    };

    for (const arm of DIRS) {
        const dir  = DIR_VECTORS[arm];
        const side = SIDE_VECTORS[arm];

        const approachAnchor = {
            x: c.x + dir.x * inner,
            y: c.y + dir.y * inner,
        };
        const inboundFar = {
            x: c.x + dir.x * (inner + armLengthPx),
            y: c.y + dir.y * (inner + armLengthPx),
        };
        const outboundFar = {
            x: c.x + dir.x * (inner + exitLengthPx),
            y: c.y + dir.y * (inner + exitLengthPx),
        };

        geometry.arms[arm] = {
            dir,
            side,
            inboundFar,
            outboundFar,
            approachAnchor,
            inboundLaneOffsets,
            outboundLaneOffsets,
            boundaryOffsets: getBoundaryOffsets(),
        };

        for (const lane of ["left", "straight", "right"]) {
            const offset = inboundLaneOffsets[lane];
            geometry.stopLines[laneId(arm, lane)] = {
                a: {
                    x: approachAnchor.x + side.x * (offset - CONFIG.laneWidthPx * 0.45),
                    y: approachAnchor.y + side.y * (offset - CONFIG.laneWidthPx * 0.45),
                },
                b: {
                    x: approachAnchor.x + side.x * (offset + CONFIG.laneWidthPx * 0.45),
                    y: approachAnchor.y + side.y * (offset + CONFIG.laneWidthPx * 0.45),
                },
                point: {
                    x: approachAnchor.x + side.x * offset,
                    y: approachAnchor.y + side.y * offset,
                },
            };
            geometry.signalHeads[laneId(arm, lane)] = {
                x: approachAnchor.x + side.x * offset - dir.x * signalPullback[lane],
                y: approachAnchor.y + side.y * offset - dir.y * signalPullback[lane],
            };
        }
    }

    geometry.intersectionBox = {
        x: c.x - inner, y: c.y - inner,
        w: inner * 2,   h: inner * 2,
    };

    // 预计算所有转向贝塞尔路径
    for (const arm of DIRS) {
        for (const turn of ["left", "straight", "right"]) {
            geometry.pathCache[laneId(arm, turn)] = buildCrossingPath(arm, turn);
        }
    }
}

// ─── 车道坐标查询 ──────────────────────────────────────────────────────────────

function getLanePoint(arm, lane, posMeters, inbound = true) {
    const armGeo = geometry.arms[arm];
    const offset = inbound ? armGeo.inboundLaneOffsets[lane] : armGeo.outboundLaneOffsets[lane];
    const dir    = inbound ? { x: -armGeo.dir.x, y: -armGeo.dir.y } : armGeo.dir;
    const base   = inbound ? armGeo.inboundFar : armGeo.approachAnchor;
    const posPx  = posMeters * CONFIG.pixelPerMeter;
    return {
        x: base.x + armGeo.side.x * offset + dir.x * posPx,
        y: base.y + armGeo.side.y * offset + dir.y * posPx,
    };
}

// ─── 贝塞尔曲线 ───────────────────────────────────────────────────────────────

function bezierQuadratic(p0, p1, p2, t) {
    const mt = 1 - t;
    return {
        x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
        y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
    };
}

function bezierCubic(p0, p1, p2, p3, t) {
    const mt = 1 - t;
    return {
        x: mt*mt*mt*p0.x + 3*mt*mt*t*p1.x + 3*mt*t*t*p2.x + t*t*t*p3.x,
        y: mt*mt*mt*p0.y + 3*mt*mt*t*p1.y + 3*mt*t*t*p2.y + t*t*t*p3.y,
    };
}

function sampleArcLength(points) {
    let total = 0;
    const arc = [{ s: 0, p: points[0] }];
    for (let i = 1; i < points.length; i++) {
        const dx = points[i].x - points[i - 1].x;
        const dy = points[i].y - points[i - 1].y;
        total += Math.hypot(dx, dy);
        arc.push({ s: total, p: points[i] });
    }
    return { total, arc };
}

function buildCrossingPath(arm, turn) {
    const startLane = turn;
    const start   = geometry.stopLines[laneId(arm, startLane)].point;
    const exitArm = TURN_TO_EXIT[arm][turn];
    const exitGeo = geometry.arms[exitArm];
    const exitLane = turn;
    const end = {
        x: exitGeo.approachAnchor.x + exitGeo.side.x * exitGeo.outboundLaneOffsets[exitLane],
        y: exitGeo.approachAnchor.y + exitGeo.side.y * exitGeo.outboundLaneOffsets[exitLane],
    };
    const center = CONFIG.center;
    const armGeo = geometry.arms[arm];
    const points = [];

    if (turn === "straight") {
        const control = {
            x: center.x + (armGeo.side.x - exitGeo.side.x) * 6,
            y: center.y + (armGeo.side.y - exitGeo.side.y) * 6,
        };
        for (let i = 0; i <= 100; i++) points.push(bezierQuadratic(start, control, end, i / 100));
    } else if (turn === "left") {
        const p1 = {
            x: start.x + armGeo.dir.x * 20 + armGeo.side.x * 8,
            y: start.y + armGeo.dir.y * 20 + armGeo.side.y * 8,
        };
        const p2 = {
            x: center.x - exitGeo.dir.x * 20 + exitGeo.side.x * 8,
            y: center.y - exitGeo.dir.y * 20 + exitGeo.side.y * 8,
        };
        for (let i = 0; i <= 100; i++) points.push(bezierCubic(start, p1, p2, end, i / 100));
    } else {
        const control = {
            x: center.x - armGeo.dir.x * 18 + armGeo.side.x * 14,
            y: center.y - armGeo.dir.y * 18 + armGeo.side.y * 14,
        };
        for (let i = 0; i <= 100; i++) points.push(bezierQuadratic(start, control, end, i / 100));
    }

    const { total, arc } = sampleArcLength(points);
    return { points, arc, lengthMeters: total / CONFIG.pixelPerMeter };
}

// ─── 路径采样 ─────────────────────────────────────────────────────────────────

function pointOnPath(path, distanceMeters) {
    const sPx = clamp(distanceMeters * CONFIG.pixelPerMeter, 0, path.arc[path.arc.length - 1].s);
    for (let i = 1; i < path.arc.length; i++) {
        if (path.arc[i].s >= sPx) {
            const prev  = path.arc[i - 1];
            const next  = path.arc[i];
            const ratio = next.s === prev.s ? 0 : (sPx - prev.s) / (next.s - prev.s);
            return { x: lerp(prev.p.x, next.p.x, ratio), y: lerp(prev.p.y, next.p.y, ratio) };
        }
    }
    return path.arc[path.arc.length - 1].p;
}

function headingOnPath(path, distanceMeters) {
    const p0 = pointOnPath(path, distanceMeters);
    const p1 = pointOnPath(path, Math.min(distanceMeters + 2, path.lengthMeters));
    return Math.atan2(p1.y - p0.y, p1.x - p0.x);
}
