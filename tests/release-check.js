const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");

function createContext() {
    const context = {
        console,
        Math,
        Number,
        String,
        Boolean,
        Object,
        Array,
        Date,
        JSON,
        URLSearchParams,
        location: { search: "" },
    };
    context.globalThis = context;
    vm.createContext(context);
    return context;
}

function loadScript(context, relativePath) {
    const source = fs.readFileSync(path.join(ROOT, relativePath), "utf8");
    vm.runInContext(source, context, { filename: relativePath });
}

function approxEqual(actual, expected, epsilon = 1e-6) {
    assert(Math.abs(actual - expected) <= epsilon, `expected ${expected}, got ${actual}`);
}

const context = createContext();
[
    "src/intersection.config.js",
    "src/intersection.analytics.js",
    "src/intersection.geometry.js",
    "src/intersection.models.js",
].forEach(file => loadScript(context, file));

vm.runInContext("computeGeometry();", context);

vm.runInContext(`
    setRandomSeed(12345);
    globalThis.__seededA = [random(), random(), randn(10, 2), expSample(0.5)];
    setRandomSeed(12345);
    globalThis.__seededB = [random(), random(), randn(10, 2), expSample(0.5)];
`, context);
assert.deepStrictEqual(Array.from(context.__seededA), Array.from(context.__seededB), "random seed should be reproducible");

vm.runInContext(`
    globalThis.__plan = computeWebsterPlan(
        { N: 800, E: 600, S: 800, W: 400 },
        { left: 0.2, straight: 0.6, right: 0.2 },
        { satFlowPerLane: 1800, lostTimePerPhase: 4, minCycle: 40, maxCycle: 120, minGreen: 8, maxGreen: 45 }
    );
`, context);
assert.deepStrictEqual(Array.from(context.__plan.greens), [32, 24, 32, 16], "unexpected Webster green split");
assert.strictEqual(context.__plan.adjustedCycle, 120, "unexpected Webster cycle length");
approxEqual(context.__plan.criticalRatios[0], 480 / 1800);
approxEqual(context.__plan.criticalRatios[3], 240 / 1800);

vm.runInContext(`
    globalThis.__pm = new PerformanceMonitor();
    __pm.recordQueuedDischarge("N-straight", 0);
    __pm.recordQueuedDischarge("N-straight", 2);
    __pm.recordQueuedDischarge("N-straight", 4);
    globalThis.__sat = __pm.getMeasuredSaturation();
`, context);
approxEqual(context.__sat, 1800);

vm.runInContext(`
    computeGeometry();
    globalThis.__straightPath = geometry.pathCache["N-straight"];
    setRandomSeed(77);
    globalThis.__vehicleA = new Vehicle(1, "N", "straight", 0, { v0: 13.89, T: 1.5, a: 1.2, b: 2.0, s0: 2.0 });
    setRandomSeed(77);
    globalThis.__vehicleB = new Vehicle(1, "N", "straight", 0, { v0: 13.89, T: 1.5, a: 1.2, b: 2.0, s0: 2.0 });
    __vehicleA.segment = "outbound";
    __vehicleA.pos = 0;
    globalThis.__outboundStart = __vehicleA.positionPoint;
    __vehicleA.pos = 20;
    globalThis.__outboundLater = __vehicleA.positionPoint;
`, context);
assert(context.__straightPath.lengthMeters > 30, "straight path should cross the intersection");
assert.strictEqual(context.__vehicleA.length, context.__vehicleB.length, "vehicle length should be reproducible");
assert.strictEqual(context.__vehicleA.v0, context.__vehicleB.v0, "vehicle desired speed should be reproducible");
assert(context.__outboundLater.y > context.__outboundStart.y, "outbound vehicle should move away from the intersection");

console.log("release-check: all checks passed");
