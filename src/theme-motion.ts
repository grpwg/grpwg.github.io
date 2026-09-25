export type ThemeCell = { row: number; lane: number };
const key = (cell: ThemeCell) => `${cell.lane}:${cell.row}`;
const ease = (t: number) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };

/** A material wave with a frozen origin and an interruptible per-card starting colour. */
export class ThemeWave {
  target = 0;
  private start = -10;
  private origin: ThemeCell = { row: 12, lane: 2 };
  private from = new Map<string, number>();
  private latest = new Map<string, number>();
  private backgroundFrom = 0;
  set(dark: boolean, time: number, origin: ThemeCell, immediate = false) {
    const target = dark ? 1 : 0;
    if (target === this.target && !immediate) return;
    this.backgroundFrom = immediate ? target : this.background(time);
    this.from = immediate ? new Map() : new Map(this.latest);
    this.target = target; this.start = immediate ? time - 10 : time;
    this.origin = { ...origin };
  }
  background(time: number) { return this.backgroundFrom + (this.target - this.backgroundFrom) * ease((time - this.start) / .85); }
  /** True while a wave can still change a card (max delay .6 + .58s, plus margin). */
  animating(now: number) { const age = now - this.start; return age >= 0 && age < 1.5; }
  beginFrame() { this.latest.clear(); }
  sample(cell: ThemeCell, time: number) {
    const delay = Math.min(.6, Math.abs(cell.row - this.origin.row) * .034 + Math.abs(cell.lane - this.origin.lane) * .11);
    const from = this.from.get(key(cell)) ?? this.backgroundFrom;
    const value = from + (this.target - from) * ease((time - this.start - delay) / .58);
    this.latest.set(key(cell), value);
    return value;
  }
}
