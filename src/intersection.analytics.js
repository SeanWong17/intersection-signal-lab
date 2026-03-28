// ─── 纯分析逻辑 ────────────────────────────────────────────────────────────────
// 依赖：intersection.config.js

function getLaneFlowsForArm(arm, armFlow, laneShares) {
    return {
        left: armFlow[arm] * laneShares.left,
        straight: armFlow[arm] * laneShares.straight,
        right: armFlow[arm] * laneShares.right,
    };
}

function normalizePhaseGreensToBounds(greens, targetTotal, bounds) {
    const scaled = greens.map((value, index) => {
        const bound = bounds[index];
        return clamp(Math.round(value), bound.min, bound.max);
    });
    let diff = targetTotal - scaled.reduce((sum, value) => sum + value, 0);
    while (diff !== 0) {
        const step = Math.sign(diff);
        let changed = false;
        for (let i = 0; i < scaled.length && diff !== 0; i++) {
            const next = scaled[i] + step;
            if (next < bounds[i].min || next > bounds[i].max) continue;
            scaled[i] = next;
            diff -= step;
            changed = true;
        }
        if (!changed) break;
    }
    return scaled;
}

function normalizePhaseGreens(greens, targetTotal, minGreen, maxGreen) {
    const bounds = greens.map(() => ({ min: minGreen, max: maxGreen }));
    return normalizePhaseGreensToBounds(greens, targetTotal, bounds);
}

function computeCriticalLaneAnalysis(armFlow, laneShares, satFlowPerLane = CONFIG.satFlowPerLane) {
    const laneFlows = {};
    const criticalFlows = DIRS.map(arm => {
        laneFlows[arm] = getLaneFlowsForArm(arm, armFlow, laneShares);
        return Math.max(laneFlows[arm].left, laneFlows[arm].straight);
    });
    const criticalRatios = criticalFlows.map(flow => flow / satFlowPerLane);
    return {
        laneFlows,
        criticalFlows,
        criticalRatios,
    };
}

function computeApproachVCRatios(armFlow, laneShares, greenTimes, cycleLength, options = {}) {
    const satFlowPerLane = options.satFlowPerLane ?? CONFIG.satFlowPerLane;
    const analysis = computeCriticalLaneAnalysis(armFlow, laneShares, satFlowPerLane);
    const safeCycle = Math.max(cycleLength, 1);
    const greenRatios = {};
    const capacities = {};
    const vcByArm = {};

    DIRS.forEach((arm, index) => {
        const greenRatio = clamp((greenTimes[index] || 0) / safeCycle, 0, 1);
        const capacity = satFlowPerLane * greenRatio;
        greenRatios[arm] = greenRatio;
        capacities[arm] = capacity;
        vcByArm[arm] = capacity > 0 ? analysis.criticalFlows[index] / capacity : Number.POSITIVE_INFINITY;
    });

    return {
        ...analysis,
        greenRatios,
        capacities,
        vcByArm,
    };
}

function computeWebsterPlan(armFlow, laneShares, options = {}) {
    const satFlowPerLane = options.satFlowPerLane ?? CONFIG.satFlowPerLane;
    const lostTimePerPhase = options.lostTimePerPhase ?? (CONFIG.yellowTime + CONFIG.allRedTime);
    const minCycle = options.minCycle ?? 40;
    const maxCycle = options.maxCycle ?? 120;
    const minGreen = options.minGreen ?? 8;
    const maxGreen = options.maxGreen ?? 45;

    const { laneFlows, criticalFlows, criticalRatios } = computeCriticalLaneAnalysis(
        armFlow,
        laneShares,
        satFlowPerLane
    );
    const ySumRaw = criticalRatios.reduce((sum, value) => sum + value, 0);
    const ySumSafe = clamp(ySumRaw, 0.01, 0.98);
    const lostTime = PHASES.length * lostTimePerPhase;
    const cycleCandidate = Math.ceil((1.5 * lostTime + 5) / Math.max(1 - ySumSafe, 0.02));
    const cycle = clamp(cycleCandidate, minCycle, maxCycle);
    const effectiveGreen = Math.max(cycle - lostTime, minGreen * PHASES.length);
    const denominator = Math.max(ySumRaw, 0.01);
    const rawGreens = criticalRatios.map(ratio => (effectiveGreen * ratio) / denominator);
    const greens = normalizePhaseGreens(rawGreens, effectiveGreen, minGreen, maxGreen);
    const adjustedCycle = greens.reduce((sum, value) => sum + value, 0) + lostTime;

    return {
        laneFlows,
        criticalFlows,
        criticalRatios,
        ySum: ySumRaw,
        lostTime,
        cycle,
        greens,
        adjustedCycle,
    };
}

function estimateLaneSaturationFromHeadways(headways) {
    if (!headways.length) return 0;
    const avgHeadway = headways.reduce((sum, value) => sum + value, 0) / headways.length;
    return avgHeadway <= 0 ? 0 : 3600 / avgHeadway;
}
