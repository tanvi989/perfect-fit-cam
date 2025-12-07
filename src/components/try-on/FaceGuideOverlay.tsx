import { cn } from '@/lib/utils';
import { ValidationCheck } from '@/types/face-validation';
import { Check, X } from 'lucide-react';

interface FaceGuideOverlayProps {
  isValid: boolean;
  faceDetected: boolean;
  validationChecks: ValidationCheck[];
}

export function FaceGuideOverlay({ isValid, faceDetected, validationChecks }: FaceGuideOverlayProps) {
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