# Intersection Signal Teaching Demo

[中文](#中文说明) | [English](#english)

## 中文说明

一个面向 GitHub 公开发布的单点交叉口信号控制教学仿真页面。项目重点是把交通工程里常见的几个教学概念放到一个可直接打开的浏览器 demo 里：四相位保护左转、IDM 跟驰、Webster 配时建议、过饱和现象、单点相位差演示，以及北进口时空图。

### 这是什么

- 一个纯前端、零依赖的教学演示页
- 一个单交叉口概念仿真，不是工程设计软件
- 一个带固定随机种子的可回归 demo，适合公开展示和持续迭代

### 模型口径

- 路口类型：单个四叉交叉口
- 车道假设：每个进口 1 条左转、1 条直行、1 条右转
- 信号控制：四相位保护左转，右转常绿
- 到达过程：按车道流量占比拆分后的泊松到达
- 跟驰模型：IDM
- Webster 配时：按每相位临界车道组流率计算
- 启动流率指标：基于排队放行头时距估计，单位为 `辆/h/车道`
- 绿波演示：单点相位差的教学近似，不是走廊级协调控制模型

### 功能

- 中英文一键切换，界面文本、告警和画布标注同步更新
- 可调入口流量、周期、相位绿灯、相位差、期望速度和车头时距
- 实时显示 LOS、平均延误、通行量和排队启动流率估计
- 内置过饱和和相位差演示场景
- 支持固定随机种子，便于复现实验和回归测试

### 快速开始

直接在浏览器打开 `index.html` 即可。

如果你想复现实验结果，可以带一个固定随机种子：

```text
index.html?seed=20260324
```

### 测试与校核

运行最小回归脚本：

```bash
node tests/release-check.js
```

当前回归脚本覆盖：

- 固定随机种子的可复现性
- Webster 配时建议的关键计算
- 启动流率估计的基本数值正确性

### 截图与录屏

发布前建议补上主页截图、过饱和场景截图和短录屏。需要拍哪些图，见 [docs/SCREENSHOTS.md](./docs/SCREENSHOTS.md)。

### 浏览器支持

- Chrome / Edge 最新版
- Safari / Firefox 新版本应可运行，但建议发布前手动 smoke test

### 已知简化与边界

- 这是教学 demo，不包含行人信号逻辑、黄闪控制、公交优先、协调控制网等复杂机制
- 指标用于教学展示，不应直接替代工程交叉口设计校核
- 页面优先兼容桌面端，同时提供窄屏响应式布局；正式发布前仍建议手测手机与平板

### 目录

```text
.
├── docs/
│   ├── SCREENSHOTS.md
│   └── screenshots/
├── index.html
├── LICENSE
├── README.md
├── legacy/
│   └── intersection.js
├── src/
│   ├── intersection.analytics.js
│   ├── intersection.config.js
│   ├── intersection.css
│   ├── intersection.geometry.js
│   ├── intersection.i18n.js
│   ├── intersection.models.js
│   ├── intersection.render.js
│   ├── intersection.simulation.js
│   └── intersection.ui.js
└── tests/
    └── release-check.js
```

### 开源协议

本项目采用 [MIT License](./LICENSE)。

## English

A browser-based teaching demo for isolated intersection signal control. It bundles several core traffic-engineering teaching concepts into a single zero-dependency frontend project: protected left-turn phasing, IDM car-following, Webster timing suggestion, oversaturation behavior, single-intersection offset demonstration, and a northbound space-time diagram.

### Scope

- Zero-dependency browser demo
- Single-intersection teaching simulator, not engineering design software
- Fixed-seed and regression-checkable for public GitHub release

### Model Assumptions

- One isolated four-leg intersection
- One left-turn lane, one through lane, and one right-turn lane per approach
- Four protected phases with free right turns
- Poisson arrivals split by lane shares
- IDM for inbound car-following
- Webster timing suggestion based on critical lane-group flow
- Queue discharge rate estimated from queued departure headways in `veh/h/lane`
- Green-wave demo is a single-intersection offset illustration, not a corridor coordination model

### Quick Start

Open `index.html` in a browser.

For reproducible runs, append a seed:

```text
index.html?seed=20260324
```

### Validation

```bash
node tests/release-check.js
```

### Media Checklist

Before tagging a public release, add screenshots and a short screen recording listed in [docs/SCREENSHOTS.md](./docs/SCREENSHOTS.md).

### License

This project is released under the [MIT License](./LICENSE).
