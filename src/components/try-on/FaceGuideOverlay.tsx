import { cn } from '@/lib/utils';

interface FaceGuideOverlayProps {
  isValid: boolean;
  faceDetected: boolean;
}

export function FaceGuideOverlay({ isValid, faceDetected }: FaceGuideOverlayProps) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Center guide oval */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div 
          className={cn(
            "w-[280px] h-[360px] rounded-[50%] transition-all duration-300",
            !faceDetected && "face-guide-oval pulse-ring",
            faceDetected && isValid && "face-guide-valid",
            faceDetected && !isValid && "face-guide-invalid"
          )}
        />
      </div>

      {/* Corner markers */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-[300px] h-[380px]">
          {/* Top left corner */}
          <div className={cn(
            "absolute -top-2 -left-2 w-8 h-8 border-l-2 border-t-2 rounded-tl-lg transition-colors duration-300",
            isValid ? "border-validation-pass" : faceDetected ? "border-validation-fail" : "border-primary/50"
          )} />
          
          {/* Top right corner */}
          <div className={cn(
            "absolute -top-2 -right-2 w-8 h-8 border-r-2 border-t-2 rounded-tr-lg transition-colors duration-300",
            isValid ? "border-validation-pass" : faceDetected ? "border-validation-fail" : "border-primary/50"
          )} />
          
          {/* Bottom left corner */}
          <div className={cn(
            "absolute -bottom-2 -left-2 w-8 h-8 border-l-2 border-b-2 rounded-bl-lg transition-colors duration-300",
            isValid ? "border-validation-pass" : faceDetected ? "border-validation-fail" : "border-primary/50"
          )} />
          
          {/* Bottom right corner */}
          <div className={cn(
            "absolute -bottom-2 -right-2 w-8 h-8 border-r-2 border-b-2 rounded-br-lg transition-colors duration-300",
            isValid ? "border-validation-pass" : faceDetected ? "border-validation-fail" : "border-primary/50"
          )} />
        </div>
      </div>

      {/* Instruction text at top */}
      <div className="absolute top-6 left-0 right-0 text-center">
        <span className={cn(
          "px-4 py-2 rounded-full text-sm font-medium glass-panel",
          !faceDetected && "text-muted-foreground",
          faceDetected && isValid && "text-success",
          faceDetected && !isValid && "text-destructive"
        )}>
          {!faceDetected 
            ? "Position your face in the oval"
            : isValid 
              ? "Perfect! Ready for try-on"
              : "Adjust your position"}
        </span>
      </div>
    </div>
  );
}