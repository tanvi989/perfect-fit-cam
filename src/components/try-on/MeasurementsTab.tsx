import { useCaptureData } from '@/context/CaptureContext';
import type {
  ApiClientCapture,
  ApiEmotionEstimate,
  ApiEyewearInsights,
  ApiGenderEstimate,
  LivePdGeometryDebug,
} from '@/types/face-validation';
import {
  Ruler,
  Eye,
  MoveHorizontal,
  Activity,
  Glasses,
  User,
  ShoppingBag,
  Smartphone,
  Smile,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

function formatEmotionLabel(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function pickEmotionEstimate(data: {
  emotion?: ApiEmotionEstimate;
  apiResponse?: { landmarks?: { emotion?: ApiEmotionEstimate }; emotion?: ApiEmotionEstimate };
}): ApiEmotionEstimate | null {
  const candidates = [
    data.emotion,
    data.apiResponse?.landmarks?.emotion,
    data.apiResponse?.emotion,
  ];
  for (const raw of candidates) {
    if (!raw || typeof raw !== 'object') continue;
    const label = (raw as ApiEmotionEstimate).label;
    if (typeof label === 'string' && label.trim().length > 0 && label.trim() !== 'unknown') {
      return { ...(raw as ApiEmotionEstimate), label: label.trim() };
    }
  }
  for (const raw of candidates) {
    if (!raw || typeof raw !== 'object') continue;
    const label = (raw as ApiEmotionEstimate).label;
    if (typeof label === 'string' && label.trim().length > 0) {
      return { ...(raw as ApiEmotionEstimate), label: label.trim() };
    }
  }
  return null;
}

function pickGenderEstimate(data: {
  gender?: ApiGenderEstimate;
  apiResponse?: { landmarks?: { gender?: ApiGenderEstimate }; gender?: ApiGenderEstimate };
}): ApiGenderEstimate | null {
  const candidates = [
    data.gender,
    data.apiResponse?.landmarks?.gender,
    data.apiResponse?.gender,
  ];
  for (const raw of candidates) {
    if (!raw || typeof raw !== 'object') continue;
    const label = (raw as ApiGenderEstimate).label;
    if (typeof label === 'string' && label.trim().length > 0) {
      return { ...(raw as ApiGenderEstimate), label: label.trim() };
    }
  }
  return null;
}

function pickEyewear(data: {
  eyewear?: ApiEyewearInsights;
  apiResponse?: { landmarks?: { eyewear?: ApiEyewearInsights } };
}): ApiEyewearInsights | null {
  const e = data.eyewear ?? data.apiResponse?.landmarks?.eyewear;
  if (!e || typeof e !== 'object') return null;
  return e;
}

function pickClientCapture(data: {
  clientCapture?: ApiClientCapture;
  apiResponse?: { landmarks?: { client_capture?: ApiClientCapture } };
}): ApiClientCapture | null {
  const c = data.clientCapture ?? data.apiResponse?.landmarks?.client_capture;
  if (!c || typeof c !== 'object') return null;
  return c;
}

function pickLivePdDebug(data: { livePdDebug?: LivePdGeometryDebug | null }): LivePdGeometryDebug | null {
  const l = data.livePdDebug;
  if (!l || typeof l !== 'object') return null;
  return l;
}

/** Iris positions + IPD px for the three summary lines above PD (live preview or server decoded image). */
type IrisPdSummary = {
  detected: boolean;
  source: 'live_preview' | 'server_image' | null;
  left: { x: number; y: number } | null;
  right: { x: number; y: number } | null;
  distancePx: number | null;
  /** Converts pixel chords in the capture plane → mm; divide by 10 for cm (iris-scale for live, API scale for server). */
  mmPerPixel: number | null;
};

function parseTraceIrisCenter(raw: unknown): { x: number; y: number } | null {
  if (Array.isArray(raw) && raw.length >= 2) {
    const x = Number(raw[0]);
    const y = Number(raw[1]);
    if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
  }
  return null;
}

function pickIrisPdSummary(capturedData: {
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
    };
  }

  return {
    detected: false,
    source: null,
    left,
    right,
    distancePx,
    mmPerPixel,
  };
}

export function MeasurementsTab() {
  const { capturedData } = useCaptureData();

  if (!capturedData) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">No measurement data available</p>
      </div>
    );
  }

  const { measurements, processedImageDataUrl, glassesDetected, faceShape } = capturedData;
  const gender = pickGenderEstimate(capturedData);
  const emotion = pickEmotionEstimate(capturedData);
  const eyewear = pickEyewear(capturedData);
  const clientCapture = pickClientCapture(capturedData);
  const livePdStored = pickLivePdDebug(capturedData);
  const irisPdSummary = pickIrisPdSummary(capturedData);

  // Helper to safely format numbers
  const formatMeasurement = (value: number | undefined, decimals: number = 1): string => {
    if (value === undefined || value === null || isNaN(value)) return 'N/A';
    return value.toFixed(decimals);
  };

  // Calculate confidence based on PD value range (typical adult PD is 54-74mm)
  const getConfidence = (pd: number | undefined): 'low' | 'medium' | 'high' => {
    if (pd === undefined || pd === null) return 'low';
    if (pd >= 54 && pd <= 74) return 'high';
    if (pd >= 48 && pd <= 80) return 'medium';
    return 'low';
  };

  const confidence = getConfidence(measurements?.pd);
  const scale = capturedData.apiResponse?.landmarks?.scale;
  const primaryPd = measurements?.pd;

  const deltaVsPrimary = (mm: number | undefined | null): string | null => {
    if (mm == null || Number.isNaN(mm) || primaryPd == null || Number.isNaN(primaryPd)) return null;
    const d = Math.abs(mm - primaryPd);
    return d < 0.05 ? 'Δ 0' : `Δ ${d.toFixed(1)}`;
  };

  const getConfidenceBadge = (conf: 'low' | 'medium' | 'high') => {
    const variants = {
      low: 'bg-destructive/10 text-destructive',
      medium: 'bg-yellow-500/10 text-yellow-600',
      high: 'bg-medical-success/10 text-medical-success',
    };
    return (
      <Badge variant="outline" className={variants[conf]}>
        {conf.charAt(0).toUpperCase() + conf.slice(1)} Confidence
      </Badge>
    );
  };

  return (
    <div className="space-y-6 p-4">
      {/* Captured Image */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              Processed Image
            </CardTitle>
            {glassesDetected && (
              <Badge variant="outline" className="bg-primary/10 text-primary">
                <Glasses className="h-3 w-3 mr-1" />
                Glasses Removed
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative rounded-lg overflow-hidden bg-muted aspect-video">
            <img
              src={processedImageDataUrl}
              alt="Processed face"
              className="w-full h-full object-cover"
            />
          </div>
        </CardContent>
      </Card>

      {/* PD Measurement */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <MoveHorizontal className="h-5 w-5 text-primary" />
              Pupillary Distance (PD)
            </CardTitle>
            {getConfidenceBadge(confidence)}
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <div className="text-left max-w-lg mx-auto mb-4 rounded-md border border-border/70 bg-muted/30 px-3 py-2.5 text-sm leading-relaxed">
              <p>
                <span className="text-muted-foreground">Iris detected:</span>{' '}
                <span className="font-semibold text-foreground">
                  {irisPdSummary.detected ? 'Yes' : 'No'}
                </span>
                {irisPdSummary.source === 'live_preview' && (
                  <span className="text-muted-foreground text-xs ml-1">(live preview)</span>
                )}
                {irisPdSummary.source === 'server_image' && (
                  <span className="text-muted-foreground text-xs ml-1">(server image)</span>
                )}
              </p>
              <p className="mt-1">
                <span className="text-muted-foreground">Iris left at</span>{' '}
                {irisPdSummary.left ? (
                  <>
                    x ={' '}
                    <span className="font-mono tabular-nums text-foreground">{irisPdSummary.left.x.toFixed(1)}</span> px, y
                    ={' '}
                    <span className="font-mono tabular-nums text-foreground">{irisPdSummary.left.y.toFixed(1)}</span> px
                  </>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
                <span className="text-muted-foreground"> · Iris right at</span>{' '}
                {irisPdSummary.right ? (
                  <>
                    x ={' '}
                    <span className="font-mono tabular-nums text-foreground">{irisPdSummary.right.x.toFixed(1)}</span> px, y
                    ={' '}
                    <span className="font-mono tabular-nums text-foreground">{irisPdSummary.right.y.toFixed(1)}</span> px
                  </>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </p>
              <p className="mt-1">
                <span className="text-muted-foreground">Distance between irises:</span>{' '}
                {irisPdSummary.distancePx != null && Number.isFinite(irisPdSummary.distancePx) ? (
                  <>
                    <span className="font-mono font-semibold tabular-nums text-foreground">
                      {irisPdSummary.distancePx.toFixed(2)}
                    </span>{' '}
                    px
                  </>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </p>
            </div>

            {(() => {
              const mm = irisPdSummary.mmPerPixel;
              const cmPerPx = mm != null && Number.isFinite(mm) ? mm / 10 : null;
              const fmtCm = (px: number | null | undefined) => {
                if (px == null || !Number.isFinite(px) || cmPerPx == null) return null;
                return (px * cmPerPx).toFixed(2);
              };
              const dCm =
                irisPdSummary.distancePx != null &&
                Number.isFinite(irisPdSummary.distancePx) &&
                cmPerPx != null
                  ? (irisPdSummary.distancePx * cmPerPx).toFixed(2)
                  : null;
              return (
                <div className="text-left max-w-lg mx-auto mb-4 rounded-md border border-border/70 bg-muted/20 px-3 py-2.5 text-sm leading-relaxed">
                  <p>
                    <span className="text-muted-foreground">Iris detected:</span>{' '}
                    <span className="font-semibold text-foreground">
                      {irisPdSummary.detected ? 'Yes' : 'No'}
                    </span>
                    {irisPdSummary.source === 'live_preview' && (
                      <span className="text-muted-foreground text-xs ml-1">(live preview)</span>
                    )}
                    {irisPdSummary.source === 'server_image' && (
                      <span className="text-muted-foreground text-xs ml-1">(server image)</span>
                    )}
                  </p>
                  <p className="mt-1">
                    <span className="text-muted-foreground">Iris left at</span>{' '}
                    {irisPdSummary.left && fmtCm(irisPdSummary.left.x) != null ? (
                      <>
                        x ={' '}
                        <span className="font-mono tabular-nums text-foreground">
                          {fmtCm(irisPdSummary.left.x)}
                        </span>{' '}
                        cm, y ={' '}
                        <span className="font-mono tabular-nums text-foreground">
                          {fmtCm(irisPdSummary.left.y)}
                        </span>{' '}
                        cm
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                    <span className="text-muted-foreground"> · Iris right at</span>{' '}
                    {irisPdSummary.right && fmtCm(irisPdSummary.right.x) != null ? (
                      <>
                        x ={' '}
                        <span className="font-mono tabular-nums text-foreground">
                          {fmtCm(irisPdSummary.right.x)}
                        </span>{' '}
                        cm, y ={' '}
                        <span className="font-mono tabular-nums text-foreground">
                          {fmtCm(irisPdSummary.right.y)}
                        </span>{' '}
                        cm
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </p>
                  <p className="mt-1">
                    <span className="text-muted-foreground">Distance between irises:</span>{' '}
                    {dCm != null ? (
                      <>
                        <span className="font-mono font-semibold tabular-nums text-foreground">{dCm}</span> cm
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1.5">
                    cm values use the iris-scale mm/px from the preview (live) or the API image (server); they describe
                    distances in the photo plane, not “cm from the lens.”
                  </p>
                </div>
              );
            })()}

            <div className="text-5xl font-bold text-primary">
              {formatMeasurement(measurements?.pd)}
              <span className="text-2xl font-normal text-muted-foreground ml-1">mm</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Total pupillary distance (primary — MediaPipe iris + geometry)
            </p>
            {capturedData.apiResponse?.landmarks?.scale?.pd_note && (
              <p className="text-xs text-muted-foreground mt-3 max-w-md mx-auto leading-relaxed">
                {capturedData.apiResponse.landmarks.scale.pd_note}
              </p>
            )}
            {livePdStored && (
              <div className="mt-4 rounded-lg border border-amber-500/35 bg-amber-500/[0.06] px-3 py-2 text-left max-w-lg mx-auto">
                <p className="text-xs font-semibold text-amber-900 dark:text-amber-100 mb-1">
                  Live preview at shutter (camera video — px)
                </p>
                <p className="text-[11px] text-muted-foreground leading-relaxed mb-2">
                  Saved from the last aligned frame before capture. The API row below uses the uploaded JPEG; resolution
                  and framing can differ slightly.
                </p>
                <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-xs">
                  <dt className="text-muted-foreground">Video frame</dt>
                  <dd className="font-mono text-right tabular-nums">
                    {livePdStored.videoWidth}×{livePdStored.videoHeight}
                  </dd>
                  <dt className="text-muted-foreground">L / R iris Ø (px)</dt>
                  <dd className="font-mono text-right tabular-nums">
                    {livePdStored.irisDiameterLeftPx.toFixed(2)} / {livePdStored.irisDiameterRightPx.toFixed(2)} (μ{' '}
                    {livePdStored.irisDiameterMeanPx.toFixed(2)})
                  </dd>
                  <dt className="text-muted-foreground">Iris centres (x, y) px</dt>
                  <dd className="font-mono text-right tabular-nums text-[10px]">
                    L {livePdStored.leftIrisCenterPx.x.toFixed(1)},{livePdStored.leftIrisCenterPx.y.toFixed(1)} · R{' '}
                    {livePdStored.rightIrisCenterPx.x.toFixed(1)},{livePdStored.rightIrisCenterPx.y.toFixed(1)}
                  </dd>
                  <dt className="text-muted-foreground">IPD px H / E / used</dt>
                  <dd className="font-mono text-right tabular-nums">
                    {livePdStored.pdPxHorizontal.toFixed(2)} / {livePdStored.pdPxEuclidean.toFixed(2)} /{' '}
                    <span className="font-semibold">{livePdStored.pdPxUsed.toFixed(2)}</span>
                  </dd>
                  <dt className="text-muted-foreground">Geometry · cheek W px</dt>
                  <dd className="text-right text-[11px]">
                    {livePdStored.pdGeometry} · {livePdStored.faceWidthCheekPx.toFixed(1)}
                  </dd>
                  <dt className="text-muted-foreground">s_iris / s_face (mm/px)</dt>
                  <dd className="font-mono text-right text-[10px]">
                    {livePdStored.sIrisMmPerPx.toFixed(4)} / {livePdStored.sFaceMmPerPx.toFixed(4)}
                  </dd>
                  <dt className="text-muted-foreground">Preview mm (iris / face ruler)</dt>
                  <dd className="font-mono text-right tabular-nums">
                    {livePdStored.pdMmIrisScaleOnly.toFixed(2)} / {livePdStored.pdMmFaceScaleOnly.toFixed(2)}
                  </dd>
                  <dt className="text-muted-foreground">IPD/Ø ratio</dt>
                  <dd className="font-mono text-right">
                    {livePdStored.ipdOverIrisDiam.toFixed(2)} {livePdStored.pdRatioOk ? '✓' : '⚠'}
                  </dd>
                </dl>
                {capturedData.pdHintMmSent != null && (
                  <p className="text-[11px] text-muted-foreground mt-2">
                    pd_hint sent:{' '}
                    <span className="font-mono text-foreground">{capturedData.pdHintMmSent.toFixed(1)} mm</span>
                  </p>
                )}
              </div>
            )}

            {(() => {
              const sc = capturedData.apiResponse?.landmarks?.scale;
              if (!sc || (sc.pd_px_used == null && sc.pd_px_horizontal == null)) return null;
              const fmt = (n: number | undefined | null) =>
                n != null && Number.isFinite(n) ? n.toFixed(1) : '—';
              return (
                <div className="mt-4 rounded-lg border border-border/80 bg-muted/40 px-3 py-2 text-left max-w-md mx-auto">
                  <p className="text-xs font-medium text-foreground mb-1.5">Server: iris IPD in uploaded photo (pixels)</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Values are in <span className="text-foreground/90">image pixels</span> at capture resolution
                    — they change with distance/zoom; mm PD uses these together with iris size.
                  </p>
                  <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-xs">
                    <dt className="text-muted-foreground">Used for mm scale</dt>
                    <dd className="font-mono text-right tabular-nums">{fmt(sc.pd_px_used)} px</dd>
                    <dt className="text-muted-foreground">Horizontal (Δx iris centres)</dt>
                    <dd className="font-mono text-right tabular-nums">{fmt(sc.pd_px_horizontal)} px</dd>
                    <dt className="text-muted-foreground">Euclidean (2D)</dt>
                    <dd className="font-mono text-right tabular-nums">
                      {fmt(sc.pd_px_euclidean_raw ?? sc.pd_px_euclidean)} px
                    </dd>
                    {sc.pd_geometry && (
                      <>
                        <dt className="text-muted-foreground">Geometry</dt>
                        <dd className="text-right text-[11px] capitalize">{sc.pd_geometry.replace(/_/g, ' ')}</dd>
                      </>
                    )}
                  </dl>
                </div>
              );
            })()}
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-border">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Left PD</p>
              <p className="text-2xl font-semibold text-foreground">
                {formatMeasurement(measurements?.pd_left)} mm
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Right PD</p>
              <p className="text-2xl font-semibold text-foreground">
                {formatMeasurement(measurements?.pd_right)} mm
              </p>
            </div>
          </div>

          {/* Second PD: Hugging Face ONNX (2d106 landmark pupil separation, same iris ruler) */}
          <div className="mt-5 pt-4 border-t border-border space-y-3">
            <p className="text-sm font-medium text-foreground">Hugging Face PD (2nd model)</p>
            {measurements?.pd_hf != null && !Number.isNaN(measurements.pd_hf) ? (
              <>
                <div className="flex flex-wrap items-baseline justify-center gap-2">
                  <span className="text-3xl font-bold text-foreground">{formatMeasurement(measurements.pd_hf)}</span>
                  <span className="text-muted-foreground">mm</span>
                  {capturedData.apiResponse?.landmarks?.scale?.pd_hf_delta_mm != null && (
                    <span className="text-xs text-muted-foreground">
                      Δ vs primary: {capturedData.apiResponse.landmarks.scale.pd_hf_delta_mm} mm
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center text-sm">
                    <p className="text-muted-foreground">Left (scaled split)</p>
                    <p className="text-lg font-semibold">{formatMeasurement(measurements?.pd_hf_left)} mm</p>
                  </div>
                  <div className="text-center text-sm">
                    <p className="text-muted-foreground">Right (scaled split)</p>
                    <p className="text-lg font-semibold">{formatMeasurement(measurements?.pd_hf_right)} mm</p>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center">
                Not available for this capture
                {capturedData.apiResponse?.landmarks?.scale?.pd_hf_error
                  ? ` — ${capturedData.apiResponse.landmarks.scale.pd_hf_error}`
                  : '.'}
              </p>
            )}
            {capturedData.apiResponse?.landmarks?.scale?.pd_hf_model && (
              <p className="text-xs text-muted-foreground text-center">
                {capturedData.apiResponse.landmarks.scale.pd_hf_model}
                {capturedData.apiResponse.landmarks.scale.pd_hf_method
                  ? ` · ${capturedData.apiResponse.landmarks.scale.pd_hf_method}`
                  : ''}
              </p>
            )}
            {capturedData.apiResponse?.landmarks?.scale?.pd_hf_note && (
              <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed text-center">
                {capturedData.apiResponse.landmarks.scale.pd_hf_note}
              </p>
            )}
          </div>

          {/* Same API response: extra PD estimates to compare (no extra hosting — not Northflank/BentoML/etc.). */}
          <div className="mt-5 pt-4 border-t border-border space-y-2">
            <p className="text-sm font-medium text-foreground">PD comparison (same capture)</p>
            <p className="text-xs text-muted-foreground max-w-lg mx-auto text-center leading-relaxed">
              Northflank, BentoML, Replicate, Modal, etc. are <span className="text-foreground">deployment platforms</span> for
              hosting models — they do not change the math. Below are <span className="text-foreground">different rulers</span>{' '}
              computed in this backend so you can see which agrees with your known PD or an in-person measurement.
            </p>
            <div className="rounded-md border border-border overflow-hidden text-sm">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/50 text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Method</th>
                    <th className="px-3 py-2 font-medium text-right">mm</th>
                    <th className="px-3 py-2 font-medium text-right">vs primary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr>
                    <td className="px-3 py-2">Primary (MediaPipe blend)</td>
                    <td className="px-3 py-2 text-right font-medium">{formatMeasurement(primaryPd)}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">—</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-muted-foreground">Iris ruler only</td>
                    <td className="px-3 py-2 text-right">{formatMeasurement(scale?.pd_mm_iris_scale_only)}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">
                      {deltaVsPrimary(scale?.pd_mm_iris_scale_only) ?? '—'}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-muted-foreground">Face width = 145 mm prior</td>
                    <td className="px-3 py-2 text-right">{formatMeasurement(scale?.pd_mm_face_scale_only)}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">
                      {deltaVsPrimary(scale?.pd_mm_face_scale_only) ?? '—'}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-muted-foreground">IPD ∝ face (prior mix)</td>
                    <td className="px-3 py-2 text-right">{formatMeasurement(scale?.pd_prior_mm)}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">
                      {deltaVsPrimary(scale?.pd_prior_mm) ?? '—'}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-muted-foreground">HF ONNX 2d106 (InsightFace-style)</td>
                    <td className="px-3 py-2 text-right">{formatMeasurement(measurements?.pd_hf)}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">
                      {deltaVsPrimary(measurements?.pd_hf) ?? '—'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Presentation (ML) — always visible so missing API data is obvious */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Presentation (ML estimate)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!gender && !emotion ? (
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>No presentation (ML) data in this capture response.</p>
              <p className="text-xs">
                Restart the backend (latest <code className="text-foreground">/landmarks/detect</code> returns{' '}
                <code className="text-foreground">landmarks.gender</code> /{' '}
                <code className="text-foreground">landmarks.emotion</code>), then take a new photo. If you only
                navigated here from an old session, run capture again.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {gender ? (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Gender</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-2xl font-semibold capitalize">{gender.label}</span>
                    {gender.low_confidence && (
                      <Badge variant="outline" className="text-yellow-700 border-yellow-600/40">
                        Low certainty
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Model confidence: {(gender.confidence * 100).toFixed(1)}%
                    {gender.model ? ` · ${gender.model}` : ''}
                  </p>
                  {gender.error && <p className="text-xs text-destructive mt-2">{gender.error}</p>}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No gender estimate in this response.</p>
              )}

              {emotion ? (
                <div className="pt-2 border-t border-border/60">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <Smile className="h-3.5 w-3.5" />
                    Expression
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-2xl font-semibold">{formatEmotionLabel(emotion.label)}</span>
                    {emotion.low_confidence && (
                      <Badge variant="outline" className="text-yellow-700 border-yellow-600/40">
                        Low certainty
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Model confidence: {(emotion.confidence * 100).toFixed(1)}%
                    {emotion.model ? ` · ${emotion.model}` : ''}
                  </p>
                  {emotion.error && <p className="text-xs text-destructive mt-2">{emotion.error}</p>}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground border-t border-border/60 pt-4">
                  No expression estimate in this response.
                </p>
              )}

              <p className="text-xs text-muted-foreground">
                Automated guesses from facial appearance — not identity or mood diagnosis. Use a clear, front-facing
                photo for best results.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Eyewear shopping insights (rules + HF age ONNX) */}
      <Card className="border-emerald-500/20 bg-emerald-500/[0.03]">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-emerald-600" />
            Eyewear insights (online fit)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {!eyewear ? (
            <div className="text-muted-foreground space-y-2">
              <p>No eyewear bundle in this capture.</p>
              <p className="text-xs">
                Restart the backend and capture again — latest{' '}
                <code className="text-foreground">/landmarks/detect</code> returns{' '}
                <code className="text-foreground">landmarks.eyewear</code> (sizing hints + optional age band from
                Hugging Face ONNX).
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground">Face width band</span>
                <Badge variant="outline" className="capitalize">
                  {eyewear.face_width_bucket || '—'}
                </Badge>
                {eyewear.fit_hint === 'review' && (
                  <Badge variant="outline" className="text-amber-800 border-amber-600/40">
                    Review warnings
                  </Badge>
                )}
              </div>
              {eyewear.suggested_frame_total_width_mm && (
                <p>
                  <span className="text-muted-foreground">Suggested total frame width (shopping range): </span>
                  <span className="font-semibold text-foreground">
                    {eyewear.suggested_frame_total_width_mm.min}–{eyewear.suggested_frame_total_width_mm.max} mm
                  </span>
                </p>
              )}
              {eyewear.face_width_bucket_recommendation && (
                <p className="text-xs text-muted-foreground leading-relaxed">{eyewear.face_width_bucket_recommendation}</p>
              )}

              {eyewear.lens_height_guidance && (
                <div className="rounded-md border border-border p-3 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Lens height (B) — heuristic
                  </p>
                  <p className="font-medium capitalize">{eyewear.lens_height_guidance.label}</p>
                  <p className="text-sm">
                    Suggest roughly{' '}
                    <span className="font-semibold">
                      {eyewear.lens_height_guidance.suggested_lens_height_mm_min}–
                      {eyewear.lens_height_guidance.suggested_lens_height_mm_max} mm
                    </span>{' '}
                    lens height for proportion (not a product spec).
                  </p>
                  <p className="text-xs text-muted-foreground">{eyewear.lens_height_guidance.explanation}</p>
                </div>
              )}

              {eyewear.segment_height && (
                <div className="rounded-md border border-border p-3 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Segment height proxy (progressives)
                  </p>
                  <p className="text-sm">
                    Pupil → lower-lid proxy:{' '}
                    <span className="font-semibold">
                      {eyewear.segment_height.pupil_to_lower_lid_proxy_mm != null
                        ? `${eyewear.segment_height.pupil_to_lower_lid_proxy_mm.toFixed(1)} mm`
                        : 'N/A'}
                    </span>
                  </p>
                  {eyewear.segment_height.note && (
                    <p className="text-xs text-muted-foreground">{eyewear.segment_height.note}</p>
                  )}
                  {eyewear.segment_height.progressives_disclaimer && (
                    <p className="text-xs text-amber-900/90 bg-amber-500/10 rounded px-2 py-1.5">
                      {eyewear.segment_height.progressives_disclaimer}
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <div className="rounded-md bg-muted/50 p-2">
                  <p className="text-muted-foreground">Eye height in face</p>
                  <p className="font-medium">
                    {eyewear.eye_vertical_position_ratio != null
                      ? eyewear.eye_vertical_position_ratio.toFixed(2)
                      : formatMeasurement(measurements?.eye_vertical_position_ratio, 2)}
                  </p>
                </div>
                <div className="rounded-md bg-muted/50 p-2">
                  <p className="text-muted-foreground">Chin / face width</p>
                  <p className="font-medium">
                    {eyewear.chin_to_face_width_ratio != null
                      ? eyewear.chin_to_face_width_ratio.toFixed(2)
                      : formatMeasurement(measurements?.chin_to_face_width_ratio, 2)}
                  </p>
                </div>
                <div className="rounded-md bg-muted/50 p-2">
                  <p className="text-muted-foreground">Jaw / chin (mm)</p>
                  <p className="font-medium">
                    {formatMeasurement(measurements?.jaw_width)} / {formatMeasurement(measurements?.chin_width)}
                  </p>
                </div>
              </div>

              {eyewear.catalog_frame_fit && eyewear.catalog_frame_fit.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Frame fit vs catalog (same mm as try-on tab)
                  </p>
                  <div className="rounded-md border border-border overflow-x-auto text-xs">
                    <table className="w-full min-w-[520px]">
                      <thead>
                        <tr className="bg-muted/50 text-left text-muted-foreground">
                          <th className="px-2 py-2">Frame</th>
                          <th className="px-2 py-2">Width fit</th>
                          <th className="px-2 py-2">Bridge</th>
                          <th className="px-2 py-2">Overall</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {eyewear.catalog_frame_fit.map((row) => (
                          <tr key={row.id}>
                            <td className="px-2 py-2 font-medium">
                              {row.name}
                              <span className="block text-muted-foreground font-normal">
                                {row.frame_total_width_mm}×{row.frame_lens_width_mm} / bridge {row.frame_nose_bridge_mm}
                              </span>
                            </td>
                            <td className="px-2 py-2 capitalize">
                              <Badge variant="outline" className="text-[10px] mr-1">
                                {row.width_vs_face}
                              </Badge>
                              <span className="text-muted-foreground block mt-1 max-w-[200px]">{row.width_explanation}</span>
                            </td>
                            <td className="px-2 py-2 capitalize">
                              <Badge variant="outline" className="text-[10px] mr-1">
                                {row.bridge_vs_estimate}
                              </Badge>
                              <span className="text-muted-foreground block mt-1 max-w-[200px]">{row.bridge_explanation}</span>
                            </td>
                            <td className="px-2 py-2 text-muted-foreground">{row.overall_label}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {eyewear.capture_quality && (
                <div className="rounded-md bg-muted/30 p-3 text-xs space-y-1">
                  <p className="font-medium text-foreground">Capture quality (attention / pose)</p>
                  <p className="text-muted-foreground capitalize">PD geometry: {eyewear.capture_quality.pd_geometry ?? '—'}</p>
                  {eyewear.capture_quality.eyes_open_frontal_hint && (
                    <p className="text-muted-foreground">{eyewear.capture_quality.eyes_open_frontal_hint}</p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm">
                <div className="rounded-md bg-muted/50 p-3">
                  <p className="text-muted-foreground">PD reliability</p>
                  <p className="font-medium capitalize">{eyewear.pd_reliability ?? '—'}</p>
                  {eyewear.pd_blend_method && (
                    <p className="text-muted-foreground mt-1">Blend: {eyewear.pd_blend_method}</p>
                  )}
                  {eyewear.nose_bridge_proxy_mm != null && (
                    <p className="text-muted-foreground mt-1">Nose proxy ~{eyewear.nose_bridge_proxy_mm} mm</p>
                  )}
                </div>
                <div className="rounded-md bg-muted/50 p-3">
                  <p className="text-muted-foreground">Asymmetry checks</p>
                  <p>
                    PD L/R:{' '}
                    <span className="font-medium">
                      {eyewear.monocular_asymmetry_mm != null
                        ? `${eyewear.monocular_asymmetry_mm.toFixed(1)} mm`
                        : '—'}
                    </span>
                  </p>
                  <p>
                    Nose bridge L/R:{' '}
                    <span className="font-medium">
                      {eyewear.nose_bridge_asymmetry_mm != null
                        ? `${eyewear.nose_bridge_asymmetry_mm.toFixed(1)} mm`
                        : '—'}
                    </span>
                  </p>
                </div>
              </div>

              {eyewear.age_estimate && (
                <div className="rounded-md border border-border p-3 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Age band (ML — Hugging Face ONNX)
                  </p>
                  {eyewear.age_estimate.error ? (
                    <p className="text-destructive text-xs">{eyewear.age_estimate.error}</p>
                  ) : (
                    <>
                      <p className="text-lg font-semibold">
                        {eyewear.age_estimate.bucket}
                        {eyewear.age_estimate.low_confidence && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            Low confidence
                          </Badge>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Confidence {(eyewear.age_estimate.confidence * 100).toFixed(0)}%
                        {eyewear.age_estimate.model ? ` · ${eyewear.age_estimate.model}` : ''}
                      </p>
                    </>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Merchandising / UX only — not proof of age or identity.
                  </p>
                </div>
              )}

              {eyewear.warnings && eyewear.warnings.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-amber-800 mb-1">Warnings</p>
                  <ul className="list-disc pl-4 space-y-1 text-xs text-muted-foreground">
                    {eyewear.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {eyewear.style_tips && eyewear.style_tips.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Style hints</p>
                  <ul className="list-disc pl-4 space-y-1 text-xs text-muted-foreground">
                    {eyewear.style_tips.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                </div>
              )}

              {eyewear.features_status && Object.keys(eyewear.features_status).length > 0 && (
                <details className="rounded-md border border-dashed border-border p-3 text-xs">
                  <summary className="cursor-pointer font-medium text-muted-foreground">
                    Feature &amp; ML coverage (what runs on-device)
                  </summary>
                  <ul className="mt-2 space-y-1 text-muted-foreground list-disc pl-4">
                    {Object.entries(eyewear.features_status).map(([k, v]) => (
                      <li key={k}>
                        <span className="text-foreground/90">{k.replace(/_/g, ' ')}:</span> {v}
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              {eyewear.disclaimer && (
                <p className="text-xs text-muted-foreground leading-relaxed border-t pt-3">{eyewear.disclaimer}</p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {clientCapture && (
        <Card className="border-muted">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-primary" />
                Capture device &amp; network
              </CardTitle>
              <Badge variant="outline" className={clientCapture.online ? 'text-medical-success' : ''}>
                {clientCapture.online ? 'Online' : 'Offline'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-3">
            {clientCapture.captured_at_iso && (
              <p>
                <span className="font-medium text-foreground/80">Captured at:</span>{' '}
                {clientCapture.captured_at_iso}
              </p>
            )}
            <div className="grid sm:grid-cols-2 gap-2">
              {clientCapture.time_zone && (
                <p>
                  <span className="font-medium text-foreground/80">Time zone:</span> {clientCapture.time_zone}
                </p>
              )}
              <p>
                <span className="font-medium text-foreground/80">Language:</span> {clientCapture.language}
                {clientCapture.languages && clientCapture.languages.length > 0
                  ? ` · ${clientCapture.languages.slice(0, 4).join(', ')}`
                  : ''}
              </p>
              {(clientCapture.platform || clientCapture.hardware_concurrency != null) && (
                <p>
                  <span className="font-medium text-foreground/80">Device:</span>{' '}
                  {clientCapture.platform ?? '—'}
                  {typeof clientCapture.hardware_concurrency === 'number'
                    ? ` · ${clientCapture.hardware_concurrency} cores`
                    : ''}
                </p>
              )}
            </div>
            {clientCapture.screen && (
              <p>
                <span className="font-medium text-foreground/80">Screen:</span>{' '}
                {clientCapture.screen.width}×{clientCapture.screen.height}
                {clientCapture.screen.avail_width != null && clientCapture.screen.avail_height != null
                  ? ` (avail ${clientCapture.screen.avail_width}×${clientCapture.screen.avail_height})`
                  : ''}
                {' · '}
                {clientCapture.screen.color_depth}-bit color
              </p>
            )}
            {clientCapture.viewport && (
              <p>
                <span className="font-medium text-foreground/80">Viewport:</span>{' '}
                {clientCapture.viewport.inner_width}×{clientCapture.viewport.inner_height}
                {typeof clientCapture.viewport.device_pixel_ratio === 'number'
                  ? ` · DPR ${clientCapture.viewport.device_pixel_ratio}`
                  : ''}
              </p>
            )}
            {clientCapture.connection && (
              <p>
                <span className="font-medium text-foreground/80">Network:</span>{' '}
                {[clientCapture.connection.effective_type, clientCapture.connection.downlink_mbps != null ? `~${clientCapture.connection.downlink_mbps} Mbps` : null, clientCapture.connection.rtt_ms != null ? `RTT ${clientCapture.connection.rtt_ms} ms` : null, clientCapture.connection.save_data ? 'save-data' : null]
                  .filter(Boolean)
                  .join(' · ') || '—'}
              </p>
            )}
            <details className="rounded-md border border-dashed border-border p-2">
              <summary className="cursor-pointer font-medium text-foreground/80">User agent</summary>
              <p className="mt-2 break-all text-[11px] leading-relaxed">{clientCapture.user_agent}</p>
            </details>
          </CardContent>
        </Card>
      )}

      {/* Face Measurements */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Ruler className="h-5 w-5 text-primary" />
            Face Dimensions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground">Face Width</p>
              <p className="text-xl font-semibold text-foreground">
                {formatMeasurement(measurements?.face_width)} mm
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground">Face Height</p>
              <p className="text-xl font-semibold text-foreground">
                {formatMeasurement(measurements?.face_height)} mm
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground">Face Ratio</p>
              <p className="text-xl font-semibold text-foreground">
                {formatMeasurement(measurements?.face_ratio, 2)}
              </p>
            </div>
            <div className="bg-primary/10 rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground">Face Shape</p>
              <p className="text-xl font-semibold text-primary capitalize">
                {faceShape || 'N/A'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Nose Measurements */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Nose Bridge Measurements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground">Left</p>
              <p className="text-xl font-semibold text-foreground">
                {formatMeasurement(measurements?.nose_bridge_left)} mm
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground">Right</p>
              <p className="text-xl font-semibold text-foreground">
                {formatMeasurement(measurements?.nose_bridge_right)} mm
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
