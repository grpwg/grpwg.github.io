/**
 * Home-screen installation only. The terminal is an online player: audio is
 * streamed from the feed and models and fonts load from the network, so there
 * is deliberately no offline cache and no service worker. Without a worker,
 * every visit always serves the release currently deployed — the previous
 * full-copy cache kept phones on an old build until it finished downloading
 * ~36 MiB of assets.
 */
interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
let installPrompt: InstallPrompt | undefined;
let tell: (message: string) => void = () => {};
const standalone = () => matchMedia("(display-mode: standalone)").matches ||
  Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
const ios = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
// Firefox desktop never fires beforeinstallprompt and offers no install menu
// item, so the generic guidance would promise an entry that does not exist.
const installlessFirefox = () => /Firefox/.test(navigator.userAgent) && !/Android/.test(navigator.userAgent);

function refresh() {
  const current = document.querySelector("#pwa-settings");
  if (current) current.outerHTML = pwaSettingsMarkup();
}

export function pwaSettingsMarkup() {
  const guidance = standalone() ? "已从主屏幕打开。"
    : ios() ? "在 Safari 中轻点“分享”→“添加到主屏幕”，然后从主屏幕图标打开。"
    : installPrompt ? "安装后可在独立窗口中打开节目。"
    : installlessFirefox() ? "本浏览器不提供一键安装；收藏本站即可随时进入。"
    : "可通过浏览器菜单安装或添加到主屏幕。";
  return `<section id="pwa-settings" class="pwa-settings" aria-label="主屏幕与安装"><h3>APP / 主屏幕</h3><p>${guidance}</p><div class="pwa-actions">${installPrompt && !standalone() ? '<button data-pwa-action="install">安装到设备 ↗</button>' : ""}</div></section>`;
}

export function initPwa(notify: (message: string) => void) {
  tell = notify;
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    installPrompt = event as InstallPrompt;
    refresh();
  });
  window.addEventListener("appinstalled", () => { installPrompt = undefined; refresh(); });
  matchMedia("(display-mode: standalone)").addEventListener("change", refresh);
  document.addEventListener("click", async event => {
    const button = (event.target as Element).closest<HTMLButtonElement>("[data-pwa-action]");
    if (!button || button.dataset.pwaAction !== "install" || !installPrompt) return;
    const prompt = installPrompt;
    installPrompt = undefined;
    try { await prompt.prompt(); await prompt.userChoice; } catch { tell("请通过浏览器菜单添加到主屏幕"); }
    refresh();
  });
}
