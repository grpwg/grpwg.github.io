# 壁纸分支回合网页主分支

2026-09-11，按用户授权将 `codex/wallpaper-engine` 的已提交实现合入 `main`，保留两种构建入口。未包含原工作区未提交的文件桥接实验与其他改动。

| 功能 | 网页处理 |
| --- | --- |
| 亮暗配色及卡片波次变色 | 直接合入，设置选择，保存偏好；详情、查看器同步 |
| 自适应阵列、逐实例裁剪、暗色雾气 | 直接合入；显式原片时间码对照保留固定阵列 |
| 正常开场铺屏与移除字幕 | 直接合入，保留网页版点击解锁声音 |
| 页脚数字时钟、滚动测量修复 | 直接合入，时分秒独立滚动，减少动态效果仍有效 |
| 超级性能模式 | 增加网页设置，默认关闭，保存到原偏好；独立于减少动态效果，关闭恢复当前预设或自定义画质 |
| 资源释放与材质管理 | 共用修复合入；网页不提供隐藏档案场景的桌面开关 |
| 工作台、待办、倒计时、专注、媒体文字滚动 | 代码保留在壁纸入口；网页继续以档案浏览为主 |
| 系统音频律动、媒体回调、宿主暂停与帧率 | 仅壁纸构建初始化，普通网页不伪造系统输入 |
| HUD、颗粒色散、界面边距、自定义图片、3D 开关 | 本次保留为壁纸属性；网页如需开放，应另行设计对应的设置入口 |
| 主屏幕安装、声音、检索收藏、导出、触摸与自定义画质 | 继续保留网页流程（离线缓存已于 2026-09-26 移除） |

## 验证

- `npm ci --offline` 安装通过，安装阶段自动应用固定版本滚动库修补。
- `npm run build` 通过（TypeScript + Vite；离线预缓存与 `sw.js` 已于 2026-09-26 移除）。壁纸构建（`npm run build:wallpaper`，824 文件、35.1 MiB）已于 2026-09-24 随 Wallpaper Engine 支持移除。保留 Vite 既有大包提示。
- 18 项档案内容测试通过；视口计算、主题反转连续性、阵列覆盖与裁剪检查通过。
- `scripts/check-web-integration.mjs` 对正式网页构建运行：真实点击启动、无壁纸宿主初始化、暗色和性能偏好刷新恢复、关闭性能恢复画质、键盘选档、真实时钟动画、详情正文与 Esc 返回均通过。默认 `channel: msedge`，可用 `REVIEW_CHANNEL` 覆盖（空值使用 Playwright 自带 Chromium），`REVIEW_ARGS` 可传硬件 GL 标志（见下节）。
- 2026-09-24 更新：原「打开 360° 查看器并断言第二个 canvas」一段改为「详情正文可见 + 恰好一个主场景 canvas + Esc 返回档案」。查看器已由 `92c2fd1`（改造成播客官方站）删除 `src/model-viewer.ts`，旧断言在基线上同样失效，不是本轮改动造成。
- 2026-09-24 顺带清理 `92c2fd1` 留下的查看器死代码：删除无人引用的 `src/viewer-camera.ts`、`quality-renderer.ts` 的 `createViewerPipeline` 及 3 个仅它使用的 postprocessing 导入、`audio.ts` 的 `SoundScene = "viewer"` 与对应混音配比、`theme.css` 10 处／`responsive.css` 3 处 `.viewer-*` 选择器、设置里「同步至 360° 查看器」文案，并修正 `appearance.ts`、`archive-lighting.ts` 两条过期注释。`.object-caption` 在 `main.ts` 仍有标记，保留。
- 2026-09-24 缺陷修复（检查加堆栈打印后抓到）：按 ←/→ 切换栏目会抛 `TypeError: Cannot read properties of undefined (reading 'id')`，整次切栏中途夭折。根因是 `#file-ticks` 只在启动时按**当前栏目**的期数生成一次（`fileTicks` 为常量快照），切到期数更少的栏目时 `files[slot]` 落空、`records[undefined].id` 抛错，并把 `data-select` 写成 `"undefined"`。`92c2fd1` 把内容换成 11 期／5 栏（3,2,2,2,2）后暴露，基线 `019fabe` 同样存在。修复：刻度按**最大栏目数**生成，`updateSelection` 内空槽设 `hidden`、清空 `data-select` 并直接返回。
- 另有 4 个更早的脚本（`capture-readme.mjs`、`check-pwa.mjs`、`check-font-update.mjs`、`check-responsive.mjs`）仍在引用 `.viewer-open`／`[data-viewer]`，同属 `92c2fd1` 之后的陈旧脚本，本轮未处理。
- 1600×900、2560×1080、390×844、844×390 视口检查通过，后面三项未出现页面横向溢出。截图检查了暗色详情与手机横屏布局。这是桌面 Edge 视口模拟，不是新一轮 iPhone 真机测试。
- 网页保留 manifest 与主屏幕安装引导；不再生成 Service Worker（2026-09-26 移除离线缓存），本轮未包含离线升级矩阵。壁纸输出已于 2026-09-24 移除。
- 运行无页面异常或 THREE／Shader／WebGL 错误。结果与截图位于 `verification/web-integration/`。

## 无头 Chromium 的 GPU 后端（2026-09-24）

本机无头 Chromium 默认掉进 **SwiftShader 软件光栅化**：档案三维模式实测 **0.3 fps**，表现为 `.settings-button` 的 `click` 永远停在「waiting for element to be visible, enabled and stable」（Playwright 的 stable 判定需要连续两帧 rAF，而帧泵近乎不出帧），并偶发页面 `CLOSE`；`chrome --type=gpu-process` 占用约 9 核。基线 `019fabe` 完全同样复现，**与应用代码和本轮改动无关**。

解法是显式切到硬件 ANGLE/Vulkan（`check-*.mjs` 支持 `REVIEW_ARGS`，逗号分隔，默认不传、行为不变）：

```bash
REVIEW_CHANNEL=chromium \
REVIEW_ARGS=--use-gl=angle,--use-angle=vulkan,--enable-gpu,--ignore-gpu-blocklist,--enable-features=Vulkan \
node scripts/check-web-integration.mjs
```

实测对照：`ANGLE (NVIDIA, Vulkan 1.4.351 …)` → 档案 **54.5 fps**、点击 **91ms** 通过、无 `CLOSE`；`--use-gl=angle --use-angle=gl`、`--use-gl=egl` 与默认配置仍为 SwiftShader（0.3 fps）。Gecko 走自身 GL 栈，本来就是硬件加速，无需标志。

复现：`npm run build`，运行 `npm run preview -- --port 5188`，另一个终端执行 `node scripts/check-web-integration.mjs`。可用 `PLAYWRIGHT_MODULE` 指定 Playwright 安装位置。
