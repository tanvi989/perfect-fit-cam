/**
 * Live PD geometry from MediaPipe FaceMesh iris rings — aligned with
 * `mf_backend/app/services/iris_landmark_service.py` (iris edge chords + eye-aperture sanity).
 * Used for WebAR-style overlays and pd_hint_mm; not a substitute for server processing.
 */

export const IRIS_DIAMETER_MM = 11.77;
export const KNOWN_FACE_WIDTH_MM = 145.0;
export const IPD_TO_FACE_WIDTH_PRIOR = 62.5 / 145.0;
/** Above this eye_dy / face_width ratio, server uses Euclidean IPD px (see iris_landmark_service). */
export const LEVEL_RATIO_EUCLIDEAN_THRESHOLD = 0.028;

/** Typical adult binocular PD band (screening / retail) — matches backend */
export const PD_ADULT_MIN_MM = 54;
export const PD_ADULT_MAX_MM = 74;
/** Child / small-head heuristic — matches backend `iris_landmark_service.py` */
export const PD_PEDIATRIC_MIN_MM = 40;
export const PD_PEDIATRIC_MAX_MM = 58;
export const PEDiatric_FACE_MM_IRIS_MAX = 118;
export const PEDiatric_IPD_OVER_FACE_MAX = 0.37;
export const IRIS_DIAMETER_MM_PEDIATRIC = 11.12;
export const PEDiatric_IPD_TO_FACE_RATIO = 0.415;
export const PEDiatric_PRIOR_BLEND = 0.48;
/** Match backend — wide cheek span + elevated IPD/cheek */
export const PEDiatric_FACE_MM_IRIS_WIDE_MAX = 172.0;
export const PEDiatric_IPD_TO_CHEEK_MIN = 0.46;

/** Match `iris_landmark_service.py` — when IPD/iris Ø ratio is too high, iris px is often underestimated */
export const IPD_OVER_IRIS_DIAM_RATIO_WARN = 6.65;
export const IPD_OVER_IRIS_DIAM_RATIO_TARGET = 5.12;
export const IPD_IRIS_DIAM_MAX_SCALEUP = 1.52;

export const L_IRIS_IDX = [468, 469, 470, 471, 472] as const;
export const R_IRIS_IDX = [473, 474, 475, 476, 477] as const;
/** Canonical iris centres for binocular IPD (px) — match clinical PD / backend */
export const L_IRIS_CENTER_IDX = 468;
export const R_IRIS_CENTER_IDX = 473;
export const R_CHEEK = 234;
export const L_CHEEK = 454;
/** Eye aperture (horizontal) — iris diameter must be a fraction of this, not the whole eye */
export const L_EYE_OUTER_INNER = [33, 133] as const;
export const R_EYE_OUTER_INNER = [263, 362] as const;

const IRIS_DIAM_MIN_FRAC_EYE = 0.2;
const IRIS_DIAM_MAX_FRAC_EYE = 0.52;

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

function eyeOpeningPx(
  meshLm: Array<{ x: number; y: number }>,
  pair: readonly [number, number],
  w: number,
  h: number,
): number {
  const a = meshLm[pair[0]];
  const b = meshLm[pair[1]];
  return Math.hypot((a.x - b.x) * w, (a.y - b.y) * h);
}

function adjustIrisDiameterVsEye(
  diamPx: number,
  eyeOpeningPx: number,
): { diam: number; sanity: 'ok' | 'clamped_large_vs_eye' | 'clamped_small_vs_eye' | 'no_eye_width' } {
  if (eyeOpeningPx < 1e-3 || !Number.isFinite(eyeOpeningPx)) {
    return { diam: Math.max(diamPx, 1e-3), sanity: 'no_eye_width' };
  }
  const frac = diamPx / eyeOpeningPx;
  if (frac >= IRIS_DIAM_MIN_FRAC_EYE && frac <= IRIS_DIAM_MAX_FRAC_EYE) {
    return { diam: diamPx, sanity: 'ok' };
  }
  if (frac > IRIS_DIAM_MAX_FRAC_EYE) {
    const adj = eyeOpeningPx * ((IRIS_DIAM_MIN_FRAC_EYE + IRIS_DIAM_MAX_FRAC_EYE) / 2);
    return { diam: Math.max(adj, 1e-3), sanity: 'clamped_large_vs_eye' };
  }
  // Same mid-band as "large" clamp — 0.2× eye is *below* a real limbus/eye ratio and inflates PD.
  const adj = eyeOpeningPx * ((IRIS_DIAM_MIN_FRAC_EYE + IRIS_DIAM_MAX_FRAC_EYE) / 2);
  return { diam: Math.max(adj, 1e-3), sanity: 'clamped_small_vs_eye' };
}

/**
 * Iris centre + diameter from limbus edge chords (matches Python backend).
 * Avoids minEnclosingCircle on all five points, which can expand to the whole eye aperture.
 */
function irisCenterAndDiameterEdgePx(
  meshLm: Array<{ x: number; y: number }>,
  idxs: readonly number[],
  w: number,
  h: number,
): { center: { x: number; y: number }; diameterPx: number } {
  const [, t, b, le, ri] = idxs;
  const pts = idxs.map((i) => ({ x: meshLm[i].x * w, y: meshLm[i].y * h }));
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;

  const pt = { x: meshLm[t].x * w, y: meshLm[t].y * h };
  const pb = { x: meshLm[b].x * w, y: meshLm[b].y * h };
  const pl = { x: meshLm[le].x * w, y: meshLm[le].y * h };
  const pr = { x: meshLm[ri].x * w, y: meshLm[ri].y * h };

  const dH = Math.hypot(pr.x - pl.x, pr.y - pl.y);
  const dV = Math.hypot(pb.x - pt.x, pb.y - pt.y);
  const diamEdges = 0.65 * dH + 0.35 * dV;

  const circ = minEnclosingCircle([pt, pb, pl, pr]);
  const diamCircleEdges = Math.max(2 * circ.r, 1e-3);

  let diam: number;
  if (diamCircleEdges > 1.25 * Math.max(diamEdges, 1e-3)) {
    diam = diamEdges;
  } else {
    diam = 0.5 * (diamEdges + diamCircleEdges);
  }

  return { center: { x: cx, y: cy }, diameterPx: Math.max(diam, 1e-3) };
}

function likelyPediatric(fwMmFromIris: number, pdPx: number, fwPx: number): boolean {
  if (fwMmFromIris < PEDiatric_FACE_MM_IRIS_MAX) return true;
  const r = pdPx / Math.max(fwPx, 1e-6);
  if (fwMmFromIris < 128.0 && r < PEDiatric_IPD_OVER_FACE_MAX) return true;
  if (
    fwMmFromIris >= PEDiatric_FACE_MM_IRIS_MAX &&
    fwMmFromIris < PEDiatric_FACE_MM_IRIS_WIDE_MAX &&
    r >= PEDiatric_IPD_TO_CHEEK_MIN
  ) {
    return true;
  }
  return false;
}

function correctIrisMeanForIpdRatio(irisMeanPx: number, pdPx: number): { mean: number; note: string } {
  if (pdPx <= 0 || irisMeanPx <= 0) return { mean: Math.max(irisMeanPx, 1e-3), note: 'skip' };
  const r = pdPx / irisMeanPx;
  if (r <= IPD_OVER_IRIS_DIAM_RATIO_WARN) return { mean: irisMeanPx, note: 'ok' };
  const scale = Math.min(r / IPD_OVER_IRIS_DIAM_RATIO_TARGET, IPD_IRIS_DIAM_MAX_SCALEUP);
  return { mean: Math.max(irisMeanPx * scale, 1e-3), note: 'ipd_ratio_iris_inflate' };
}

function arPreviewQuality(
  ratioOk: boolean,
  leftSanity: string,
  rightSanity: string,
  pdMm: number,
  pediatric: boolean,
): 'excellent' | 'good' | 'fair' {
  const inBand = pediatric
    ? pdMm >= PD_PEDIATRIC_MIN_MM && pdMm <= PD_PEDIATRIC_MAX_MM
    : pdMm >= PD_ADULT_MIN_MM && pdMm <= PD_ADULT_MAX_MM;
  const irisOk = leftSanity === 'ok' && rightSanity === 'ok';
  if (ratioOk && irisOk && inBand) return 'excellent';
  if (ratioOk && inBand) return 'good';
  if (ratioOk) return 'good';
  return 'fair';
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
  /** Adult typical band 54–74 mm (live preview, iris-scale) */
  pdInTypicalAdultRange: boolean;
  /** Heuristic: small iris-scaled face — child/small teen; adult band does not apply */
  likelyPediatricHeuristic: boolean;
  /** Rough child PD band ~40–58 mm when pediatric heuristic is true */
  pdInTypicalPediatricRange: boolean;
  /** WebAR-style quality tier */
  arPdPreviewQuality: 'excellent' | 'good' | 'fair';
  irisLeftSanity: string;
  irisRightSanity: string;
  /** After IPD/iris ratio correction (matches server when ratio was too high) */
  irisDiameterMeanPxCorrected: number;
  ipdIrisRatioCorrection: string;
}

/** Full-res-geometry snapshot matching server iris-edge + eye sanity (float px). */
export function computeLivePdGeometry(
  meshLm: Array<{ x: number; y: number }>,
  videoW: number,
  videoH: number,
): LivePdGeometryDebug | null {
  if (!meshLm || meshLm.length < 478 || videoW <= 0 || videoH <= 0) return null;

  const left = irisCenterAndDiameterEdgePx(meshLm, L_IRIS_IDX, videoW, videoH);
  const right = irisCenterAndDiameterEdgePx(meshLm, R_IRIS_IDX, videoW, videoH);

  const eyeLOpen = eyeOpeningPx(meshLm, L_EYE_OUTER_INNER, videoW, videoH);
  const eyeROpen = eyeOpeningPx(meshLm, R_EYE_OUTER_INNER, videoW, videoH);

  const adjL = adjustIrisDiameterVsEye(left.diameterPx, eyeLOpen);
  const adjR = adjustIrisDiameterVsEye(right.diameterPx, eyeROpen);

  const irisMean = (adjL.diam + adjR.diam) / 2;

  // IPD in px: iris centres 468/473 (not 5-point ring mean — avoids skewed PD vs scale)
  const l = { x: meshLm[L_IRIS_CENTER_IDX].x * videoW, y: meshLm[L_IRIS_CENTER_IDX].y * videoH };
  const r = { x: meshLm[R_IRIS_CENTER_IDX].x * videoW, y: meshLm[R_IRIS_CENTER_IDX].y * videoH };
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

  const fwMmEst = (fwPx * IRIS_DIAMETER_MM) / Math.max(irisMean, 1e-3);
  const likelyPediatricHeuristic = likelyPediatric(fwMmEst, pdPxUsed, fwPx);

  const { mean: irisMeanCorr, note: ratioCorrNote } = correctIrisMeanForIpdRatio(irisMean, pdPxUsed);

  const irisMmRef = likelyPediatricHeuristic ? IRIS_DIAMETER_MM_PEDIATRIC : IRIS_DIAMETER_MM;
  const sIris = irisMmRef / Math.max(irisMeanCorr, 1e-3);
  const sFace = KNOWN_FACE_WIDTH_MM / Math.max(fwPx, 1e-6);
  let pdMmIris = pdPxUsed * sIris;
  const fwMmIris = fwPx * sIris;
  if (likelyPediatricHeuristic) {
    const pdPed = PEDiatric_IPD_TO_FACE_RATIO * fwMmIris;
    pdMmIris = (1.0 - PEDiatric_PRIOR_BLEND) * pdMmIris + PEDiatric_PRIOR_BLEND * pdPed;
  }
  const pdMmFace = pdPxUsed * sFace;
  const ratio = pdPxUsed / Math.max(irisMeanCorr, 1e-6);
  const pdRatioOk = ratio >= 4.2 && ratio <= 8.5;

  const pdInTypicalAdultRange =
    !likelyPediatricHeuristic && pdMmIris >= PD_ADULT_MIN_MM && pdMmIris <= PD_ADULT_MAX_MM;
  const pdInTypicalPediatricRange =
    likelyPediatricHeuristic && pdMmIris >= PD_PEDIATRIC_MIN_MM && pdMmIris <= PD_PEDIATRIC_MAX_MM;
  const arPdPreviewQuality = arPreviewQuality(
    pdRatioOk,
    adjL.sanity,
    adjR.sanity,
    pdMmIris,
    likelyPediatricHeuristic,
  );

  return {
    videoWidth: videoW,
    videoHeight: videoH,
    leftIrisCenterPx: { x: l.x, y: l.y },
    rightIrisCenterPx: { x: r.x, y: r.y },
    irisDiameterLeftPx: adjL.diam,
    irisDiameterRightPx: adjR.diam,
    irisDiameterMeanPx: irisMean,
    irisDiameterMeanPxCorrected: irisMeanCorr,
    ipdIrisRatioCorrection: ratioCorrNote,
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
    pdInTypicalAdultRange,
    likelyPediatricHeuristic,
    pdInTypicalPediatricRange,
    arPdPreviewQuality,
    irisLeftSanity: adjL.sanity,
    irisRightSanity: adjR.sanity,
  };
}
