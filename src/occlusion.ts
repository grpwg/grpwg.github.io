import * as THREE from "three";

/** A screen rectangle in CSS pixels that fully covers what is behind it. */
export interface ScreenRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

// Cells stay small enough that a card seen at a shallow angle still claims
// interior cells. The edge margin keeps the sub-pixel glass rim, the card's
// terrain lean and raster rounding outside every claim.
const CELL = 6;
const EDGE_MARGIN = 3;
// Occluder far plane and occludee near plane must clear each other by more
// than float noise before a slot is dropped.
const DEPTH_EPS = 0.05;

/**
 * Conservative screen-space occlusion test for "draw only what the camera can
 * see" culling (verification/OCCLUSION.md).
 *
 * One Float32 grid stores, per cell, the smallest far depth of any occluder
 * that fully covers it. Occluders are inner-rasterized: a cell is only claimed
 * when all four of its corners sit inside the projected hull of the occluder's
 * true (already rotated) corners, so a claim never exceeds the silhouette.
 * An occludee is dropped only when every cell of its outer screen box holds a
 * strictly nearer far plane. Boxes crossing the near plane are refused as
 * occluders and kept as occludees; opaque DOM panels enter through addRect at
 * depth 0, in front of the whole scene.
 */
export class OcclusionGrid {
  private depth = new Float32Array(0);
  private cols = 0;
  private rows = 0;
  private width = 0;
  private height = 0;
  private near = 1;
  private view = new THREE.Matrix4();
  private projection = new THREE.Matrix4();
  private mv = new THREE.Matrix4();
  private xs = new Float32Array(8);
  private ys = new Float32Array(8);
  private zs = new Float32Array(8);
  /** Per-box projected corners, cached between the claim pass and the test
   * pass so each box is projected once per frame instead of twice. */
  private slotXs = new Float32Array(0);
  private slotYs = new Float32Array(0);
  private slotZs = new Float32Array(0);
  private slotValid = new Uint8Array(0);
  private order = new Int32Array(8);
  private hull = new Int32Array(8);
  private rangeLo = 0;
  private rangeHi = 0;
  occluders = 0;
  claimed = 0;

  begin(camera: THREE.PerspectiveCamera, width: number, height: number) {
    this.width = Math.max(1, Math.round(width));
    this.height = Math.max(1, Math.round(height));
    const cols = Math.ceil(this.width / CELL);
    const rows = Math.ceil(this.height / CELL);
    if (cols !== this.cols || rows !== this.rows) {
      this.depth = new Float32Array(cols * rows);
      this.cols = cols;
      this.rows = rows;
    }
    this.depth.fill(Infinity);
    this.near = camera.near;
    this.view.copy(camera.matrixWorldInverse);
    this.projection.copy(camera.projectionMatrix);
    this.occluders = 0;
    this.claimed = 0;
  }

  /**
   * Project the eight true corners of `box` transformed by `matrix` into CSS
   * pixels, recording view depth per corner. False when any corner crosses the
   * near plane: the caller must then treat the box as occluder-invalid or as a
   * visible occludee.
   */
  private project(min: THREE.Vector3, max: THREE.Vector3, matrix: THREE.Matrix4) {
    this.mv.multiplyMatrices(this.view, matrix);
    const v = this.mv.elements;
    const p = this.projection.elements;
    let inside = true;
    for (let i = 0; i < 8; i++) {
      const x = i & 1 ? max.x : min.x;
      const y = i & 2 ? max.y : min.y;
      const z = i & 4 ? max.z : min.z;
      const vx = v[0] * x + v[4] * y + v[8] * z + v[12];
      const vy = v[1] * x + v[5] * y + v[9] * z + v[13];
      const vz = v[2] * x + v[6] * y + v[10] * z + v[14];
      const depth = -vz;
      this.zs[i] = depth;
      const cw = p[3] * vx + p[7] * vy + p[11] * vz + p[15];
      if (depth < this.near || cw <= 1e-6) {
        inside = false;
        this.xs[i] = 0;
        this.ys[i] = 0;
        continue;
      }
      this.xs[i] = ((p[0] * vx + p[4] * vy + p[8] * vz + p[12]) / cw * 0.5 + 0.5) * this.width;
      this.ys[i] = (0.5 - (p[1] * vx + p[5] * vy + p[9] * vz + p[13]) / cw * 0.5) * this.height;
    }
    return inside;
  }

  private less(a: number, b: number) {
    return this.xs[a] < this.xs[b] || (this.xs[a] === this.xs[b] && this.ys[a] < this.ys[b]);
  }

  private cross(a: number, b: number, c: number) {
    return (this.xs[b] - this.xs[a]) * (this.ys[c] - this.ys[a]) -
      (this.ys[b] - this.ys[a]) * (this.xs[c] - this.xs[a]);
  }

  /** Monotone-chain hull of the eight projected corners. */
  private buildHull() {
    const order = this.order;
    for (let i = 0; i < 8; i++) order[i] = i;
    for (let i = 1; i < 8; i++) {
      const value = order[i];
      let j = i - 1;
      while (j >= 0 && this.less(value, order[j])) {
        order[j + 1] = order[j];
        j--;
      }
      order[j + 1] = value;
    }
    const hull = this.hull;
    let count = 0;
    for (let i = 0; i < 8; i++) {
      const k = order[i];
      while (count >= 2 && this.cross(hull[count - 2], hull[count - 1], k) <= 0) count--;
      hull[count++] = k;
    }
    const upper = count + 1;
    for (let i = 6; i >= 0; i--) {
      const k = order[i];
      while (count >= upper && count >= 2 && this.cross(hull[count - 2], hull[count - 1], k) <= 0) count--;
      hull[count++] = k;
    }
    return count - 1;
  }

  /** X span where the hull crosses the horizontal line `y`. */
  private rangeAt(y: number, hullN: number) {
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < hullN; i++) {
      const a = this.hull[i];
      const b = this.hull[(i + 1) % hullN];
      const ya = this.ys[a];
      const yb = this.ys[b];
      if (ya === yb) continue;
      if (y <= Math.min(ya, yb) || y >= Math.max(ya, yb)) continue;
      const t = (y - ya) / (yb - ya);
      const x = this.xs[a] + (this.xs[b] - this.xs[a]) * t;
      if (x < lo) lo = x;
      if (x > hi) hi = x;
    }
    this.rangeLo = lo;
    this.rangeHi = hi;
    return hi >= lo;
  }

  /**
   * Project the box once and cache its corners in `slot` for the claim pass
   * and the later test pass. False when any corner crosses the near plane:
   * the caller must then treat the box as occluder-invalid and keep it as a
   * visible occludee, exactly as before.
   */
  cacheBox(min: THREE.Vector3, max: THREE.Vector3, matrix: THREE.Matrix4, slot: number): boolean {
    if (slot >= this.slotValid.length) {
      const capacity = Math.max(slot + 1, this.slotValid.length * 2, 64);
      const xs = new Float32Array(capacity * 8);
      xs.set(this.slotXs);
      this.slotXs = xs;
      const ys = new Float32Array(capacity * 8);
      ys.set(this.slotYs);
      this.slotYs = ys;
      const zs = new Float32Array(capacity * 8);
      zs.set(this.slotZs);
      this.slotZs = zs;
      const valid = new Uint8Array(capacity);
      valid.set(this.slotValid);
      this.slotValid = valid;
    }
    const ok = this.project(min, max, matrix);
    this.slotValid[slot] = ok ? 1 : 0;
    if (!ok) return false;
    this.slotXs.set(this.xs, slot * 8);
    this.slotYs.set(this.ys, slot * 8);
    this.slotZs.set(this.zs, slot * 8);
    return true;
  }

  /** Restore a cached slot into the working corners. */
  private loadSlot(slot: number) {
    this.xs.set(this.slotXs.subarray(slot * 8, slot * 8 + 8));
    this.ys.set(this.slotYs.subarray(slot * 8, slot * 8 + 8));
    this.zs.set(this.slotZs.subarray(slot * 8, slot * 8 + 8));
  }

  /**
   * Claim every grid cell the solid box fully covers, remembering its far
   * depth. Returns false when nothing claimable was found (near-plane crossing
   * or a silhouette narrower than a cell).
   */
  addBox(min: THREE.Vector3, max: THREE.Vector3, matrix: THREE.Matrix4) {
    if (!this.project(min, max, matrix)) return false;
    return this.claim();
  }

  /** Claim cells for a box projected by cacheBox (same arithmetic as addBox). */
  claimCached(slot: number) {
    if (!this.slotValid[slot]) return false;
    this.loadSlot(slot);
    return this.claim();
  }

  private claim() {
    const hullN = this.buildHull();
    if (hullN < 3) return false;
    let far = 0;
    let top = Infinity;
    let bottom = -Infinity;
    for (let i = 0; i < 8; i++) {
      if (this.zs[i] > far) far = this.zs[i];
      if (this.ys[i] < top) top = this.ys[i];
      if (this.ys[i] > bottom) bottom = this.ys[i];
    }
    const firstRow = Math.max(0, Math.ceil((top + EDGE_MARGIN) / CELL));
    const lastRow = Math.min(this.rows - 1, Math.floor((bottom - EDGE_MARGIN) / CELL));
    let claimed = 0;
    for (let row = firstRow; row <= lastRow; row++) {
      const yTop = row * CELL;
      if (!this.rangeAt(yTop, hullN)) continue;
      const loTop = this.rangeLo;
      const hiTop = this.rangeHi;
      if (!this.rangeAt(yTop + CELL, hullN)) continue;
      // Both horizontal cell edges inside the hull: convexity puts the whole
      // cell inside. The extra margin absorbs projection rounding.
      const lo = Math.max(loTop, this.rangeLo) + EDGE_MARGIN;
      const hi = Math.min(hiTop, this.rangeHi) - EDGE_MARGIN;
      if (hi <= lo) continue;
      const firstCol = Math.max(0, Math.ceil(lo / CELL));
      const lastCol = Math.min(this.cols - 1, Math.floor(hi / CELL) - 1);
      for (let col = firstCol; col <= lastCol; col++) {
        const index = row * this.cols + col;
        if (far < this.depth[index]) this.depth[index] = far;
        claimed++;
      }
    }
    if (claimed) this.occluders++;
    this.claimed += claimed;
    return claimed > 0;
  }

  /** Claim every cell an opaque overlay rectangle fully covers (depth 0). */
  addRect(rect: ScreenRect) {
    const firstCol = Math.max(0, Math.ceil(rect.left / CELL));
    const lastCol = Math.min(this.cols - 1, Math.floor(rect.right / CELL) - 1);
    const firstRow = Math.max(0, Math.ceil(rect.top / CELL));
    const lastRow = Math.min(this.rows - 1, Math.floor(rect.bottom / CELL) - 1);
    if (lastCol < firstCol || lastRow < firstRow) return false;
    let claimed = 0;
    for (let row = firstRow; row <= lastRow; row++) {
      const base = row * this.cols;
      for (let col = firstCol; col <= lastCol; col++) {
        const index = base + col;
        if (0 < this.depth[index]) this.depth[index] = 0;
        claimed++;
      }
    }
    if (claimed) this.occluders++;
    this.claimed += claimed;
    return claimed > 0;
  }

  /**
   * True when every screen cell the box touches is already painted by a
   * strictly nearer occluder. Outer (bounding box) footprint: cells outside the
   * true silhouette only ever reduce culling, never over-cull.
   */
  hidden(min: THREE.Vector3, max: THREE.Vector3, matrix: THREE.Matrix4) {
    if (!this.project(min, max, matrix)) return false;
    return this.test();
  }

  /** Test a box projected by cacheBox (same arithmetic as hidden). */
  testCached(slot: number) {
    if (!this.slotValid[slot]) return false;
    this.loadSlot(slot);
    return this.test();
  }

  private test() {
    let left = Infinity;
    let right = -Infinity;
    let top = Infinity;
    let bottom = -Infinity;
    let near = Infinity;
    for (let i = 0; i < 8; i++) {
      if (this.xs[i] < left) left = this.xs[i];
      if (this.xs[i] > right) right = this.xs[i];
      if (this.ys[i] < top) top = this.ys[i];
      if (this.ys[i] > bottom) bottom = this.ys[i];
      if (this.zs[i] < near) near = this.zs[i];
    }
    const firstCol = Math.max(0, Math.floor(left / CELL));
    const lastCol = Math.min(this.cols - 1, Math.ceil(right / CELL) - 1);
    const firstRow = Math.max(0, Math.floor(top / CELL));
    const lastRow = Math.min(this.rows - 1, Math.ceil(bottom / CELL) - 1);
    if (lastCol < firstCol || lastRow < firstRow) return true;
    const limit = near - DEPTH_EPS;
    for (let row = firstRow; row <= lastRow; row++) {
      const base = row * this.cols;
      for (let col = firstCol; col <= lastCol; col++) {
        if (this.depth[base + col] >= limit) return false;
      }
    }
    return true;
  }
}
