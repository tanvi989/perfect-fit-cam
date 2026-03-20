/**
 * Live PD geometry from MediaPipe FaceMesh iris rings — mirrors backend iris_landmark_service
 * (min enclosing circle on 5 ring points, horizontal vs Euclidean PD rule).
 */

export const IRIS_DIAMETER_MM = 11.77;
export const KNOWN_FACE_WIDTH_MM = 145.0;
export const IPD_TO_FACE_WIDTH_PRIOR = 62.5 / 145.0;
/** Above this eye_dy / face_width ratio, server uses Euclidean IPD px (see iris_landmark_service). */
export const LEVEL_RATIO_EUCLIDEAN_THRESHOLD = 0.028;

export const L_IRIS_IDX = [468, 469, 470, 471, 472] as const;
export const R_IRIS_IDX = [473, 474, 475, 476, 477] as const;
export const R_CHEEK = 234;
export const L_CHEEK = 454;

type Pt = { x: number; y: number };

function dist2(a: Pt, b: Pt): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function circleFrom2(p1: Pt, p2: Pt): { cx: number; cy: number; r: number } {
  return {
    cx: (p1.x + p2.x) / 2,
    cy: (p1.y + p2.y) / 2,
    r: Math.hypot(p1.x - p2.x, p1.y - p2.y) / 2,
  };
}

/** Circumcircle of three points; null if nearly collinear. */
function circleFrom3(a: Pt, b: Pt, c: Pt): { cx: number; cy: number; r: number } | null {
  const ax = a.x;
  const ay = a.y;
  const bx = b.x;
  const by = b.y;
  const cx = c.x;
  const cy = c.y;
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(d) < 1e-10) return null;
  const aSq = ax * ax + ay * ay;
  const bSq = bx * bx + by * by;
  const cSq = cx * cx + cy * cy;
  const ux = (aSq * (by - cy) + bSq * (cy - ay) + cSq * (ay - by)) / d;
  const uy = (aSq * (cx - bx) + bSq * (ax - cx) + cSq * (bx - ax)) / d;
  const r = Math.hypot(ux - ax, uy - ay);
  if (!Number.isFinite(r) || r <= 0) return null;
  return { cx: ux, cy: uy, r };
}

function allInside(c: { cx: number; cy: number; r: number }, pts: Pt[], eps = 1e-5): boolean {
  const r2 = (c.r + eps) * (c.r + eps);
  return pts.every((p) => dist2(p, { x: c.cx, y: c.cy }) <= r2);
}

/** Minimum enclosing circle (≤8 points): boundary has 2 or 3 points — exhaustive like OpenCV for tiny n. */
export function minEnclosingCircle(pts: Pt[]): { cx: number; cy: number; r: number } {
  const n = pts.length;
  if (n === 0) return { cx: 0, cy: 0, r: 0 };
  if (n === 1) return { cx: pts[0].x, cy: pts[0].y, r: 0 };

  let best: { cx: number; cy: number; r: number } | null = null;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const c = circleFrom2(pts[i], pts[j]);
      if (allInside(c, pts) && (best == null || c.r < best.r)) best = c;
    }
  }

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      for (let k = j + 1; k < n; k++) {
        const c = circleFrom3(pts[i], pts[j], pts[k]);
        if (c && allInside(c, pts) && (best == null || c.r < best.r)) best = c;
      }
    }
  }

  return best ?? { cx: pts[0].x, cy: pts[0].y, r: 0 };
}

export interface LivePdGeometryDebug {
  videoWidth: number;
  videoHeight: number;
  leftIrisCenterPx: { x: number; y: number };
  rightIrisCenterPx: { x: number; y: number };
  irisDiameterLeftPx: number;
  irisDiameterRightPx: number;
  irisDiameterMeanPx: number;
  pdPxHorizontal: number;
  pdPxEuclidean: number;
  pdPxUsed: number;
  pdGeometry: 'horizontal_primary' | 'euclidean';
  eyeDyPx: number;
  faceWidthCheekPx: number;
  levelRatio: number;
  /** Iris-ruler PD preview (mm), same formula as server before hint/prior blend */
  pdMmIrisScaleOnly: number;
  /** Face-width–ruler PD preview (mm) */
  pdMmFaceScaleOnly: number;
  /** mm/px if we only trusted iris ruler: IRIS_DIAMETER_MM / irisDiameterMeanPx */
  sIrisMmPerPx: number;
  sFaceMmPerPx: number;
  /** IPD px / iris diam — expect ~5–7 frontal */
  ipdOverIrisDiam: number;
  pdRatioOk: boolean;
}

function ringPointsPx(meshLm: Array<{ x: number; y: number }>, idxs: readonly number[], w: number, h: number): Pt[] {
  return idxs.map((i) => ({ x: meshLm[i].x * w, y: meshLm[i].y * h }));
}

function irisCenterAndDiameterPx(meshLm: Array<{ x: number; y: number }>, idxs: readonly number[], w: number, h: number) {
  const pts = ringPointsPx(meshLm, idxs, w, h);
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  const circ = minEnclosingCircle(pts);
  const diam = Math.max(2 * circ.r, 1e-3);
  return { center: { x: cx, y: cy }, diameterPx: diam };
}

/** Full-res-geometry snapshot matching server (float px; server uses int-rounded landmarks — small delta possible). */
export function computeLivePdGeometry(
  meshLm: Array<{ x: number; y: number }>,
  videoW: number,
  videoH: number,
): LivePdGeometryDebug | null {
  if (!meshLm || meshLm.length < 478 || videoW <= 0 || videoH <= 0) return null;

  const left = irisCenterAndDiameterPx(meshLm, L_IRIS_IDX, videoW, videoH);
  const right = irisCenterAndDiameterPx(meshLm, R_IRIS_IDX, videoW, videoH);
  const irisMean = (left.diameterPx + right.diameterPx) / 2;

  const l = left.center;
  const r = right.center;
  const pdPxHoriz = Math.abs(l.x - r.x);
  const pdPxEucl = Math.hypot(l.x - r.x, l.y - r.y);
  const eyeDy = Math.abs(l.y - r.y);

  const cheekR = meshLm[R_CHEEK];
  const cheekL = meshLm[L_CHEEK];
  const fwPx = Math.hypot((cheekR.x - cheekL.x) * videoW, (cheekR.y - cheekL.y) * videoH);

  const levelRatio = eyeDy / Math.max(fwPx, 1e-6);
  let pdPxUsed: number;
  let pdGeometry: 'horizontal_primary' | 'euclidean';
  if (levelRatio < LEVEL_RATIO_EUCLIDEAN_THRESHOLD) {
    pdPxUsed = 0.88 * pdPxHoriz + 0.12 * pdPxEucl;
    pdGeometry = 'horizontal_primary';
  } else {
    pdPxUsed = pdPxEucl;
    pdGeometry = 'euclidean';
  }

  const sIris = IRIS_DIAMETER_MM / Math.max(irisMean, 1e-3);
  const sFace = KNOWN_FACE_WIDTH_MM / Math.max(fwPx, 1e-6);
  const pdMmIris = pdPxUsed * sIris;
  const pdMmFace = pdPxUsed * sFace;
  const ratio = pdPxUsed / Math.max(irisMean, 1e-6);
  const pdRatioOk = ratio >= 4.2 && ratio <= 8.5;

  return {
    videoWidth: videoW,
    videoHeight: videoH,
    leftIrisCenterPx: { x: l.x, y: l.y },
    rightIrisCenterPx: { x: r.x, y: r.y },
    irisDiameterLeftPx: left.diameterPx,
    irisDiameterRightPx: right.diameterPx,
    irisDiameterMeanPx: irisMean,
    pdPxHorizontal: pdPxHoriz,
    pdPxEuclidean: pdPxEucl,
    pdPxUsed,
    pdGeometry,
    eyeDyPx: eyeDy,
    faceWidthCheekPx: fwPx,
    levelRatio,
    pdMmIrisScaleOnly: pdMmIris,
    pdMmFaceScaleOnly: pdMmFace,
    sIrisMmPerPx: sIris,
    sFaceMmPerPx: sFace,
    ipdOverIrisDiam: ratio,
    pdRatioOk,
  };
}
