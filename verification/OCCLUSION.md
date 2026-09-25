# 可见性裁剪：遮挡剔除（2026-09-25）

目标（用户 2026-09-24/25 授权）：只为摄像机渲染——出视锥不画，被遮挡的部分（含模型
自身被挡住的部分）完全不渲染，以求极致优化；红线不变：不降分辨率、不关阴影/AO/景深、
不改材质与后处理，画质零变化。

## 现状与缺口

- 逐实例视锥+覆盖裁剪早已存在（`src/archive-visibility.ts`，18% 余量留剪影与屏幕外
  阴影投射体），开场/原片对照的固定 160 位置不在其内。
- 缺的是**遮挡剔除**：一个卡片被前排卡片或不透明 DOM 面板完全盖住时，仍然照画。
- 一帧内实例几何被重复遍历多次：阴影贴图、透射采样 RT、主通道、AO/景深深度通道
  （共享深度按需）——剔除同时作用于所有通道，因为它们共用同一份实例矩阵缓冲与 `count`。

## 实现（`src/occlusion.ts` + `src/scene.ts`）

CPU 保守屏幕空间遮挡网格（软件 HZB），无 GPU 回读、零分配热点：

- 网格：每 6px 一格，`Float32Array` 每格存"完全覆盖该格的遮挡物中最小的远深度"
  （初值 `Infinity`，`min` 合并，与遮挡物顺序无关）。
- **遮挡物**：每个候选卡片的实心包围盒（card space 由 5 个批次几何并集得到），
  以及不透明 DOM 面板矩形（深度 0，位于整个场景之前）。
  - 投影取**真实旋转后的 8 角点**（先 `view×matrix` 再投影），不做 AABB 再膨胀，
    斜率倾转（≤0.024rad）不会虚增覆盖面。
  - 单调链凸包 + 扫描线**内栅格化**：仅当格子的上下两边都落在包络内（凸性 ⇒ 整格
    在内）才认领，并再内缩 `EDGE_MARGIN=3px`——毛玻璃边缘的亚像素透光缝、栅格取整
    永远落在认领之外。
  - 跨近平面的盒子拒绝作遮挡物；小于一格的剪影自然认领 0 格。
- **被遮挡判定**（`hidden`）：取盒子屏幕 AABB（外接，超集只会少剔不会误剔），逐格
  要求 `遮挡物远深度 < 被遮挡物近深度 − 0.05`；任一格不满足即保留。屏幕外部分按
  屏幕边界裁剪（画布外像素不存在）。
- **Pass D（网格级）**：抽出的详情模型与归位副本网格，`after` 每帧世界矩阵统一更新
  （`scene.updateMatrixWorld()`）之后逐 mesh 判定 `visible`；可见性进入帧复用快照，
  关闭遮挡时自动重绘并恢复全部可见。拾取 `pickCell` 跳过不可见命中（它们不写帧），
  顺序命中里取第一个真正可见的表面。

`frame()` 内顺序：Pass A 一次合成所有候选变换（矩阵池复用）→ Pass B 建网格（卡片
盒 + DOM 矩形）→ Pass C 压缩绘制列表（`drawnCells`/矩阵/主题标量，语义与原循环
一致）→ 世界矩阵统一更新 → Pass D。`fixed`（开场/原片对照）路径完全不剔除，保留
原 160 位置参照。

## 为什么画质必然不变

1. **卡片是实心遮挡物**：Blender 源（`art/build_archive.py`）——前磨砂盖
   `5×0.016×3.7`（transmission 0.78），其后不透明信息基板 `4.80×3.47` 与后载板
   `4.97×3.68`（`Ivory_Edges` 在应用内 transmission=0）+ 四周边条，正面覆盖率
   ≥99%，残余为亚像素外缘，被 3px 内缩完全吸收。任意正面像素处的最近不透明面
   都是该卡片自身，看不到其后内容；玻璃与玻璃之间 three.js 不做递归采样，
   被盖住的毛面在采样 RT 中本就不存在。结论：整盒遮挡与渲染器实际输出一致。
2. **透射采样 RT 只含不透明物**（three r183 `renderTransmissionPass`），因此
   "认领格内被遮挡物的不透明件也不可见"与 RT 结果一致；格子认领又进一步内缩。
3. **DOM 面板**：`.archive-callout`／`#detail-content` 背景 `var(--theme-panel,#fff)`
   不透明；仅在元素及全部祖先 `display/visibility/opacity` 全部落定、背景 alpha≥0.99
   时才认领，矩形再内缩 4px（圆角/边框饰条）。模式淡入淡出期间自动失效。
4. **阴影**：唯一投影体 `Optical_Diffuser` 留在被剔除卡片里……不——被剔除卡片
   整实例不进阴影通道，但其阴影必然落在自身被遮挡的深处（灯位高
   `(-6,14,-5)`，近垂直落下，落点同样被阵列遮住）；A/B 截图对比以噪声基线校准
   直接检验该假设（含阴影差异会被捕获）。
5. **开场/原片参照路径零改动**，`check-archive-visibility` 等既有回归继续通过。

## 验证

- 新增 `npm run check:occlusion`（`scripts/check-occlusion.mjs`，reduced-motion
  上下文）：同一稳定帧下遮挡开/关 A/B 截图，另取两张开状态截图计算**运动噪声基线**，
  要求 `diff(on, off) ≤ max(基线×1.25, 400px)`；同时断言关状态三角形数严格更大、
  `occlusion.hidden > 0`、无页面/着色器错误。产出 `verification/occlusion/*.png`
  与 `results.json`（候选数、剔除数、遮挡物数、被剔 mesh 数、三角形/绘制调用对比）。
  复查钩子：`window.rhine.setOcclusion(bool)` 与 `?no-occlusion`。
- 既有回归：`check:content`、`check:viewport`、`check-web-integration`、
  `check:firefox`、render-updates / archive-visibility / performance-invalidation。
- `getStats()` 新增 `occlusion: { candidates, hidden, meshesHidden, occluders, enabled }`。

### 实测（2026-09-25，内置浏览器 A/B）

环境重启后外置 Playwright 已清除，按用户指示改用内置浏览器人工 A/B；`scripts/check-occlusion.mjs`
（Playwright 版）保留供本地/CI 复跑。结果存档 `verification/occlusion/results.json`。

- **阵列模式**：候选 255、剔除 124、遮挡物 154、60 fps；三角形 1,289,915（开）对 2,354,827（关），
  **减少 45.2%**；绘制调用同为 48（实例批次只减 `count`，不增加调用）。
- **详情模式**：阵列剔除 123/254 同样生效；`meshesHidden=0` 属预期（抽出模型高于阵列，不被遮挡）；
  三角形 1,289,915（开）对 2,183,067（关），减少 40.9%。
- **同屏 A/B 截图**（`verification/occlusion/archive-*.png`、`detail-*.png`）：开×开运动噪声基线
  381 px（0.055%），开×关差异 893 px（0.129%，ImageMagick `compare -metric AE -fuzz 3%`）；
  放大差异图 `diff-on-off.png` 为全画幅边缘性运动噪声，无局部整块缺失；用户逐图人工复核
  确认三张截图一致。控制台 0 错误。
- 详情正文黑条经 DOM 检查确认为既有 `.document-redacted` 解密遮罩设计，与遮挡剔除无关。
- 复查钩子：`window.rhine.setOcclusion(bool)`、`?no-occlusion`，统计入 `getStats().occlusion`。

## 限制（有意保守）

- 详情模型的**非凸内部件**（环、镂空）不作遮挡物，模型后方的阵列因此不被模型剔除；
  模型自身被前景卡片/面板挡住的部分（用户点名的"下半部分"）由 Pass D 正常剔除。
- 毛玻璃盖超出不透明件的边缘（亚像素）与 3px 内缩之外不做更激进的跨对象孔洞推断。
- 屏幕空间网格为每帧重建（相机阻尼与波场持续变化），未做增量缓存。
