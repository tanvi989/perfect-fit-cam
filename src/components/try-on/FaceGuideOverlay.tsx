import { cn } from '@/lib/utils';
import { PD_DESKTOP_TARGET_DISTANCE_CM, PD_MOBILE_TARGET_DISTANCE_CM } from '@/lib/pdCaptureDistance';
import { useMobileCaptureMode } from '@/hooks/useMobileCaptureMode';
import {
  PD_ADULT_MAX_MM,
  PD_ADULT_MIN_MM,
  PD_PEDIATRIC_MAX_MM,
  PD_PEDIATRIC_MIN_MM,
  type LivePdGeometryDebug,
} from '@/lib/irisGeometry';
import { irisSegmentLayoutPercents } from '@/lib/videoCoverMap';
import { ValidationCheck } from '@/types/face-validation';
import { Check, X } from 'lucide-react';

interface DebugValues {
  faceWidthPercent: number;
  leftEyeAR: number;
  rightEyeAR: number;
  headTilt: number;
  headRotation: number;
  brightness: number;
  eyeLevelDelta?: number;
  steadyFrames?: number;
  steadyRequired?: number;
  maxHeadTilt?: number;
  maxHeadRotation?: number;
  maxEyeYDelta?: number;
}

interface FaceGuideOverlayProps {
  isValid: boolean;
  faceDetected: boolean;
  validationChecks: ValidationCheck[];
  debugValues?: DebugValues;
  /** Live full-res iris PD geometry (video pixels); line overlay maps to screen with object-fit: cover */
  livePdDebug?: LivePdGeometryDebug | null;
  layoutWidth?: number;
  layoutHeight?: number;
  /** Match <video style={{ transform: scaleX(-1) }}> */
  videoMirrorX?: boolean;
}

function fmt(n: number, d = 1): string {
  return Number.isFinite(n) ? n.toFixed(d) : '—';
}

/** Match server display: 0.5 mm steps */
function pdDisplayHalfMm(mm: number): number {
  return Math.round(mm * 2) / 2;
}

export function FaceGuideOverlay({
  isValid,
  faceDetected,
  validationChecks,
  debugValues,
  livePdDebug,
  layoutWidth = 0,
  layoutHeight = 0,
  videoMirrorX = false,
}: FaceGuideOverlayProps) {
  const mobileCapture = useMobileCaptureMode();
  const maxTilt = debugValues?.maxHeadTilt ?? 6;
  const maxRot = debugValues?.maxHeadRotation ?? 8;
  const maxEyeY = debugValues?.maxEyeYDelta ?? 0.012;
  const steadyReq = debugValues?.steadyRequired ?? 10;

  const showPdOverlay =
    faceDetected &&
    livePdDebug != null &&
    layoutWidth > 40 &&
    layoutHeight > 40;

  const irisLayout = showPdOverlay
    ? irisSegmentLayoutPercents(livePdDebug, layoutWidth, layoutHeight, videoMirrorX)
    : null;

  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      {/* Full-screen iris ↔ iris chord (video px labeled) — debug */}
      {showPdOverlay && irisLayout && (
        <svg
          className="absolute inset-0 w-full h-full z-[15]"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
        >
          <defs>
            <filter id="pd-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="0.25" floodColor="#fbbf24" floodOpacity="0.9" />
            </filter>
          </defs>
          <line
            x1={irisLayout.left.leftPct}
            y1={irisLayout.left.topPct}
            x2={irisLayout.right.leftPct}
            y2={irisLayout.right.topPct}
            stroke="rgba(250,204,21,0.95)"
            strokeWidth={0.35}
            vectorEffect="nonScalingStroke"
            filter="url(#pd-glow)"
          />
          <circle
            cx={irisLayout.left.leftPct}
            cy={irisLayout.left.topPct}
            r={0.9}
            fill="rgba(34,211,238,0.95)"
          />
          <circle
            cx={irisLayout.right.leftPct}
            cy={irisLayout.right.topPct}
            r={0.9}
            fill="rgba(34,211,238,0.95)"
          />
          <text
            x={(irisLayout.left.leftPct + irisLayout.right.leftPct) / 2}
            y={(irisLayout.left.topPct + irisLayout.right.topPct) / 2 - 1.2}
            fill="white"
            fontSize="2.4"
            fontWeight="700"
            textAnchor="middle"
            stroke="rgba(0,0,0,0.85)"
            strokeWidth="0.15"
            paintOrder="stroke"
          >
            {`H ${fmt(livePdDebug.pdPxHorizontal, 1)} · E ${fmt(livePdDebug.pdPxEuclidean, 1)} px`}
          </text>
          <text
            x={irisLayout.left.leftPct}
            y={Math.max(4, irisLayout.left.topPct - 2)}
            fill="white"
            fontSize="2.2"
            textAnchor="middle"
            stroke="rgba(0,0,0,0.8)"
            strokeWidth="0.12"
            paintOrder="stroke"
          >
            L
          </text>
          <text
            x={irisLayout.right.leftPct}
            y={Math.max(4, irisLayout.right.topPct - 2)}
            fill="white"
            fontSize="2.2"
            textAnchor="middle"
            stroke="rgba(0,0,0,0.8)"
            strokeWidth="0.12"
            paintOrder="stroke"
          >
            R
          </text>
        </svg>
      )}

      {showPdOverlay && livePdDebug && (
        <div className="absolute top-[5.5rem] left-0 right-0 z-[16] flex justify-center px-1">
          <div className="bg-black/82 backdrop-blur-md rounded-lg px-2 py-1.5 max-w-[min(100%,520px)] border border-amber-500/40 shadow-lg">
            <div className="text-[9px] font-mono text-amber-100/95 leading-tight space-y-0.5">
              <div className="text-amber-300 font-semibold uppercase tracking-wide">PD debug — video pixels</div>
              <div>
                Frame: {livePdDebug.videoWidth}×{livePdDebug.videoHeight}px · L iris Ø {fmt(livePdDebug.irisDiameterLeftPx, 2)}{' '}
                R Ø {fmt(livePdDebug.irisDiameterRightPx, 2)} · mean Ø{' '}
                {livePdDebug.ipdIrisRatioCorrection !== 'ok'
                  ? `${fmt(livePdDebug.irisDiameterMeanPx, 2)}→${fmt(livePdDebug.irisDiameterMeanPxCorrected, 2)}`
                  : fmt(livePdDebug.irisDiameterMeanPx, 2)}
              </div>
              <div>
                Centres: L ({fmt(livePdDebug.leftIrisCenterPx.x, 1)}, {fmt(livePdDebug.leftIrisCenterPx.y, 1)}) · R (
                {fmt(livePdDebug.rightIrisCenterPx.x, 1)}, {fmt(livePdDebug.rightIrisCenterPx.y, 1)})
              </div>
              <div>
                IPD px: horiz {fmt(livePdDebug.pdPxHorizontal, 2)} · euclid {fmt(livePdDebug.pdPxEuclidean, 2)} ·{' '}
                <span className="text-white font-bold">used {fmt(livePdDebug.pdPxUsed, 2)}</span> (
                {livePdDebug.pdGeometry}) · cheek W {fmt(livePdDebug.faceWidthCheekPx, 1)} px
              </div>
              <div>
                Scale: s_iris {fmt(livePdDebug.sIrisMmPerPx, 4)} mm/px · s_face {fmt(livePdDebug.sFaceMmPerPx, 4)} mm/px ·
                IPD/Ø {fmt(livePdDebug.ipdOverIrisDiam, 2)} {livePdDebug.pdRatioOk ? '✓' : '⚠'}
              </div>
              <div>
                Preview mm (client): iris-ruler {fmt(livePdDebug.pdMmIrisScaleOnly, 2)} · face-ruler{' '}
                {fmt(livePdDebug.pdMmFaceScaleOnly, 2)} · levelRatio {livePdDebug.levelRatio.toFixed(5)}
              </div>
              <div className="text-white/60 pt-0.5">
                Live console: add <span className="text-white">?pddebug=1</span> to URL · after snap see{' '}
                <span className="text-white">[PD SNAP REPORT]</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Center guide oval */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className={cn(
            'w-[280px] h-[360px] md:w-[320px] md:h-[420px] rounded-[50%] transition-all duration-300',
            !faceDetected && 'face-guide-oval pulse-ring',
            faceDetected && isValid && 'face-guide-valid',
            faceDetected && !isValid && 'face-guide-invalid',
          )}
        />
      </div>

      {/* Corner markers */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-[300px] h-[380px] md:w-[340px] md:h-[440px]">
          <div
            className={cn(
              'absolute -top-2 -left-2 w-8 h-8 border-l-3 border-t-3 rounded-tl-lg transition-colors duration-300',
              isValid ? 'border-validation-pass' : faceDetected ? 'border-validation-fail' : 'border-white/60',
            )}
          />

          <div
            className={cn(
              'absolute -top-2 -right-2 w-8 h-8 border-r-3 border-t-3 rounded-tr-lg transition-colors duration-300',
              isValid ? 'border-validation-pass' : faceDetected ? 'border-validation-fail' : 'border-white/60',
            )}
          />

          <div
            className={cn(
              'absolute -bottom-2 -left-2 w-8 h-8 border-l-3 border-b-3 rounded-bl-lg transition-colors duration-300',
              isValid ? 'border-validation-pass' : faceDetected ? 'border-validation-fail' : 'border-white/60',
            )}
          />

          <div
            className={cn(
              'absolute -bottom-2 -right-2 w-8 h-8 border-r-3 border-b-3 rounded-br-lg transition-colors duration-300',
              isValid ? 'border-validation-pass' : faceDetected ? 'border-validation-fail' : 'border-white/60',
            )}
          />
        </div>
      </div>

      {/* WebAR live PD — same iris geometry as server; adult 54–74 mm or child heuristic ~40–58 mm */}
      {showPdOverlay && livePdDebug && (
        <div className="absolute bottom-36 md:bottom-28 left-0 right-0 z-[17] flex justify-center px-3 pointer-events-none">
          <div className="bg-gradient-to-br from-slate-950/92 to-black/88 backdrop-blur-md rounded-2xl px-4 py-3 max-w-[min(100%,380px)] border border-cyan-500/35 shadow-xl text-center">
            <div className="text-[10px] uppercase tracking-wider text-cyan-200/90 font-semibold mb-1">
              WebAR · live PD (iris-scale preview)
              {livePdDebug.likelyPediatricHeuristic && (
                <span className="block normal-case text-violet-200/95 font-normal mt-0.5">
                  Child / small-head heuristic — not using adult 54–74 mm band
                </span>
              )}
            </div>
            <div className="text-3xl font-bold text-white tabular-nums tracking-tight">
              {pdDisplayHalfMm(livePdDebug.pdMmIrisScaleOnly).toFixed(1)}{' '}
              <span className="text-lg font-semibold text-white/80">mm</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-[11px]">
              <span
                className={cn(
                  'rounded-full px-2.5 py-0.5 font-medium',
                  livePdDebug.likelyPediatricHeuristic
                    ? livePdDebug.pdInTypicalPediatricRange
                      ? 'bg-emerald-500/25 text-emerald-100 border border-emerald-400/40'
                      : 'bg-amber-500/20 text-amber-100 border border-amber-400/35'
                    : livePdDebug.pdInTypicalAdultRange
                      ? 'bg-emerald-500/25 text-emerald-100 border border-emerald-400/40'
                      : 'bg-amber-500/20 text-amber-100 border border-amber-400/35',
                )}
              >
                {livePdDebug.likelyPediatricHeuristic
                  ? livePdDebug.pdInTypicalPediatricRange
                    ? `Rough child range ${PD_PEDIATRIC_MIN_MM}–${PD_PEDIATRIC_MAX_MM} mm ✓`
                    : `Rough child range ${PD_PEDIATRIC_MIN_MM}–${PD_PEDIATRIC_MAX_MM} mm — lighting / distance`
                  : livePdDebug.pdInTypicalAdultRange
                    ? `Typical adult range ${PD_ADULT_MIN_MM}–${PD_ADULT_MAX_MM} mm ✓`
                    : `Target ${PD_ADULT_MIN_MM}–${PD_ADULT_MAX_MM} mm — adjust distance & face square`}
              </span>
              <span
                className={cn(
                  'rounded-full px-2.5 py-0.5 border font-medium',
                  livePdDebug.arPdPreviewQuality === 'excellent' &&
                    'bg-emerald-600/30 text-emerald-50 border-emerald-400/50',
                  livePdDebug.arPdPreviewQuality === 'good' &&
                    'bg-sky-600/25 text-sky-50 border-sky-400/40',
                  livePdDebug.arPdPreviewQuality === 'fair' &&
                    'bg-white/10 text-white/85 border-white/20',
                )}
              >
                AR {livePdDebug.arPdPreviewQuality}
              </span>
            </div>
            <p className="text-[9px] text-white/55 mt-2 leading-snug">
              Overlays follow iris centres in real time. Final PD uses the captured photo on the server; use a credit
              card at cheek depth for maximum accuracy.
            </p>
          </div>
        </div>
      )}

      {/* Primary instruction */}
      <div className="absolute top-6 left-0 right-0 text-center px-4">
        <span
          className={cn(
            'inline-block px-5 py-3 rounded-full text-sm md:text-base font-semibold backdrop-blur-md max-w-[min(100%,420px)]',
            !faceDetected && 'bg-black/55 text-white',
            faceDetected && isValid && 'bg-validation-pass/95 text-white',
            faceDetected && !isValid && 'bg-validation-fail/90 text-white',
          )}
        >
          {!faceDetected
            ? "PD mode: center your face in the oval"
            : isValid
              ? 'Perfect alignment — hold still'
              : 'Square up to the camera for an accurate PD'}
        </span>
      </div>

      {/* PD-specific guidance (always visible while framing) — leave room for Snap photo bar */}
      <div className="absolute bottom-28 md:bottom-8 left-0 right-0 text-center px-4">
        <p className="text-[11px] md:text-xs text-white/85 drop-shadow-md max-w-md mx-auto leading-snug bg-black/45 rounded-lg px-3 py-2 backdrop-blur-sm">
          <span className="font-semibold text-white">For correct pupillary distance:</span>{' '}
          {mobileCapture ? (
            <>
              Face the camera straight on, eyes level. Hold the phone at a{' '}
              <span className="text-white">comfortable selfie distance</span> (~{PD_MOBILE_TARGET_DISTANCE_CM} cm —
              no need to reach far). Roughly fill the oval, then hold steady until the checklist turns green.
            </>
          ) : (
            <>
              Face the camera directly (no angle), keep eyes level, sit ~{PD_DESKTOP_TARGET_DISTANCE_CM} cm from
              the webcam, fill the oval, and hold steady until the checklist turns green.
            </>
          )}
        </p>
      </div>

      {debugValues && (
        <div className="absolute top-20 right-4 bg-black/80 backdrop-blur-md rounded-xl p-3 text-xs font-mono text-white space-y-1">
          <div className="text-yellow-400 font-bold mb-2">PD alignment</div>
          <div
            className={cn(
              debugValues.steadyFrames != null && debugValues.steadyFrames >= steadyReq
                ? 'text-green-400'
                : 'text-amber-300',
            )}
          >
            Steady: {debugValues.steadyFrames ?? 0}/{steadyReq}
          </div>
          <div
            className={cn(
              (debugValues.eyeLevelDelta ?? 0) <= maxEyeY ? 'text-green-400' : 'text-red-400',
            )}
          >
            Eye Δy: {(debugValues.eyeLevelDelta ?? 0).toFixed(4)}{' '}
            <span className="text-white/50">(≤{maxEyeY})</span>
          </div>
          <div className={cn(Math.abs(debugValues.headTilt ?? 0) <= maxTilt ? 'text-green-400' : 'text-red-400')}>
            Tilt: {(debugValues.headTilt ?? 0).toFixed(1)}°
            <span className="text-white/50 ml-1">(±{maxTilt}°)</span>
          </div>
          <div
            className={cn(Math.abs(debugValues.headRotation ?? 0) <= maxRot ? 'text-green-400' : 'text-red-400')}
          >
            Yaw: {(debugValues.headRotation ?? 0).toFixed(1)}°
            <span className="text-white/50 ml-1">(±{maxRot}°)</span>
          </div>
          <div className="text-white/70 text-[10px] mt-1">Distance %: {(debugValues.faceWidthPercent ?? 0).toFixed(1)}</div>
        </div>
      )}

      <div className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2">
        <div className="bg-black/60 backdrop-blur-md rounded-2xl p-3 md:p-4 max-w-[168px] md:max-w-[200px]">
          <div className="flex flex-col gap-2">
            {validationChecks.map((check) => (
              <div
                key={check.id}
                className={cn(
                  'flex items-start gap-2 px-2 md:px-3 py-1.5 md:py-2 rounded-lg text-sm transition-all duration-200',
                  check.passed ? 'bg-validation-pass/20' : 'bg-white/10',
                )}
              >
                <div
                  className={cn(
                    'flex-shrink-0 w-4 h-4 md:w-5 md:h-5 rounded-full flex items-center justify-center mt-0.5',
                    check.passed ? 'bg-validation-pass' : 'bg-white/30',
                  )}
                >
                  {check.passed ? (
                    <Check className="h-2.5 w-2.5 md:h-3 md:w-3 text-white" />
                  ) : (
                    <X className="h-2.5 w-2.5 md:h-3 md:w-3 text-white/70" />
                  )}
                </div>
                <div className="min-w-0">
                  <span
                    className={cn(
                      'text-[10px] md:text-xs font-medium leading-tight block',
                      check.passed ? 'text-white' : 'text-white/75',
                    )}
                  >
                    {check.label}
                  </span>
                  {!check.passed && check.message && (
                    <span className="text-[9px] md:text-[10px] text-white/55 leading-tight block mt-0.5">
                      {check.message}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
