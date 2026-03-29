// ─── 常量与全局配置 ────────────────────────────────────────────────────────────

const DIRS = ["N", "E", "S", "W"];

function readInitialSeed() {
    if (typeof location === "undefined" || !location.search) return 20260324;
    const params = new URLSearchParams(location.search);
    const value = Number.parseInt(params.get("seed") || "", 10);
    return Number.isFinite(value) ? value : 20260324;
}

const DIR_VECTORS = {
    N: { x: 0, y: -1 },
    E: { x: 1,  y: 0 },
    S: { x: 0,  y: 1 },
    W: { x: -1, y: 0 },
};

const SIDE_VECTORS = {
    N: { x: 1,  y: 0 },
    E: { x: 0,  y: 1 },
    S: { x: -1, y: 0 },
    W: { x: 0,  y: -1 },
};

const TURN_TO_EXIT = {
    N: { left: "E", straight: "S", right: "W" },
    E: { left: "S", straight: "W", right: "N" },
    S: { left: "W", straight: "N" , right: "E" },
    W: { left: "N", straight: "E", right: "S" },
};

const OPPOSITE_ARM = {
    N: "S",
    E: "W",
    S: "N",
    W: "E",
};

// 两相位：南北同放、东西同放；左转与对向直行同绿但需让行
const PHASES = [
    {
        key: "NS",
        arms: ["N", "S"],
        lanes: ["N-left", "N-straight", "S-left", "S-straight"],
    },
    {
        key: "EW",
        arms: ["E", "W"],
        lanes: ["E-left", "E-straight", "W-left", "W-straight"],
    },
];

function getPhaseIndexForArm(arm) {
    return arm === "N" || arm === "S" ? 0 : 1;
}

const CONFIG = {
    pixelPerMeter: 1.6,
    center: { x: 550, y: 400 },   // 动态由 resizeCanvas 更新
    stopLinePx: 74,                // 停车线距路口中心（像素）
    approachLengthM: 200,          // 进口道长度（米）
    exitLengthM: 200,              // 出口道长度（米）
    laneWidthPx: 20,               // 单车道宽度（像素）
    centerDividerPx: 10,           // 中央双黄线预留带宽（像素）
    crosswalkWidthPx: 20,
    yellowTime: 3,                 // 黄灯时长（s）
    allRedTime: 1,                 // 全红时长（s）
    crossingSpeed: 8,              // 通过路口速度（m/s）
    satFlowPerLane: 1800,          // 理论饱和流率（辆/h/车道）
    maxVehiclesPerLane: 45,        // 每车道最大排队数
    dt: 0.05,                      // 物理步长（s）
    timeWarp: 1,                   // 时间倍速
    ghostLength: 0,
    leftTurnYieldLookaheadM: 36,   // 左转默认让行的对向直行感知距离
    leftTurnImmediateHazardM: 14,  // 长等待后仍必须让行的立即冲突距离
    leftTurnCourtesyYieldS: 8,     // 左转长等待后放宽让行判定阈值
    speedColorMin: 0,              // 速度→颜色 HSL 色相范围
    speedColorMax: 120,
    randomSeed: readInitialSeed(),
};

// ─── 工具函数 ──────────────────────────────────────────────────────────────────

const randomState = {
    baseSeed: 0,
    generator: null,
};

function normalizeSeed(seed) {
    const value = Number(seed);
    if (!Number.isFinite(value)) return 1;
    return (Math.abs(Math.trunc(value)) >>> 0) || 1;
}

function mulberry32(seed) {
    let state = seed >>> 0;
    return function next() {
        state = (state + 0x6D2B79F5) >>> 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function setRandomSeed(seed) {
    randomState.baseSeed = normalizeSeed(seed);
    randomState.generator = mulberry32(randomState.baseSeed);
    CONFIG.randomSeed = randomState.baseSeed;
    return randomState.baseSeed;
}

function resetRandomSeed() {
    return setRandomSeed(CONFIG.randomSeed);
}

function getRandomSeed() {
    return CONFIG.randomSeed;
}

function random() {
    if (!randomState.generator) resetRandomSeed();
    return randomState.generator();
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function randn(mean, sd) {
    let u = 0, v = 0;
    while (u === 0) u = random();
    while (v === 0) v = random();
    return mean + Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * sd;
}

function expSample(rate) {
    if (rate <= 0) return Number.POSITIVE_INFINITY;
    return -Math.log(Math.max(1e-6, random())) / rate;
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

resetRandomSeed();
