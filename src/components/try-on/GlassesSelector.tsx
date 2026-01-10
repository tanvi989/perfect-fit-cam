import { cn } from '@/lib/utils';
import type { GlassesFrame } from '@/types/face-validation';
import { Glasses, CheckCircle, AlertCircle, Info } from 'lucide-react';

type FitCategory = 'tight' | 'perfect' | 'loose';

interface GlassesSelectorProps {
  frames: GlassesFrame[];
  selectedFrame: GlassesFrame | null;
  onSelectFrame: (frame: GlassesFrame) => void;
  faceWidthMm?: number;
  className?: string;
}

function getFitCategory(frameWidthMm: number, faceWidthMm: number): FitCategory {
  const diff = frameWidthMm - faceWidthMm;
  if (diff <= -3) return 'tight';
  if (diff >= 5) return 'loose';
  return 'perfect';
}

const FIT_STYLES: Record<FitCategory, { bg: string; border: string; icon: typeof CheckCircle; iconColor: string }> = {
  tight: { bg: 'bg-orange-500/10', border: 'border-orange-500/50', icon: AlertCircle, iconColor: 'text-orange-500' },
  perfect: { bg: 'bg-green-500/10', border: 'border-green-500/50', icon: CheckCircle, iconColor: 'text-green-500' },
  loose: { bg: 'bg-blue-500/10', border: 'border-blue-500/50', icon: Info, iconColor: 'text-blue-500' },
};

export function GlassesSelector({ frames, selectedFrame, onSelectFrame, faceWidthMm, className }: GlassesSelectorProps) {
  return (
    <div className={cn("glass-panel rounded-xl p-4", className)}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Glasses className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Select Frames</h3>
        </div>
        {faceWidthMm != null && (
          <span className="text-xs text-muted-foreground">Your face width: <span className="font-medium text-foreground">{faceWidthMm?.toFixed(0) ?? 'N/A'}mm</span></span>
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
                  className={cn(
                    "w-20 h-16 rounded-lg border-2 overflow-hidden transition-all duration-200 hover:scale-105",
                    selectedFrame?.id === frame.id 
                      ? "border-primary ring-2 ring-primary/30" 
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <img
                    src={frame.imageUrl}
                    alt={frame.name}
                    className="w-full h-full object-contain p-1 bg-white"
                  />
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
                tight: 'Tight Fit',
                perfect: 'Perfect Fit',
                loose: 'Loose Fit',
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
