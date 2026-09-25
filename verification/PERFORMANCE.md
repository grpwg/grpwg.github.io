# 保持视觉效果的性能优化

基线：`75f7eac83d65dcb70a6177437d7994ce5a0933f2`，来自 `codex/wallpaper-engine`。本轮工作保留在 `codex/visual-preserving-performance`。网页与壁纸使用同一套主场景优化；开场 HUD 使用既有原生实现。

## 完成的修改

1. **同帧阴影复用**：每次实际绘制只在主画面通道生成一次阴影，环境遮蔽与景深通道复用。场景世界矩阵也在模拟结束后统一更新一次。
2. **阵列数据共享与按变化上传**：五种阵列部件共用一个实例矩阵缓冲。比较实际 Float32 数值，只上传变化区间；主题属性独立更新。包围球仅在实例变换或数量变化时重算。相机、轨道及覆盖参数相同则复用候选列表，逐卡裁剪继续执行。
3. **静止画面复用**：模拟、选档、拾取与界面更新继续执行，仅在相机、实例、材质、纹理及后处理输入均相同时跳过三维绘制。比较的是 GPU 浮点输入，不截断弹簧、不增加动画停止阈值。变化中的实例直接绘制，避免在忙碌帧上额外扫描全部材质。纹理更新、画质、窗口尺寸、上下文恢复等变化会使缓存失效。
4. **开场 HUD 布局缓存**：文字或布局变化时测量原始框体；Logo 位移与欢迎画面缩放从原时间轴变换计算。保留字体完成加载、窗口尺寸、布局模式切换等失效条件。
5. **环境遮蔽与景深共享深度绘制**：在法线通道的第二个颜色附件中，同时输出原 BokehPass 的 RGBA 打包深度，保留 HalfFloat 存储与高精度深度公式。景深使用原着色器。AO 分辨率降低或关闭时继续使用原独立景深深度通道；不以低分辨率深度替代完整深度。

模型、材质参数、光照、阴影分辨率、AO 采样、景深强度、抗锯齿、三维渲染比例和动效时间轴未降低。无新增产品开关。

## 测量方法

- 本机 GPU：NVIDIA GeForce RTX 5070 Ti Laptop GPU，ANGLE / D3D11；主基准为 1920×1080、DPR 1、原始画质。
- Edge 中运行实际 ArchiveScene。固定随机种子以保持 SSAO 样本一致，固定 1/60 秒模拟步长，按场景重建实例。核心每场景采样 48 帧。
- 原生 Wallpaper Engine 测试窗使用相同场景和画质，运行于其 CEF（Chrome 146）中。每场景先运行 60 个实际预热帧，再采样 96 帧；三轮顺序为基线→优化、优化→基线、基线→优化。
- 宿主性能基准隔离真实鼠标转发，选档与音乐频段由脚本提供。正常鼠标、触摸、音乐唤醒等另有运行时回归。
- GPU 时间来自 `EXT_disjoint_timer_query_webgl2`，失效或未就绪的查询记为 `null`，不当作零；CPU 时间是主线程模拟和渲染命令提交耗时。二者不能直接相加推算 FPS。
- 原始记录中的 `total` 仅包含 CPU 提交及 `gl.finish()` 调用返回时间，浏览器可异步处理命令，不能把它当作端到端帧耗时。
- 测试未锁显卡频率、功耗与其他桌面进程，因此同时报告绘制工作量和时间波动。此机器不是低配设备，结果不外推为所有用户的固定提升幅度。

## 已确认的工作量减少

| 场景／指标 | 基线 | 优化后 |
| --- | ---: | ---: |
| 普通呼吸／音乐场景绘制调用 | 102 次/帧 | 75 次/帧 |
| 固定 48 帧快速切档样本的绘制调用中位数 | 308 次/帧 | 225 次/帧 |
| 普通阵列缓冲上传 | 186,624 字节/帧，6 次 | 约 20,000 字节/帧，1 次 |
| 已稳定阵列／详情三维绘制 | 每帧重绘 | 采样期间 0 次 |
| 已稳定阵列／详情缓冲上传 | 每帧上传 | 0 字节 |
| 开场 HUD，650 帧布局测量 | 651 次，含预备帧 | 92 次 |

上传减少约 89%；102→75 的绘制调用减少约 26%。连续呼吸、音乐、切档和开场仍完整运行，静止复用仅在输入一致时生效。

## 时间结果与视觉证据

以下为最终三轮原生宿主各轮中位数的中位数（毫秒），每轮 96 个样本：

| 场景 | CPU 基线→优化 | GPU 基线→优化 | 解读 |
| --- | --- | --- | --- |
| 静止归齐阵列 | 2.60→1.20 | 5.22→0 | 复用已有画面；模拟仍运行 |
| 呼吸阵列 | 2.70→2.40 | 5.23→4.57 | GPU 中位耗时降低 12.6% |
| 连续快速换档 | 5.10→4.60 | 7.09→6.15 | 最终三轮降低 13.2%，早先一批接近持平 |
| 已稳定详情 | 2.00→0.80 | 5.43→0 | 复用已有画面；输入会唤醒 |
| 音乐律动 | 2.80→2.60 | 5.22→4.52 | GPU 中位耗时降低 13.3% |

“0”仅指受测三维场景无重复绘制，不代表整张壁纸零 GPU 占用；界面、窗口合成与其他效果仍可能运行。先前交替采样中快速换档的 GPU 中位数为 6.98→7.05 ms，体现了频率和负载波动，因此不承诺所有机器或每次运行都能得到上述百分比。

网页核心结果：`performance/baseline/results.json`、`performance/candidate/results.json`；逐像素对照：`performance/candidate/comparison-baseline.json`。六个场景的定点截图均无像素差异。网页样本中呼吸和音乐的 GPU 时间有所下降，快速切档接近持平，三维入场的一次样本反而较慢；不据此宣称所有场景都提速。

扩展对照覆盖暗色、半分辨率 AO、关闭 AO、关闭景深、SMAA、2560×1080、900×1600，以及另两种音乐律动，九组截图均无像素差异。见 `performance/candidate-extended/comparison-baseline-extended.json`。

开场 HUD 在 1920×1080、2560×1080、900×1600 连续运行各 650 帧。CPU 总耗时分别由约 1638/1990/1920 ms 降至 363/409/408 ms，减少约 78%–79%。连续投影矩阵的最大数值差约 0.00025（浏览器变换序列化精度）；15 张定点截图逐像素相同。见 `performance/hud/results.json` 和 `performance/hud/images.json`。

原生宿主三轮的逐帧记录、每轮中位数和画面校验位于 `performance/host/runs.json`。汇总脚本保留轮间范围，并单独验证每组画面，见 `performance/host/summary.json`。早期采样发现宿主真实鼠标导致悬停抬起、破坏固定输入，已修订测试程序；不把该批结果用于最终比较。

更严格的重复检查发现：宿主详情页的截图有 **4 个像素，各有一个 RGB 通道相差 1/255**，总绝对通道差为 4，其余像素相同。坐标与逐轮结果完整保留在上述汇总中。人工审阅认定这不构成可见画质损失，但不能称作原生宿主所有画面逐字节一致；汇总脚本如实保留不一致的哈希。此前未保存截图的重复采样也保留为 `performance/host/first-repeated-runs.json`。

完整截图在本机 `verification/performance/`；Git 保存代表性对照图、原始数值、比较报告和完整图片哈希清单 `performance/image-manifest.json`，避免把每次中间运行的截图全部加入仓库。

## 跨帧阴影缓存、亚像素细节 LOD 与实例复用（2026-09-25）

用户参考半条命 2（Source 引擎）的渲染裁剪方法，要求继续优化低配机器、笔记本与手机 Chrome 的卡顿；红线放宽为允许亚像素细节 LOD（<1 设备像素的小螺丝不画），其余保持不降分辨率、不关阴影/AO/景深、不改材质与后处理。

1. **A 跨帧阴影缓存**（`shadowCache`）：每帧汇总投射者输入指纹——投射链可见性、世界矩阵、几何 id、实例矩阵版本，加上光源位置/目标与阴影相机、mapSize、bias 配置——相同则复用上一帧的阴影深度图。上下文恢复、`setQuality` 使 `shadowInput=null` 强制重绘；模态挂起帧同样计算哈希，避免恢复后多渲染一次阴影。
2. **B 亚像素细节 LOD**（`detailLod`）：离线分析 GLB 连通域得到特征尺寸（fasteners 最大连通块 0.114→记 0.15、inlay 用 bbox 最大边，共用 `detailFeature=max`，因「全部亚像素 ⇔ 最大者亚像素」）。全量帧按每实例距离把「0.25 单位特征 <1 设备像素」的实例移出细节批次（count=full 前缀）。**实测在所有现实视口下休眠**：1600×900 最小投影 26.3px，超性能 60% 缩放与手机视口也 ≥8px——长焦（fov≈4.7°）加卡片约 136 单位距离使螺丝永不亚像素；放宽阈值到约 16px 才会剔到可见螺丝，违反画质红线，故不做。用户确认保留为休眠守卫。
3. **C 实例 pass 复用指纹**（`instanceReuse`）：Pass A/B/C 的全部输入分六段指纹（discrete / floats / time / maps / camera / cells），全部一致则整帧跳过候选构建、遮挡建格与实例提交；复用帧用 `theme.sample` 遍历 `drawnCells` 补齐 `theme.latest`，保证后续主题切换连续。浮点输入用 float32（实例缓冲自身精度）量化到真实终态，衰减项按有限阈值归零（scanBlend、idleGain、脉冲包络）；脉冲在阵列中 `pulseGain` 常驻 1，只有存活涟漪才入 time；可见格集内容以 `ArchiveVisibility.key` 入指纹，与其 f64 精确再键保持一致，良性噪声下内容不变、真实边界穿越强制全量。`theme.animating()` 以 `age>=0` 排除初始 `start=-10`。

三个 URL 开关 `?no-shadow-cache`、`?no-detail-lod`、`?no-instance-reuse` 用于 A/B，均为默认开启。

### 验证

`npm run check:frame-caching`（外部 Playwright，环境变量见下）。1600×900、reduced、无音乐设置，稳定窗口用轮询判据（`renderedFrames` 冻结 800ms 且 `drift=[]`）而非固定等待：相机 rate-5 缓动收敛到 float32 精确约需 7 秒且随运行历史漂移。

| 状态 | 默认构建 | 三开关全关 |
| --- | ---: | ---: |
| 静止阵列帧循环 | 73/73 复用、阴影 0 次重绘 | 复用 0、逐帧全量 |
| 详情阅读 | 84/84 复用、阴影 0 次 | 复用 0 |
| 主题波结束后 | 72/72 复用（复用恢复） | 复用 0 |
| 选中动作 | 渲染 65 帧 / 阴影 62 帧 | 渲染 67 / 阴影 67 |

- 同状态 ON/OFF 截图像素差：archive 60px、select 0px、detail 0px、dark 74px，均低于 400px 预算（同状态运动噪声地板 0–60px）。
- 交互回归：选中重绘 42,636px、主题重着色 1,433,606px、遮挡剔除 149 格、`detailCulled=0`（B 休眠的直接证据）、零页面/着色器错误。
- 选中窗口内 `shadow(62) < rendered(65)` 证明缓存跳过卡片停稳后的相机尾巴帧；关闭缓存则 `shadow === rendered` 每帧必绘。
- 既有回归：`check:occlusion`（视觉中性 4733px ≤ 5781px 预算、三角形 on<off）、`check:content`、`check:viewport` 全部通过。
- 证据：`verification/frame-caching/results.json` 与代表性截图。

```bash
# 复现（外部 Playwright 安装，不进仓库）
PLAYWRIGHT_MODULE=<playwright 模块> PLAYWRIGHT_BROWSERS_PATH=<浏览器目录> \
REVIEW_CHANNEL=chromium REVIEW_ARGS=--use-gl=angle,--use-angle=vulkan,--enable-gpu,--ignore-gpu-blocklist,--enable-features=Vulkan \
REVIEW_URL=http://127.0.0.1:4173 npm run check:frame-caching
```

## 运行时回归

- `check-render-updates.mjs`：实际 Float32 更新范围、尚未提交的区间、纹理与对象变化、显式失效，以及长期运行中超过 2²⁴ 的版本计数。
- `check-performance-invalidation.mjs`：稳定画面、改尺寸、配色、选档、延迟纹理、AO/景深通道切换、SMAA、3D 退场反向、音乐恢复、实例容量扩展后的共享缓冲。
- `check-frame-caching.mjs`：跨帧阴影缓存、实例 pass 复用指纹与亚像素细节 LOD 的开关 A/B、计数器断言、同状态截图像素差与交互回归。结果见 `frame-caching/results.json`。
- `check-archive-diagonal.mjs`：桌面、手机竖屏与横屏上的投影轨道、自由拖动、转向。结果见 `performance/runtime/diagonal.json`。
- `check-three-release.mjs`：退场反向、实际上下文释放、零三维画布、图片背景、重新创建上下文、减少动态效果、查看器释放与详情恢复。结果见 `performance/runtime/three-release.json`。该脚本已于 2026-09-24 随 Wallpaper Engine 支持删除，结果文件保留为历史记录。
- `check-boot-hud.mjs`：五个开场区域、曲面关闭／静态／追踪、减少动态效果、阶段切换、超宽屏。结果见 `performance/runtime/boot-hud.json`。该脚本已于 2026-09-24 随 Wallpaper Engine 支持删除，结果文件保留为历史记录。
- 既有覆盖范围、画质迁移、运动规则与内容检查通过；TypeScript、网页生产构建通过。壁纸构建已于 2026-09-24 移除。

当前机器未安装 Playwright WebKit 运行时，本轮没有真实 iPhone/Safari 或其他 GPU 的验证；不能把 Chromium 的手机视口测试称为 iPhone 实机结果。

## 复现与维护

```powershell
# 如 playwright / pngjs 不在项目依赖中，设置为本机安装路径。
$env:PLAYWRIGHT_MODULE = '<playwright 模块目录>'
$env:PNGJS_MODULE = '<pngjs 模块目录>'
node scripts/build-performance.mjs baseline
node scripts/build-performance.mjs candidate
node scripts/check-performance.mjs baseline
node scripts/check-performance.mjs candidate
node scripts/compare-performance.mjs baseline candidate

# 宿主必须已安装，必要时配置 WALLPAPER_EXE。
$env:HOST_ROUNDS = '3'
node scripts/check-performance-host.mjs
node scripts/summarize-performance.mjs

# 另一个终端启动测试服务器后运行缓存与 HUD 回归。
node scripts/serve-performance.mjs release/performance-candidate 5194
node scripts/check-performance-invalidation.mjs
node --experimental-strip-types scripts/check-render-updates.mjs
```

基线构建从上述 Git 提交加载原版 `scene.ts`、`archive-visibility.ts`、`hud-projection.ts`，使用同一资源与测试入口；不切换或改写工作区。测试页面不属于正常生产构建入口。

共享深度针对锁定的 Three.js 0.183.2 实现，使用了 SSAOPass 的 `_renderOverride` 扩展点。升级 Three.js 时必须检查该调用约定、深度着色器、附件清除行为，并重跑视觉及回退通道测试。主场景后续增加新的可变材质、光源或着色器输入时，需要一并加入 RenderState 失效条件。
