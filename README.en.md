# Intersection Signal Control Simulation

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

## Preview

Live Demo: <https://seanwong17.github.io/intersection-signal-lab/>

## Demo GIF

![Demo GIF](./media/demo.gif)

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
- Safari and Firefox should generally work, but a manual smoke test is recommended before release
- For stable recordings, use a fixed seed

## Repository Layout

- `media/demo.gif`: animated preview used in the README.
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

## Acknowledgements

This project was developed and prepared for release with AI-assisted collaboration, including Claude and GPT.

## License

Released under the [MIT License](./LICENSE).
