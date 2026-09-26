# 光辉革命播客 · 官方发布网站

**马列毛主义播客的交互式三维节目终端。**

以《莱茵生命：访问》终端界面为交互蓝本改造：白底开场 → 五栏目三维玻璃阵列 → 抽取一期 → 玻璃与正文同步解密 → 站内播放音频。

内容来自播客 RSS，节目音频直接串流播放（Anchor / CloudFront 直链）。视觉为红白两色，开场、左上角、favicon 与主屏幕图标共用同一枚 lockup。

## 快速运行

需要 **Node.js 22.12 或更高版本**，以及支持 WebGL 2 的现代桌面浏览器。

```sh
npm ci
npm run dev
```

打开终端显示的地址（通常 `http://127.0.0.1:5173/`），点击「点击进入」开始。构建与预览：

```sh
npm run build      # 输出到 dist/
npm run preview
```

## 节目数据

节目由构建脚本从 RSS 抓取，快照写入 `content/episodes.json`；抓取失败时保留现有快照，不中断构建。

```sh
npm run export:feed     # 从 RSS 重新抓取
npm run check:content   # 校验数据规则
```

新增一期后重新执行 `npm run export:feed` 即可，页面与阵列会自动带上。**每列节目数不限**（当前 11 期分布在五个栏目：理论学习 / 组织与路线 / 青年与教育 / 工人运动 / 形势与时事）。

封面直接使用 RSS 的单集图片（`itunes:image`）直链，未单独上传封面的期次回落到频道封面，无需在本地登记。字段与流程详见 [`content/README.md`](content/README.md)。

## 主要功能

- **三维档案阵列**：五栏目循环阵列，`← →` 切栏目、`↑ ↓` 换期、`ENTER` 播放；支持拖动与触摸。
- **同步解密**：玻璃盖板与右侧正文一起揭示。
- **站内播放器**：进度、倍速、MediaSession；离开详情自动停靠到右下角继续播放；播放时终端配乐自动让位。
- **检索与收藏**：按期号、标题、栏目检索；收藏保存在本地。
- **检索快捷键**：`/` 打开节目索引，`Esc` 返回。
- **主屏幕安装**：manifest 与 Apple meta 仍保留，可用浏览器菜单添加到主屏幕并以独立窗口打开；本站是在线播放器，不含离线缓存、Service Worker，设置里也不再显示安装提示。
- **画质设置**：性能 / 原始 / 高 / 极高四档预设与精细设置；可开启超级性能模式。

## 工程结构

| 目录或文件 | 内容 |
| --- | --- |
| [`src/main.ts`](src/main.ts) | 页面状态、节目详情、检索、收藏与快捷键 |
| [`src/player.ts`](src/player.ts) | 站内音频播放器 |
| [`src/scene.ts`](src/scene.ts)、[`src/archive-loop.ts`](src/archive-loop.ts) | Three.js 场景、循环阵列、抽取与归位 |
| [`src/boot.ts`](src/boot.ts)、[`src/boot-motion.ts`](src/boot-motion.ts) | 开场界面与逐帧时间轴 |
| [`src/brand.ts`](src/brand.ts) | 共用的光辉革命 lockup |
| [`content/episodes.json`](content/episodes.json) | 页面使用的节目数据（由 RSS 生成） |
| [`scripts/fetch-feed.mjs`](scripts/fetch-feed.mjs) | RSS 抓取、解析与栏目映射 |
| [`scripts/feed-content.mjs`](scripts/feed-content.mjs) | 节目数据校验 |
| [`public/assets/`](public/assets/) | 运行所需的 GLB 模型 |

## 操作

| 操作 | 效果 |
| --- | --- |
| 开场中按 `Enter` / `Esc`，或点击「进入终端」 | 资源就绪后进入交互阵列 |
| `←` / `→` | 切换栏目，首尾循环 |
| `↑` / `↓` | 翻阅栏目内节目，首尾循环 |
| `Enter`、`播放本期` 或期号 | 打开节目详情并开始播放 |
| `/` | 打开节目索引，可按期号、标题、栏目检索 |
| `Esc` | 关闭弹窗，或从详情返回阵列 |

## 许可与资源

自行编写且有权授权的程序代码与文档采用 [MIT License](LICENSE)。第三方资源继续遵循各自许可：

- **MiSans**：小米官方字体，保留字体许可与署名，见 `public/fonts`。
- **Rolling Number**：编号与文字滚动，见 `public/licenses/rolling-number.txt`。
- **节目音频**：由播客 RSS 提供，版权归原发布者；本站仅作串流播放，不重新分发。
- **节目文字**：简介与目录来自 RSS；节目本身不生产原创内容，仅对文章进行有声加工。

订阅与投稿请见播客电报频道与 RSS（页面「链接」页签）。
