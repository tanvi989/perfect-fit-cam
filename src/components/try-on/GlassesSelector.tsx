import { cn } from '@/lib/utils';
import type { GlassesFrame } from '@/types/face-validation';
import { Glasses } from 'lucide-react';

interface GlassesSelectorProps {
  frames: GlassesFrame[];
  selectedFrame: GlassesFrame | null;
  onSelectFrame: (frame: GlassesFrame) => void;
  className?: string;
}

export function GlassesSelector({ frames, selectedFrame, onSelectFrame, className }: GlassesSelectorProps) {
  return (
    <div className={cn("glass-panel rounded-xl p-4", className)}>
      <div className="flex items-center gap-2 mb-3">
        <Glasses className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Select Frames</h3>
      </div>

      {frames.length > 0 ? (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {frames.map((frame) => (
            <button
              key={frame.id}
              onClick={() => onSelectFrame(frame)}
              className={cn(
                "flex-shrink-0 w-20 h-16 rounded-lg border-2 overflow-hidden transition-all duration-200 hover:scale-105",
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
          ))}
        </div>
      ) : (
        <div className="py-6 text-center">
          <Glasses className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No frames available</p>
          <p className="text-xs text-muted-foreground mt-1">Upload glasses images to try them on</p>
        </div>
      )}

      {selectedFrame && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-sm font-medium text-foreground">{selectedFrame.name}</p>
          <p className="text-xs text-muted-foreground capitalize">{selectedFrame.category} • {selectedFrame.color}</p>
        </div>
      )}
    </div>
  );
}