// ─── UI 绑定、控制逻辑与主循环 ────────────────────────────────────────────────
// 依赖：全部其他模块

const canvas = document.getElementById("simCanvas");
const ctx    = canvas.getContext("2d");

// ── DOM 引用表 ─────────────────────────────────────────────────────────────────

const ui = {
    flow: {
        N: document.getElementById("flowNorth"),
        E: document.getElementById("flowEast"),
        S: document.getElementById("flowSouth"),
        W: document.getElementById("flowWest"),
    },
    flowValue: {
        N: document.getElementById("flowNorthValue"),
        E: document.getElementById("flowEastValue"),
        S: document.getElementById("flowSouthValue"),
        W: document.getElementById("flowWestValue"),
    },
    cycle:      document.getElementById("cycleLength"),
    cycleValue: document.getElementById("cycleValue"),
    green: [
        document.getElementById("green0"),
        document.getElementById("green1"),
    ],
    greenValue: [
        document.getElementById("green0Value"),
        document.getElementById("green1Value"),
    ],
    offset:             document.getElementById("offset"),
    offsetValue:        document.getElementById("offsetValue"),
    desiredSpeed:       document.getElementById("desiredSpeed"),
    desiredSpeedValue:  document.getElementById("desiredSpeedValue"),
    headway:            document.getElementById("headway"),
    headwayValue:       document.getElementById("headwayValue"),
    losDisplay:         document.getElementById("losDisplay"),
    losLabel:           document.getElementById("losLabel"),
    delayDisplay:       document.getElementById("delayDisplay"),
    throughputDisplay:  document.getElementById("throughputDisplay"),
    saturationDisplay:  document.getElementById("saturationDisplay"),
    approachStats:      document.getElementById("approachStats"),
    alerts:             document.getElementById("alerts"),
    btnRun:             document.getElementById("btnRun"),
    btnPause:           document.getElementById("btnPause"),
    btnReset:           document.getElementById("btnReset"),
    btnSpeed:           document.getElementById("btnSpeed"),
    btnSpeedLabel:      document.getElementById("btnSpeedLabel"),
    btnLang:            document.getElementById("btnLang"),
    btnWebster:         document.getElementById("btnWebster"),
    btnOversat:         document.getElementById("btnOversat"),
    btnGreenWave:       document.getElementById("btnGreenWave"),
    showQueue:          document.getElementById("showQueue"),
    showSat:            document.getElementById("showSat"),
    showSpaceTime:      document.getElementById("showSpaceTime"),
};

// ── 辅助：同步滑块值与显示标签 ────────────────────────────────────────────────

function setSlider(input, display, value) {
    input.value          = value;
    display.textContent  = value;
}

function getSignalLostTime() {
    return PHASES.length * (CONFIG.yellowTime + CONFIG.allRedTime);
}

function getGreenBounds() {
    return ui.green.map(input => ({
        min: parseFloat(input.min),
        max: parseFloat(input.max)
    }));
}

function normalizeGreensToCycle(greens, cycle) {
    const bounds = getGreenBounds();
    const available = Math.max(cycle - getSignalLostTime(), bounds.reduce((sum, item) => sum + item.min, 0));
    const total = greens.reduce((sum, value) => sum + value, 0) || greens.length;
    const scaled = greens.map(value => {
        const share = value / total;
        return available * share;
    });
    return normalizePhaseGreensToBounds(scaled, available, bounds);
}

function getCurrentPlanSnapshot() {
    return {
        armFlow: { ...state.armFlow },
        greens: ui.green.map(input => parseFloat(input.value)),
        cycle: parseFloat(ui.cycle.value),
        offset: parseFloat(ui.offset.value),
    };
}

function restorePlanSnapshot(snapshot) {
    if (!snapshot) return;
    for (const arm of DIRS) {
        state.armFlow[arm] = snapshot.armFlow[arm];
        setSlider(ui.flow[arm], ui.flowValue[arm], snapshot.armFlow[arm]);
    }
    setSlider(ui.cycle, ui.cycleValue, snapshot.cycle);
    snapshot.greens.slice(0, ui.green.length).forEach((value, index) => {
        setSlider(ui.green[index], ui.greenValue[index], value);
    });
    setSlider(ui.offset, ui.offsetValue, snapshot.offset);
    syncCycleFromGreens();
    applySignalSettings();
}

function getCurrentSignalPlan() {
    return {
        greens: ui.green.map(input => parseFloat(input.value)),
        cycle: parseFloat(ui.cycle.value),
        offset: parseFloat(ui.offset.value),
    };
}

function syncCycleFromGreens() {
    const greens = ui.green.map(input => parseFloat(input.value));
    const cycle = greens.reduce((sum, value) => sum + value, 0) + getSignalLostTime();
    setSlider(ui.cycle, ui.cycleValue, cycle);
}

function syncGreensFromCycle() {
    const cycle = parseFloat(ui.cycle.value);
    const greens = ui.green.map(input => parseFloat(input.value));
    const normalized = normalizeGreensToCycle(greens, cycle);
    normalized.forEach((value, index) => setSlider(ui.green[index], ui.greenValue[index], value));
    syncCycleFromGreens();
}

// ── 信号配时应用 ───────────────────────────────────────────────────────────────

function applySignalSettings() {
    const greens = ui.green.map(el => parseFloat(el.value));
    const cycle  = parseFloat(ui.cycle.value);
    const offset = parseFloat(ui.offset.value);
    state.signal.setPlan(greens, cycle, offset);
    state.signal.syncToTime(state.simTime);
    state.signal.applyLaneStates();
}

// ── Webster 一键优化 ───────────────────────────────────────────────────────────

function runWebsterOptimization() {
    const bounds = getGreenBounds();
    const plan = computeWebsterPlan(state.armFlow, state.laneShares, {
        satFlowPerLane: CONFIG.satFlowPerLane,
        lostTimePerPhase: CONFIG.yellowTime + CONFIG.allRedTime,
        minCycle: parseFloat(ui.cycle.min),
        maxCycle: parseFloat(ui.cycle.max),
        minGreen: Math.min(...bounds.map(item => item.min)),
        maxGreen: Math.max(...bounds.map(item => item.max)),
    });

    setSlider(ui.cycle, ui.cycleValue, plan.adjustedCycle);
    plan.greens.forEach((g, idx) => setSlider(ui.green[idx], ui.greenValue[idx], g));
    syncCycleFromGreens();
    applySignalSettings();

    state.overlays.push({
        type: "webster",
        messageKey: "overlay.webster",
        messageParams: {
            cycle: plan.adjustedCycle,
            ns: plan.greens[0],
            ew: plan.greens[1]
        },
        ttl:  5
    });
}

// ── 教育演示场景 ───────────────────────────────────────────────────────────────

function setOversaturatedDemo() {
    state.demo.oversat = true;
    const flows = { N: 1700, E: 1500, S: 1700, W: 1400 };
    for (const arm of DIRS) {
        state.armFlow[arm] = flows[arm];
        setSlider(ui.flow[arm], ui.flowValue[arm], flows[arm]);
    }
    setSlider(ui.cycle, ui.cycleValue, 110);
    [54, 48].forEach((g, idx) => setSlider(ui.green[idx], ui.greenValue[idx], g));
    syncGreensFromCycle();
    applySignalSettings();
    updatePerformanceUI();
    state.overlays.push({ type: "overflow", messageKey: "overlay.oversatLoaded", ttl: 6 });
}

function setGreenWaveDemo() {
    state.demo.greenWave = !state.demo.greenWave;
    if (state.demo.greenWave) {
        state.demo.greenWaveSnapshot = getCurrentPlanSnapshot();
        state.armFlow.N = 900;  state.armFlow.S = 900;
        setSlider(ui.flow.N, ui.flowValue.N, 900);
        setSlider(ui.flow.S, ui.flowValue.S, 900);
        [50, 26].forEach((g, idx) => setSlider(ui.green[idx], ui.greenValue[idx], g));
        setSlider(ui.cycle, ui.cycleValue, 84);
        setSlider(ui.offset, ui.offsetValue, 8);
        syncCycleFromGreens();
        state.overlays.push({
            type: "greenwave",
            messageKey: "overlay.greenwaveOn",
            messageParams: { offset: 8 },
            ttl: 6
        });
    } else {
        restorePlanSnapshot(state.demo.greenWaveSnapshot);
        state.demo.greenWaveSnapshot = null;
        state.overlays.push({ type: "greenwave", messageKey: "overlay.greenwaveOff", ttl: 3 });
    }
    if (state.demo.greenWave) {
        syncCycleFromGreens();
        applySignalSettings();
    }
    updatePerformanceUI();
}

// ── 性能指标 UI 刷新 ────────────────────────────────────────────────────────────

function updatePerformanceUI() {
    const avgDelay = state.performance.getAverageDelay();
    const los      = losFromDelay(avgDelay);
    const signalPlan = getCurrentSignalPlan();
    const vcAnalysis = computeApproachVCRatios(
        state.armFlow,
        state.laneShares,
        signalPlan.greens,
        signalPlan.cycle,
        { satFlowPerLane: CONFIG.satFlowPerLane }
    );
    state.performance.lastLOS = los;

    ui.losDisplay.textContent    = los.grade;
    ui.losDisplay.style.color    = los.color;
    if (ui.losLabel) ui.losLabel.style.color = los.color;
    ui.delayDisplay.textContent      = avgDelay.toFixed(1);
    ui.throughputDisplay.textContent = Math.round(state.performance.getThroughputPerHour(state.simTime));
    ui.saturationDisplay.textContent = Math.round(state.performance.getMeasuredSaturation());

    // 各臂进口统计行
    ui.approachStats.innerHTML = DIRS.map(arm => {
        const q     = state.queueDetectors[arm].currentQueue;
        const vc    = vcAnalysis.vcByArm[arm].toFixed(2);
        const width = clamp((q / CONFIG.approachLengthM) * 100, 0, 100);
        const vcNum = parseFloat(vc);
        const vcColor = vcNum > 0.9 ? "#ef4444" : vcNum > 0.7 ? "#fb923c" : "#22c55e";
        return `
          <div class="approach-row">
            <span class="badge">${getDirectionLabel(arm)}</span>
            <div class="bar"><span style="width:${width}%"></span></div>
            <span class="mono">${formatMeters(q)}</span>
            <span class="mono" style="color:${vcColor}">${t("approach.vc", { value: vc })}</span>
          </div>`;
    }).join("");

    // 教学标注告警
    const alerts = [];
    if (los.grade === "E" || los.grade === "F") {
        alerts.push({
            cls: "danger",
            text: t("alert.severeCongestion", { delay: avgDelay.toFixed(1), grade: los.grade })
        });
    }
    const highVC = DIRS.find(arm => vcAnalysis.vcByArm[arm] > 0.9);
    if (highVC) {
        alerts.push({ cls: "warn", text: t("alert.highVC", { arm: getDirectionLabel(highVC) }) });
    }
    const spill = DIRS.find(arm => state.queueDetectors[arm].spillback);
    if (spill) {
        alerts.push({ cls: "danger", text: t("alert.spillback", { arm: getDirectionLabel(spill) }) });
    }
    if (ui.showSat.checked && state.performance.getMeasuredSaturation() > 0) {
        alerts.push({
            cls: "info",
            text: t("alert.saturation", { value: Math.round(state.performance.getMeasuredSaturation()) })
        });
    }
    const popup = state.overlays[state.overlays.length - 1];
    if (popup && ["webster", "greenwave", "overflow"].includes(popup.type)) {
        alerts.push({ cls: popup.type === "overflow" ? "warn" : "info", text: getOverlayText(popup) });
    }
    ui.alerts.innerHTML = alerts.slice(0, 4)
        .map(a => `<div class="alert ${a.cls}">${a.text}</div>`).join("");
}

// ── 全量 UI 显示同步 ────────────────────────────────────────────────────────────

function updateUI() {
    for (const arm of DIRS) ui.flowValue[arm].textContent = ui.flow[arm].value;
    ui.cycleValue.textContent       = ui.cycle.value;
    ui.offsetValue.textContent      = ui.offset.value;
    ui.desiredSpeedValue.textContent = ui.desiredSpeed.value;
    ui.headwayValue.textContent     = ui.headway.value;
    ui.green.forEach((el, idx) => { ui.greenValue[idx].textContent = el.value; });
    ui.btnSpeedLabel.textContent    = formatSpeedButtonLabel(CONFIG.timeWarp);
    updatePerformanceUI();
}

// ── 画布尺寸自适应 ─────────────────────────────────────────────────────────────

function resizeCanvas() {
    const rect        = document.getElementById("canvas-wrap").getBoundingClientRect();
    canvas.width      = rect.width;
    canvas.height     = rect.height;
    CONFIG.center.x   = rect.width * 0.5;
    CONFIG.center.y   = rect.height * 0.5;
    computeGeometry();
    refreshVehicleGeometry();
}

function refreshVehicleGeometry() {
    for (const vehicle of state.vehicles) {
        const nextPath = geometry.pathCache[laneId(vehicle.arm, vehicle.turnIntent)];
        if (vehicle.segment === "crossing" && vehicle.crossingPath) {
            const prevLength = Math.max(vehicle.crossingPath.lengthMeters, 1e-6);
            const progress = clamp(vehicle.crossingDistance / prevLength, 0, 1);
            vehicle.crossingDistance = progress * nextPath.lengthMeters;
        }
        vehicle.crossingPath = nextPath;
    }
}

// ── 事件绑定 ───────────────────────────────────────────────────────────────────

function bindRange(input, onChange) {
    input.addEventListener("input", () => {
        updateUI();
        if (onChange) onChange();
    });
}

function bindUI() {
    for (const arm of DIRS) {
        bindRange(ui.flow[arm], () => { state.armFlow[arm] = parseFloat(ui.flow[arm].value); });
    }
    bindRange(ui.cycle, () => {
        syncGreensFromCycle();
        applySignalSettings();
    });
    bindRange(ui.offset, applySignalSettings);
    ui.green.forEach(el => bindRange(el, () => {
        syncCycleFromGreens();
        applySignalSettings();
    }));
    bindRange(ui.desiredSpeed, () => { state.baseVehicleParams.v0 = parseFloat(ui.desiredSpeed.value) / 3.6; });
    bindRange(ui.headway,      () => { state.baseVehicleParams.T  = parseFloat(ui.headway.value); });

    ui.btnRun.addEventListener("click",   () => { state.running = true; });
    ui.btnPause.addEventListener("click", () => { state.running = false; });
    ui.btnReset.addEventListener("click", resetSimulation);
    ui.btnSpeed.addEventListener("click", () => {
        CONFIG.timeWarp = CONFIG.timeWarp === 1 ? 2 : CONFIG.timeWarp === 2 ? 4 : 1;
        updateUI();
    });
    ui.btnLang.addEventListener("click", () => {
        setLanguage(getCurrentLanguage() === "zh" ? "en" : "zh");
    });
    ui.btnWebster.addEventListener("click",  runWebsterOptimization);
    ui.btnOversat.addEventListener("click",  setOversaturatedDemo);
    ui.btnGreenWave.addEventListener("click", setGreenWaveDemo);
    window.addEventListener("resize", resizeCanvas);
}

// ── 主循环 ─────────────────────────────────────────────────────────────────────

function frame(ts) {
    if (!state.lastFrame) state.lastFrame = ts;
    const elapsed    = Math.min((ts - state.lastFrame) / 1000, 0.1);
    state.lastFrame  = ts;

    if (state.running) {
        state.accumulator += elapsed * CONFIG.timeWarp;
        while (state.accumulator >= CONFIG.dt) {
            stepSimulation(CONFIG.dt);
            state.accumulator -= CONFIG.dt;
        }
        updatePerformanceUI();
    }
    draw();
    requestAnimationFrame(frame);
}

// ── 启动 ───────────────────────────────────────────────────────────────────────

resizeCanvas();
bindUI();
setLanguage(getCurrentLanguage());
updateUI();
resetSimulation();
requestAnimationFrame(frame);
