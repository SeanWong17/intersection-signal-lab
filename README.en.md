<div align="center">

# Intersection Signal Lab

**Traffic signal simulation · Permissive left turns · Timing and queue visualization**

![JavaScript](https://img.shields.io/badge/JavaScript-ES6-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![Canvas](https://img.shields.io/badge/Canvas-2D-0891b2?style=flat-square)
[![MIT](https://img.shields.io/badge/License-MIT-22c55e?style=flat-square)](./LICENSE)

**[Live Demo](https://seanwong17.github.io/intersection-signal-lab/) · [简体中文](./README.md) · [Report an Issue](https://github.com/SeanWong17/intersection-signal-lab/issues)**

Adjust demand and green times to explore queues, discharge, and why a left turn may still wait on green.

</div>

![Default operation, Webster timing, oversaturation and offset scenarios](./media/demo.gif)

[Watch the MP4 demo](./media/demo.mp4). The application supports English and Chinese.

## At a Glance

| Area | Capabilities |
|---|---|
| Signals | Two opposing phases, cycle and green times, offsets, per-approach countdowns |
| Vehicles | Poisson arrivals, IDM following, permissive left turns, conflict reservations |
| Congestion | Independent approach demand, upstream queue overlays, oversaturated scenario |
| Analysis | Webster timing suggestions, v/c, LOS, delay and queue discharge rate |
| Visualization | Median-mounted signals, vehicle animation, four approach space-time views |

## Understanding Left Turns

There is no protected left-turn phase. Opposing approaches receive green together; left turns still wait for opposing through traffic and active intersection reservations to clear. Green permits a movement but does not guarantee immediate entry.

The median signals are ordered from the stop line outward: `L` (left), `T` (through), `RT` (right). Red countdowns show time until green; green and yellow countdowns show the remaining duration of that color.

This is a simplified teaching model, not a calibrated road-design tool. Webster uses the maximum critical flow ratio of concurrently served approaches and does not separately calibrate permissive-left capacity. Reservations use a conservative movement conflict table. Average delay covers departed vehicles, excluding vehicles still queued and waiting outside the simulated approach. The green-wave scenario demonstrates a single offset, not corridor coordination.

[中文](./README.md)

A browser-based simulation of an isolated signalized intersection for viewing junction behavior under different demand and timing settings. The page provides live metrics, scenario switches, and an approach space-time view for a single intersection.

## Features

- Two-phase opposing control with permissive left turns and free right turns
- Independent demand control for all four approaches, split into turn movements by lane share
- Adjustable cycle, phase greens, and offset
- One-click `Webster Plan` timing suggestion
- Built-in `Oversat` and `Green Wave` scenarios
- Live LOS, average delay, throughput, and queue discharge rate
- Approach space-time view with N/E/S/W switching
- Chinese and English UI switching for panel text, alerts, and canvas labels

## Model Summary

- Scope: one isolated four-leg intersection
- Lane layout: one left-turn, one through, and one right-turn lane per approach
- Arrivals: Poisson arrivals split by approach demand and lane share
- Car-following: IDM
- Signal logic: two opposing phases, permissive left turns, free right turns
- Queue discharge rate: estimated from queued departure headways in `veh/h/lane`
- Green-wave scenario: single-intersection offset illustration only

## Quick Start

Open `index.html` directly in a browser. No dependency installation is required.

You can also use the live demo directly: <https://seanwong17.github.io/intersection-signal-lab/>

For deterministic runs, append a seed in the URL:

```text
index.html?seed=20260324
```

## Usage

### Canvas

The canvas shows vehicles, stop lines, signal heads, queue overlays, status messages, and the approach space-time view.

### Control Panel

- `Run` / `Pause` / `Reset`: control simulation execution
- Demand controls: adjust demand for the four approaches
- Signal timing: adjust cycle, phase greens, and offset
- `Webster Plan`: generate a timing suggestion from the current demand
- `Oversat`: switch to the congested demonstration case
- `Green Wave`: switch to the single-intersection offset demonstration case
- Overlay toggles: show or hide queue-wave shading, discharge-rate labels, and the space-time panel

### Metrics

- LOS: mapped from average delay
- Average Delay: shown in `s/veh`
- Throughput: normalized to `veh/h`
- Queue Discharge Rate: estimated from queued departure headways

## Browser Support

- Recommended: latest Chrome or Edge
- Supported: latest Safari and Firefox
- For stable recordings, use a fixed seed

## Quality Check

Run the dependency-free model and release regression checks with:

```bash
node tests/release-check.js
```

The checks cover deterministic randomness, Webster timing, v/c ratios, queue detection, permissive left turns, vehicle paths, space-time sampling, and oversaturated scenario consistency.

## Repository Layout

- `media/demo.gif`: animated preview used in the README.
- `media/demo.mp4`: MP4 version of the same demonstration.
- `index.html`: page entry point with the canvas, control panel, and UI containers.
- `LICENSE`: project license file.
- `README.md`: Chinese documentation.
- `README.en.md`: English documentation.
- `src/intersection.analytics.js`: LOS, delay, discharge-rate, and Webster calculation logic.
- `src/intersection.config.js`: default simulation parameters and geometry constants.
- `src/intersection.css`: page layout, control styling, and responsive rules.
- `src/intersection.geometry.js`: intersection geometry, lane boundaries, stop lines, and signal-head positions.
- `src/intersection.i18n.js`: bilingual text resources and language switching logic.
- `src/intersection.models.js`: core models for vehicles, signals, and queue detection.
- `src/intersection.render.js`: canvas rendering for vehicles, overlays, labels, and the space-time view.
- `src/intersection.simulation.js`: vehicle generation, car-following, discharge, and simulation time update logic.
- `src/intersection.ui.js`: control binding, scenario switching, metric refresh, and UI state synchronization.
- `tests/release-check.js`: regression checks for the core model, simulation constraints, and release settings.

## Acknowledgements

This project was developed and prepared for release with AI-assisted collaboration, including Claude and GPT.

## License

Released under the [MIT License](./LICENSE).
