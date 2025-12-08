import { useState, useMemo } from 'react';
import { useCaptureData } from '@/context/CaptureContext';
import { GlassesSelector } from './GlassesSelector';
import { Glasses, AlertCircle, CheckCircle, Info, Loader2 } from 'lucide-react';
import type { GlassesFrame } from '@/types/face-validation';
import { cn } from '@/lib/utils';
import { useProcessedFrames, ProcessedFrame } from '@/hooks/useProcessedFrames';
import { Progress } from '@/components/ui/progress';

// Import frame images
import frame1Img from '@/assets/frames/frame1.png';
import frame2Img from '@/assets/frames/frame2.png';
import frame3Img from '@/assets/frames/frame3.png';

// Real glasses frames with dimensions
const FRAMES: GlassesFrame[] = [
  {
    id: '1',
    name: 'Pink Cat-Eye',
    imageUrl: frame1Img,
    category: 'cat-eye',
    color: 'Pink',
    width: 127,
    lensWidth: 50,
    noseBridge: 15,
    templeLength: 135,
  },
  {
    id: '2',
    name: 'Blue Round',
    imageUrl: frame2Img,
    category: 'round',
    color: 'Blue',
    width: 122,
    lensWidth: 44,
    noseBridge: 18,
    templeLength: 125,
  },
  {
    id: '3',
    name: 'Black Aviator',
    imageUrl: frame3Img,
    category: 'aviator',
    color: 'Black',
    width: 141,
    lensWidth: 55,
    noseBridge: 18,
    templeLength: 142,
  },
];

type FitCategory = 'tooSmall' | 'small' | 'ideal' | 'large' | 'oversized';

interface FrameOverlayResult {
  frameWidthPercent: number;
  frameHeightPercent: number;
  fitCategory: FitCategory;
  fitScore: number;
  positionX: number;
  positionY: number;
  rotation: number;
}

/**
 * Compute how to draw the frame so it is "true to scale" on the user's face.
 * Uses PD in mm + PD in pixels to get mm ⇄ pixel scale.
 */
function computeFrameOverlayFit(
  frameWidthMm: number,
  faceWidthMm: number,
  pdMm: number,
  pdPixelsNormalized: number, // PD as normalized 0-1 value
  eyeCenterX: number,
  eyeCenterY: number,
  eyeDeltaX: number,
  eyeDeltaY: number
): FrameOverlayResult {
  // 1. Get physical scale: mm -> normalized using PD
  const normalizedPerMm = pdPixelsNormalized / pdMm;

  // 2. True-to-scale frame width in normalized coordinates
  const frameWidthNormalized = frameWidthMm * normalizedPerMm;
  const frameWidthPercent = frameWidthNormalized * 100;

  // 3. Fit classification based on frame width vs face width
  const diffMm = frameWidthMm - faceWidthMm;

  let fitCategory: FitCategory;
  if (diffMm <= -10) {
    fitCategory = 'tooSmall';
  } else if (diffMm > -10 && diffMm < 0) {
    fitCategory = 'small';
  } else if (diffMm >= 0 && diffMm <= 10) {
    fitCategory = 'ideal';
  } else if (diffMm > 10 && diffMm <= 18) {
    fitCategory = 'large';
  } else {
    fitCategory = 'oversized';
  }

  // Normalize to a score: -1 = much too small, 0 = ideal, +1 = much too big
  const MIN_DIFF = -15;
  const MAX_DIFF = 20;
  const clampedDiff = Math.max(MIN_DIFF, Math.min(MAX_DIFF, diffMm));
  const fitScore = ((clampedDiff - MIN_DIFF) / (MAX_DIFF - MIN_DIFF)) * 2 - 1;

  // 4. Frame height (typical glasses are ~40% as tall as wide)
  const ESTIMATED_FRAME_HEIGHT_RATIO = 0.4;
  const frameHeightPercent = frameWidthPercent * ESTIMATED_FRAME_HEIGHT_RATIO;

  // 5. Eye line positioning
  // eyeLineFactor controls how high the frame sits relative to the eyes
  // 0.45 = frame sits so eye line is at 45% from top (lower eyebrow visible)
  const eyeLineFactor = 0.45;
  const frameHeightNormalized = frameWidthNormalized * ESTIMATED_FRAME_HEIGHT_RATIO;
  const verticalOffset = frameHeightNormalized * eyeLineFactor;

  // Position so eye center aligns with the lens center
  const positionX = eyeCenterX * 100;
  const positionY = (eyeCenterY - verticalOffset / 2 + frameHeightNormalized / 2) * 100;

  // Calculate rotation from eye positions
  const rotation = Math.atan2(eyeDeltaY, eyeDeltaX) * (180 / Math.PI);

  return {
    frameWidthPercent,
    frameHeightPercent,
    fitCategory,
    fitScore,
    positionX,
    positionY,
    rotation,
  };
}

const FIT_CONFIG: Record<FitCategory, { label: string; color: string; message: string; icon: typeof CheckCircle }> = {
  tooSmall: {
    label: 'Too Small',
    color: 'text-destructive',
    message: 'This frame will feel narrow on your face. Try a wider size.',
    icon: AlertCircle,
  },
  small: {
    label: 'Small',
    color: 'text-orange-500',
    message: 'This frame may feel slightly narrow.',
    icon: Info,
  },
  ideal: {
    label: 'Ideal Fit',
    color: 'text-green-500',
    message: 'Perfect fit for your face width!',
    icon: CheckCircle,
  },
  large: {
    label: 'Large',
    color: 'text-orange-500',
    message: 'This frame has a bold, larger look.',
    icon: Info,
  },
  oversized: {
    label: 'Oversized',
    color: 'text-destructive',
    message: 'This is a fashion-oversized frame.',
    icon: AlertCircle,
  },
};

export function FramesTab() {
  const { capturedData } = useCaptureData();
  const [selectedFrame, setSelectedFrame] = useState<ProcessedFrame | null>(null);
  
  // Process frames to remove backgrounds
  const { processedFrames, isProcessing, processingProgress } = useProcessedFrames(FRAMES);

  const overlayResult = useMemo(() => {
    if (!selectedFrame || !capturedData?.landmarks || !capturedData?.measurements) {
      return null;
    }

    const { landmarks, measurements } = capturedData;

    // Calculate PD in normalized coordinates (distance between pupils)
    const pdPixelsNormalized = Math.sqrt(
      Math.pow(landmarks.rightEye.x - landmarks.leftEye.x, 2) +
      Math.pow(landmarks.rightEye.y - landmarks.leftEye.y, 2)
    );

    const eyeCenterX = (landmarks.leftEye.x + landmarks.rightEye.x) / 2;
    const eyeCenterY = (landmarks.leftEye.y + landmarks.rightEye.y) / 2;
    const eyeDeltaX = landmarks.rightEye.x - landmarks.leftEye.x;
    const eyeDeltaY = landmarks.rightEye.y - landmarks.leftEye.y;

    return computeFrameOverlayFit(
      selectedFrame.width,
      measurements.face_width,
      measurements.pd_total,
      pdPixelsNormalized,
      eyeCenterX,
      eyeCenterY,
      eyeDeltaX,
      eyeDeltaY
    );
  }, [selectedFrame, capturedData]);

  if (!capturedData) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">No capture data available</p>
      </div>
    );
  }

  const getGlassesStyle = () => {
    if (!overlayResult) return {};

    return {
      position: 'absolute' as const,
      left: `${overlayResult.positionX}%`,
      top: `${overlayResult.positionY}%`,
      width: `${overlayResult.frameWidthPercent}%`,
      height: `${overlayResult.frameHeightPercent}%`,
      transform: `translate(-50%, -50%) rotate(${overlayResult.rotation}deg)`,
      transformOrigin: 'center center',
    };
  };

  const fitInfo = overlayResult ? FIT_CONFIG[overlayResult.fitCategory] : null;
  const FitIcon = fitInfo?.icon || CheckCircle;

  return (
    <div className="space-y-6 p-4">
      {/* Try-on Preview */}
      <div className="bg-muted/30 rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Glasses className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground">Virtual Try-On Preview</h3>
          </div>
          
          {/* Fit indicator badge */}
          {fitInfo && overlayResult && (
            <div className={cn("flex items-center gap-1.5 px-3 py-1 rounded-full bg-background border", fitInfo.color)}>
              <FitIcon className="h-4 w-4" />
              <span className="text-xs font-medium">{fitInfo.label}</span>
            </div>
          )}
        </div>
        
        <div className="relative rounded-lg overflow-hidden bg-black aspect-[4/3]">
          <img
            src={capturedData.processedImageDataUrl}
            alt="Try-on preview"
            className="w-full h-full object-contain"
          />
          
          {/* Glasses overlay */}
          {selectedFrame && overlayResult && (
            <div 
              className="pointer-events-none"
              style={getGlassesStyle()}
            >
              <img
                src={selectedFrame.processedImageUrl}
                alt={selectedFrame.name}
                className="w-full h-full object-contain"
                style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}
              />
            </div>
          )}

          {!selectedFrame && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <p className="text-white/80 text-sm">Select a frame below to try on</p>
            </div>
          )}
        </div>

        {/* Fit message */}
        {fitInfo && overlayResult && (
          <div className={cn("mt-3 flex items-center gap-2 text-sm", fitInfo.color)}>
            <FitIcon className="h-4 w-4 flex-shrink-0" />
            <span>{fitInfo.message}</span>
          </div>
        )}
      </div>

      {/* Processing indicator */}
      {isProcessing && (
        <div className="bg-muted/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">
              Processing frames for transparent overlay...
            </span>
          </div>
          <Progress value={processingProgress} className="h-2" />
        </div>
      )}

      {/* Frames selector */}
      <GlassesSelector
        frames={processedFrames}
        selectedFrame={selectedFrame}
        onSelectFrame={setSelectedFrame}
        faceWidthMm={capturedData.measurements.face_width}
      />
    </div>
  );
}
