import "./player.css";

export interface PlayerTrack {
  id: string;
  title: string;
  subtitle: string;
  audio: string;
  cover: string | null;
}

const RATES = [0.75, 1, 1.25, 1.5, 2];

const clock = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

/**
 * Streams episode audio from the feed. Deliberately a plain HTMLAudioElement:
 * the engine's Web Audio graph only decodes same-origin stems, so remote mp3s
 * play without CORS, and nothing here is routed through createMediaElementSource.
 */
export class EpisodePlayer {
  private audio = new Audio();
  private root: HTMLElement;
  private cover: HTMLImageElement;
  private title: HTMLElement;
  private subtitle: HTMLElement;
  private toggle: HTMLButtonElement;
  private seek: HTMLInputElement;
  private elapsed: HTMLElement;
  private total: HTMLElement;
  private rate: HTMLSelectElement;
  private track?: PlayerTrack;
  private scrubbing = false;
  private onPlayStateChange?: (playing: boolean) => void;

  constructor(host: HTMLElement, onPlayStateChange?: (playing: boolean) => void) {
    this.audio.preload = "metadata";
    this.onPlayStateChange = onPlayStateChange;
    this.root = document.createElement("div");
    this.root.id = "episode-player";
    this.root.className = "episode-player";
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="player-cover"><img alt="" /></div>
      <div class="player-body">
        <div class="player-meta"><span class="player-kicker">NOW PLAYING</span><strong class="player-title"></strong><span class="player-subtitle"></span></div>
        <div class="player-controls">
          <button class="player-toggle" type="button" aria-label="播放或暂停"><span class="player-glyph">▶</span></button>
          <span class="player-elapsed">00:00</span>
          <input class="player-seek" type="range" min="0" max="1000" value="0" step="1" aria-label="播放进度" />
          <span class="player-total">00:00</span>
          <select class="player-rate" aria-label="播放速度">${RATES.map((value) => `<option value="${value}">${value}×</option>`).join("")}</select>
        </div>
      </div>`;
    host.appendChild(this.root);

    this.cover = this.root.querySelector("img")!;
    this.title = this.root.querySelector(".player-title")!;
    this.subtitle = this.root.querySelector(".player-subtitle")!;
    this.toggle = this.root.querySelector(".player-toggle")!;
    this.seek = this.root.querySelector(".player-seek")!;
    this.elapsed = this.root.querySelector(".player-elapsed")!;
    this.total = this.root.querySelector(".player-total")!;
    this.rate = this.root.querySelector(".player-rate")!;

    try {
      const stored = Number(localStorage.getItem("gr-player-rate"));
      if (RATES.includes(stored)) this.rate.value = String(stored);
    } catch {}
    this.audio.playbackRate = Number(this.rate.value);

    this.toggle.addEventListener("click", () => this.togglePlayback());
    this.seek.addEventListener("input", () => {
      this.scrubbing = true;
      this.elapsed.textContent = clock((Number(this.seek.value) / 1000) * this.audio.duration);
    });
    this.seek.addEventListener("change", () => {
      if (Number.isFinite(this.audio.duration)) this.audio.currentTime = (Number(this.seek.value) / 1000) * this.audio.duration;
      this.scrubbing = false;
    });
    this.rate.addEventListener("change", () => {
      this.audio.playbackRate = Number(this.rate.value);
      try {
        localStorage.setItem("gr-player-rate", this.rate.value);
      } catch {}
    });
    this.audio.addEventListener("play", () => this.paint());
    this.audio.addEventListener("pause", () => this.paint());
    this.audio.addEventListener("timeupdate", () => this.paintProgress());
    this.audio.addEventListener("loadedmetadata", () => this.paintProgress());
    this.audio.addEventListener("ended", () => {
      this.paint();
      this.seek.value = "0";
    });
    this.audio.addEventListener("error", () => {
      this.subtitle.textContent = "音频加载失败";
      this.paint();
    });
  }

  get playing() {
    return !this.audio.paused && !this.audio.ended;
  }

  play() {
    if (this.track) void this.audio.play().catch(() => this.paint());
  }

  setDocked(docked: boolean) {
    this.root.classList.toggle("is-docked", docked);
  }

  setOpacity(value: number) {
    this.root.style.opacity = value >= 0.999 ? "" : String(value);
    this.root.style.pointerEvents = value < 0.1 ? "none" : "";
  }

  setTrack(track: PlayerTrack, autoplay = false) {
    if (this.track?.id === track.id && this.audio.src) return;
    this.track = track;
    this.root.hidden = false;
    this.title.textContent = track.title;
    this.subtitle.textContent = track.subtitle;
    this.elapsed.textContent = "00:00";
    this.total.textContent = "00:00";
    this.seek.value = "0";
    if (track.cover) {
      this.cover.src = track.cover;
      this.cover.hidden = false;
    } else {
      this.cover.removeAttribute("src");
      this.cover.hidden = true;
    }
    this.audio.src = track.audio;
    if (autoplay) void this.audio.play().catch(() => this.paint());
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: "光辉革命播客",
        album: track.subtitle,
        artwork: track.cover ? [{ src: track.cover, sizes: "512x512" }] : [],
      });
      navigator.mediaSession.setActionHandler("play", () => void this.audio.play());
      navigator.mediaSession.setActionHandler("pause", () => this.audio.pause());
    }
    this.paint();
  }

  togglePlayback() {
    if (!this.track) return;
    if (this.playing) this.audio.pause();
    else void this.audio.play().catch(() => this.paint());
  }

  private paintProgress() {
    const duration = this.audio.duration;
    if (Number.isFinite(duration) && duration > 0) {
      this.total.textContent = clock(duration);
      if (!this.scrubbing) this.seek.value = String(Math.round((this.audio.currentTime / duration) * 1000));
    }
    if (!this.scrubbing) this.elapsed.textContent = clock(this.audio.currentTime);
  }

  private paint() {
    const playing = this.playing;
    this.root.classList.toggle("is-playing", playing);
    this.toggle.querySelector(".player-glyph")!.textContent = playing ? "❚❚" : "▶";
    this.toggle.setAttribute("aria-label", playing ? "暂停" : "播放");
    this.onPlayStateChange?.(playing);
  }
}
