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

![Main dashboard](./media/cover.png)

## Demo Video

`media/demo.mp4`

## Quick Start

Open `index.html` directly in a browser. No dependency installation is required.

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

```text
.
├── media/
│   ├── cover.png
│   └── demo.mp4
├── index.html
├── LICENSE
├── README.en.md
├── README.md
├── legacy/
│   └── intersection.js
└── src/
    ├── intersection.analytics.js
    ├── intersection.config.js
    ├── intersection.css
    ├── intersection.geometry.js
    ├── intersection.i18n.js
    ├── intersection.models.js
    ├── intersection.render.js
    ├── intersection.simulation.js
    └── intersection.ui.js
```

## License

Released under the [MIT License](./LICENSE).
