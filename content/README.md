# 节目数据

[`episodes.json`](episodes.json) 是页面与 TXT 下载共用的节目数据。它由 `scripts/fetch-feed.mjs` 从播客 RSS 抓取生成，遵循你在构建前把最新一期同步进仓库；一般不需要手工编辑。

## 生成与校验

```sh
npm run export:feed              # 从 RSS 重新抓取，写入 content/episodes.json
npm run export:episodes          # 校验并生成 public/episodes/*.txt
npm run check:content            # 校验规则与下载一致性
```

`npm run dev` 与 `npm run build` 都会先抓取、再校验导出。抓取失败（离线或 RSS 不可达）时保留现有快照并告警，不会中断构建。

## 文件结构

- `show`：节目信息（标题、作者、简介、RSS、电报频道、频道封面）。
- `categories`：检索筛选器的五个栏目，按显示顺序排列。“全部节目”由界面添加。
- `columns`：三维阵列从左到右的五个栏目，名称与 `categories` 相同，顺序可以不同。
- `episodes`：节目数组，按期号 `EP-00` 起顺序排列，同栏目在数组中的顺序决定列内顺序。

| 字段              | 内容                                        |
| ----------------- | ------------------------------------------- |
| `id`              | 稳定编号（`EP-00`…），用于收藏、定位和下载  |
| `number`、`title` | 期号（第零期为 0）、标题                    |
| `column`          | 所属栏目，须与 `columns` 中的名称完全一致   |
| `pubDate`         | 发布日期（`YYYY-MM-DD`）                    |
| `duration`        | 时长文本（`HH:MM:SS`）                      |
| `audio`           | 单集音频直链                                |
| `cover`           | RSS 单集封面直链或 `null`（未上传封面时回落到频道封面） |
| `summary`         | 节目简介                                    |
| `chapters`        | 目录条目                                    |
| `sources`         | 源文章 `{ label, url }` 列表                |
| `music`           | 背景音乐说明或 `null`                       |

`id` 须按数组顺序稳定；栏目数固定为五个（与三维阵列池一致），但**每列节目数不限**，新一期发布后重新抓取即可。

## 修改与验证

1. 需要临时覆盖标题或栏目时，改 `scripts/fetch-feed.mjs` 顶部的 `TITLE_BY_NUMBER` / `COLUMN_BY_NUMBER`，再执行 `npm run export:feed`。
2. 执行 `npm run export:episodes` 生成下载文件，再执行 `npm run check:content`。
3. 在 `npm run dev` 中查看标题、详情、检索与播放结果。

封面直接使用 RSS 单集图片（`itunes:image`），无需在本地登记；修改后重新抓取一次即可。
