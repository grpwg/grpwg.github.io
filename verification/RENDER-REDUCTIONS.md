# 不可见即不画 · 渲染与每帧写入削减 · 2026-09-24

用户要求「优化网页，让看不到的地方不渲染」，并明确红线：**不能影响画质**——不降分辨率、不关阴影／AO／景深、不改材质与后处理；后续追加「激进点优化，自己决定，尽可能少影响画面表现」。

本记录说明改了什么、为什么这些是安全的，以及**刻意不改**的项目和理由。

## 一、红线（本轮未触碰）

以下都属于「降画质」而非「不可见就不画」，一律不做：

- 渲染分辨率、像素密度、抗锯齿、阴影、AO、景深、透明材质分辨率、纹理过滤——全部仍由用户画质设置与 `prefs.superPerformance` 决定。
- 材质、光照、后处理链、色调。
- 为了省事关闭呼吸、波浪、选档动效（只在**屏幕被完全遮住**时跳过绘制，见下）。

## 二、已落地的优化

### 1. 弹窗期间挂起整条 GPU 通路（最大头）

`scene.update(time, cinematic, suspendRender)`：弹窗（检索／收藏／设置）打开时，`.modal-backdrop` 以 `rgba(…, .45) + backdrop-filter: blur(18px)` 完全覆盖舞台。

- **继续做**：所有模拟（呼吸、波浪、阻尼、镜头、实例矩阵、主题波）照常推进，所以关闭弹窗时画面不会跳帧、不会出现呼吸相位突变。
- **不做**：静态快照（`scene.traverse` + `Math.fround`）与 `renderer.render / composer.render`（含阴影、AO、景深、SMAA、折射）。
- **恢复**：关闭后第一帧强制绘制一次（`resumed` 标记），覆盖弹窗背后发生的 resize 或画质切换这类「快照看不见」的变化。

证据：`verification/firefox/results.json` → `modal.drawnBehindBackdrop = 0`、`modal.resumed = 43`；`check-firefox.mjs` 对这两项做了断言（模糊期间一帧都不许画，关闭后必须恢复绘制）。

### 2. 每帧 DOM 写入改为逐值比较提交

这些写入原本**每帧无条件执行**，触发样式重算；现在只有值真的变了才写：

| 位置 | 原来每帧 | 现在 |
| --- | --- | --- |
| `src/main.ts` `frame()` | `#detail-content` 的 `opacity`、`translate`、`inert` 三次查询 + 三次写入 | 元素引用复用，逐值比较，静止帧 0 写入 |
| `src/main.ts` `frame()` | `#stage` 的 `--detail-shade` | 与**实际 inline 值**比较（不是影子缓存），静止帧 0 写入 |
| `src/player.ts` `setOpacity()` | `opacity`、`pointerEvents` 每帧写 | 逐值比较 |
| `src/scene.ts` `update()` | `canvas.style.opacity` 每帧写 | 逐值比较（`canvasOpacity`） |
| `src/inspection-overlay.ts` | 每帧约 11 处 DOM 写入 + 每帧 `clientWidth` 读取（强制布局刷新） | 逐值比较；尺寸改用 `ResizeObserver` 触发重测，静止帧 0 写入、0 强制布局 |

对照基线 `/tmp/opencode/baseline`（HEAD `019fabe`）。

### 3. 已排除的候选（记录理由，避免重复踩）

- **`scene.ts` 每实例粗筛（先 X/Z 再算 `field()`）**：候选集已经由 `ArchiveVisibility.update()` 用视锥 + 高度板条（±6.5）裁过，剩下的 `intersects()` 只比 y 方向的紧界（−0.3…+4.1）；而 y 必须先算 `field()` 才知道，任何不依赖 `field()` 的保守 y 界都会宽到永远通过。加一层只会多一次盒测试，收益为负。
- **隐藏层补 `visibility: hidden`**：候选只有 `opacity: 0` 的层（`.detail-ui[hidden]`、`.modal-backdrop[hidden]`、`.column-navigation` 等已经是 `display: none`）。而 `.archive-ui` 等是带 `0.8s` 延迟淡出的，插入 `visibility` 需要额外的 `transition: visibility 0s .8s` 才能不切断淡出，属于「可能改变画面」的风险换极小收益；现代 Chromium / Firefox 对 `opacity: 0` 子树本就跳过绘制。
- **静止时停车 rAF**：静止复用（`RenderState`）已经让 GPU 零开销，rAF 本身只剩亚毫秒 JS。要真正停掉必须给所有输入、播放器、滚动数字、主题波、详情过渡登记「唤醒」，漏一个就是整页冻死——风险远大于收益。
- **开场 cinematic 的 160 位置固定裁剪**：那是逐帧对照原片的基线，改动会破坏与原片的比对，不碰。
- **详情页右侧遮挡剔除**：违反「必须保留后方阵列可见层次」的既有构图约束，不碰。

## 三、结论

在不改变任何一帧画面内容的前提下，削减了：弹窗期间的全部 GPU 帧（原为满帧渲染）、静止帧的全部 DOM 写入与强制布局刷新。画质、材质、后处理、动效时间轴与基线完全一致。

## 四、复现

```bash
npm run build && npm run preview -- --port 5188
PLAYWRIGHT_MODULE=… node scripts/check-firefox.mjs     # 弹窗挂起断言
node --experimental-strip-types --test scripts/check-render-updates.mjs
node --experimental-strip-types --test scripts/check-archive-visibility.mjs
node --experimental-strip-types scripts/check-viewport.mjs
node --experimental-strip-types --test scripts/check-content.mjs
```
