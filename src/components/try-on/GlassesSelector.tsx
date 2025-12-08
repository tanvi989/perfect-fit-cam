import { cn } from '@/lib/utils';
import type { GlassesFrame } from '@/types/face-validation';
import { Glasses, CheckCircle, AlertCircle, Info, Loader2 } from 'lucide-react';
import type { ProcessedFrame } from '@/hooks/useProcessedFrames';

type FitCategory = 'tooSmall' | 'small' | 'ideal' | 'large' | 'oversized';

interface GlassesSelectorProps {
  frames: ProcessedFrame[];
  selectedFrame: ProcessedFrame | null;
  onSelectFrame: (frame: ProcessedFrame) => void;
  faceWidthMm?: number;
  className?: string;
}

function getFitCategory(frameWidthMm: number, faceWidthMm: number): FitCategory {
  const diffMm = frameWidthMm - faceWidthMm;
  if (diffMm <= -10) return 'tooSmall';
  if (diffMm > -10 && diffMm < 0) return 'small';
  if (diffMm >= 0 && diffMm <= 10) return 'ideal';
  if (diffMm > 10 && diffMm <= 18) return 'large';
  return 'oversized';
}

const FIT_STYLES: Record<FitCategory, { bg: string; border: string; icon: typeof CheckCircle; iconColor: string }> = {
  tooSmall: { bg: 'bg-destructive/10', border: 'border-destructive/50', icon: AlertCircle, iconColor: 'text-destructive' },
  small: { bg: 'bg-orange-500/10', border: 'border-orange-500/50', icon: Info, iconColor: 'text-orange-500' },
  ideal: { bg: 'bg-green-500/10', border: 'border-green-500/50', icon: CheckCircle, iconColor: 'text-green-500' },
  large: { bg: 'bg-orange-500/10', border: 'border-orange-500/50', icon: Info, iconColor: 'text-orange-500' },
  oversized: { bg: 'bg-destructive/10', border: 'border-destructive/50', icon: AlertCircle, iconColor: 'text-destructive' },
};

export function GlassesSelector({ frames, selectedFrame, onSelectFrame, faceWidthMm, className }: GlassesSelectorProps) {
  return (
    <div className={cn("glass-panel rounded-xl p-4", className)}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Glasses className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Select Frames</h3>
        </div>
        {faceWidthMm && (
          <span className="text-xs text-muted-foreground">Your face width: <span className="font-medium text-foreground">{faceWidthMm.toFixed(0)}mm</span></span>
        )}
      </div>

      {frames.length > 0 ? (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {frames.map((frame) => {
            const fitCategory = faceWidthMm ? getFitCategory(frame.width, faceWidthMm) : null;
            const fitStyle = fitCategory ? FIT_STYLES[fitCategory] : null;
            const FitIcon = fitStyle?.icon;

            return (
              <div key={frame.id} className="flex-shrink-0 relative">
                <button
                  onClick={() => onSelectFrame(frame)}
                  disabled={frame.isProcessing}
                  className={cn(
                    "w-20 h-16 rounded-lg border-2 overflow-hidden transition-all duration-200 hover:scale-105",
                    selectedFrame?.id === frame.id 
                      ? "border-primary ring-2 ring-primary/30" 
                      : "border-border hover:border-primary/50",
                    frame.isProcessing && "opacity-50 cursor-wait"
                  )}
                >
                  {frame.isProcessing ? (
                    <div className="w-full h-full flex items-center justify-center bg-muted">
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <img
                      src={frame.processedImageUrl}
                      alt={frame.name}
                      className="w-full h-full object-contain p-1 bg-white"
                    />
                  )}
                </button>
                {/* Fit indicator badge */}
                {fitStyle && FitIcon && (
                  <div className={cn(
                    "absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border",
                    fitStyle.bg,
                    fitStyle.border
                  )}>
                    <FitIcon className={cn("w-3 h-3", fitStyle.iconColor)} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-6 text-center">
          <Glasses className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No frames available</p>
          <p className="text-xs text-muted-foreground mt-1">Upload glasses images to try them on</p>
        </div>
      )}

      {selectedFrame && (
        <div className="mt-3 pt-3 border-t border-border space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">{selectedFrame.name}</p>
            {faceWidthMm && (() => {
              const fitCategory = getFitCategory(selectedFrame.width, faceWidthMm);
              const fitStyle = FIT_STYLES[fitCategory];
              const FitIcon = fitStyle.icon;
              const labels: Record<FitCategory, string> = {
                tooSmall: 'Too Small',
                small: 'Small',
                ideal: 'Ideal Fit',
                large: 'Large',
                oversized: 'Oversized',
              };
              return (
                <span className={cn("flex items-center gap-1 text-xs font-medium", fitStyle.iconColor)}>
                  <FitIcon className="w-3 h-3" />
                  {labels[fitCategory]}
                </span>
              );
            })()}
          </div>
          <p className="text-xs text-muted-foreground capitalize">{selectedFrame.category} • {selectedFrame.color}</p>
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <span>Frame Width: <span className="text-foreground font-medium">{selectedFrame.width}mm</span></span>
            <span>Lens Width: <span className="text-foreground font-medium">{selectedFrame.lensWidth}mm</span></span>
            <span>Nose Bridge: <span className="text-foreground font-medium">{selectedFrame.noseBridge}mm</span></span>
            <span>Temple Length: <span className="text-foreground font-medium">{selectedFrame.templeLength}mm</span></span>
          </div>
        </div>
      )}
    </div>
  );
}
