// ─── 渲染引擎 ──────────────────────────────────────────────────────────────────
// 依赖：intersection.config.js，intersection.geometry.js，
//        intersection.models.js，intersection.simulation.js
// 使用外部变量：canvas, ctx, ui, state

// ── 背景 ──────────────────────────────────────────────────────────────────────

function drawBackground() {
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const g = ctx.createRadialGradient(
        CONFIG.center.x, CONFIG.center.y, 120,
        CONFIG.center.x, CONFIG.center.y, 550
    );
    g.addColorStop(0, "rgba(56,189,248,0.08)");
    g.addColorStop(1, "rgba(15,23,42,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// ── 路面 ──────────────────────────────────────────────────────────────────────

function getRoadHalfWidthPx() {
    return CONFIG.centerDividerPx * 0.5 + CONFIG.laneWidthPx * 3.35;
}

function drawRoadSurface() {
    const c = CONFIG.center;
    const roadHalf = getRoadHalfWidthPx();
    const armLen   = CONFIG.approachLengthM * CONFIG.pixelPerMeter;
    const exitLen  = CONFIG.exitLengthM     * CONFIG.pixelPerMeter;

    ctx.fillStyle = state.demo.oversat ? "#3a3a3a" : "#374151";
    // 南北走廊
    ctx.fillRect(c.x - roadHalf, c.y - CONFIG.stopLinePx - armLen,
                 roadHalf * 2, armLen + CONFIG.stopLinePx * 2 + exitLen);
    // 东西走廊（跨越中心）
    ctx.fillRect(c.x - CONFIG.stopLinePx - armLen, c.y - roadHalf,
                 armLen + CONFIG.stopLinePx * 2 + exitLen, roadHalf * 2);

    // 路口中心方块（稍浅）
    ctx.fillStyle = "#4b5563";
    ctx.fillRect(geometry.intersectionBox.x, geometry.intersectionBox.y,
                 geometry.intersectionBox.w, geometry.intersectionBox.h);
}

// ── 标线 ──────────────────────────────────────────────────────────────────────

function drawMarkings() {
    const c        = CONFIG.center;
    const roadHalf = getRoadHalfWidthPx() - CONFIG.laneWidthPx * 0.12;

    ctx.save();
    ctx.lineWidth = 1.35;
    ctx.setLineDash([]);

    for (const arm of DIRS) {
        const armGeo = geometry.arms[arm];
        const outerInbound = armGeo.inboundBoundaryOffsets[armGeo.inboundBoundaryOffsets.length - 1];
        const outerOutbound = armGeo.outboundBoundaryOffsets[armGeo.outboundBoundaryOffsets.length - 1];

        ctx.strokeStyle = "rgba(255,255,255,0.72)";
        ctx.setLineDash([12, 10]);

        for (const offset of armGeo.inboundBoundaryOffsets.slice(1, -1)) {
            const p1 = {
                x: armGeo.inboundFar.x  + armGeo.side.x * offset,
                y: armGeo.inboundFar.y  + armGeo.side.y * offset,
            };
            const p2 = {
                x: armGeo.approachAnchor.x + armGeo.side.x * offset,
                y: armGeo.approachAnchor.y + armGeo.side.y * offset,
            };
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
        }

        for (const offset of armGeo.outboundBoundaryOffsets.slice(1, -1)) {
            const p1 = {
                x: armGeo.approachAnchor.x + armGeo.side.x * offset,
                y: armGeo.approachAnchor.y + armGeo.side.y * offset,
            };
            const p2 = {
                x: armGeo.outboundFar.x + armGeo.side.x * offset,
                y: armGeo.outboundFar.y + armGeo.side.y * offset,
            };
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
        }

        ctx.setLineDash([]);
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.lineWidth = 1.8;
        for (const offset of [outerInbound, outerOutbound]) {
            const p1 = {
                x: armGeo.inboundFar.x + armGeo.side.x * offset,
                y: armGeo.inboundFar.y + armGeo.side.y * offset,
            };
            const p2 = {
                x: armGeo.approachAnchor.x + armGeo.side.x * offset,
                y: armGeo.approachAnchor.y + armGeo.side.y * offset,
            };
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
        }

        ctx.strokeStyle = "rgba(251,191,36,0.88)";
        ctx.lineWidth = 2.4;
        for (const offset of [-CONFIG.centerDividerPx * 0.5, CONFIG.centerDividerPx * 0.5]) {
            const p1 = {
                x: armGeo.inboundFar.x + armGeo.side.x * offset,
                y: armGeo.inboundFar.y + armGeo.side.y * offset,
            };
            const p2 = {
                x: armGeo.approachAnchor.x + armGeo.side.x * offset,
                y: armGeo.approachAnchor.y + armGeo.side.y * offset,
            };
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
        }
        ctx.lineWidth = 1;
    }
    ctx.restore();

    // 停车线（实白线）
    ctx.lineWidth   = 3;
    ctx.strokeStyle = "#ffffff";
    for (const key of Object.keys(geometry.stopLines)) {
        const line = geometry.stopLines[key];
        ctx.beginPath();
        ctx.moveTo(line.a.x, line.a.y);
        ctx.lineTo(line.b.x, line.b.y);
        ctx.stroke();
    }
}

function drawCrosswalk(x, y, w, h, orientation) {
    ctx.fillStyle = "rgba(248,250,252,0.55)";
    const stripes = 6;
    for (let i = 0; i < stripes; i++) {
        if (orientation === "h") {
            ctx.fillRect(x + i * (w / stripes), y, w / (stripes * 1.8), h);
        } else {
            ctx.fillRect(x, y + i * (h / stripes), w, h / (stripes * 1.8));
        }
    }
}

function drawLaneDirectionArrows() {
    ctx.save();
    ctx.strokeStyle = "rgba(241,245,249,0.7)";
    ctx.fillStyle = "rgba(241,245,249,0.82)";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (const arm of DIRS) {
        const armGeo = geometry.arms[arm];
        const inboundDir = { x: -armGeo.dir.x, y: -armGeo.dir.y };
        const arrowOriginDistance = 30;

        for (const lane of ["left", "straight", "right"]) {
            const stopPoint = geometry.stopLines[laneId(arm, lane)].point;
            const start = {
                x: stopPoint.x + armGeo.dir.x * arrowOriginDistance,
                y: stopPoint.y + armGeo.dir.y * arrowOriginDistance,
            };

            if (lane === "straight") {
                const stem = {
                    x: start.x + inboundDir.x * 22,
                    y: start.y + inboundDir.y * 22,
                };
                ctx.beginPath();
                ctx.moveTo(start.x, start.y);
                ctx.lineTo(stem.x, stem.y);
                ctx.stroke();
                drawArrowHead(stem, inboundDir, armGeo.side, 7);
                continue;
            }

            const bendSign = lane === "left" ? 1 : -1;
            // Straight stem first
            const stemEnd = {
                x: start.x + inboundDir.x * 10,
                y: start.y + inboundDir.y * 10,
            };
            // Curve control and end
            const control = {
                x: stemEnd.x + inboundDir.x * 8,
                y: stemEnd.y + inboundDir.y * 8,
            };
            const end = {
                x: control.x + armGeo.side.x * bendSign * 10,
                y: control.y + armGeo.side.y * bendSign * 10,
            };

            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(stemEnd.x, stemEnd.y);
            ctx.quadraticCurveTo(control.x, control.y, end.x, end.y);
            ctx.stroke();

            // Tangent at t=1 of quadratic bezier: 2*(end - control)
            const tangent = {
                x: end.x - control.x,
                y: end.y - control.y,
            };
            drawArrowHead(end, tangent, armGeo.side, 6);
        }
    }

    ctx.restore();
}

function drawArrowHead(point, direction, side, size) {
    const mag = Math.hypot(direction.x, direction.y) || 1;
    const dx = direction.x / mag;
    const dy = direction.y / mag;
    const px = -dy;
    const py = dx;

    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    ctx.lineTo(point.x - dx * size + px * size * 0.55, point.y - dy * size + py * size * 0.55);
    ctx.lineTo(point.x - dx * size - px * size * 0.55, point.y - dy * size - py * size * 0.55);
    ctx.closePath();
    ctx.fill();
}

// ── 信号灯 ────────────────────────────────────────────────────────────────────

function drawSignals() {
    for (const arm of DIRS) {
        const armDir = geometry.arms[arm].dir;

        for (const lane of ["left", "straight"]) {
            const key       = laneId(arm, lane);
            const head      = geometry.signalHeads[key];
            const stateName = state.signal.laneState[key];
            drawSignalHead(head.x, head.y, stateName, Math.ceil(state.signal.countdown), false, armDir);
        }
        const rightHeadPos = geometry.signalHeads[laneId(arm, "right")];
        drawSignalHead(rightHeadPos.x, rightHeadPos.y, "green", null, true, armDir);
    }
}

function drawSignalSupport(armGeo) {
    // No longer needed - signals are placed directly in lanes
}

function drawSignalHead(x, y, active, countdown, rightTurn, armDir) {
    const rotation = Math.atan2(armDir.y, armDir.x);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);

    // 灯箱背景（沿车道方向排列）
    ctx.fillStyle   = "rgba(10,18,35,0.85)";
    ctx.strokeStyle = "rgba(148,163,184,0.25)";
    ctx.lineWidth   = 0.8;
    roundedRectPath(ctx, -16, -8, 32, 16, 4);
    ctx.fill();
    ctx.stroke();

    // 三色灯
    const colorNames = ["red", "yellow", "green"];
    const hexColors  = { red: "#ef4444", yellow: "#facc15", green: "#22c55e" };
    const positions  = [-9, 0, 9];

    for (let i = 0; i < 3; i++) {
        const name = colorNames[i];
        const on   = (name === active) || (rightTurn && name === "green");
        ctx.beginPath();
        ctx.fillStyle = on ? hexColors[name] : "rgba(55,65,81,0.6)";
        if (on) {
            ctx.shadowBlur  = 8;
            ctx.shadowColor = hexColors[name];
        } else {
            ctx.shadowBlur = 0;
        }
        ctx.arc(positions[i], 0, 3.2, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.restore();

    // 倒计时数字（信号灯上游方向，不旋转）
    ctx.save();
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    if (countdown !== null && !rightTurn) {
        ctx.fillStyle = "rgba(220,235,254,0.85)";
        ctx.font      = "bold 9px sans-serif";
        ctx.fillText(`${Math.ceil(countdown)}`, x + armDir.x * 18, y + armDir.y * 18);
    } else if (rightTurn) {
        ctx.fillStyle = "rgba(167,243,208,0.75)";
        ctx.font      = "bold 7px sans-serif";
        ctx.fillText("RT", x + armDir.x * 18, y + armDir.y * 18);
    }
    ctx.restore();
}

// ── 排队可视化叠加层 ───────────────────────────────────────────────────────────

function drawQueueOverlays() {
    if (!ui.showQueue.checked) return;
    for (const arm of DIRS) {
        const queue = state.queueDetectors[arm];
        if (queue.currentQueue <= 0.5) continue;
        const stop     = geometry.arms[arm].approachAnchor;
        const dir      = geometry.arms[arm].dir;
        const side     = geometry.arms[arm].side;
        const maxLen   = CONFIG.approachLengthM * CONFIG.pixelPerMeter * 0.85;
        const len      = Math.min(queue.currentQueue * CONFIG.pixelPerMeter, maxLen);
        ctx.save();
        ctx.fillStyle = queue.spillback
            ? "rgba(239,68,68,0.28)"
            : "rgba(248,113,113,0.14)";
        ctx.beginPath();
        const innerOffset = geometry.arms[arm].inboundBoundaryOffsets[0];
        const centerX = stop.x + side.x * innerOffset;
        const centerY = stop.y + side.y * innerOffset;
        const outerOffset = geometry.arms[arm].inboundBoundaryOffsets[geometry.arms[arm].inboundBoundaryOffsets.length - 1];
        const outerX = stop.x + side.x * outerOffset;
        const outerY = stop.y + side.y * outerOffset;
        ctx.moveTo(centerX,                     centerY);
        ctx.lineTo(outerX,                      outerY);
        ctx.lineTo(outerX - dir.x * len,        outerY - dir.y * len);
        ctx.lineTo(centerX - dir.x * len,       centerY - dir.y * len);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
}

// ── 车辆 ──────────────────────────────────────────────────────────────────────

function drawVehicles() {
    const ordered = state.vehicles
        .filter(v => v.segment !== "departed")
        .sort((a, b) => {
            const la = a.segment === "crossing" ? 2 : a.segment === "inbound" ? 1 : 0;
            const lb = b.segment === "crossing" ? 2 : b.segment === "inbound" ? 1 : 0;
            return la - lb || a.pos - b.pos;
        });

    for (const vehicle of ordered) {
        const p        = vehicle.positionPoint;
        const angle    = vehicle.angle;
        const lengthPx = vehicle.length * CONFIG.pixelPerMeter * 1.1;
        const widthPx  = vehicle.width  * CONFIG.pixelPerMeter * 1.4;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(angle + Math.PI / 2);
        ctx.shadowBlur = 6;
        ctx.shadowColor = "rgba(15,23,42,0.4)";

        // 车身
        const bodyColor = speedToColor(vehicle.vel, vehicle.v0);
        ctx.fillStyle   = bodyColor;
        ctx.strokeStyle = "rgba(10,18,35,0.55)";
        ctx.lineWidth   = 0.7;
        roundedRectPath(ctx, -widthPx / 2, -lengthPx / 2, widthPx, lengthPx, 3.5);
        ctx.fill();
        ctx.stroke();

        // 前窗玻璃
        ctx.fillStyle = "rgba(180,220,255,0.55)";
        roundedRectPath(ctx, -widthPx * 0.32, -lengthPx / 2 + 2.5, widthPx * 0.64, lengthPx * 0.18, 2);
        ctx.fill();

        // 车顶高光
        ctx.fillStyle = "rgba(255,255,255,0.12)";
        roundedRectPath(ctx, -widthPx * 0.22, -lengthPx * 0.12, widthPx * 0.44, lengthPx * 0.32, 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // 前灯
        ctx.fillStyle = "rgba(255,250,220,0.7)";
        ctx.beginPath();
        ctx.arc(-widthPx / 2 + 2.2, -lengthPx / 2 + 2.2, 1.5, 0, Math.PI * 2);
        ctx.arc( widthPx / 2 - 2.2, -lengthPx / 2 + 2.2, 1.5, 0, Math.PI * 2);
        ctx.fill();

        // 刹车灯 / 尾灯
        if (vehicle.acc < -1.5 || vehicle.vel < 0.5) {
            ctx.fillStyle = "rgba(255,50,50,0.95)";
        } else {
            ctx.fillStyle = "rgba(180,40,40,0.5)";
        }
        ctx.beginPath();
        ctx.arc(-widthPx / 2 + 2.2, lengthPx / 2 - 2, 1.6, 0, Math.PI * 2);
        ctx.arc( widthPx / 2 - 2.2, lengthPx / 2 - 2, 1.6, 0, Math.PI * 2);
        ctx.fill();

        // 转向灯（转弯车辆闪烁）
        if (vehicle.turnIntent !== "straight") {
            const blink = Math.floor(Date.now() / 400) % 2 === 0;
            if (blink) {
                ctx.fillStyle = "rgba(255,180,30,0.9)";
                const signalSide = vehicle.turnIntent === "left" ? -1 : 1;
                ctx.beginPath();
                ctx.arc(signalSide * (widthPx / 2 - 1.5), -lengthPx / 2 + 1.5, 1.3, 0, Math.PI * 2);
                ctx.arc(signalSide * (widthPx / 2 - 1.5),  lengthPx / 2 - 1.5, 1.3, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.restore();
    }
}

// ── 绿波引导箭头 ───────────────────────────────────────────────────────────────

function drawGreenWaveGuides() {
    if (!state.demo.greenWave) return;
    for (const arm of ["N", "S"]) {
        const line = geometry.stopLines[laneId(arm, "straight")];
        const dir  = geometry.arms[arm].dir;
        const side = geometry.arms[arm].side;
        ctx.save();
        ctx.strokeStyle = "rgba(125,211,252,0.8)";
        ctx.fillStyle   = "rgba(125,211,252,0.9)";
        ctx.lineWidth   = 2;
        // 主干线
        ctx.beginPath();
        ctx.moveTo(line.point.x - dir.x * 10, line.point.y - dir.y * 10);
        ctx.lineTo(line.point.x - dir.x * 45, line.point.y - dir.y * 45);
        ctx.stroke();
        // 箭头头
        ctx.beginPath();
        ctx.moveTo(line.point.x - dir.x * 45,             line.point.y - dir.y * 45);
        ctx.lineTo(line.point.x - dir.x * 38 + side.x * 6, line.point.y - dir.y * 38 + side.y * 6);
        ctx.lineTo(line.point.x - dir.x * 38 - side.x * 6, line.point.y - dir.y * 38 - side.y * 6);
        ctx.closePath();
        ctx.fill();
        // 标注文字
        ctx.fillStyle = "rgba(125,211,252,0.9)";
        ctx.font      = "12px sans-serif";
        ctx.fillText(t("canvas.idealArrival", { offset: Math.round(ui.offset.value) }),
                     line.point.x - dir.x * 72, line.point.y - dir.y * 50);
        ctx.restore();
    }
}

// ── 教育标注（Canvas 内叠字） ─────────────────────────────────────────────────

function drawEducationLabels() {
    ctx.save();
    ctx.font      = "13px sans-serif";
    ctx.textAlign = "left";
    let y = 34;
    const lines = [
        t("canvas.simClock", { time: state.simTime.toFixed(1) }),
        t("canvas.currentPhase", {
            phase: getPhaseLabel(PHASES[state.signal.phaseIndex].key),
            stage: getSignalStageLabel(state.signal.stage)
        }),
        t("canvas.onlineVehicles", { count: state.vehicles.length })
    ];
    ctx.fillStyle = "rgba(220,232,252,0.9)";
    for (const line of lines) {
        ctx.fillText(line, 24, y);
        y += 18;
    }

    // 饱和流率标注（左上角，在线车辆后面）
    if (ui.showSat.checked && state.performance.getMeasuredSaturation() > 0) {
        ctx.fillStyle = "#86efac";
        ctx.fillText(t("canvas.saturation", {
            value: Math.round(state.performance.getMeasuredSaturation())
        }), 24, y);
        y += 18;
    }

    // 各臂排队长度标注（停车线外侧进口道上显示）
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    for (const arm of DIRS) {
        const armGeo = geometry.arms[arm];
        const stop   = armGeo.approachAnchor;
        const dir    = armGeo.dir;
        const queue  = state.queueDetectors[arm].currentQueue;
        const queueText = t("canvas.queueLabel", { queue: formatMeters(queue) });
        ctx.fillStyle = state.queueDetectors[arm].spillback ? "#f87171" : "#94a3b8";
        // 标注位置：停车线沿进口方向往外 28px
        const labelX = stop.x + dir.x * 28;
        const labelY = stop.y + dir.y * 28;
        ctx.fillText(queueText, labelX, labelY);
    }

    ctx.restore();

    // 底部弹出 overlay 提示条
    if (!state.overlays.length) return;
    const overlay = state.overlays[state.overlays.length - 1];
    ctx.save();
    const isErr = overlay.type === "overflow";
    ctx.fillStyle   = isErr ? "rgba(239,68,68,0.2)"   : "rgba(59,130,246,0.18)";
    ctx.strokeStyle = isErr ? "rgba(248,113,113,0.6)" : "rgba(125,211,252,0.5)";
    ctx.lineWidth   = 1;
    roundedRectPath(ctx, 24, canvas.height - 90, 380, 44, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#e6edf8";
    ctx.font      = "14px sans-serif";
    ctx.fillText(getOverlayText(overlay), 40, canvas.height - 62);
    ctx.restore();
}

// ── 时空图小窗口 ───────────────────────────────────────────────────────────────

function estimateNorthGreenWindows(startTime, endTime) {
    const phaseIdx = getPhaseIndexForArm("N");
    return state.signal.getPhaseGreenWindows(phaseIdx, startTime, endTime);
}

function drawSpaceTimeWindow() {
    if (!ui.showSpaceTime.checked) return;
    const W = 290, H = 165;
    const x = canvas.width  - W - 16;
    const y = canvas.height - H - 16;

    ctx.save();
    ctx.fillStyle   = "rgba(2,6,23,0.86)";
    ctx.strokeStyle = "rgba(148,163,184,0.3)";
    ctx.lineWidth   = 1;
    roundedRectPath(ctx, x, y, W, H, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#94a3b8";
    ctx.font      = "11px sans-serif";
    ctx.fillText(t("canvas.spaceTimeTitle"), x + 12, y + 17);

    const pad = 14, lpad = 22;
    const gx  = x + lpad;
    const gy  = y + 28;
    const gw  = W - lpad - pad;
    const gh  = H - 44;

    ctx.strokeStyle = "rgba(148,163,184,0.2)";
    ctx.strokeRect(gx, gy, gw, gh);

    const history = 80;
    const t0      = Math.max(0, state.simTime - history);

    // 纵向时间格线
    ctx.strokeStyle = "rgba(148,163,184,0.1)";
    for (let sec = Math.ceil(t0 / 5) * 5; sec <= state.simTime; sec += 5) {
        const px = gx + ((sec - t0) / history) * gw;
        ctx.beginPath(); ctx.moveTo(px, gy); ctx.lineTo(px, gy + gh); ctx.stroke();
    }

    // 绿灯背景窗
    for (const win of estimateNorthGreenWindows(t0, state.simTime)) {
        const sx = gx + ((win.start - t0) / history) * gw;
        const ex = gx + ((win.end   - t0) / history) * gw;
        ctx.fillStyle = "rgba(34,197,94,0.1)";
        ctx.fillRect(sx, gy, ex - sx, gh);
    }

    // 轨迹点
    for (const pt of state.spaceTime) {
        if (pt.t < t0) continue;
        const px = gx + ((pt.t - t0) / history) * gw;
        const py = gy + gh - (pt.x / CONFIG.approachLengthM) * gh;
        ctx.fillStyle = speedToColor(pt.speed, state.baseVehicleParams.v0);
        ctx.fillRect(px, py, 2, 2);
    }

    // 轴标签
    ctx.fillStyle = "#64748b";
    ctx.font      = "9px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(t("canvas.timeAxis"), gx + gw - 20, gy + gh + 11);
    ctx.save();
    ctx.translate(gx - 10, gy + gh / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(t("canvas.distanceAxis"), 0, 0);
    ctx.restore();

    ctx.restore();
}

// ── 主渲染调度 ────────────────────────────────────────────────────────────────

function draw() {
    drawBackground();
    drawRoadSurface();
    drawMarkings();
    drawLaneDirectionArrows();
    drawSignals();
    drawQueueOverlays();
    drawGreenWaveGuides();
    drawVehicles();
    drawSpaceTimeWindow();
    drawEducationLabels();
}
