# Firefox（Gecko）支持 · 2026-09-24

本机没有任何系统浏览器，全部结论来自**外置 Playwright + Gecko 引擎实测**（安装在 `/tmp/opencode/pw`，`PLAYWRIGHT_BROWSERS_PATH=/tmp/opencode/pw-browsers`，不进仓库、不改 `package.json` 依赖），配合一次 MDN BCD / Bugzilla 只读调研。目标：桌面 Firefox 最新版与 ESR ≥ 140。

## 一、阻断级缺陷（已修）

### 1. `AudioParam.cancelAndHoldAtTime` 在 Firefox 完全未实现

- 现象：Gecko 下点击启动后停在「声音暂未就绪，请重试或无声进入」，`rhine.stats().startup` 永远到不了 `started`；后续每次切场景、音效停止、duck、开场混音都会抛 `TypeError`。
- 依据：MDN BCD `cancelAndHoldAtTime` → `firefox: false`（bug 1308431，至今 NEW）。首次实测（修复前）就是这个状态：`startup: null`、无 pageerror（异常被 `activate()` 的 catch 吞掉），与调研推断一致。
- 修复：`src/audio.ts` 的 `level()` 做特性检测，Firefox 走 `cancelScheduledValues(now)` + `setValueAtTime(param.value, now)` 再 `linearRampToValueAtTime`。Firefox 69+ 的 `AudioParam.value` 已计入运行中 automation，语义等效；全库不使用 `setValueCurveAtTime`，`cancelScheduledValues` 在此场景为完整实现。Chromium / Safari 继续走原路径，行为不变。
- 回归保护：`scripts/check-firefox.mjs` 点击 `.entry-start` 并断言 `startup === 'started'`。

### 2. PWA 安装引导文案在 Firefox 桌面不成立

- Firefox 桌面永不触发 `beforeinstallprompt`，也没有「安装到设备」菜单项，原兜底文案「可通过浏览器菜单安装或添加到主屏幕」承诺了不存在的入口。
- 修复：`src/pwa.ts` 增加 `installlessFirefox()`（UA 判定，排除 Android），改用「本浏览器不提供一键安装；收藏本站即可随时进入。」安装按钮仍只在 `installPrompt` 存在时渲染。（2026-09-26 移除离线缓存后文案相应去掉“离线”字样。）
- 回归保护：`check-firefox.mjs` 断言弹窗内 `#pwa-settings` 首段文案。

### 3. `navigator.userActivation` 在 Firefox < 120 不存在

- `src/main.ts` 的 `rhine.playBootPreview` 审阅钩子直接读 `.isActive` 会抛错；改为 `navigator.userActivation?.isActive`，与同文件 `visualViewport?.` 风格一致。

## 二、视觉与健壮性（已修）

- **滚动条配色**：Firefox 是 `scrollbar-width` 的原生实现方，窄屏 `.terminal-modal` 只有 `scrollbar-width: thin` 时会退回系统默认色。已在 `src/responsive.css` 的三处（桌面 `.detail-content`、compact/portrait `.detail-content`、`.terminal-modal`）补 `scrollbar-color: #bbb4a6 transparent;`，与 `style.css` 既有值一致。
- **孤立 CSS 声明块**：`src/podcast-skin.css` 第 187 行起的 `px; … }` 是无选择器的解析错误块（两端等效丢弃，功能由 `.player-toggle` 完整规则兜底），已清理。

## 三、检查脚本的可移植性

- 5 个硬编码 `channel:'msedge'` 的检查改为 `process.env.REVIEW_CHANNEL ? { channel } : {}`，**默认行为不变**（仍是 Edge），空值时使用 Playwright 自带 Chromium：`check-web-integration`、`check-performance-invalidation`、`check-performance`、`check-model-precision`、`check-model-precision-review`。
- 新增 `scripts/check-firefox.mjs` 与 `npm run check:firefox`。

## 四、实测结果（Gecko，1600×900 headless）

产物见 `verification/firefox/`（`results.json`、`archive.png`、`detail.png`、`shared-depth.png`）。

| 项 | 结果 |
| --- | --- |
| 引擎 | Firefox/155 Gecko，WebGL 2.0（NVIDIA GeForce GTX 980） |
| 启动（声音解锁） | `started`，修复前为卡死状态 |
| 阵列渲染 | 48 draw calls、318 个档案实例、零 pageerror / console error |
| **MRT 共享深度** | 切到 `original` 预设后 `aoWidth 1600 = render width`（aoResolution 1）、AO 32 采样、景深 100、`superPerformance false` → `scene.setSharing(...)` 四个条件全满足并实际绘制；`shared-depth.ts` 的 `layout(location = 1)` + `clearBufferfv(gl.COLOR, 1, …)` 在 Gecko 无着色器错误 |
| 弹窗渲染挂起 | 模糊遮罩期间 `drawnBehindBackdrop = 0`（一帧都不画），关闭后 `resumed > 0` 恢复绘制 |
| 滚轮切档 | `wheelChanged: true` |
| 详情模式 | 进入成功，截图正常 |
| Service Worker | 已于 2026-09-26 移除（在线播放器，不再离线缓存）；本轮检查改为断言不注册 |

> 注：默认「性能」预设 `aoSamples:0 / depthOfField:0`，共享深度那段非 three 内建材质根本不会编译；因此脚本先切 `original` 再断言，避免「通过但没测到」。

## 五、仍需人工确认（未改代码）

1. **音频 ramp 听感**：Firefox 对 `linearRamp/exponentialRampToValueAtTime` 为部分实现（bug 2011524「sometimes jumps to value immediately」）。需实机试听切场景 1.1s 斜坡、duck 0.9s、开机淡入；若有可闻爆音，对增益类参数改 `setTargetAtTime`（BCD 完整实现），频率扫频保留。
2. **滚轮慢滚手感**：`scene.ts` 的 100 阈值 + 180ms 清零窗口在触控板／鼠标慢滚下是否偶发不切档，标准 `WheelEvent` 无 BCD 分歧，属行为差异，须真机确认。
3. **`@media (display-mode: standalone)`**：Firefox 桌面无安装入口故恒不匹配（预期）；Firefox Android 是否匹配需实机验证。

## 六、复现

```bash
npm run preview -- --port 5188      # 终端 A
PLAYWRIGHT_MODULE=/path/to/playwright \
PLAYWRIGHT_BROWSERS_PATH=/path/to/browsers \
node scripts/check-firefox.mjs      # 终端 B（需 playwright install firefox）
```

> 2026-09-25：环境重启清除了外置 Playwright + Gecko，遮挡剔除合入后的 `check:firefox` 重跑（弹窗采样断言已修正，允许 Playwright 点击产生的额外帧）**待恢复环境后执行**；本文与 `verification/firefox/` 的既有结果取自此前的 Gecko 完整轮次，`src/audio.ts` 阻断修复等代码未再变更。
