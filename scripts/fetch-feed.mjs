import fs from "node:fs/promises";
import { validateContent } from "./feed-content.mjs";

// Keeps content/episodes.json in sync with the published feed. The committed
// snapshot is the source of truth for the app, so a failed fetch never breaks
// dev/build; it just leaves the previous snapshot in place.
const FEED_URL =
  process.env.FEED_URL ?? "https://anchor.fm/s/11487a7ac/podcast/rss";
const OUTPUT = new URL("../content/episodes.json", import.meta.url);

// Left-to-right 3D column order. Must stay five names to match the archive pool.
const COLUMNS = ["理论学习", "青年与教育", "工人运动", "组织与路线", "形势与时事"];
// Filter order only; the same five names.
const CATEGORIES = ["理论学习", "组织与路线", "青年与教育", "工人运动", "形势与时事"];

// Episode number -> column. New episodes fall back to the last column.
const COLUMN_BY_NUMBER = {
  0: "理论学习", 1: "理论学习", 7: "理论学习",
  4: "青年与教育", 8: "青年与教育",
  2: "工人运动", 9: "工人运动",
  3: "组织与路线", 5: "组织与路线",
  6: "形势与时事", 10: "形势与时事",
};

// Episodes without dedicated artwork fall back to the shared series cover.
const SERIES_COVER = "/covers/show.webp";
const COVER_BY_NUMBER = {
  7: "/covers/ep07.webp",
  8: "/covers/ep08.webp",
  9: "/covers/ep09.webp",
  10: "/covers/ep10.webp",
};

// The feed titles most episodes only as "光辉革命播客第X期"; the descriptive
// title lives in the show notes. These are the cases extraction cannot reach.
const TITLE_BY_NUMBER = {
  5: "唯路线论：路线错误是万能解释器还是革命神学",
  7: "为什么左派非注重理论学习不可？",
};

const CN_DIGITS = { 零: 0, 〇: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };

const decodeEntities = (value) =>
  value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, "&");

const cdata = (value) => value.replace(/^\s*<!\[CDATA\[/, "").replace(/\]\]>\s*$/, "");

function tag(block, name) {
  const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return match ? cdata(match[1]).trim() : "";
}

function attr(block, name, attribute) {
  const match = block.match(new RegExp(`<${name}[^>]*?\\s${attribute}="([^"]*)"`, "i"));
  return match ? decodeEntities(match[1]) : "";
}

const stripTags = (html) =>
  html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li)>/gi, "\n\n").replace(/<[^>]+>/g, "");

function clean(html) {
  return decodeEntities(stripTags(html))
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractLinks(html) {
  const links = [];
  const pattern = /<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = pattern.exec(html))) {
    const url = decodeEntities(match[1]).trim();
    if (!/^https?:/i.test(url)) continue;
    if (links.some((link) => link.url === url)) continue;
    links.push({ label: clean(match[2]) || url, url });
  }
  return links;
}

function episodeNumber(title, itunesEpisode, index, total) {
  const chinese = title.match(/第([零〇一二三四五六七八九十])期/);
  if (chinese) return CN_DIGITS[chinese[1]] ?? index;
  if (Number.isInteger(itunesEpisode) && itunesEpisode > 0) return itunesEpisode - 1;
  return Math.max(0, total - 1 - index);
}

// Drops the invisible joiners / book marks the feed wraps around titles.
function stripDecor(value) {
  let text = value.replace(/[\u200b-\u200f\u2060\ufeff]/g, "").trim();
  if (text.startsWith("《") && text.endsWith("》")) text = text.slice(1, -1);
  return text.trim();
}

function episodeTitle(rawTitle, html, number) {
  if (TITLE_BY_NUMBER[number]) return TITLE_BY_NUMBER[number];
  const explicit = html.match(/标\s*题[：:]\s*([\s\S]*?)(?:<\/p>|<br|$)/i);
  if (explicit) {
    const value = stripDecor(clean(explicit[1]));
    if (value) return value;
  }
  // The source-article line carries the descriptive title, either as link text
  // or as plain text; the link label is the cleaner copy.
  const source = html.match(/(?:原文章提供者|原文章|源文章|文章)[：:]([\s\S]*?)(?:<\/p>|<br|$)/i);
  if (source) {
    const link = source[1].match(/<a\s[^>]*>([\s\S]*?)<\/a>/i);
    const value = stripDecor(clean(link ? link[1] : source[1]));
    if (value) return value;
  }
  return stripDecor(clean(rawTitle)) || `第 ${String(number).padStart(2, "0")} 期`;
}

const FOOTER_LINE = /^(提醒|背景音乐|音乐|本文|声明|订阅|电报|使用原文章|作者|源文章|原文章)/;

function chapters(html) {
  const lines = [];
  const inline = html.match(/目\s*录[：:]\s*\**\s*([\s\S]*?)(?:<\/p>|$)/i);
  for (const raw of inline ? clean(inline[1]).split("\n") : []) {
    const line = raw.replace(/^\s*[\d.]+\s*[.、]?\s*/, "").trim();
    if (line) lines.push(line);
  }
  if (lines.length === 0) {
    // Some episodes put "目录：" in its own paragraph and the entries in the
    // following ones, so fall back to every paragraph after the marker.
    const tail = html.slice(html.search(/目\s*录[：:]/i));
    for (const raw of clean(tail).split("\n")) {
      const line = raw.replace(/^\s*[\d.]+\s*[.、]?\s*/, "").trim();
      if (!line) continue;
      if (FOOTER_LINE.test(line)) break;
      if (line.length > 30 || (line.length > 20 && /。$/.test(line))) break;
      lines.push(line);
    }
  }
  return lines;
}

function summary(html) {
  const cut = html.search(/目\s*录[：:]/i);
  const body = cut === -1 ? html : html.slice(0, cut);
  return clean(body);
}

function music(html) {
  const match = html.match(/(?:背景音乐|音乐)[：:]\s*([\s\S]*?)(?:<\/p>|<br|$)/i);
  return match ? clean(match[1]) : null;
}

function durationToSeconds(value) {
  const parts = String(value).split(":").map(Number);
  if (parts.some((n) => !Number.isFinite(n))) return null;
  return parts.reduce((total, part) => total * 60 + part, 0) || null;
}

function parseFeed(xml) {
  const channelBlock = xml.slice(xml.indexOf("<channel"), xml.indexOf("<item"));
  const show = {
    title: clean(tag(channelBlock, "title")) || "光辉革命播客",
    author: clean(tag(channelBlock, "itunes:author") || tag(channelBlock, "author")) || "Redmolisha",
    summary: clean(tag(channelBlock, "description")),
    rss: FEED_URL,
    telegram: "https://t.me/redmopav",
    cover: SERIES_COVER,
  };

  const items = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
  const episodes = items.map((item, index) => {
    const rawTitle = tag(item, "title");
    const html = cdata(item.match(/<description>([\s\S]*?)<\/description>/i)?.[1] ?? "").trim();
    const itunesEpisode = Number(tag(item, "itunes:episode")) || 0;
    const number = episodeNumber(rawTitle, itunesEpisode, index, items.length);
    const duration = tag(item, "itunes:duration");
    const episode = {
      id: `EP-${String(number).padStart(2, "0")}`,
      number,
      title: episodeTitle(rawTitle, html, number),
      column: COLUMN_BY_NUMBER[number] ?? COLUMNS[COLUMNS.length - 1],
      pubDate: new Date(tag(item, "pubDate")).toISOString().slice(0, 10),
      duration: duration || "--:--",
      durationSeconds: durationToSeconds(duration),
      audio: attr(item, "enclosure", "url"),
      cover: COVER_BY_NUMBER[number] ?? SERIES_COVER,
      summary: summary(html),
      chapters: chapters(html),
      sources: extractLinks(html).filter((link) => !/anchor\.fm|podcasters\.spotify/i.test(link.url)),
      music: music(html),
    };
    return episode;
  });

  episodes.sort((a, b) => a.number - b.number);
  episodes.forEach((episode, index) => {
    episode.id = `EP-${String(index).padStart(2, "0")}`;
  });

  return { show, categories: CATEGORIES, columns: COLUMNS, episodes };
}

async function main() {
  let response;
  try {
    response = await fetch(FEED_URL, { signal: AbortSignal.timeout(20000) });
  } catch (error) {
    console.warn(`抓取 RSS 失败，保留现有快照：${error.message}`);
    return;
  }
  if (!response.ok) {
    console.warn(`抓取 RSS 失败（HTTP ${response.status}），保留现有快照。`);
    return;
  }

  const content = validateContent(parseFeed(await response.text()));
  await fs.writeFile(OUTPUT, `${JSON.stringify(content, null, 2)}\n`, "utf8");
  console.log(`已更新 ${content.episodes.length} 期节目到 content/episodes.json。`);
}

await main();
