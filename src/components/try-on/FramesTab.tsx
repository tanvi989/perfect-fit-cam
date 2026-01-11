import { useState, useMemo, useRef } from 'react';
import { useCaptureData } from '@/context/CaptureContext';
import { GlassesSelector } from './GlassesSelector';
import { FrameAdjustmentControls } from './FrameAdjustmentControls';
import { Glasses, AlertCircle, CheckCircle, Info } from 'lucide-react';
import type { GlassesFrame, FrameOffsets, FaceLandmarks } from '@/types/face-validation';
import { cn } from '@/lib/utils';

// Import frame images
import frame1Img from '@/assets/frames/frame1.png';
import frame2Img from '@/assets/frames/frame2.png';
import frame3Img from '@/assets/frames/frame3.png';

// Real glasses frames with dimensions (mm) and per-frame offsets
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
    offsets: { offsetX: 0, offsetY: 0, scaleAdjust: 1.0, rotationAdjust: 0 },
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
    offsets: { offsetX: 0, offsetY: 0, scaleAdjust: 1.0, rotationAdjust: 0 },
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
    offsets: { offsetX: 0, offsetY: 0, scaleAdjust: 1.0, rotationAdjust: 0 },
  },
];

type FitCategory = 'tight' | 'perfect' | 'loose';

// Frame PNG internal eye width in pixels (distance between lens centers in the PNG)
// This should match the actual frame PNG - adjust per frame if needed
const FRAME_PNG_INTERNAL_EYE_WIDTH_PX: Record<string, number> = {
  '1': 200, // Pink Cat-Eye
  '2': 180, // Blue Round
  '3': 220, // Black Aviator
};

interface FrameTransform {
  midX: number;          // Midpoint X between eye centers
  midY: number;          // Midpoint Y between eye centers (adjusted for nose bridge)
  scaleFactor: number;   // Scale factor based on eye distance / frame internal width
  angleRad: number;      // Rotation in radians from atan2
  fit: FitCategory;      // Fit classification
  eyeDistancePx: number; // Distance between eye centers
}

interface AdjustmentValues {
  offsetX: number;
  offsetY: number;
  scaleAdjust: number;
  rotationAdjust: number;
}

const DEFAULT_ADJUSTMENTS: AdjustmentValues = {
  offsetX: 0,
  offsetY: 0,
  scaleAdjust: 1.0,
  rotationAdjust: 0,
};

/**
 * Professional frame overlay calculation using exact math:
 * 
 * 1. Calculate eye centers from local face landmarks
 * 2. Calculate angle = atan2(leftCenter.y - rightCenter.y, leftCenter.x - rightCenter.x)
 * 3. Calculate eye distance in pixels
 * 4. Calculate scale factor = eyeDistancePx / FRAME_PNG_INTERNAL_EYE_WIDTH
 * 5. Position at midpoint between eyes, slightly above for natural fit
 */
/**
 * Compute frame overlay transform.
 * 
 * Local landmarks are normalized 0-1 (MediaPipe), so we first convert them
 * to pixel positions in the natural image size, then scale to container size.
 */
function computeFrameTransform(
  frame: GlassesFrame,
  landmarks: FaceLandmarks,
  faceWidthMm: number,
  containerSize: { width: number; height: number },
  naturalSize: { width: number; height: number }
): FrameTransform | null {
  if (naturalSize.width === 0 || naturalSize.height === 0) return null;

  // Landmarks are 0-1 normalized. Convert to natural image pixels first.
  const leftEyeNatural = {
    x: landmarks.leftEye.x * naturalSize.width,
    y: landmarks.leftEye.y * naturalSize.height,
  };
  const rightEyeNatural = {
    x: landmarks.rightEye.x * naturalSize.width,
    y: landmarks.rightEye.y * naturalSize.height,
  };

  // Scale from natural to displayed container size
  const displayScale = {
    x: containerSize.width / naturalSize.width,
    y: containerSize.height / naturalSize.height,
  };

  const leftCenter = {
    x: leftEyeNatural.x * displayScale.x,
    y: leftEyeNatural.y * displayScale.y,
  };
  const rightCenter = {
    x: rightEyeNatural.x * displayScale.x,
    y: rightEyeNatural.y * displayScale.y,
  };

  // Calculate angle using atan2
  const angleRad = Math.atan2(
    leftCenter.y - rightCenter.y,
    leftCenter.x - rightCenter.x
  );

  // Calculate eye distance in displayed pixels
  const eyeDistancePx = Math.sqrt(
    Math.pow(leftCenter.x - rightCenter.x, 2) +
    Math.pow(leftCenter.y - rightCenter.y, 2)
  );

  // Calculate scale factor: how much to scale frame PNG so its internal
  // eye width matches the detected eye distance in pixels
  const frameInternalWidth = FRAME_PNG_INTERNAL_EYE_WIDTH_PX[frame.id] || 200;
  const scaleFactor = eyeDistancePx / frameInternalWidth;

  // Position - midpoint between eyes
  const midX = (leftCenter.x + rightCenter.x) / 2;
  const midY = (leftCenter.y + rightCenter.y) / 2;

  // Adjust Y slightly above eye center for natural nose bridge placement
  const frameY = midY - (0.08 * eyeDistancePx);

  // Fit classification based on frame width vs face width
  const diff = frame.width - faceWidthMm;
  let fit: FitCategory;
  if (diff <= -3) fit = 'tight';
  else if (diff >= 5) fit = 'loose';
  else fit = 'perfect';

  return {
    midX,
    midY: frameY,
    scaleFactor,
    angleRad,
    fit,
    eyeDistancePx,
  };
}

const FIT_CONFIG: Record<FitCategory, { label: string; color: string; message: string; icon: typeof CheckCircle }> = {
  tight: {
    label: 'Tight Fit',
    color: 'text-orange-500',
    message: 'This frame may feel narrow on your face.',
    icon: AlertCircle,
  },
  perfect: {
    label: 'Perfect Fit',
    color: 'text-green-500',
    message: 'This frame fits your face perfectly!',
    icon: CheckCircle,
  },
  loose: {
    label: 'Loose Fit',
    color: 'text-blue-500',
    message: 'This frame has a relaxed, looser fit.',
    icon: Info,
  },
};

export function FramesTab() {
  const { capturedData } = useCaptureData();
  const [selectedFrame, setSelectedFrame] = useState<GlassesFrame | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [adjustments, setAdjustments] = useState<AdjustmentValues>(DEFAULT_ADJUSTMENTS);
  const imageRef = useRef<HTMLImageElement>(null);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setContainerSize({ width: img.clientWidth, height: img.clientHeight });
  };

  const handleFrameSelect = (frame: GlassesFrame | null) => {
    setSelectedFrame(frame);
    // Apply frame's default offsets if available
    if (frame?.offsets) {
      setAdjustments(frame.offsets);
    } else {
      setAdjustments(DEFAULT_ADJUSTMENTS);
    }
  };

  const handleResetAdjustments = () => {
    setAdjustments(selectedFrame?.offsets || DEFAULT_ADJUSTMENTS);
  };

  // Compute transform using eye-center based math from local face detection
  const transform = useMemo(() => {
    if (!selectedFrame || !capturedData?.landmarks || !imageRef.current) return null;

    const { landmarks, measurements } = capturedData;
    const img = imageRef.current;
    
    const naturalSize = {
      width: img.naturalWidth || 1,
      height: img.naturalHeight || 1,
    };

    return computeFrameTransform(
      selectedFrame,
      landmarks,
      measurements?.face_width ?? 0,
      containerSize,
      naturalSize
    );
  }, [selectedFrame, capturedData, containerSize]);

  if (!capturedData) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">No capture data available</p>
      </div>
    );
  }

  /**
   * Generate CSS transform for frame overlay:
   * 
   * 1. Position at anchor point (nose bridge)
   * 2. translate(-50%, -50%) to center PNG bridge at anchor
   * 3. Apply rotation to match head tilt
   * 4. Apply scale factor
   * 5. Apply user adjustments
   */
  /**
   * Apply CSS transform for frame overlay:
   * 
   * frameElement.style.left = `${midX}px`;
   * frameElement.style.top = `${frameY}px`;
   * frameElement.style.transform = `translate(-50%, -50%) rotate(${angleRad}rad) scale(${scaleFactor})`;
   */
  const getGlassesStyle = (): React.CSSProperties => {
    if (!transform || containerSize.width === 0 || !capturedData?.processedImageDataUrl) {
      return { display: 'none' };
    }

    // Transform already has midX/midY in container (display) coordinates
    const displayX = transform.midX + adjustments.offsetX;
    const displayY = transform.midY + adjustments.offsetY;

    // Apply scale factor with user adjustment
    const finalScale = transform.scaleFactor * adjustments.scaleAdjust;

    // Apply rotation (head tilt angle) with user adjustment
    const finalRotation = transform.angleRad + (adjustments.rotationAdjust * Math.PI / 180);

    return {
      position: 'absolute',
      left: `${displayX}px`,
      top: `${displayY}px`,
      // Exact transform order: translate(-50%, -50%) rotate() scale()
      transform: `translate(-50%, -50%) rotate(${finalRotation}rad) scale(${finalScale})`,
      transformOrigin: 'center center',
      pointerEvents: 'none',
      filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
    };
  };

  const fitInfo = transform ? FIT_CONFIG[transform.fit] : null;
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

          <div className="flex items-center gap-3">

            {/* Fit badge */}
            {transform && fitInfo && (
              <div className={cn("flex items-center gap-1.5 px-3 py-1 rounded-full bg-background border", fitInfo.color)}>
                <FitIcon className="h-4 w-4" />
                <span className="text-xs font-medium">{fitInfo.label}</span>
              </div>
            )}
          </div>
        </div>

        <div className="relative rounded-lg overflow-hidden bg-black aspect-[4/3]">
          {/* User's face image */}
          <img
            ref={imageRef}
            src={capturedData.processedImageDataUrl}
            alt="Try-on preview"
            className="w-full h-full object-contain"
            onLoad={handleImageLoad}
          />


          {/* Frame overlay with CSS transforms */}
          {selectedFrame && transform && (
            <img
              src={selectedFrame.imageUrl}
              alt={selectedFrame.name}
              style={getGlassesStyle()}
            />
          )}

          {!selectedFrame && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <p className="text-white/80 text-sm">Select a frame below to try on</p>
            </div>
          )}
        </div>

        {/* Fit message */}
        {fitInfo && transform && (
          <div className={cn("mt-3 flex items-center gap-2 text-sm", fitInfo.color)}>
            <FitIcon className="h-4 w-4 flex-shrink-0" />
            <span>{fitInfo.message}</span>
          </div>
        )}

        {/* Debug info */}
        {transform && (
          <div className="mt-2 text-xs text-muted-foreground font-mono">
            Scale: {((transform.scaleFactor ?? 0) * (adjustments?.scaleAdjust ?? 1)).toFixed(3)} |
            Angle: {((transform.angleRad ?? 0) * 180 / Math.PI).toFixed(1)}° |
            Eye Distance: {(transform.eyeDistancePx ?? 0).toFixed(0)}px |
            Position: ({(transform.midX ?? 0).toFixed(0)}, {(transform.midY ?? 0).toFixed(0)})
          </div>
        )}
      </div>

      {/* Manual adjustment controls */}
      {selectedFrame && (
        <FrameAdjustmentControls
          values={adjustments}
          onChange={setAdjustments}
          onReset={handleResetAdjustments}
        />
      )}

      {/* Frames selector */}
      <GlassesSelector
        frames={FRAMES}
        selectedFrame={selectedFrame}
        onSelectFrame={handleFrameSelect}
        faceWidthMm={capturedData?.measurements?.face_width ?? 0}
      />
    </div>
  );
}
