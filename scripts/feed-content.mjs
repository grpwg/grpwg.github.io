import fs from "node:fs/promises";

const isText = (value) => typeof value === "string" && value.trim().length > 0;

function isUrl(value) {
  if (!isText(value)) return false;
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

export function validateContent(content) {
  const errors = [];
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    throw new Error("节目数据必须是 JSON 对象。");
  }

  const show = content.show;
  if (!show || typeof show !== "object" || Array.isArray(show)) {
    errors.push("show：必须是对象");
  } else {
    for (const key of ["title", "author", "summary"]) {
      if (!isText(show[key])) errors.push(`show.${key}：必须是非空文本`);
    }
    for (const key of ["rss", "telegram"]) {
      if (!isUrl(show[key])) errors.push(`show.${key}：必须是有效的 HTTP 或 HTTPS 链接`);
    }
    if (show.cover !== null && show.cover !== undefined && !isText(show.cover)) {
      errors.push("show.cover：必须是文本或 null");
    }
  }

  for (const key of ["categories", "columns"]) {
    const names = content[key];
    if (!Array.isArray(names) || names.length !== 5 || !names.every(isText)) {
      errors.push(`${key}：必须包含五个非空栏目名称`);
    } else if (new Set(names).size !== 5 || names.includes("全部节目")) {
      errors.push(`${key}：栏目名称不能重复，也不能使用“全部节目”`);
    }
  }
  const categories = Array.isArray(content.categories) ? content.categories : [];
  const columns = Array.isArray(content.columns) ? content.columns : [];
  if (
    categories.some((name) => !columns.includes(name)) ||
    columns.some((name) => !categories.includes(name))
  ) {
    errors.push("categories 与 columns 必须包含相同的五个栏目（顺序可以不同）");
  }

  const episodes = Array.isArray(content.episodes) ? content.episodes : [];
  if (episodes.length === 0) errors.push("episodes：至少需要一期节目");
  const ids = new Set();
  episodes.forEach((episode, index) => {
    const label = `episodes[${index}]`;
    if (!episode || typeof episode !== "object" || Array.isArray(episode)) {
      errors.push(`${label}：必须是节目对象`);
      return;
    }
    for (const key of ["id", "title", "column", "pubDate", "duration"]) {
      if (!isText(episode[key])) errors.push(`${label}.${key}：必须是非空文本`);
    }
    const expectedId = `EP-${String(index).padStart(2, "0")}`;
    if (episode.id !== expectedId) {
      errors.push(`${label}.id：应为 ${expectedId}，编号须按顺序保持稳定`);
    }
    if (ids.has(episode.id)) errors.push(`${label}.id：重复编号 ${episode.id}`);
    ids.add(episode.id);
    if (!Number.isInteger(episode.number) || episode.number < 0) {
      errors.push(`${label}.number：必须是非负整数`);
    }
    if (episode.durationSeconds !== null && !(Number.isInteger(episode.durationSeconds) && episode.durationSeconds > 0)) {
      errors.push(`${label}.durationSeconds：必须是正整数或 null`);
    }
    if (!categories.includes(episode.column)) {
      errors.push(`${label}.column：未知栏目 ${episode.column}`);
    }
    if (!isUrl(episode.audio)) {
      errors.push(`${label}.audio：必须是有效的 HTTP 或 HTTPS 链接`);
    }
    if (episode.cover !== null && episode.cover !== undefined && !isText(episode.cover)) {
      errors.push(`${label}.cover：必须是文本或 null`);
    }
    if (!isText(episode.summary)) errors.push(`${label}.summary：必须是非空文本`);
    if (!Array.isArray(episode.chapters) || !episode.chapters.every(isText)) {
      errors.push(`${label}.chapters：必须是非空文本数组`);
    }
    if (!Array.isArray(episode.sources)) {
      errors.push(`${label}.sources：必须是数组`);
    } else {
      episode.sources.forEach((source, i) => {
        if (!source || !isText(source.label) || !isUrl(source.url)) {
          errors.push(`${label}.sources[${i}]：需要非空 label 与合法 url`);
        }
      });
    }
  });
  for (const name of columns) {
    if (episodes.filter((episode) => episode?.column === name).length === 0) {
      errors.push(`栏目“${name}”：至少需要一期节目`);
    }
  }

  if (errors.length) throw new Error(`节目数据校验失败：\n- ${errors.join("\n- ")}`);
  return content;
}

export async function loadContent() {
  return validateContent(
    JSON.parse(await fs.readFile(new URL("../content/episodes.json", import.meta.url), "utf8")),
  );
}

export function episodeText(episode, show) {
  const lines = [
    `\uFEFF${show.title} · ${show.author}`,
    `第 ${String(episode.number).padStart(2, "0")} 期 / ${episode.title}`,
    "",
    `栏目：${episode.column}`,
    `发布：${episode.pubDate}`,
    `时长：${episode.duration}`,
    `音频：${episode.audio}`,
    "",
    episode.summary,
  ];
  if (episode.chapters.length) {
    lines.push("", "目录", ...episode.chapters.map((chapter, i) => `${i + 1}. ${chapter}`));
  }
  if (episode.sources.length) {
    lines.push("", "源文章", ...episode.sources.map((source) => `${source.label}：${source.url}`));
  }
  if (episode.music) lines.push("", episode.music);
  lines.push("", `订阅：${show.rss}`, `电报频道：${show.telegram}`, "本节目不生产原创内容，仅对文章进行有声加工。");
  return `${lines.join("\n")}\n`;
}
