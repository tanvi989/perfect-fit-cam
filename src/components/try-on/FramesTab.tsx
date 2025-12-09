import { useState, useMemo, useRef } from 'react';
import { useCaptureData } from '@/context/CaptureContext';
import { GlassesSelector } from './GlassesSelector';
import { FrameAdjustmentControls } from './FrameAdjustmentControls';
import { LandmarksDebugOverlay } from './LandmarksDebugOverlay';
import { Glasses, AlertCircle, CheckCircle, Info, Eye } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import type { GlassesFrame, ApiScale, FrameOffsets } from '@/types/face-validation';
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
type CalibrationMode = 'calibrated' | 'visual-only';

interface FrameTransform {
  anchorX: number;       // Nose bridge X position (anchor point)
  anchorY: number;       // Nose bridge Y position (anchor point)
  scale: number;         // Scale factor for the frame image
  rotationRad: number;   // Rotation in radians
  fit: FitCategory;      // Fit classification
  frameHeightPx: number; // Calculated frame height in pixels
  mode: CalibrationMode; // Whether using calibrated or visual-only mode
  eyeDistancePx: number; // For debugging
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
 * Calculate center point from array of [x, y] coordinates
 */
function getCenter(points: number[][]): { x: number; y: number } {
  if (!points || points.length === 0) {
    return { x: 0, y: 0 };
  }
  const sumX = points.reduce((acc, p) => acc + (p[0] || 0), 0);
  const sumY = points.reduce((acc, p) => acc + (p[1] || 0), 0);
  return {
    x: sumX / points.length,
    y: sumY / points.length,
  };
}

/**
 * Calculate Euclidean distance between two points
 */
function distance(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

/**
 * Clamp rotation to natural head tilt limits (±15 degrees)
 */
function clampRotation(radians: number): number {
  const maxTilt = 15 * (Math.PI / 180);
  return Math.max(-maxTilt, Math.min(maxTilt, radians));
}

/**
 * Professional frame overlay calculation:
 * 
 * 1. Compute eyeCenterLeft and eyeCenterRight by averaging eye landmarks
 * 2. Compute noseBridgePoint from nose_bridge landmarks (anchor point)
 * 3. Compute head tilt: angle = atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x)
 * 4. frameWidthPx = frameWidthMM * (1 / mm_per_pixel)
 * 5. scaleFactor = frameWidthPx / frameImageNaturalWidth
 * 6. Position anchor at nose bridge point
 * 7. Apply per-frame offsets if defined
 */
function computeFrameTransform(
  frame: GlassesFrame,
  regionPoints: any,
  scale: ApiScale,
  faceWidthMm: number,
  frameImageWidth: number,
  frameImageHeight: number
): FrameTransform | null {
  // Extract landmark arrays
  const leftEyePoints = regionPoints.left_eye;
  const rightEyePoints = regionPoints.right_eye;
  const noseBridgePoints = regionPoints.nose_bridge;

  if (!leftEyePoints?.length || !rightEyePoints?.length) {
    console.warn('Missing eye landmarks');
    return null;
  }

  // Compute eye centers by averaging landmark points
  const leftEyeCenter = getCenter(leftEyePoints);
  const rightEyeCenter = getCenter(rightEyePoints);

  // Compute eye distance (PD) in pixels
  const eyeDistancePx = distance(leftEyeCenter, rightEyeCenter);

  // Compute nose bridge point (anchor for glasses)
  let noseBridgePoint: { x: number; y: number };
  if (noseBridgePoints?.length) {
    noseBridgePoint = getCenter(noseBridgePoints);
  } else {
    // Fallback: use midpoint between eyes, slightly below
    noseBridgePoint = {
      x: (leftEyeCenter.x + rightEyeCenter.x) / 2,
      y: (leftEyeCenter.y + rightEyeCenter.y) / 2 + eyeDistancePx * 0.1,
    };
  }

  // Check mm_per_pixel reliability
  const mmPerPixel = scale.mm_per_pixel;
  const isCalibrated = mmPerPixel && mmPerPixel > 0.1 && mmPerPixel < 1.0;

  let frameWidthPx: number;
  let mode: CalibrationMode;

  if (isCalibrated) {
    // Calibrated: frameWidthPx = frameWidthMM * (1 / mm_per_pixel)
    const pixelsPerMM = 1 / mmPerPixel;
    frameWidthPx = frame.width * pixelsPerMM;
    mode = 'calibrated';
  } else {
    // Fallback: scale to ~2.8-3.2× eyeDistancePx
    frameWidthPx = eyeDistancePx * 3.0;
    mode = 'visual-only';
  }

  // Validate: clamp if excessively large/small
  const minFrameWidth = eyeDistancePx * 2.4;
  const maxFrameWidth = eyeDistancePx * 3.2;
  if (frameWidthPx < minFrameWidth) frameWidthPx = minFrameWidth;
  if (frameWidthPx > maxFrameWidth) frameWidthPx = maxFrameWidth;

  // Calculate scale factor
  const scaleFactor = frameWidthPx / frameImageWidth;

  // Calculate frame height
  const frameHeightPx = (frameImageHeight / frameImageWidth) * frameWidthPx;

  // Compute head tilt angle
  const rawRotation = Math.atan2(
    rightEyeCenter.y - leftEyeCenter.y,
    rightEyeCenter.x - leftEyeCenter.x
  );
  const rotationRad = clampRotation(rawRotation);

  // Fit classification
  const diff = frame.width - faceWidthMm;
  let fit: FitCategory;
  if (diff <= -3) fit = 'tight';
  else if (diff >= 5) fit = 'loose';
  else fit = 'perfect';

  return {
    anchorX: noseBridgePoint.x,
    anchorY: noseBridgePoint.y,
    scale: scaleFactor,
    rotationRad,
    fit,
    frameHeightPx,
    mode,
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
  const [frameImageSize, setFrameImageSize] = useState({ width: 0, height: 0 });
  const [adjustments, setAdjustments] = useState<AdjustmentValues>(DEFAULT_ADJUSTMENTS);
  const [showDebugOverlay, setShowDebugOverlay] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setContainerSize({ width: img.clientWidth, height: img.clientHeight });
  };

  const handleFrameImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setFrameImageSize({ width: img.naturalWidth, height: img.naturalHeight });
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

  // Compute transform using nose-bridge anchoring
  const transform = useMemo(() => {
    if (!selectedFrame || !capturedData?.apiLandmarks) return null;

    const { apiLandmarks, measurements } = capturedData;
    if (!apiLandmarks.region_points || !apiLandmarks.scale) return null;
    if (frameImageSize.width === 0 || frameImageSize.height === 0) return null;

    return computeFrameTransform(
      selectedFrame,
      apiLandmarks.region_points,
      apiLandmarks.scale,
      measurements.face_width,
      frameImageSize.width,
      frameImageSize.height
    );
  }, [selectedFrame, capturedData, frameImageSize]);

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
  const getGlassesStyle = (): React.CSSProperties => {
    if (!transform || containerSize.width === 0 || !capturedData?.processedImageDataUrl) {
      return { display: 'none' };
    }

    const img = imageRef.current;
    if (!img) return { display: 'none' };

    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;

    // Scale ratios from natural to displayed size
    const scaleX = containerSize.width / naturalWidth;
    const scaleY = containerSize.height / naturalHeight;
    const displayScaleRatio = Math.min(scaleX, scaleY);

    // Convert anchor point to display coordinates
    const displayAnchorX = transform.anchorX * scaleX + adjustments.offsetX;
    const displayAnchorY = transform.anchorY * scaleY + adjustments.offsetY;

    // Apply adjustments to scale and rotation
    const displayScale = transform.scale * displayScaleRatio * adjustments.scaleAdjust;
    const rotationDeg = (transform.rotationRad * (180 / Math.PI)) + 180 + adjustments.rotationAdjust;

    return {
      position: 'absolute',
      left: `${displayAnchorX}px`,
      top: `${displayAnchorY}px`,
      // Order: translate to center, then scale, then rotate
      transform: `translate(-50%, -50%) scale(${displayScale}) rotate(${rotationDeg}deg)`,
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
            {/* Debug overlay toggle */}
            <div className="flex items-center gap-2">
              <Switch
                id="debug-overlay"
                checked={showDebugOverlay}
                onCheckedChange={setShowDebugOverlay}
              />
              <Label htmlFor="debug-overlay" className="text-xs text-muted-foreground cursor-pointer">
                <Eye className="h-3 w-3 inline mr-1" />
                Landmarks
              </Label>
            </div>

            {/* Fit badges */}
            {transform && (
              <div className="flex items-center gap-2">
                {transform.mode === 'visual-only' && (
                  <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-100 text-amber-700 text-xs">
                    <AlertCircle className="h-3 w-3" />
                    <span>Visual Only</span>
                  </div>
                )}
                {fitInfo && (
                  <div className={cn("flex items-center gap-1.5 px-3 py-1 rounded-full bg-background border", fitInfo.color)}>
                    <FitIcon className="h-4 w-4" />
                    <span className="text-xs font-medium">{fitInfo.label}</span>
                  </div>
                )}
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

          {/* Landmarks debug overlay */}
          {showDebugOverlay && capturedData.apiLandmarks && imageRef.current && (
            <LandmarksDebugOverlay
              landmarks={capturedData.apiLandmarks}
              containerWidth={containerSize.width}
              containerHeight={containerSize.height}
              naturalWidth={imageRef.current.naturalWidth}
              naturalHeight={imageRef.current.naturalHeight}
            />
          )}

          {/* Frame overlay with CSS transforms */}
          {selectedFrame && transform && (
            <img
              src={selectedFrame.imageUrl}
              alt={selectedFrame.name}
              style={getGlassesStyle()}
              onLoad={handleFrameImageLoad}
            />
          )}

          {/* Hidden frame image to get dimensions before display */}
          {selectedFrame && frameImageSize.width === 0 && (
            <img
              src={selectedFrame.imageUrl}
              alt=""
              className="hidden"
              onLoad={handleFrameImageLoad}
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
            Scale: {(transform.scale * adjustments.scaleAdjust).toFixed(3)} |
            Rotation: {((transform.rotationRad * 180 / Math.PI) + adjustments.rotationAdjust).toFixed(1)}° |
            Anchor: ({transform.anchorX.toFixed(0)}, {transform.anchorY.toFixed(0)}) |
            PD: {transform.eyeDistancePx.toFixed(0)}px
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
        faceWidthMm={capturedData.measurements.face_width}
      />
    </div>
  );
}
