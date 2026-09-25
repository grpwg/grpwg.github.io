import { createRollingClock } from "./rolling-clock";
import { InspectionOverlay } from "./inspection-overlay";
import { DocumentDecryption } from "./document-decryption";
import "./document-decryption.css";
import "./decryption.css";
import { escapeHtml } from "./html";
import { EpisodePlayer } from "./player";
import { normalizeQuality, qualityPresets, superPerformanceQuality, type QualityPreset, type RenderQuality } from "./render-quality";
import { qualityMarkup, syncQualityUI } from "./quality-settings";
import "@kitlangton/rolling-number/styles.css";
import "./style.css";
import "./quality-settings.css";
import "./responsive.css";
import "./podcast-skin.css";
import { viewportLayout, openingLayout } from "./viewport-layout";
import { assetUrl } from "./asset-url";
import { initPwa, pwaSettingsMarkup } from "./pwa";
import { createRollingNumber, createRollingText } from "@kitlangton/rolling-number";
import { ArchiveScene } from "./scene";
import type { ScreenRect } from "./occlusion";
import { ContentTransition, SurfaceTransition } from "./ui-transitions";
import { BootSequence } from "./boot";
import { loadBootWebfonts } from "./boot-lettering";
import { wrap, type ArchiveNavigation } from "./archive-loop";
import {
  records,
  show,
  categories,
  archiveColumns,
  columnFiles,
  fileLocation,
} from "./data";
import { TerminalAudio } from "./audio";
import { audioSettingsMarkup } from "./audio-settings";
import { StartupGate } from "./startup";
import "./startup.css";
import { paintTheme, themeSettingsMarkup } from "./theme-ui";

const $ = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;
import { logo, brandHeading } from "./brand";

$("#stage").innerHTML = `
  <div id="three-scene" class="three-scene"></div>
  <div class="scene-atmosphere archive-atmosphere"></div>
  <div id="boot-background" class="boot-background"><svg viewBox="0 0 1920 1080" preserveAspectRatio="none"><g fill="none" stroke="#fff" stroke-width="3"><path d="M-210 705C-45 705 182 704 247 567C337 377 99 306 4 435S27 680 169 631C309 584 227 314 279 111S568-113 568-113"/><path d="M1560-80C1374 114 1671 168 1601 323S1371 367 1431 480S1692 666 1559 787S1329 886 1498 1130"/><circle cx="1450" cy="648" r="346"/><circle cx="1450" cy="648" r="348"/></g></svg></div>
  <header class="brand">${brandHeading}</header>
  <nav class="system-nav" aria-label="系统导航">
    <button data-action="search"><span class="nav-glyph">⌕</span> 往期档案 <span class="key">/</span></button>
    <button data-action="saved" aria-label="查看已存档案" title="已存档案">＋ 收藏 <span id="saved-count">00</span></button>
    <button class="settings-button" data-action="settings" aria-label="系统设置" title="系统设置"><span class="settings-glyph" aria-hidden="true">◷</span><span class="settings-label">设置</span></button>
  </nav>
  <button id="skip" class="skip" data-action="skip">进入终端 <span>↗</span></button>
  <section id="boot" class="boot" aria-label="系统启动">
    <div class="access-text">节目</div>
    <div class="boot-logo">${logo}</div>
    <div class="auth-status"><span>▪</span> <span id="auth-message"></span><i></i></div>
    <div class="scan"><svg viewBox="0 0 1920 1080" aria-hidden="true"><g fill="none" stroke="#080a08" stroke-width="2" stroke-linecap="round"><path/><path stroke="#fff"/><path/><path/><path/><path/><circle class="orbit-dot" r="8" fill="#ed821b" stroke="none"/><circle class="orbit-dot" r="8" fill="#ed821b" stroke="none"/><circle class="scan-core" cx="960" cy="540" r="5" fill="#080a08" stroke="none"/></g></svg><span>播放权限已授予</span></div>
    <div class="welcome"><div class="welcome-panel"></div><div class="welcome-heading">接入已授权</div><div class="welcome-company"><strong>光辉革命播客</strong><strong class="welcome-highlight" aria-hidden="true">光辉革命播客</strong></div><div class="welcome-database">让价值文章有声化</div><div class="welcome-logo">${logo}</div></div>
  </section>
  <svg id="inspection-marks" viewBox="0 0 1920 1080" aria-hidden="true"><path id="inspection-lines"/><g id="inspection-corners"></g><circle id="inspection-point" r="1.8"/></svg>
  <div id="inspection-text" aria-hidden="true">节目宗旨：<strong>让价值文章有声化</strong></div>
  <section id="archive-ui" class="archive-ui" aria-label="节目选择">
    <div class="archive-callout"><div class="callout-label"><i></i><span id="archive-category">理论学习</span></div><button class="file-title" data-action="open"><span id="selected-title">谁改造谁</span><span id="selected-title-plain"></span><span class="file-open">↗</span></button><div class="callout-summary" id="callout-summary"></div><div class="callout-foot"><button class="read-file" data-action="open"><span class="play-glyph">▶</span>调阅本期</button><span class="callout-duration"><b id="selected-id">EP-<span id="selected-code">00</span></b><span id="selected-clearance">00:00</span></span></div></div>
    <div id="hover-label" class="hover-label" hidden>EP-<span id="hover-code">00</span> / <span id="hover-title"></span></div>
    <div class="archive-counter"><span class="tiny-label">节目 / 选择</span><div><span id="selected-number">01</span><i>/</i><span class="count-total">12</span></div></div>
    <div class="archive-navigation"><button data-action="prev" aria-label="上一期">↑</button><div id="file-ticks" class="file-ticks"></div><button data-action="next" aria-label="下一期">↓</button></div>
    <div class="column-navigation"><button data-action="column-prev" aria-label="上一栏">←</button><div><span id="column-number">栏目 <span id="column-index">03</span> / 05</span><strong id="column-name">理论学习</strong></div><button data-action="column-next" aria-label="下一栏">→</button></div>
    <div class="archive-hint"><kbd>←</kbd> <kbd>→</kbd> 切换栏目 <span>／</span> <kbd>↑</kbd> <kbd>↓</kbd> 前后一期 <span>／</span> <kbd>ENTER</kbd> 播放</div>
  </section>
  <section id="detail-ui" class="detail-ui" aria-label="节目内容" hidden>
    <button class="back-button" data-action="back">← <span>返回节目</span><small>ESC</small></button>
    <div class="object-caption"><span id="object-id">EP.00</span><div>GLORIOUS REVOLUTION PODCAST</div><small>拖动查看 <span>↔</span></small></div>
    <article id="detail-content" class="detail-content"></article>
    <div class="detail-nav"><button data-action="episode-prev">← <span>上一期</span></button><div id="detail-ticks" class="detail-ticks"></div><button data-action="episode-next"><span>下一期</span> →</button></div>
  </section>
  <div class="powered">POWERED BY <b>光辉革命播客</b><i></i></div>
  <footer class="system-footer"><span><i class="status-light"></i> 全世界无产者，联合起来</span><span>光辉革命播客 <i>／</i> <span id="clock">00:00:00</span></span><button data-action="replay" title="重播启动流程">重新初始化 ↗</button></footer>
  <div id="pwa-update-notice" class="pwa-update-notice" role="status" hidden><span>新版本已就绪</span><button data-pwa-action="update">更新并重启 ↻</button></div>
  <div id="modal-root"></div><div id="toast" class="toast" role="status"></div>
  <div id="loading" class="loading"><div class="loading-mark">${logo}</div><span>正在连接节目源</span><i></i></div>
`;

$("#boot-background").insertAdjacentHTML(
  "beforeend",
  '<div class="boot-white"></div>',
);
const bootSequence = new BootSequence($("#stage"));
const player = new EpisodePlayer($("#stage"), (playing) => {
  // The podcast takes the speakers; the terminal score steps aside.
  musicSuppressed = playing;
  configureAudio();
});
$("#viewport").insertAdjacentHTML("beforeend", '<button class="mobile-entry" data-action="skip">接入终端 <span>→</span></button>');

type Mode = "boot" | "archive" | "detail";
let mode: Mode = "boot",
  selected = 0,
  bootStart = 0,
  lastStep = "",
  ready = false;
let modal: "search" | "saved" | "settings" | null = null,
  searchQuery = "",
  filter = "全部节目";
let activeTab = "overview";
const reviewParams = new URLSearchParams(location.search);
let frozenTime =
  reviewParams.get("freeze") === "1"
    ? Number(reviewParams.get("time") ?? 0)
    : null;
if (reviewParams.get("review") === "1") {
  $("#stage").dataset.review = "true";
  window.addEventListener("message", (event) => {
    if (
      event.origin !== location.origin ||
      event.source !== window.parent ||
      event.data?.type !== "rhine-review-frame"
    )
      return;
    const t = Number(event.data.time);
    if (!Number.isFinite(t) || t < 0 || t >= 35) return;
    frozenTime = t;
    if (ready && mode !== "boot") setMode("boot");
  });
}
let toastTimer: ReturnType<typeof setTimeout>;
let previousFocus: HTMLElement | null = null;
const detailTransition = new SurfaceTransition($("#detail-ui"), undefined, 180, 180);
const tabTransition = new ContentTransition();
let modalTransition: SurfaceTransition | undefined;
let modalClosing = false;
let modalSiblings: { node: HTMLElement; inert: boolean }[] = [];
let pendingDetailFocus = false;
let bookmarkFeedback: Animation | undefined;
function readLocal<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback;
  } catch {
    return fallback;
  }
}
const saved = new Set<string>(readLocal<string[]>("rhine-saved", []));
const storedPrefs = readLocal<Partial<{ sound: boolean; music: boolean; soundVolume: number; musicVolume: number; reduced: boolean; quality: boolean; rendering: RenderQuality; superPerformance: boolean; colorTheme: "light" | "dark" }>>("rhine-settings", {});
const prefs = {
  sound: true,
  music: storedPrefs.music ?? true,
  soundVolume: .55,
  musicVolume: .5,
  reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
  quality: true,
  superPerformance: false,
  ...storedPrefs,
  rendering: normalizeQuality(storedPrefs.rendering, storedPrefs.quality !== false),
  colorTheme: storedPrefs.colorTheme === "dark" ? "dark" : "light",
};
paintTheme(prefs.colorTheme === "dark" ? 1 : 0);
const rollingMotion = {
  duration: 460,
  motionBlur: true,
  animated: !prefs.reduced,
};
const updateFooterClock = createRollingClock($("#clock"));
const numberOptions = {
  ...rollingMotion,
  locales: "en-US",
  format: { minimumIntegerDigits: 2, useGrouping: false },
};
const fileCounter = createRollingNumber($("#selected-number"), {
  ...numberOptions,
  value: 1,
});
const columnCounter = createRollingNumber($("#column-index"), {
  ...numberOptions,
  value: 3,
});
const codeOptions = {
  ...numberOptions,
  format: { minimumIntegerDigits: 2, useGrouping: false },
  value: 0,
};
const textOptions = {
  ...rollingMotion,
  transition: "direct" as const,
  stagger: "none" as const,
};
const selectionTitle = createRollingText($("#selected-title"), {
  ...textOptions,
  text: $("#selected-title").textContent ?? "",
});
const columnTitle = createRollingText($("#column-name"), {
  ...textOptions,
  text: $("#column-name").textContent ?? "",
});
const hoverTitle = createRollingText($("#hover-title"), { ...textOptions, text: "" });
const categoryTitle = createRollingText($("#archive-category"), {
  ...textOptions,
  text: $("#archive-category").textContent ?? "",
});
const clearanceTitle = createRollingText($("#selected-clearance"), {
  ...textOptions,
  text: $("#selected-clearance").textContent ?? "",
});
const rollingTitles = [selectionTitle, columnTitle, hoverTitle, categoryTitle, clearanceTitle];
const selectedCode = createRollingNumber($("#selected-code"), codeOptions);
const hoverCode = createRollingNumber($("#hover-code"), codeOptions);
const audio = new TerminalAudio();
let musicSuppressed = false;
function configureAudio() { audio.configure({ ...prefs, music: prefs.music && !musicSuppressed }); }
configureAudio();
const reviewEntry = reviewParams.has("scene") || reviewParams.has("time") || reviewParams.get("review") === "1";
let started = false;
const loading = $("#loading");
// The entry screen uses the actual viewport, including portrait phones; the
// reference animation still uses its calibrated 1920 x 1080 stage.
$("#viewport").append(loading);
$("#stage").inert = true;
$(".mobile-entry").inert = true;
const entry = !reviewEntry && (prefs.sound || prefs.music) ? new StartupGate({
  root: loading,
  unlock: () => audio.unlock(),
  cancel: () => audio.cancelEntry(),
  start: silent => completeStartup(silent),
}) : undefined;
if (entry) {
  audio.holdForEntry();
  if (prefs.music) void audio.prepareMusic().catch(() => { /* Entry offers retry. */ });
}
let audioPreview = false, audioPreviewRequest = 0;
let scene: ArchiveScene | undefined;
const accessLog: { id: string; time: string }[] = [];
const columnMemory = archiveColumns.map((_, lane) => columnFiles(lane)[0]);
function recordAccess() {
  accessLog.unshift({
    id: records[selected].id,
    time: new Date().toLocaleTimeString("en-GB"),
  });
}
function saveAudioPrefs() {
  try {
    localStorage.setItem("rhine-settings", JSON.stringify(prefs));
  } catch {}
  configureAudio();
}
function superPerformanceEnabled() { return prefs.superPerformance; }
function effectiveRenderQuality() { return superPerformanceEnabled() ? superPerformanceQuality : prefs.rendering; }
function savePrefs() {
  saveAudioPrefs();
  if (prefs.reduced) {
    rollingTitles.forEach(title => title.finish());
    detailTransition.finish();
    modalTransition?.finish();
    tabTransition.cancel();
    bookmarkFeedback?.cancel();
  }
  scene?.setReduced(prefs.reduced);
  scene?.setTheme(prefs.colorTheme === "dark", prefs.reduced || !started);
  document.querySelectorAll<HTMLElement>("[data-color-theme]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.colorTheme === prefs.colorTheme)));
  scene?.setSuperPerformance(superPerformanceEnabled());
  scene?.setQuality(effectiveRenderQuality());
  syncQualityUI(prefs.rendering);
  updateQualitySummary();
  fileCounter.update({ animated: !prefs.reduced && mode === "archive" });
  rollingTitles.forEach(title => title.update({ animated: !prefs.reduced && mode === "archive" }));
  columnCounter.update({ animated: !prefs.reduced && mode === "archive" });
  hoverCode.update({ animated: !prefs.reduced && mode === "archive" });
  $("#stage").classList.toggle("reduce-motion", prefs.reduced);
}
let previousLayout = "";
function fit() {
  const stage = $("#stage");
  const viewport = $("#viewport");
  const coarse = matchMedia("(pointer: coarse)").matches;
  const reference = reviewParams.has("time") || reviewParams.get("review") === "1";
  const { width, height, scale, kind } = mode === "boot" && !reference
    ? openingLayout(viewport.clientWidth, viewport.clientHeight)
    : viewportLayout(viewport.clientWidth, viewport.clientHeight, coarse, mode === "boot");
  stage.style.width = `${width}px`;
  stage.style.height = `${height}px`;
  stage.style.transform = `translate(-50%, -50%) scale(${scale})`;
  stage.dataset.layout = kind;
  stage.dataset.touch = String(coarse);
  viewport.dataset.mobileBoot = String(mode === "boot" && (coarse || viewport.clientWidth < 1100));
  stage.style.setProperty("--stage-scale", String(scale));
  stage.style.setProperty("--opening-width", `${width}px`);
  stage.style.setProperty("--opening-height", `${height}px`);
  stage.style.setProperty("--opening-scan-scale", String(Math.min(1, width / 1920)));
  stage.dataset.openingPortrait = String(width < height);
  // The software keyboard resizes dialogs without recomposing the 3D scene.
  const visible = window.visualViewport;
  const stageTop = (viewport.clientHeight - height * scale) / 2;
  stage.style.setProperty("--modal-top", `${Math.max(0, (visible?.offsetTop ?? 0) - stageTop) / scale}px`);
  stage.style.setProperty("--modal-height", `${Math.min(height, (visible?.height ?? viewport.clientHeight) / scale)}px`);
  $("#viewport").style.setProperty("--scale", String(scale));
  const marks = document.querySelector("#inspection-marks");
  marks?.setAttribute("viewBox", `0 0 ${width} ${height}`);
  const layoutKey = JSON.stringify([width, height, scale, kind, devicePixelRatio]);
  if (layoutKey !== previousLayout) {
    previousLayout = layoutKey;
    scene?.resize();
  }
  updateQualitySummary();
  // Re-measure line covers and tab underline after wrapping changes.
  requestAnimationFrame(() => {
    documentDecryption.refresh();
    const tab = document.querySelector<HTMLElement>(".detail-tabs button.active");
    const indicator = document.querySelector<HTMLElement>(".tab-indicator");
    if (tab && indicator) indicator.style.transform = `translateX(${tab.offsetLeft}px) scaleX(${tab.offsetWidth})`;
  });
}
window.addEventListener("resize", fit);
window.visualViewport?.addEventListener("resize", fit);
window.visualViewport?.addEventListener("scroll", fit);
matchMedia("(pointer: coarse)").addEventListener("change", fit);
fit();
const initialFiles = columnFiles(fileLocation(selected).lane);
// Columns do not all hold the same number of episodes, so the ticks are built
// for the largest column once and the surplus is hidden per column.
const tickCount = Math.max(
  ...archiveColumns.map((_, lane) => columnFiles(lane).length),
  initialFiles.length,
);
$("#file-ticks").innerHTML = Array.from({ length: tickCount }, (_, slot) =>
  slot < initialFiles.length
    ? `<button data-select="${initialFiles[slot]}"></button>`
    : `<button data-select="" hidden></button>`,
).join("");
const fileTicks = [...$("#file-ticks").querySelectorAll<HTMLButtonElement>("button")];

function setMode(next: Mode) {
  const previousMode = mode;
  rollingTitles.forEach(title => title.update({ animated: !prefs.reduced && next === "archive" }));
  if (next !== "archive") {
    rollingTitles.forEach(title => title.finish());
    hoverCode.finish();
    $("#hover-label").hidden = true;
  }
  if (next === "detail" && mode !== "detail") recordAccess();
  mode = next;
  audio.setScene(next);
  if (next !== "boot" && audioPreview) {
    audioPreview = false;
    audioPreviewRequest++;
    configureAudio();
  }
  $("#stage").dataset.mode = next;
  if (previousMode !== next) fit();
  $("#boot").inert = next !== "boot";
  $("#boot").setAttribute("aria-hidden", String(next !== "boot"));
  $("#archive-ui").inert = next !== "archive" || Boolean(modal);
  $("#archive-ui").setAttribute("aria-hidden", String(next !== "archive"));
  $(".system-nav").inert = next === "boot" || Boolean(modal);
  $(".system-footer").inert = next === "boot" || Boolean(modal);
  if (next === "detail") {
    if (previousMode !== "detail") detailTransition.show(prefs.reduced);
  } else if (previousMode === "detail" || (next === "boot" && !$("#detail-ui").hidden)) {
    pendingDetailFocus = false;
    tabTransition.cancel();
    detailTransition.hide(prefs.reduced || next === "boot");
    if (!modal && next === "archive") $(".read-file").focus({ preventScroll: true });
  }
  $("#detail-ui").inert = next !== "detail" || Boolean(modal);
  player.setDocked(next !== "detail");
  // The opening owns the screen; the player only appears once it hands over.
  if (next === "boot") player.setOpacity(0);
  else if (next !== "detail") player.setOpacity(1);
  scene?.setMode(next === "boot" ? "hidden" : next);
  if (next !== "boot") {
    bootSequence.reset();
    $("#stage").dataset.boot = "done";
  }
  if (next === "detail" && previousMode !== "detail") {
    renderDetail();
    pendingDetailFocus = true;
    if (!scene) {
      $("#detail-content").style.opacity = "1";
      $("#detail-content").style.translate = "0 0";
      $("#detail-content").inert = false;
    }
  }
}
function select(index: number, navigation?: ArchiveNavigation) {
  selected = (index + records.length) % records.length;
  columnMemory[fileLocation(selected).lane] = selected;
  if (mode === "detail") setMode("archive");
  activeTab = "overview";
  // State (selection, column memory, model bookkeeping) applies per event so
  // every passed cell is visited. Presentation (DOM, label paint, tick) is
  // flushed once at frame start for the latest cell: bursts of selects in one
  // frame share a single presentation with identical rendered pixels.
  scene?.select(selected, navigation, false);
  pendingPresent = { navigation };
}
/** Latest deferred selection presentation, flushed at frame start. */
let pendingPresent: { navigation?: ArchiveNavigation } | null = null;
/** Tracks slide→settle so the deferred player track loads once at rest. */
let slideWasActive = false;
function flushPresent() {
  if (!pendingPresent) return;
  const { navigation } = pendingPresent;
  pendingPresent = null;
  scene?.presentSelection();
  updateSelection(navigation);
  const columnMove = navigation && "axis" in navigation && navigation.axis === "lane";
  audio.play(columnMove ? "column" : "tick", columnMove ? navigation.direction * .45 : 0);
}
function stepFile(direction: number) {
  const files = columnFiles(fileLocation(selected).lane);
  if (files.length < 2) return;
  select(
    files[(files.indexOf(selected) + direction + files.length) % files.length],
    { axis: "row", direction },
  );
}
/** The episode page keeps its own navigation so browsing stays on the page. */
function openEpisode(index: number, direction = 0) {
  selected = index;
  columnMemory[fileLocation(index).lane] = index;
  scene?.select(index, { axis: "row", direction });
  // Immediate presentation supersedes any deferred slide presentation.
  pendingPresent = null;
  updateSelection({ axis: "row", direction });
  renderDetail();
  player.setTrack(playerTrack(records[index]), true);
  audio.play("tick");
}
function stepEpisode(direction: number) {
  const files = columnFiles(fileLocation(selected).lane);
  if (files.length < 2) return;
  openEpisode(files[(files.indexOf(selected) + direction + files.length) % files.length], direction);
}
function stepColumn(direction: number) {
  const lane = fileLocation(selected).lane;
  const next = wrap(lane + direction, archiveColumns.length);
  select(columnMemory[next], { axis: "lane", direction });
}
function updateSelection(navigation?: ArchiveNavigation) {
  const r = records[selected];
  const { lane } = fileLocation(selected);
  const files = columnFiles(lane);
  selectionTitle.update({ text: r.title, animated: !prefs.reduced && mode === "archive" });
  // Phones render the name as plain text: the rolling nodes cannot reflow.
  $("#selected-title-plain").textContent = r.title;
  clearanceTitle.update({ text: r.duration, animated: !prefs.reduced && mode === "archive" });
  categoryTitle.update({ text: r.column, animated: !prefs.reduced && mode === "archive" });
  $("#callout-summary").textContent = r.summary.replace(/\s+/g, " ").slice(0, 180);
  // Keep the player bar stocked so the phone home shows a live play button
  // before the first episode is opened. While the array is sliding, skip the
  // reload: setTrack reassigns audio.src (network + decode) and rebuilding it
  // per crossed cell is a real stutter source. It catches up on settle.
  if (mode !== "boot" && !scene?.isSliding) player.setTrack(playerTrack(r));
  const direction =
    navigation && "axis" in navigation
      ? navigation.direction > 0
        ? "up"
        : "down"
      : "auto";
  // The library prefixes its number cells with a stray sign, so the code is
  // written straight to the DOM instead of rolled.
  $("#selected-code").textContent = String(r.number).padStart(2, "0");
  selectedCode.finish();
  fileCounter.update({
    value: files.indexOf(selected) + 1,
    animated: !prefs.reduced && mode === "archive",
    direction:
      navigation && "axis" in navigation && navigation.axis === "row"
        ? direction
        : "auto",
  });
  $(".count-total").textContent = String(files.length).padStart(2, "0");
  columnCounter.update({
    value: lane + 1,
    animated: !prefs.reduced && mode === "archive",
    direction:
      navigation && "axis" in navigation && navigation.axis === "lane"
        ? direction
        : "auto",
  });
  columnTitle.update({ text: archiveColumns[lane], animated: !prefs.reduced && mode === "archive" });
  $<HTMLButtonElement>('[data-action="column-prev"]').disabled = false;
  $<HTMLButtonElement>('[data-action="column-next"]').disabled = false;
  fileTicks.forEach((button, slot) => {
    const index = files[slot];
    const record = index === undefined ? undefined : records[index];
    // A column with fewer episodes leaves surplus ticks idle; without this the
    // read below throws and the whole column switch aborts half-way.
    if (!record) {
      button.hidden = true;
      button.dataset.select = "";
      button.classList.remove("selected");
      button.setAttribute("aria-pressed", "false");
      return;
    }
    button.hidden = false;
    button.dataset.select = String(index);
    button.setAttribute("aria-label", `选择 ${record.id} ${record.title}`);
    button.title = `${record.id} · ${record.title}`;
    button.classList.toggle("selected", index === selected);
    button.setAttribute("aria-pressed", String(index === selected));
  });
  $("#saved-count").textContent = String(saved.size).padStart(2, "0");
}
function replayBoot(forcePreview = false) {
  if (!ready) return;
  closeModal(() => replayBootAfterModal(forcePreview));
}
function replayBootAfterModal(forcePreview: boolean) {
  bootStart = performance.now() / 1000 - 1.76;
  frozenTime = null;
  lastStep = "";
  setMode(prefs.reduced && !forcePreview ? "archive" : "boot");
  audio.restartBoot();
  scene?.select(0);
  selected = 0;
  pendingPresent = null;
  updateSelection();
  if (!forcePreview) audio.play("ui-tick");
}
function openFile() {
  if (!ready) return;
  closeModal(() => {
    setMode("detail");
    audio.play("open");
    player.play();
  });
}
function toggleSaved() {
  const id = records[selected].id;
  if (saved.has(id)) saved.delete(id);
  else saved.add(id);
  try {
    localStorage.setItem("rhine-saved", JSON.stringify([...saved]));
  } catch {}
  $("#saved-count").textContent = String(saved.size).padStart(2, "0");
  const button = $<HTMLButtonElement>('[data-action="bookmark"]');
  const added = saved.has(id);
  button.querySelector(".bookmark-label")!.textContent = added ? "已收藏" : "收藏本期";
  button.setAttribute("aria-pressed", String(added));
  bookmarkFeedback?.cancel();
  if (!prefs.reduced) bookmarkFeedback = button.animate(
    [{ backgroundColor: "#d8a0a6" }, { backgroundColor: "#7d1218" }],
    { duration: 220, easing: "ease-out" },
  );
  audio.play("confirm");
  notify(saved.has(id) ? "节目已加入收藏" : "已取消收藏");
}
function renderDetail() {
  tabTransition.cancel();
  const r = records[selected];
  const primary = r.sources[0];
  $("#object-id").textContent = "EP." + String(r.number).padStart(2, "0");
  $("#detail-content").innerHTML = `
  <div class="detail-head"><div class="detail-kicker"><span>第 ${String(r.number).padStart(2, "0")} 期</span><span>${escapeHtml(r.pubDate)}</span></div><h2>${escapeHtml(r.title)}</h2></div>
  <p class="detail-lead">${escapeHtml(r.summary.replace(/\s+/g, " ").slice(0, 92))}…</p>
  <div class="detail-tabs" role="tablist"><button id="tab-overview" class="active" role="tab" aria-controls="tab-panel" aria-selected="true" data-tab="overview">01 <span>简介</span></button><button id="tab-notes" role="tab" aria-controls="tab-panel" aria-selected="false" data-tab="notes">02 <span>目录</span></button><button id="tab-history" role="tab" aria-controls="tab-panel" aria-selected="false" data-tab="history">03 <span>链接</span></button><i class="tab-indicator" aria-hidden="true"></i></div>
  <dl class="metadata"><div><dt>COLUMN / 栏目</dt><dd>${escapeHtml(r.column)}</dd></div><div><dt>PUBLISHED / 发布日期</dt><dd>${escapeHtml(r.pubDate)}</dd></div><div><dt>DURATION / 时长</dt><dd>${escapeHtml(r.duration)}</dd></div><div><dt>STATUS / 状态</dt><dd><i></i>已发布 · 可播放</dd></div></dl>
  <div id="tab-panel" class="tab-panel" role="tabpanel">${overview()}</div>
  <div class="detail-actions"><button class="solid-button" data-action="bookmark"><span class="bookmark-glyph">▣</span><span class="bookmark-label">${saved.has(r.id) ? "已收藏" : "收藏本期"}</span></button><a class="download-button" href="${escapeHtml(r.audio)}" target="_blank" rel="noopener"><span>⤓</span>下载音频</a></div>`;
  $("#detail-content").setAttribute("tabindex", "-1");
  $('[data-action="bookmark"]').setAttribute("aria-pressed", String(saved.has(r.id)));
  const siblings = columnFiles(fileLocation(selected).lane);
  $("#detail-ticks").innerHTML = siblings
    .map((index) => `<button data-action="episode-select" data-index="${index}" class="${index === selected ? "active" : ""}" aria-label="${records[index].id} ${escapeHtml(records[index].title)}"></button>`)
    .join("");
  player.setTrack(playerTrack(r));
  documentDecryption.reset($("#detail-content"), prefs.reduced || !scene || scene.decryptionFrame.phase === "clear");
  setTab(activeTab, false);
}
function playerTrack(r: (typeof records)[number]) {
  return {
    id: r.id,
    title: r.title,
    subtitle: `第 ${String(r.number).padStart(2, "0")} 期 · ${r.column} · ${r.duration}`,
    audio: r.audio,
    cover: r.cover,
  };
}
function overview() {
  return `<div class="panel-label">SUMMARY / 简介</div><p>${escapeHtml(records[selected].summary)}</p>`;
}
function setTab(tab: string, sound = true) {
  if (sound && tab === activeTab) return;
  activeTab = tab;
  document.querySelectorAll("[data-tab]").forEach((b) => {
    const active = (b as HTMLElement).dataset.tab === tab;
    b.classList.toggle("active", active);
    b.setAttribute("aria-selected", String(active));
    b.setAttribute("tabindex", active ? "0" : "-1");
  });
  const r = records[selected];
  const tabButton = $<HTMLButtonElement>(`[data-tab="${tab}"]`);
  const indicator = $(".tab-indicator");
  indicator.style.transition = sound ? "" : "none";
  indicator.style.transform = `translateX(${tabButton.offsetLeft}px) scaleX(${tabButton.offsetWidth})`;
  $("#tab-panel").setAttribute("aria-labelledby", tabButton.id);
  $("#tab-panel").innerHTML =
    tab === "overview"
      ? overview()
      : tab === "notes"
        ? `<div class="panel-label">CHAPTERS / 目录</div>${r.chapters.length ? `<ol class="research-notes">${r.chapters.map((chapter, i) => `<li><span>${String(i + 1).padStart(2, "0")}</span>${escapeHtml(chapter)}</li>`).join("")}</ol>` : `<p class="log-note">本期未提供目录。</p>`}`
        : `<div class="panel-label">LINKS / 相关链接</div>${r.sources.map((source) => `<div class="log-row"><span>源文章</span><span>${escapeHtml(source.label)}</span><b><a href="${escapeHtml(source.url)}" target="_blank" rel="noopener">打开 ↗</a></b></div>`).join("")}<div class="log-row"><span>订阅</span><span>RSS</span><b><a href="${escapeHtml(show.rss)}" target="_blank" rel="noopener">打开 ↗</a></b></div><div class="log-row"><span>电报</span><span>频道</span><b><a href="${escapeHtml(show.telegram)}" target="_blank" rel="noopener">打开 ↗</a></b></div>${r.music ? `<p class="log-note">${escapeHtml(r.music)}</p>` : ""}`;
  $("#tab-panel").scrollTop = 0;
  documentDecryption.refresh();
  if (sound) {
    tabTransition.reveal($("#tab-panel"), prefs.reduced);
    audio.play("ui-tick");
  }
}
function notify(message: string) {
  clearTimeout(toastTimer);
  $("#toast").textContent = message;
  $("#toast").classList.add("visible");
  toastTimer = setTimeout(() => $("#toast").classList.remove("visible"), 2600);
}

function openModal(kind: NonNullable<typeof modal>) {
  if (!ready) return;
  if (!modal) {
    previousFocus = document.activeElement as HTMLElement;
    modalSiblings = [...$("#stage").children]
      .filter((node): node is HTMLElement => node instanceof HTMLElement && node.id !== "modal-root")
      .map((node) => ({ node, inert: node.inert }));
    modalSiblings.forEach(({ node }) => (node.inert = true));
  }
  modalClosing = false;
  modal = kind;
  searchQuery = "";
  filter = "全部节目";
  audio.play("page-open");
  renderModal();
}
function closeModal(afterClose?: () => void) {
  if (!modal) {
    afterClose?.();
    return;
  }
  if (modalClosing) return;
  modalClosing = true;
  audio.play("page-close");
  modalTransition!.hide(prefs.reduced, () => {
    modal = null;
    modalClosing = false;
    $("#modal-root").replaceChildren();
    modalTransition = undefined;
    modalSiblings.forEach(({ node, inert }) => (node.inert = inert));
    modalSiblings = [];
    $("#archive-ui").inert = mode !== "archive";
    $("#detail-ui").inert = mode !== "detail";
    previousFocus?.focus({ preventScroll: true });
    afterClose?.();
  });
}
function renderModal() {
  if (!modal) return;
  modalTransition?.dispose();
  $("#modal-root").innerHTML =
    `<div class="modal-backdrop"><section class="terminal-modal ${modal === "settings" ? "settings-modal" : ""}" role="dialog" aria-modal="true" aria-label="${modal === "settings" ? "系统设置" : modal === "saved" ? "已存档案" : "档案检索"}"><div class="modal-top"><span>光辉革命播客 / ${modal === "settings" ? "SYSTEM PREFERENCES" : "ARCHIVE INDEX"}</span><button data-action="close-modal" aria-label="关闭窗口">关闭 <span>×</span></button></div>${modal === "settings" ? settingsMarkup() : `<h2>${modal === "saved" ? "SAVED EPISODES" : "往期档案"}<small>${modal === "saved" ? "已存档案" : "全档案检索"}</small></h2><div class="search-field"><span>⌕</span><input id="archive-search" type="search" autocomplete="off" placeholder="输入期号、标题或栏目" aria-label="检索节目"/><span class="key">ESC</span></div><div class="category-filters">${categories.map((c, i) => `<button data-filter="${escapeHtml(c)}" class="${i === 0 ? "active" : ""}">${escapeHtml(c)}</button>`).join("")}</div><div class="result-header"><span>EPISODE / 节目</span><span>PUBLISHED / 发布</span><span>DURATION</span></div><div id="search-results" class="search-results"></div><div class="modal-bottom"><span id="result-count"></span><span>GLORIOUS REVOLUTION <i>●</i> LINKED</span></div>`}</section></div>`;
  const backdrop = $(".modal-backdrop");
  backdrop.hidden = true;
  modalTransition = new SurfaceTransition(backdrop, $(".terminal-modal"));
  modalTransition.show(prefs.reduced);
  if (modal === "settings") updateQualitySummary();
  if (modal !== "settings") {
    renderResults();
    requestAnimationFrame(() => {
      if (backdrop.isConnected && !modalClosing) $("#archive-search").focus();
    });
  } else
    requestAnimationFrame(() => {
      if (backdrop.isConnected && !modalClosing) $('[data-action="close-modal"]').focus();
    });
  $("#modal-root")
    .querySelector(".modal-backdrop")
    ?.addEventListener("click", (e) => {
      if (e.target === e.currentTarget) closeModal();
    });
}
function renderResults() {
  const results = records
    .map((r, i) => ({ r, i }))
    .filter(
      ({ r }) =>
        (modal !== "saved" || saved.has(r.id)) &&
        (filter === "全部节目" || r.column === filter) &&
        `${r.id} ${r.number} ${r.title} ${r.column}`
          .toLowerCase()
          .includes(searchQuery.toLowerCase()),
    );
  $("#search-results").innerHTML = results.length
    ? results
        .map(
          ({ r, i }) =>
            `<button class="result-row" data-result="${i}"><span class="result-name"><b>${r.id}</b><span>${escapeHtml(r.title)}<small>${escapeHtml(r.column)}</small></span>${saved.has(r.id) ? "<i>＋</i>" : ""}</span><span>${escapeHtml(r.pubDate)}</span><span>${escapeHtml(r.duration)} <i>↗</i></span></button>`,
        )
        .join("")
    : `<div class="empty-results"><span>∅</span><strong>${modal === "saved" && !searchQuery ? "尚无已存档案" : "没有匹配的档案"}</strong><p>${modal === "saved" && !searchQuery ? "播放节目时，选择「收藏本期」将其保存在此处。" : "尝试其他标题、期号，或切换栏目。"}</p><button data-action="reset-search">${modal === "saved" ? "查看全部档案 →" : "重置检索 →"}</button></div>`;
  $("#result-count").textContent =
    `${String(results.length).padStart(2, "0")} EPISODES FOUND`;
}
function updateQualitySummary() {
  const summary = document.querySelector("#quality-summary");
  if (!summary) return;
  if (!scene) { summary.textContent = "3D 已关闭 · 三维模型与渲染资源已释放"; return; }
  const canvas = scene.renderer.domElement;
  const metrics = JSON.parse(canvas.parentElement?.dataset.renderQuality ?? "{}");
  summary.textContent = `${superPerformanceEnabled() ? "超级性能模式已启用 · 画质设置暂被覆盖，关闭后恢复 · " : ""}实际渲染 ${canvas.width} × ${canvas.height} · ${effectiveRenderQuality().antialias === "smaa" ? "SMAA" : "原始抗锯齿"} · 纹理 ${metrics.anisotropy ?? 1}×${metrics.limited ? " · 已达到缓冲上限" : ""}`;
}
function motionSettingsMarkup() {
  return `<div id="motion-preference-note" class="motion-preference-note"><p>${prefs.reduced
    ? `当前已减少动态效果。${matchMedia("(prefers-reduced-motion: reduce)").matches ? "系统也请求减少动画，可仅为本站启用完整动效。" : "关闭上方开关可恢复完整动效。"}`
    : "当前使用完整动效。"}</p>${prefs.reduced ? '<button data-action="enable-motion">启用完整动效并重播 ↻</button>' : ""}</div>`;
}
function settingsMarkup() {
  return `<h2>终端设置<small>SYSTEM PREFERENCES</small></h2><p class="settings-intro">光辉革命播客 <span>·</span> 全世界无产者，联合起来</p><div class="settings-list">${themeSettingsMarkup(prefs.colorTheme === "dark")}<label><div><strong>性能模式</strong><span>降低三维画质和渲染分辨率，保留完整动效；关闭后恢复原画质</span></div><input type="checkbox" data-pref="superPerformance" ${prefs.superPerformance ? "checked" : ""}/><i class="toggle"></i></label>${audioSettingsMarkup(prefs)}<label><div><strong>减少动态效果</strong><span>跳过开机动画，简化选档、镜头和文字动效</span></div><input type="checkbox" data-pref="reduced" ${prefs.reduced ? "checked" : ""}/><i class="toggle"></i></label></div>${motionSettingsMarkup()}${qualityMarkup(prefs.rendering)}${pwaSettingsMarkup()}<div class="settings-shortcuts"><span>操作说明</span><p><kbd>←</kbd><kbd>→</kbd> 切栏 <kbd>↑</kbd><kbd>↓</kbd> 选期 <kbd>ENTER</kbd> 播放 <kbd>/</kbd> 检索 <kbd>ESC</kbd> 返回</p></div><div class="settings-bottom">${document.fullscreenEnabled ? '<button data-action="fullscreen">全屏 <span>↗</span></button>' : ''}<button data-action="restart">重新开始 <span>↻</span></button></div><div class="modal-bottom"><span>VERITAS · POPULUS · VOX</span><span>GLORIOUS REVOLUTION PODCAST / 1.0 · 使用 MiSans 字体（小米） <a href="${assetUrl("fonts/MiSans-license.pdf")}" target="_blank" rel="noopener">字体许可</a></span><span>由 光辉革命播客 制作</span></div>`;
}

document.addEventListener("input", (e) => {
  const slider = e.target as HTMLInputElement;
  if (slider.dataset.quality) {
    const output = document.querySelector<HTMLOutputElement>(`[data-quality-output="${slider.dataset.quality}"]`);
    if (output) output.value = `${slider.value}%`;
  }
  const volume = e.target as HTMLInputElement;
  if (volume.dataset.volume === "musicVolume" || volume.dataset.volume === "soundVolume") {
    prefs[volume.dataset.volume] = Number(volume.value) / 100;
    volume.closest("label")?.querySelector("output")?.replaceChildren(`${volume.value}%`);
    saveAudioPrefs();
  }
  if ((e.target as HTMLElement).id === "archive-search") {
    searchQuery = (e.target as HTMLInputElement).value;
    renderResults();
  }
});
document.addEventListener("change", (e) => {
  const el = e.target as HTMLInputElement;
  if (el.id === "quality-preset" && Object.hasOwn(qualityPresets, el.value)) {
    prefs.rendering = { ...qualityPresets[el.value as QualityPreset] };
    savePrefs();
  } else if (el.dataset.quality) {
    const key = el.dataset.quality as keyof RenderQuality;
    prefs.rendering = normalizeQuality({ ...prefs.rendering, [key]: key === "antialias" ? el.value : Number(el.value) });
    savePrefs();
  }
  if (el.dataset.pref) {
    const key = el.dataset.pref;
    if (key === "sound" || key === "music" || key === "reduced" || key === "quality" || key === "superPerformance") prefs[key] = el.checked;
    if (key === "sound" || key === "music") saveAudioPrefs(); else savePrefs();
    if (key === "reduced") $("#motion-preference-note").outerHTML = motionSettingsMarkup();
    audio.play("confirm");
  }
});
document.addEventListener("click", (e) => {
  const themeButton = (e.target as Element).closest<HTMLElement>("[data-color-theme]");
  if (themeButton) { prefs.colorTheme = themeButton.dataset.colorTheme === "dark" ? "dark" : "light"; savePrefs(); return; }
  if (!started) return;
  if (modalClosing) return;
  const el = (e.target as Element).closest<HTMLElement>("button");
  if (!el) return;
  if (el.dataset.select) {
    select(Number(el.dataset.select));
    return;
  }
  if (el.dataset.result) {
    const index = Number(el.dataset.result);
    closeModal(() => {
      select(index);
      openFile();
    });
    return;
  }
  if (el.dataset.filter) {
    filter = el.dataset.filter;
    document
      .querySelectorAll("[data-filter]")
      .forEach((b) =>
        b.classList.toggle(
          "active",
          (b as HTMLElement).dataset.filter === filter,
        ),
      );
    renderResults();
    return;
  }
  if (el.dataset.tab) {
    setTab(el.dataset.tab);
    return;
  }
  const action = el.dataset.action;
  if (action === "sound-preview") audio.play("confirm");
  if (action === "skip") {
    setMode("archive");
    audio.play("confirm");
  }
  if (action === "prev") stepFile(-1);
  if (action === "next") stepFile(1);
  if (action === "column-prev") stepColumn(-1);
  if (action === "column-next") stepColumn(1);
  if (action === "open") openFile();
  if (action === "play") player.play();
  if (action === "episode-prev") stepEpisode(-1);
  if (action === "episode-next") stepEpisode(1);
  if (action === "episode-select" && el.dataset.index)
    openEpisode(Number(el.dataset.index));
  if (action === "back") {
    setMode("archive");
    audio.play("back");
  }
  if (action === "search" || action === "saved" || action === "settings") {
    el.focus({ preventScroll: true });
    openModal(action);
  }
  if (action === "close-modal") closeModal();
  if (action === "bookmark") toggleSaved();
  if (action === "reset-search") {
    modal = "search";
    searchQuery = "";
    filter = "全部节目";
    renderModal();
  }
  if (action === "replay" || action === "restart") {
    replayBoot();
  }
  if (action === "enable-motion") {
    prefs.reduced = false;
    savePrefs();
    replayBoot();
  }
  if (action === "fullscreen" && document.fullscreenEnabled) {
    if (document.fullscreenElement) void document.exitFullscreen();
    else
      void document.documentElement
        .requestFullscreen()
        .catch(() => notify("请使用浏览器的全屏快捷键 F11"));
  }
});
document.addEventListener("keydown", (e) => {
  if (!started) return;
  if (modalClosing) {
    e.preventDefault();
    return;
  }
  const typing = e.target instanceof HTMLInputElement;
  if (e.key === "Escape") {
    if (modal) closeModal();
    else if (mode === "detail" || (mode === "boot" && ready)) { const sound = mode === "detail" ? "back" : "ui-tick"; setMode("archive"); audio.play(sound); }
    return;
  }
  if (modal && e.key === "Tab") {
    const focusables = [
      ...$("#modal-root").querySelectorAll<HTMLElement>(
        'button,input:not(:disabled),select:not(:disabled),summary,[tabindex="0"]',
      ),
    ];
    const visible = focusables.filter(el => el.getClientRects().length > 0);
    const first = visible[0],
      last = visible.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
    return;
  }
  if (typing || modal || !ready) return;
  if (
    (e.target as HTMLElement).dataset.tab &&
    ["ArrowLeft", "ArrowRight"].includes(e.key)
  ) {
    e.preventDefault();
    const tabs = ["overview", "notes", "history"];
    setTab(
      tabs[(tabs.indexOf(activeTab) + (e.key === "ArrowRight" ? 1 : 2)) % 3],
    );
    $<HTMLButtonElement>(`[data-tab="${activeTab}"]`).focus();
    return;
  }
  if (e.key === "/") {
    e.preventDefault();
    if (mode === "boot") setMode("archive");
    openModal("search");
  }
  if (e.key === "ArrowLeft" && mode !== "boot") {
    e.preventDefault();
    if (mode === "detail") stepEpisode(-1);
    else stepColumn(-1);
  }
  if (e.key === "ArrowRight" && mode !== "boot") {
    e.preventDefault();
    if (mode === "detail") stepEpisode(1);
    else stepColumn(1);
  }
  if (["ArrowUp", "ArrowDown"].includes(e.key) && mode !== "boot") {
    e.preventDefault();
    stepFile(e.key === "ArrowUp" ? -1 : 1);
  }
  if (
    e.key === "Enter" &&
    (document.activeElement === document.body ||
      document.activeElement?.id === "detail-content" ||
      ["prev", "next", "column-prev", "column-next"].includes(
        (document.activeElement as HTMLElement)?.dataset.action ?? "",
      ) ||
      (document.activeElement as HTMLElement)?.dataset.select)
  ) {
    e.preventDefault();
    if (mode === "boot") setMode("archive");
    else if (mode === "archive") openFile();
  }
});

const ease = (t: number) => {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
};
function bootFrame(t: number) {
  audio.updateBoot(t, frozenTime !== null);
  const motion = bootSequence.update(t);
  let step: string = motion.step;
  if (t >= 22) {
    step = "array";
  }
  if (t >= 25.68) {
    step = "select";
  }
  if (t >= 28.3) {
    step = "inspect";
  }
  if (step !== lastStep) {
    $("#stage").dataset.boot = step;
    lastStep = step;
  }
  $("#stage").style.setProperty(
    "--entry-opacity",
    String(ease((t - 21.9) / 0.13)),
  );
  const reveal = ease((t - 22) / 0.4),
    lift = ease((t - 26) / 1.8),
    zoom = 0.55 * ease((t - 27.3) / 1.65) + 0.45 * ease((t - 29.0) / 5.0);
  if (t >= 35) {
    setMode("detail");
    return undefined;
  }
  return { reveal, lift, zoom, time: t };
}

const inspectionOverlay = new InspectionOverlay();
const documentDecryption = new DocumentDecryption();
// A newly opened archive can introduce another font shard. Re-measure its
// redaction lines after font swap while retaining the current reveal progress.
document.fonts.addEventListener("loadingdone", () => documentDecryption.refresh());

let lastTime = 0,
  frameCount = 0,
  frameStart = performance.now(),
  fps = 0;
function frame(ms: number) {
  if (document.hidden) { requestAnimationFrame(frame); return; }
  flushPresent();
  const sliding = scene?.isSliding ?? false;
  if (slideWasActive && !sliding && mode !== "boot") player.setTrack(playerTrack(records[selected]));
  slideWasActive = sliding;
  const time = ms / 1000;
  const theme = scene?.themeAmount ?? (prefs.colorTheme === "dark" ? 1 : 0);
  paintTheme(theme);
  const cinema =
    mode === "boot" && ready
      ? bootFrame(frozenTime ?? time - bootStart)
      : undefined;
  // The calibrated 2D opening fully covers the scene until array entry.
  // A modal blurs the stage completely, so only the GPU pass is suspended.
  if (!cinema || cinema.time >= 21.9) scene?.update(time, cinema, Boolean(modal));
  if (scene && mode === "detail") {
    documentDecryption.update(time, scene.decryptionFrame, prefs.reduced);
    const content = $("#detail-content");
    const visibility = scene.detailVisibility;
    const opacity = String(visibility);
    if (content.style.opacity !== opacity) content.style.opacity = opacity;
    const translate = `0 ${(1 - visibility) * 18}px`;
    if (content.style.translate !== translate) content.style.translate = translate;
    const detailInert = visibility < 0.1;
    if (content.inert !== detailInert) content.inert = detailInert;
    player.setOpacity(visibility);
    if (pendingDetailFocus && visibility >= 0.1 && !modal) {
      content.focus({ preventScroll: true });
      pendingDetailFocus = false;
    }
  }
  const shade = String(mode === "boot" ? 0 : scene?.detailVisibility ?? 0);
  const stageStyle = $("#stage").style;
  if (stageStyle.getPropertyValue("--detail-shade") !== shade)
    stageStyle.setProperty("--detail-shade", shade);
  const currentScene = scene;
  if (currentScene) inspectionOverlay.render(currentScene.decryptionFrame,
    (x, y) => currentScene.projectCard(x, y), Boolean(cinema));
  if (Math.floor(time) !== lastTime) {
    lastTime = Math.floor(time);
    updateFooterClock(new Date(), !prefs.reduced);
  }
  frameCount++;
  if (ms - frameStart > 1000) {
    fps = (frameCount * 1000) / (ms - frameStart);
    frameStart = ms;
    frameCount = 0;
    $("#three-scene").dataset.fps = String(Math.round(fps));
    $("#three-scene").dataset.renderStats = JSON.stringify(scene?.getStats() ?? { loaded: false, drawCalls: 0, triangles: 0 });
  }
  requestAnimationFrame(frame);
}
function bindScene(scene: ArchiveScene, cell?: { lane: number; row: number }) {
    scene.select(selected, cell ? { cell } : undefined);
    scene.onSelect = (i, cell) => {
      if (mode !== "archive" || modal) return;
      select(i, cell ? { cell } : undefined);
    };
    scene.onNavigate = (axis, direction) => {
      if (mode !== "archive" || modal) return;
      if (axis === "lane") stepColumn(direction);
      else stepFile(direction);
    };
    scene.onHover = (i) => {
      const label = $("#hover-label");
      if (i === null) {
        label.hidden = true;
        hoverCode.finish();
        hoverTitle.finish();
        return;
      }
      const animated = !prefs.reduced && mode === "archive";
      hoverCode.update({
        value: Number(records[i].id.slice(2)),
        animated: !label.hidden && animated,
      });
      hoverTitle.update({ text: records[i].title, animated: !label.hidden && animated });
      label.hidden = false;
      // Prepare the first visible value so the next hover can animate immediately.
      hoverCode.update({ animated });
      hoverTitle.update({ animated });
    };
}

/**
 * Opaque overlays hide the scene behind them exactly like solid geometry.
 * A panel qualifies once every ancestor has settled (no mode fades) and its
 * own background is opaque; the rectangle is inset so rounded corners and the
 * border accent never count as coverage.
 */
const overlayPanels = [".archive-callout", "#detail-content"];
function opaquePanelRects(): ScreenRect[] {
  const rects: ScreenRect[] = [];
  for (const selector of overlayPanels) {
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) continue;
    let settled = true;
    for (let node: Element | null = element; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === "none" || style.visibility !== "visible" || Number(style.opacity) < 0.99) {
        settled = false;
        break;
      }
    }
    if (!settled) continue;
    const parts = (getComputedStyle(element).backgroundColor.match(/[\d.]+/g) ?? []).map(Number);
    if (parts.length < 3) continue;
    const alpha = parts.length > 3 ? parts[3] : 1;
    if (alpha < 0.99) continue;
    const rect = element.getBoundingClientRect();
    if (rect.width < 24 || rect.height < 24) continue;
    rects.push({
      left: rect.left + 4,
      top: rect.top + 4,
      right: rect.right - 4,
      bottom: rect.bottom - 4,
    });
  }
  return rects;
}

async function start() {
  try {
    scene = new ArchiveScene($("#three-scene"));
    scene.occlusionEnabled = !reviewParams.has("no-occlusion");
    scene.shadowCache = !reviewParams.has("no-shadow-cache");
    scene.detailLod = !reviewParams.has("no-detail-lod");
    scene.instanceReuse = !reviewParams.has("no-instance-reuse");
    scene.motionQuality = !reviewParams.has("no-motion-quality");
    scene.screenOccluders = opaquePanelRects;
    scene.setTheme(prefs.colorTheme === "dark", true);
    await Promise.all([
      scene?.load(),
      loadBootWebfonts(),
      // With unicode-range faces, preload the opening's actual characters,
      // not every font shard. Other archive text loads on demand.
      document.fonts.load("300 20px MiSans", "正在调取档案音频链路预热中授权播放身份确认行为"),
      document.fonts.load("400 20px MiSans", "身份信息确认请求已接收正在调取档案音频链路预热中授权播放终端已上线播放权限已授予光辉革命播客内部资料期号时长栏目选择节目：0123456789 接入已授权"),
      document.fonts.load("600 20px MiSans", "光辉革命 马列毛主义播客 PODCAST 让价值文章有声化"),
      document.fonts.load("700 20px MiSans", "GLORIOUS REVOLUTION PODCAST 接入已授权"),
    ]);
    if (scene) bindScene(scene);
    savePrefs();
    ready = true;
    select(0);
    if (entry) entry.ready();
    else completeStartup(false);
  } catch (error) {
    console.error(error);
    $("#loading").innerHTML =
      '<div class="error-state"><strong>连接中断</strong><p>三维模型资源未能载入。请确认浏览器已启用硬件加速，然后重新连接。</p><button onclick="location.reload()">RECONNECT →</button></div>';
  }
}
function completeStartup(silent: boolean) {
  if (started || !ready) return;
  started = true;
  if (silent) {
    prefs.sound = false;
    prefs.music = false;
    saveAudioPrefs();
  }
  audio.releaseEntry();
  audio.restartBoot();
  const fade = prefs.reduced ? 0 : 600;
  bootStart = performance.now() / 1000 - (reviewParams.has("time") ? Number(reviewParams.get("time")) : 1.76);
  if (!reviewParams.has("time")) bootStart += fade / 1000;
  setMode("boot");
  if (reviewParams.get("scene") === "archive" || (prefs.reduced && !reviewParams.has("time"))) setMode("archive");
  if (reviewParams.get("scene") === "detail") setMode("detail");
  $("#stage").inert = false;
  $(".mobile-entry").inert = false;
  loading.classList.add("loaded");
  loading.inert = true;
  setTimeout(() => {
    const restoreFocus = loading.contains(document.activeElement) || document.activeElement === document.body;
    loading.remove();
    if (entry && restoreFocus) {
      const skip = $("#skip");
      const target = mode === "boot" ? skip.getClientRects().length ? skip : $(".mobile-entry") : $(".read-file");
      target.focus({ preventScroll: true });
    }
  }, fade);
  requestAnimationFrame(frame);
  // Do not compete with entry audio/font downloads. Full offline installation
  // begins after startup is complete and remains atomic.
  setTimeout(() => void initPwa(notify), 1500);
}
updateSelection();
void start();
// Deterministic review controls: the running application, never a video surrogate.
Object.assign(window, {
  rhine: {
    // The review button supplies a real user activation. Preferences stay local to this preview.
    playBootPreview: async (music = false) => {
      // userActivation only exists from Firefox 120; older builds treat the
      // preview hook as unavailable instead of throwing.
      if (!ready || !navigator.userActivation?.isActive) return false;
      const request = ++audioPreviewRequest;
      audioPreview = true;
      audio.configure({ ...prefs, sound: true, music });
      const unlocked = await audio.unlock();
      if (request !== audioPreviewRequest) return false;
      if (!unlocked) {
        audioPreview = false;
        configureAudio();
        return false;
      }
      replayBoot(true);
      return true;
    },
    seek: (t: number) => {
      setMode("boot");
      bootStart = performance.now() / 1000 - t;
      lastStep = "";
    },
    archive: () => setMode("archive"),
    detail: () => openFile(),
    select: (i: number) => select(i),
    // Occlusion A/B review hook: toggling repaints the canvas because instance
    // counts and mesh visibility both enter the reuse snapshot.
    setOcclusion: (enabled: boolean) => {
      if (scene) scene.occlusionEnabled = enabled;
    },
    stats: () => ({
      ...scene?.getStats(),
      fps: Math.round(fps),
      mode,
      ready,
      startup: started ? "started" : entry?.phase ?? "loading",
      motion: { reduced: prefs.reduced, systemReduced: matchMedia("(prefers-reduced-motion: reduce)").matches },
      bootTime: mode === "boot" ? started ? (frozenTime ?? performance.now() / 1000 - bootStart) + 5 : 6.76 : null,
      selected: records[selected].id,
      saved: [...saved],
      audio: audio.stats(),
    }),
  },
});
if (import.meta.hot) import.meta.hot.dispose(() => audio.dispose());

