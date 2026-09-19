import assert from "node:assert/strict";
import { test } from "node:test";
import { loadContent, validateContent } from "./feed-content.mjs";
import { escapeHtml } from "../src/html.ts";

const content = await loadContent();

const invalidCases = [
  [
    "missing title",
    (c) => {
      delete c.episodes[0].title;
    },
    /episodes\[0\].title/,
  ],
  [
    "blank summary",
    (c) => {
      c.episodes[0].summary = "  ";
    },
    /summary/,
  ],
  [
    "duplicate ID",
    (c) => {
      c.episodes[1].id = "EP-00";
    },
    /EP-00/,
  ],
  [
    "reordered ID",
    (c) => {
      [c.episodes[0], c.episodes[1]] = [c.episodes[1], c.episodes[0]];
    },
    /EP-00/,
  ],
  [
    "unknown column",
    (c) => {
      c.episodes[0].column = "未知";
    },
    /未知栏目/,
  ],
  [
    "empty column",
    (c) => {
      for (const episode of c.episodes)
        if (episode.column === c.columns[0]) episode.column = c.columns[1];
    },
    /至少需要一期节目/,
  ],
  [
    "missing episodes",
    (c) => {
      c.episodes = [];
    },
    /至少需要一期节目/,
  ],
  [
    "null episode",
    (c) => {
      c.episodes[0] = null;
    },
    /必须是节目对象/,
  ],
  [
    "non-text chapters",
    (c) => {
      c.episodes[0].chapters = [42];
    },
    /chapters/,
  ],
  [
    "unsafe audio URL",
    (c) => {
      c.episodes[0].audio = "javascript:alert(1)";
    },
    /audio/,
  ],
  [
    "invalid audio URL",
    (c) => {
      c.episodes[0].audio = "example.com";
    },
    /audio/,
  ],
  [
    "duplicate categories",
    (c) => {
      c.categories[1] = c.categories[0];
    },
    /不能重复/,
  ],
  [
    "reserved category",
    (c) => {
      c.categories[0] = "全部节目";
    },
    /全部节目/,
  ],
  [
    "mismatched columns",
    (c) => {
      c.columns[0] = "其他";
    },
    /相同的五个栏目/,
  ],
];
for (const [name, mutate, error] of invalidCases) {
  test(`rejects ${name}`, () => {
    const invalid = structuredClone(content);
    mutate(invalid);
    assert.throws(() => validateContent(invalid), error);
  });
}
test("accepts independent filter and column order", () => {
  const edited = structuredClone(content);
  edited.categories.reverse();
  assert.equal(validateContent(edited), edited);
});
test("plain-text punctuation stays literal in HTML output", () => {
  const title = `<玻璃> & "实验" 'A'`;
  const edited = structuredClone(content);
  edited.episodes[0].title = title;
  validateContent(edited);
  assert.equal(
    escapeHtml(title),
    "&lt;玻璃&gt; &amp; &quot;实验&quot; &#39;A&#39;",
  );
});
