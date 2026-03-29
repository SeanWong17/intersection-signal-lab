const LANG_STORAGE_KEY = "intersection-lang";
const DEFAULT_LANG = (() => {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    if (saved === "zh" || saved === "en") return saved;
    return (navigator.language || "").toLowerCase().startsWith("zh") ? "zh" : "en";
})();

const I18N = {
    zh: {
        "page.title": "十字路口交通信号教学仿真",
        "panel.title": "十字路口信号控制教学仿真",
        "panel.intro": "两相位普通路口 · 左转让行 · IDM 跟驰 · Webster 配时建议",
        "button.run": "运行",
        "button.pause": "暂停",
        "button.reset": "重置",
        "button.webster": "Webster 配时",
        "button.oversat": "过饱和",
        "button.greenwave": "绿波协调",
        "button.lang": "EN",
        "button.langTitle": "切换到英文",
        "button.speedTitle": "切换倍速",
        "metrics.header": "实时指标",
        "metrics.los": "LOS 服务水平",
        "metrics.delay": "平均延误 s/辆",
        "metrics.throughput": "通行量 辆/h",
        "metrics.saturation": "排队启动流率",
        "flow.header": "流量控制",
        "flow.hint": "辆/h",
        "signal.header": "信号配时",
        "signal.cycle": "周期",
        "signal.offset": "相位差",
        "idm.header": "IDM 跟驰参数",
        "idm.desiredSpeed": "期望速度",
        "idm.headway": "车头时距 T",
        "demo.header": "教育演示",
        "demo.showQueue": "排队波可视化",
        "demo.showSat": "启动流率标注",
        "demo.showSpaceTime": "时空图（北进口）",
        "demo.hint": "理论饱和流率 1800 辆/h/车道。时空图斜率反映消散波速，绿色背景为绿灯窗口。",
        "alerts.header": "教学标注",
        "direction.N": "北",
        "direction.E": "东",
        "direction.S": "南",
        "direction.W": "西",
        "phase.NS": "南北相位",
        "phase.EW": "东西相位",
        "stage.green": "绿灯",
        "stage.yellow": "黄灯",
        "stage.allred": "全红",
        "overlay.webster": "Webster 建议: C={cycle}s · 南北{ns}s 东西{ew}s",
        "overlay.oversatLoaded": "过饱和场景已加载: v/c > 1，观察队列持续溢出",
        "overlay.greenwaveOn": "主走廊偏移演示启用: 南北相位差 {offset}s，观察车辆连续通过",
        "overlay.greenwaveOff": "绿波协调已关闭",
        "overlay.overflow": "{arm} 进口排队溢出",
        "alert.severeCongestion": "严重拥堵: 平均延误 {delay} s/辆，LOS {grade}",
        "alert.highVC": "{arm} 进口 v/c > 0.9，接近过饱和，队列将持续增长",
        "alert.spillback": "⚠ {arm} 进口排队溢出，干扰上游路段",
        "alert.saturation": "排队启动流率估计: {value} 辆/h/车道",
        "canvas.idealArrival": "理想到达 {offset}s",
        "canvas.simClock": "仿真时钟 {time} s",
        "canvas.currentPhase": "当前相位 {phase} {stage}",
        "canvas.onlineVehicles": "在线车辆 {count}",
        "canvas.queueLabel": "{arm}: {queue}",
        "canvas.saturation": "启动流率≈{value} 辆/h/车道",
        "canvas.spaceTimeTitle": "北进口时空图",
        "canvas.timeAxis": "时间 →",
        "canvas.distanceAxis": "距入口",
        "approach.vc": "v/c {value}"
    },
    en: {
        "page.title": "Intersection Signal Teaching Demo",
        "panel.title": "Intersection Signal Control Teaching Demo",
        "panel.intro": "Typical two-phase junction · Permissive left turns · IDM car-following · Webster timing suggestion",
        "button.run": "Run",
        "button.pause": "Pause",
        "button.reset": "Reset",
        "button.webster": "Webster Plan",
        "button.oversat": "Oversat",
        "button.greenwave": "Green Wave",
        "button.lang": "中文",
        "button.langTitle": "Switch to Chinese",
        "button.speedTitle": "Change speed",
        "metrics.header": "Live Metrics",
        "metrics.los": "LOS",
        "metrics.delay": "Avg Delay s/veh",
        "metrics.throughput": "Throughput veh/h",
        "metrics.saturation": "Queue Discharge Rate",
        "flow.header": "Demand Control",
        "flow.hint": "veh/h",
        "signal.header": "Signal Timing",
        "signal.cycle": "Cycle",
        "signal.offset": "Offset",
        "idm.header": "IDM Parameters",
        "idm.desiredSpeed": "Desired Speed",
        "idm.headway": "Headway T",
        "demo.header": "Teaching Demos",
        "demo.showQueue": "Queue-wave overlay",
        "demo.showSat": "Discharge-rate label",
        "demo.showSpaceTime": "Space-time view (northbound)",
        "demo.hint": "Theoretical saturation flow is 1800 veh/h/lane. The space-time slope reflects discharge wave speed, and the green background marks green intervals.",
        "alerts.header": "Teaching Notes",
        "direction.N": "N",
        "direction.E": "E",
        "direction.S": "S",
        "direction.W": "W",
        "phase.NS": "North-South Phase",
        "phase.EW": "East-West Phase",
        "stage.green": "GREEN",
        "stage.yellow": "YELLOW",
        "stage.allred": "ALL-RED",
        "overlay.webster": "Webster suggestion: C={cycle}s · NS {ns}s EW {ew}s",
        "overlay.oversatLoaded": "Oversaturated scenario loaded: v/c > 1, observe persistent queue spillback",
        "overlay.greenwaveOn": "Main-corridor offset demo enabled: north-south offset {offset}s, observe platoon progression",
        "overlay.greenwaveOff": "Green wave disabled",
        "overlay.overflow": "{arm} approach queue overflow",
        "alert.severeCongestion": "Severe congestion: average delay {delay} s/veh, LOS {grade}",
        "alert.highVC": "{arm} approach v/c > 0.9, near oversaturation with sustained queue growth",
        "alert.spillback": "⚠ {arm} approach queue spillback affects upstream traffic",
        "alert.saturation": "Estimated queue discharge rate: {value} veh/h/lane",
        "canvas.idealArrival": "Ideal arrival {offset}s",
        "canvas.simClock": "Simulation clock {time} s",
        "canvas.currentPhase": "Current phase {phase} {stage}",
        "canvas.onlineVehicles": "Vehicles online {count}",
        "canvas.queueLabel": "{arm}: {queue}",
        "canvas.saturation": "q≈{value} veh/h/lane",
        "canvas.spaceTimeTitle": "Northbound Space-Time View",
        "canvas.timeAxis": "Time →",
        "canvas.distanceAxis": "Distance from entry",
        "approach.vc": "v/c {value}"
    }
};

const i18nState = {
    lang: DEFAULT_LANG
};

function t(key, params = {}) {
    const table = I18N[i18nState.lang] || I18N.zh;
    const fallback = I18N.zh[key] || key;
    const template = table[key] || fallback;
    return template.replace(/\{(\w+)\}/g, (_, name) => `${params[name] ?? ""}`);
}

function getCurrentLanguage() {
    return i18nState.lang;
}

function getDirectionLabel(arm) {
    return t(`direction.${arm}`);
}

function getPhaseLabel(arm) {
    return t(`phase.${arm}`);
}

function getSignalStageLabel(stage) {
    return t(`stage.${stage}`);
}

function getOverlayText(overlay) {
    if (!overlay) return "";
    if (overlay.messageKey) {
        const params = { ...(overlay.messageParams || {}) };
        if (params.arm) params.arm = getDirectionLabel(params.arm);
        return t(overlay.messageKey, params);
    }
    return overlay.text || "";
}

function formatSpeedButtonLabel(multiplier) {
    return `${multiplier}x`;
}

function renderStaticI18n() {
    document.documentElement.lang = i18nState.lang === "zh" ? "zh-CN" : "en";
    document.title = t("page.title");

    const textMap = {
        panelTitle: "panel.title",
        panelIntro: "panel.intro",
        btnRunLabel: "button.run",
        btnPauseLabel: "button.pause",
        btnResetLabel: "button.reset",
        metricsHeader: "metrics.header",
        losMetricLabel: "metrics.los",
        delayMetricLabel: "metrics.delay",
        throughputMetricLabel: "metrics.throughput",
        saturationMetricLabel: "metrics.saturation",
        flowHeader: "flow.header",
        flowHint: "flow.hint",
        flowNorthLabel: "direction.N",
        flowEastLabel: "direction.E",
        flowSouthLabel: "direction.S",
        flowWestLabel: "direction.W",
        signalHeader: "signal.header",
        btnWebsterLabel: "button.webster",
        cycleLabel: "signal.cycle",
        phaseMainLabel: "phase.NS",
        phaseCrossLabel: "phase.EW",
        offsetLabel: "signal.offset",
        idmHeader: "idm.header",
        desiredSpeedText: "idm.desiredSpeed",
        headwayText: "idm.headway",
        demoHeader: "demo.header",
        btnOversatLabel: "button.oversat",
        btnGreenWaveLabel: "button.greenwave",
        showQueueLabel: "demo.showQueue",
        showSatLabel: "demo.showSat",
        showSpaceTimeLabel: "demo.showSpaceTime",
        demoHint: "demo.hint",
        alertsHeader: "alerts.header"
    };

    for (const [id, key] of Object.entries(textMap)) {
        const node = document.getElementById(id);
        if (node) node.textContent = t(key);
    }

    const langButton = document.getElementById("btnLang");
    if (langButton) {
        langButton.textContent = t("button.lang");
        langButton.title = t("button.langTitle");
    }

    const btnRun = document.getElementById("btnRun");
    const btnPause = document.getElementById("btnPause");
    const btnReset = document.getElementById("btnReset");
    const btnSpeed = document.getElementById("btnSpeed");
    if (btnRun) btnRun.title = t("button.run");
    if (btnPause) btnPause.title = t("button.pause");
    if (btnReset) btnReset.title = t("button.reset");
    if (btnSpeed) btnSpeed.title = t("button.speedTitle");
}

function setLanguage(lang) {
    if (lang !== "zh" && lang !== "en") return;
    i18nState.lang = lang;
    localStorage.setItem(LANG_STORAGE_KEY, lang);
    renderStaticI18n();
    if (typeof updateUI === "function") updateUI();
    if (typeof updatePerformanceUI === "function") updatePerformanceUI();
}

renderStaticI18n();
