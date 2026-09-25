import {
  SCAN_FROM,
  SCAN_TO,
  SCAN_CORNERS,
  type DecryptionFrame,
} from "./decryption";

export function inspectionSegments(frame: DecryptionFrame) {
  const point = (t: number): [number, number] => [
    SCAN_FROM[0] + (SCAN_TO[0] - SCAN_FROM[0]) * t,
    SCAN_FROM[1] + (SCAN_TO[1] - SCAN_FROM[1]) * t,
  ];
  return frame.intervals.map(([a, b]) => [point(a), point(b)] as const);
}

export class InspectionOverlay {
  private root = document.querySelector<SVGSVGElement>("#inspection-marks")!;
  private line = this.root.querySelector<SVGPathElement>("#inspection-lines")!;
  private corners = this.root.querySelector<SVGGElement>(
    "#inspection-corners",
  )!;
  private point =
    this.root.querySelector<SVGCircleElement>("#inspection-point")!;
  private label = document.querySelector<HTMLElement>("#inspection-text")!;
  private labelText = this.label.querySelector<HTMLElement>("strong")!;
  private host = document.querySelector<HTMLElement>("#three-scene")!;

  // The overlay is rendered every animation frame but only changes while the
  // scan runs. Every value is compared against the committed one so an idle
  // frame performs no DOM writes and no forced layout.
  private viewBox = "";
  private sizeDirty = true;
  private phase = "";
  private time = "";
  private path = "";
  private cornerMarkup = "";
  private pointPosition = "";
  private rootOpacity = "";
  private cornersOpacity = "";
  private pointOpacity = "";
  private labelOpacity = "";
  private valueOpacity = "";

  constructor() {
    // Reading clientWidth every frame flushes layout; observe the host instead
    // and re-measure only when its box actually changes.
    new ResizeObserver(() => {
      this.sizeDirty = true;
    }).observe(this.host);
  }

  render(
    frame: DecryptionFrame,
    project: (x: number, y: number) => number[],
    showLabel: boolean,
  ) {
    const visible =
      frame.intervals.length > 0 || frame.markers > 0 || frame.point > 0;
    const rootOpacity = visible ? "1" : "0";
    const cornersOpacity = String(frame.markers);
    const pointOpacity = String(frame.point);
    const labelOpacity = showLabel ? String(frame.label) : "0";
    const valueOpacity = String(frame.labelValue);

    if (rootOpacity !== this.rootOpacity) {
      this.root.style.opacity = rootOpacity;
      this.rootOpacity = rootOpacity;
    }
    const phase = frame.phase;
    if (phase !== this.phase) {
      this.root.dataset.phase = phase;
      this.phase = phase;
    }
    const time = frame.time.toFixed(3);
    if (time !== this.time) {
      this.root.dataset.referenceTime = time;
      this.time = time;
    }
    if (cornersOpacity !== this.cornersOpacity) {
      this.corners.style.opacity = cornersOpacity;
      this.cornersOpacity = cornersOpacity;
    }
    if (pointOpacity !== this.pointOpacity) {
      this.point.style.opacity = pointOpacity;
      this.pointOpacity = pointOpacity;
    }
    if (labelOpacity !== this.labelOpacity) {
      this.label.style.opacity = labelOpacity;
      this.labelOpacity = labelOpacity;
    }
    if (valueOpacity !== this.valueOpacity) {
      this.labelText.style.opacity = valueOpacity;
      this.valueOpacity = valueOpacity;
    }

    if (!visible) {
      // Clear the geometry once when the scan disappears; idle frames below
      // then cost nothing but the comparisons above.
      if (this.path) {
        this.line.setAttribute("d", "");
        this.path = "";
      }
      if (this.cornerMarkup) {
        this.corners.innerHTML = "";
        this.cornerMarkup = "";
      }
      if (this.pointPosition) {
        this.point.removeAttribute("cx");
        this.point.removeAttribute("cy");
        this.pointPosition = "";
      }
      return;
    }

    if (this.sizeDirty) {
      const viewBox = `0 0 ${this.host.clientWidth} ${this.host.clientHeight}`;
      if (viewBox !== this.viewBox) {
        this.root.setAttribute("viewBox", viewBox);
        this.viewBox = viewBox;
      }
      this.sizeDirty = false;
    }

    const path = inspectionSegments(frame)
      .map(([a, b]) => `M${project(...a)}L${project(...b)}`)
      .join("");
    if (path !== this.path) {
      this.line.setAttribute("d", path);
      this.path = path;
    }

    const cornerMarkup =
      frame.markers > 0
        ? SCAN_CORNERS.map(([x, y]) => {
            const [px, py] = project(x, y);
            return `<rect x="${px - 4}" y="${py - 4}" width="8" height="8"/>`;
          }).join("")
        : "";
    if (cornerMarkup !== this.cornerMarkup) {
      this.corners.innerHTML = cornerMarkup;
      this.cornerMarkup = cornerMarkup;
    }

    if (frame.point > 0) {
      const [cx, cy] = project(
        (SCAN_FROM[0] + SCAN_TO[0]) / 2,
        (SCAN_FROM[1] + SCAN_TO[1]) / 2,
      );
      const position = `${cx},${cy}`;
      if (position !== this.pointPosition) {
        this.point.setAttribute("cx", String(cx));
        this.point.setAttribute("cy", String(cy));
        this.pointPosition = position;
      }
    } else if (this.pointPosition) {
      this.point.removeAttribute("cx");
      this.point.removeAttribute("cy");
      this.pointPosition = "";
    }
  }
}
