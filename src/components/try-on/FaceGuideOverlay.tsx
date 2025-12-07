import { cn } from '@/lib/utils';
import { ValidationCheck } from '@/types/face-validation';
import { Check, X } from 'lucide-react';

interface DebugValues {
  faceWidthPercent: number;
  leftEyeAR: number;
  rightEyeAR: number;
  headTilt: number;
  headRotation: number;
  brightness: number;
}

interface FaceGuideOverlayProps {
  isValid: boolean;
  faceDetected: boolean;
  validationChecks: ValidationCheck[];
  debugValues?: DebugValues;
}

export function FaceGuideOverlay({ isValid, faceDetected, validationChecks, debugValues }: FaceGuideOverlayProps) {
  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      {/* Center guide oval */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div 
          className={cn(
            "w-[280px] h-[360px] md:w-[320px] md:h-[420px] rounded-[50%] transition-all duration-300",
            !faceDetected && "face-guide-oval pulse-ring",
            faceDetected && isValid && "face-guide-valid",
            faceDetected && !isValid && "face-guide-invalid"
          )}
        />
      </div>

      {/* Corner markers */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-[300px] h-[380px] md:w-[340px] md:h-[440px]">
          {/* Top left corner */}
          <div className={cn(
            "absolute -top-2 -left-2 w-8 h-8 border-l-3 border-t-3 rounded-tl-lg transition-colors duration-300",
            isValid ? "border-validation-pass" : faceDetected ? "border-validation-fail" : "border-white/60"
          )} />
          
          {/* Top right corner */}
          <div className={cn(
            "absolute -top-2 -right-2 w-8 h-8 border-r-3 border-t-3 rounded-tr-lg transition-colors duration-300",
            isValid ? "border-validation-pass" : faceDetected ? "border-validation-fail" : "border-white/60"
          )} />
          
          {/* Bottom left corner */}
          <div className={cn(
            "absolute -bottom-2 -left-2 w-8 h-8 border-l-3 border-b-3 rounded-bl-lg transition-colors duration-300",
            isValid ? "border-validation-pass" : faceDetected ? "border-validation-fail" : "border-white/60"
          )} />
          
          {/* Bottom right corner */}
          <div className={cn(
            "absolute -bottom-2 -right-2 w-8 h-8 border-r-3 border-b-3 rounded-br-lg transition-colors duration-300",
            isValid ? "border-validation-pass" : faceDetected ? "border-validation-fail" : "border-white/60"
          )} />
        </div>
      </div>

      {/* Instruction text at top */}
      <div className="absolute top-6 left-0 right-0 text-center px-4">
        <span className={cn(
          "inline-block px-6 py-3 rounded-full text-base font-medium backdrop-blur-md",
          !faceDetected && "bg-black/50 text-white",
          faceDetected && isValid && "bg-validation-pass/90 text-white",
          faceDetected && !isValid && "bg-validation-fail/90 text-white"
        )}>
          {!faceDetected 
            ? "Position your face in the oval"
            : isValid 
              ? "Perfect! Capturing..."
              : "Adjust your position"}
        </span>
      </div>

      {/* Debug panel - Live values */}
      {debugValues && (
        <div className="absolute top-20 right-4 bg-black/80 backdrop-blur-md rounded-xl p-3 text-xs font-mono text-white space-y-1">
          <div className="text-yellow-400 font-bold mb-2">Debug Values</div>
          <div className={cn(
            debugValues.faceWidthPercent >= 40 && debugValues.faceWidthPercent <= 60 
              ? "text-green-400" : "text-red-400"
          )}>
            Distance: {debugValues.faceWidthPercent.toFixed(1)}% 
            <span className="text-white/50 ml-1">(need 40-60%)</span>
          </div>
          <div className={cn(
            debugValues.leftEyeAR > 0.2 ? "text-green-400" : "text-red-400"
          )}>
            Left Eye AR: {debugValues.leftEyeAR.toFixed(3)}
            <span className="text-white/50 ml-1">(need &gt;0.2)</span>
          </div>
          <div className={cn(
            debugValues.rightEyeAR > 0.2 ? "text-green-400" : "text-red-400"
          )}>
            Right Eye AR: {debugValues.rightEyeAR.toFixed(3)}
            <span className="text-white/50 ml-1">(need &gt;0.2)</span>
          </div>
          <div className={cn(
            Math.abs(debugValues.headTilt) <= 10 ? "text-green-400" : "text-red-400"
          )}>
            Head Tilt: {debugValues.headTilt.toFixed(1)}°
            <span className="text-white/50 ml-1">(need ±10°)</span>
          </div>
          <div className={cn(
            Math.abs(debugValues.headRotation) <= 15 ? "text-green-400" : "text-red-400"
          )}>
            Head Rotation: {debugValues.headRotation.toFixed(1)}°
            <span className="text-white/50 ml-1">(need ±15°)</span>
          </div>
          <div className={cn(
            debugValues.brightness >= 80 && debugValues.brightness <= 220 
              ? "text-green-400" : "text-red-400"
          )}>
            Brightness: {debugValues.brightness.toFixed(0)}
            <span className="text-white/50 ml-1">(need 80-220)</span>
          </div>
        </div>
      )}

      {/* Validation checklist at bottom */}
      <div className="absolute bottom-6 left-4 right-4">
        <div className="bg-black/60 backdrop-blur-md rounded-2xl p-4 max-w-md mx-auto">
          <div className="grid grid-cols-2 gap-2">
            {validationChecks.map((check) => (
              <div
                key={check.id}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-200",
                  check.passed ? "bg-validation-pass/20" : "bg-white/10"
                )}
              >
                <div className={cn(
                  "flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center",
                  check.passed ? "bg-validation-pass" : "bg-white/30"
                )}>
                  {check.passed ? (
                    <Check className="h-3 w-3 text-white" />
                  ) : (
                    <X className="h-3 w-3 text-white/70" />
                  )}
                </div>
                <span className={cn(
                  "text-xs font-medium truncate",
                  check.passed ? "text-white" : "text-white/70"
                )}>
                  {check.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}