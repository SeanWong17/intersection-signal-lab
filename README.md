# Intersection Traffic Simulation

[中文说明](#中文说明) | [English](#english)

## 中文说明

一个纯前端的十字路口信号控制教学仿真页面，包含四相位保护左转、IDM 跟驰、Webster 配时优化、过饱和演示、绿波演示，以及北进口时空图。

### 功能

- 中英文一键切换，界面文本、告警和画布标注同步更新
- 可调入口流量、周期、相位绿灯、相位差、期望速度和车头时距
- 实时显示 LOS、平均延误、通行量和实测饱和流率
- 提供过饱和和绿波两个教学场景

### 目录

```text
.
├── index.html
├── LICENSE
├── README.md
├── legacy/
│   └── intersection.js
└── src/
    ├── intersection.config.js
    ├── intersection.css
    ├── intersection.geometry.js
    ├── intersection.i18n.js
    ├── intersection.models.js
    ├── intersection.render.js
    ├── intersection.simulation.js
    └── intersection.ui.js
```

### 使用

直接在浏览器打开 `index.html` 即可。

### 开源协议

本项目采用 [MIT License](./LICENSE)。

## English

A browser-based teaching demo for intersection signal control. It includes protected left-turn phasing, IDM car-following, Webster timing optimization, oversaturation and green-wave demos, plus a northbound space-time diagram.

### Features

- One-click Chinese/English switching for the UI, alerts, and canvas annotations
- Adjustable demand, cycle, phase greens, offset, desired speed, and headway
- Live LOS, delay, throughput, and measured saturation metrics
- Built-in oversaturation and green-wave teaching scenarios

### Structure

```text
.
├── index.html
├── LICENSE
├── README.md
├── legacy/
│   └── intersection.js
└── src/
    ├── intersection.config.js
    ├── intersection.css
    ├── intersection.geometry.js
    ├── intersection.i18n.js
    ├── intersection.models.js
    ├── intersection.render.js
    ├── intersection.simulation.js
    └── intersection.ui.js
```

### Usage

Open `index.html` in a browser.

### License

This project is released under the [MIT License](./LICENSE).
