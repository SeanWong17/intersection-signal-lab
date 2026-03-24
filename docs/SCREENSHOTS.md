# Screenshot And Recording Checklist

发布公开版本前，建议至少补这 4 份素材。文件名已经按 README 可引用的路径约定好，直接放到 `docs/screenshots/` 即可。

## 建议截图

1. `docs/screenshots/main-dashboard.png`
   说明：默认参数下的主界面，全画布 + 右侧控制面板，能看清 LOS、延误、通行量、启动流率和时空图。
2. `docs/screenshots/webster-plan.png`
   说明：点击 `Webster 配时` 后的界面，展示调整后的周期和各相位绿灯。
3. `docs/screenshots/oversaturated-demo.png`
   说明：过饱和场景，最好能看到排队溢出、告警和较差 LOS。
4. `docs/screenshots/offset-demo.png`
   说明：相位差演示场景，最好能看到引导箭头和北进口时空图。

## 建议录屏

1. `docs/screenshots/demo-walkthrough.gif` 或 `docs/screenshots/demo-walkthrough.mp4`
   说明：15-30 秒，顺序建议为默认运行 -> 调流量 -> 点 Webster -> 点过饱和 -> 点相位差演示 -> 切换中英文。

## README 图注模板

如果你后面补上图片，可以在 README 里直接加下面这段：

```md
![Main dashboard](./docs/screenshots/main-dashboard.png)
![Oversaturated scenario](./docs/screenshots/oversaturated-demo.png)
```
