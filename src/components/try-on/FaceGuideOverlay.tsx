import { cn } from '@/lib/utils';
import { PD_DESKTOP_TARGET_DISTANCE_CM, PD_MOBILE_TARGET_DISTANCE_CM } from '@/lib/pdCaptureDistance';
import { useMobileCaptureMode } from '@/hooks/useMobileCaptureMode';
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
}

export function FaceGuideOverlay({ isValid, faceDetected, validationChecks, debugValues }: FaceGuideOverlayProps) {
  const mobileCapture = useMobileCaptureMode();
  const maxTilt = debugValues?.maxHeadTilt ?? 6;
  const maxRot = debugValues?.maxHeadRotation ?? 8;
  const maxEyeY = debugValues?.maxEyeYDelta ?? 0.012;
  const steadyReq = debugValues?.steadyRequired ?? 10;

  return (
    <div className="absolute inset-0 pointer-events-none z-10">
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
