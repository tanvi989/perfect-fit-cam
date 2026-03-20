import type { LivePdGeometryDebug } from '@/lib/irisGeometry';

/** Iris positions, IPD px, diameters, and scale — for admin debug on results. */
export type IrisPdSummary = {
  detected: boolean;
  source: 'live_preview' | 'server_image' | null;
  left: { x: number; y: number } | null;
  right: { x: number; y: number } | null;
  distancePx: number | null;
  mmPerPixel: number | null;
  irisDiameterLeftPx: number | null;
  irisDiameterRightPx: number | null;
  irisDiameterMeanPx: number | null;
};

function asFiniteNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  return null;
}

function parseTraceIrisCenter(raw: unknown): { x: number; y: number } | null {
  if (Array.isArray(raw) && raw.length >= 2) {
    const x = Number(raw[0]);
    const y = Number(raw[1]);
    if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
  }
  return null;
}

export function pickIrisPdSummary(capturedData: {
  livePdDebug?: LivePdGeometryDebug | null;
  apiResponse?: {
    landmarks?: {
      debug?: {
        pd_calculation_trace?: {
          pixels?: Record<string, unknown>;
          intermediate_mm?: Record<string, unknown>;
        };
      };
      scale?: {
        mm_per_pixel?: number | null;
        iris_diameter_px?: number | null;
        iris_diameter_left_px?: number | null;
        iris_diameter_right_px?: number | null;
        pd_px_used?: number | null;
        pd_px_euclidean?: number | null;
        pd_px_euclidean_raw?: number | null;
      };
    };
  };
}): IrisPdSummary {
  const live = capturedData.livePdDebug;
  if (live) {
    return {
      detected: true,
      source: 'live_preview',
      left: { x: live.leftIrisCenterPx.x, y: live.leftIrisCenterPx.y },
      right: { x: live.rightIrisCenterPx.x, y: live.rightIrisCenterPx.y },
      distancePx: live.pdPxUsed,
      mmPerPixel: Number.isFinite(live.sIrisMmPerPx) ? live.sIrisMmPerPx : null,
      irisDiameterLeftPx: live.irisDiameterLeftPx,
      irisDiameterRightPx: live.irisDiameterRightPx,
      irisDiameterMeanPx: live.irisDiameterMeanPx,
    };
  }

  const pixels = capturedData.apiResponse?.landmarks?.debug?.pd_calculation_trace?.pixels as
    | Record<string, unknown>
    | undefined;
  const intermediate = capturedData.apiResponse?.landmarks?.debug?.pd_calculation_trace?.intermediate_mm as
    | Record<string, unknown>
    | undefined;
  const left = pixels ? parseTraceIrisCenter(pixels.left_iris_center) : null;
  const right = pixels ? parseTraceIrisCenter(pixels.right_iris_center) : null;
  const sc = capturedData.apiResponse?.landmarks?.scale;
  const scRec = sc as Record<string, unknown> | undefined;
  let distancePx: number | null = null;
  if (sc?.pd_px_used != null && Number.isFinite(Number(sc.pd_px_used))) {
    distancePx = Number(sc.pd_px_used);
  } else if (pixels != null && typeof pixels.pd_px_used === 'number' && Number.isFinite(pixels.pd_px_used)) {
    distancePx = pixels.pd_px_used;
  } else if (sc?.pd_px_euclidean_raw != null && Number.isFinite(Number(sc.pd_px_euclidean_raw))) {
    distancePx = Number(sc.pd_px_euclidean_raw);
  } else if (sc?.pd_px_euclidean != null && Number.isFinite(Number(sc.pd_px_euclidean))) {
    distancePx = Number(sc.pd_px_euclidean);
  } else if (pixels != null && typeof pixels.pd_px_euclidean === 'number' && Number.isFinite(pixels.pd_px_euclidean)) {
    distancePx = pixels.pd_px_euclidean;
  }

  let mmPerPixel: number | null = null;
  if (sc?.mm_per_pixel != null && Number.isFinite(Number(sc.mm_per_pixel))) {
    mmPerPixel = Number(sc.mm_per_pixel);
  } else if (
    intermediate != null &&
    typeof intermediate.s_iris_mm_per_px === 'number' &&
    Number.isFinite(intermediate.s_iris_mm_per_px)
  ) {
    mmPerPixel = intermediate.s_iris_mm_per_px;
  }

  let irisDiameterLeftPx = pixels != null ? asFiniteNumber(pixels.iris_diameter_left) : null;
  let irisDiameterRightPx = pixels != null ? asFiniteNumber(pixels.iris_diameter_right) : null;
  let irisDiameterMeanPx = pixels != null ? asFiniteNumber(pixels.iris_diameter_mean) : null;
  if (irisDiameterLeftPx == null) irisDiameterLeftPx = asFiniteNumber(scRec?.iris_diameter_left_px);
  if (irisDiameterRightPx == null) irisDiameterRightPx = asFiniteNumber(scRec?.iris_diameter_right_px);
  if (irisDiameterMeanPx == null) irisDiameterMeanPx = asFiniteNumber(scRec?.iris_diameter_px);
  if (
    irisDiameterMeanPx == null &&
    irisDiameterLeftPx != null &&
    irisDiameterRightPx != null
  ) {
    irisDiameterMeanPx = (irisDiameterLeftPx + irisDiameterRightPx) / 2;
  }

  if (left && right) {
    if (distancePx == null) {
      distancePx = Math.hypot(right.x - left.x, right.y - left.y);
    }
    return {
      detected: true,
      source: 'server_image',
      left,
      right,
      distancePx,
      mmPerPixel,
      irisDiameterLeftPx,
      irisDiameterRightPx,
      irisDiameterMeanPx,
    };
  }

  return {
    detected: false,
    source: null,
    left,
    right,
    distancePx,
    mmPerPixel,
    irisDiameterLeftPx,
    irisDiameterRightPx,
    irisDiameterMeanPx,
  };
}
