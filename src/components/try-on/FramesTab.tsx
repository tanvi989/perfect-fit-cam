import { useState, useMemo, useRef } from 'react';
import { useCaptureData } from '@/context/CaptureContext';
import { GlassesSelector } from './GlassesSelector';
import { Glasses, AlertCircle, CheckCircle, Info } from 'lucide-react';
import type { GlassesFrame, ApiScale } from '@/types/face-validation';
import { cn } from '@/lib/utils';

// Import frame images
import frame1Img from '@/assets/frames/frame1.png';
import frame2Img from '@/assets/frames/frame2.png';
import frame3Img from '@/assets/frames/frame3.png';

// Real glasses frames with dimensions (mm)
const FRAMES: GlassesFrame[] = [
  {
    id: '1',
    name: 'Pink Cat-Eye',
    imageUrl: frame1Img,
    category: 'cat-eye',
    color: 'Pink',
    width: 127,        // frame_width_mm
    lensWidth: 50,     // lens_width_mm
    noseBridge: 15,    // bridge_mm
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

type FitCategory = 'tight' | 'perfect' | 'loose';
type CalibrationMode = 'calibrated' | 'visual-only';

interface FrameTransform {
  centerX: number;       // Frame center X position in pixels
  centerY: number;       // Frame center Y position in pixels
  scale: number;         // Scale factor for the frame image
  rotationRad: number;   // Rotation in radians
  fit: FitCategory;      // Fit classification
  frameHeightPx: number; // Calculated frame height in pixels
  mode: CalibrationMode; // Whether using calibrated or visual-only mode
}

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
  const maxTilt = 15 * (Math.PI / 180); // 15 degrees in radians
  return Math.max(-maxTilt, Math.min(maxTilt, radians));
}

/**
 * Professional frame overlay calculation:
 * 
 * Input:
 * - Face landmarks: left_eye, right_eye, nose_bridge
 * - mm_per_pixel calibration from PD measurement
 * - Real frame specs (frame_width_mm, bridge_mm, lens_width_mm)
 * - Frame PNG natural dimensions
 * 
 * Compute:
 * - eyeDistancePx = distance between eye centers
 * - frameWidthPx = frame_width_mm / mm_per_pixel
 * - scale = frameWidthPx / frameImageNaturalWidth
 * - rotation = atan2(deltaY, deltaX) between eyes (clamped)
 * - centerX/Y = midpoint between eye centers
 * - verticalOffset based on nose_bridge landmark
 * 
 * Fallback:
 * - If mm_per_pixel unreliable: scale frame to ~3× eyeDistancePx
 */
function computeFrameTransform(
  frame: GlassesFrame,
  regionPoints: any,
  scale: ApiScale,
  faceWidthMm: number,
  frameImageWidth: number,
  frameImageHeight: number
): FrameTransform | null {
  // Step 1: Extract landmark arrays
  const leftEyePoints = regionPoints.left_eye;
  const rightEyePoints = regionPoints.right_eye;
  const noseBridgePoints = regionPoints.nose_bridge;

  if (!leftEyePoints?.length || !rightEyePoints?.length) {
    console.warn('Missing eye landmarks in region_points');
    return null;
  }

  // Step 2: Compute eye centers by averaging landmark points
  const leftEyeCenter = getCenter(leftEyePoints);
  const rightEyeCenter = getCenter(rightEyePoints);

  // Step 3: Compute eye distance (PD) in pixels
  const eyeDistancePx = distance(leftEyeCenter, rightEyeCenter);

  // Step 4: Check mm_per_pixel reliability
  const mmPerPixel = scale.mm_per_pixel;
  const isCalibrated = mmPerPixel && mmPerPixel > 0.1 && mmPerPixel < 1.0;
  
  let frameWidthPx: number;
  let mode: CalibrationMode;

  if (isCalibrated) {
    // Calibrated mode: Use mm_per_pixel
    const pixelsPerMM = 1 / mmPerPixel;
    frameWidthPx = frame.width * pixelsPerMM;
    mode = 'calibrated';
  } else {
    // Fallback: Visual-only mode - scale to ~3× eyeDistancePx
    frameWidthPx = eyeDistancePx * 3.0;
    mode = 'visual-only';
    console.warn('Using visual-only mode: mm_per_pixel unreliable');
  }

  // Validate fit: clamp if excessively large/small relative to eyeDistancePx
  const minFrameWidth = eyeDistancePx * 2.4;
  const maxFrameWidth = eyeDistancePx * 3.2;
  
  if (frameWidthPx < minFrameWidth) {
    frameWidthPx = minFrameWidth;
  } else if (frameWidthPx > maxFrameWidth) {
    frameWidthPx = maxFrameWidth;
  }

  // Step 5: Calculate scale factor = frameWidthPx / naturalPNGwidth
  const scaleFactor = frameWidthPx / frameImageWidth;

  // Step 6: Calculate frame height based on aspect ratio
  const frameHeightPx = (frameImageHeight / frameImageWidth) * frameWidthPx;

  // Step 7: Position at midpoint between eye centers
  const eyeCenterX = (leftEyeCenter.x + rightEyeCenter.x) / 2;
  const eyeCenterY = (leftEyeCenter.y + rightEyeCenter.y) / 2;
  
  // Vertical offset: use nose_bridge if available, otherwise use frame height ratio
  let verticalOffset = frameHeightPx * 0.15; // Default: lift by 15% of frame height
  
  if (noseBridgePoints?.length) {
    const noseBridgeCenter = getCenter(noseBridgePoints);
    // Position frame so bridge aligns with nose bridge landmark
    // The nose bridge Y is typically slightly below eye center
    const noseBridgeOffset = eyeCenterY - noseBridgeCenter.y;
    verticalOffset = Math.max(0, noseBridgeOffset + frameHeightPx * 0.1);
  }
  
  const adjustedCenterY = eyeCenterY - verticalOffset;

  // Step 8: Compute rotation angle and clamp to natural limits
  const rawRotation = Math.atan2(
    rightEyeCenter.y - leftEyeCenter.y,
    rightEyeCenter.x - leftEyeCenter.x
  );
  const rotationRad = clampRotation(rawRotation);

  // Fit classification based on frame width vs face width
  const diff = frame.width - faceWidthMm;
  let fit: FitCategory;
  if (diff <= -3) {
    fit = 'tight';
  } else if (diff >= 5) {
    fit = 'loose';
  } else {
    fit = 'perfect';
  }

  console.log('Frame overlay:', {
    mode,
    eyeDistancePx: eyeDistancePx.toFixed(1),
    frameWidthPx: frameWidthPx.toFixed(1),
    scaleFactor: scaleFactor.toFixed(3),
    verticalOffset: verticalOffset.toFixed(1),
    rotationDeg: (rotationRad * 180 / Math.PI).toFixed(2)
  });

  return {
    centerX: eyeCenterX,
    centerY: adjustedCenterY,
    scale: scaleFactor,
    rotationRad,
    fit,
    frameHeightPx,
    mode,
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
  const imageRef = useRef<HTMLImageElement>(null);

  // Get container dimensions when image loads
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    // Use displayed size, not natural size
    setContainerSize({ 
      width: img.clientWidth, 
      height: img.clientHeight 
    });
  };

  // Get frame image dimensions when it loads
  const handleFrameImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setFrameImageSize({ 
      width: img.naturalWidth, 
      height: img.naturalHeight 
    });
  };

  // Compute transform using the professional calculation method
  const transform = useMemo(() => {
    if (!selectedFrame || !capturedData?.apiLandmarks) {
      return null;
    }

    const { apiLandmarks, measurements } = capturedData;
    
    if (!apiLandmarks.region_points || !apiLandmarks.scale) {
      console.warn('Missing region_points or scale from API');
      return null;
    }

    if (frameImageSize.width === 0 || frameImageSize.height === 0) {
      return null;
    }

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
   * Step 9: Generate CSS transform for the frame overlay
   * 
   * The transform is applied in this order:
   * 1. translate(-50%, -50%) - Center the image on its position point
   * 2. scale(scale) - Scale the frame based on PD ratio
   * 3. rotate(angle) - Rotate to match head tilt
   */
  /**
   * Generate CSS transform for frame overlay (Rule 4):
   * 
   * position: absolute;
   * transform: translate(-50%, -50%) rotate(rotationDeg) scale(scaleFactor);
   * 
   * Transform origin is center between both eyes.
   */
  /**
   * Generate CSS transform for frame overlay:
   * 
   * Transform origin at center (bridge point of PNG).
   * Apply: translate(-50%, -50%), then scale, then rotate.
   */
  const getGlassesStyle = (): React.CSSProperties => {
    if (!transform || containerSize.width === 0 || !capturedData?.processedImageDataUrl) {
      return { display: 'none' };
    }

    const img = imageRef.current;
    if (!img) return { display: 'none' };

    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;
    
    // Calculate scale ratios from natural to displayed size
    const scaleX = containerSize.width / naturalWidth;
    const scaleY = containerSize.height / naturalHeight;

    // Convert API coordinates to displayed coordinates
    const displayX = transform.centerX * scaleX;
    const displayY = transform.centerY * scaleY;
    
    // Scale factor adjusted for display scaling (use uniform scale)
    const displayScaleRatio = Math.min(scaleX, scaleY);
    const displayScale = transform.scale * displayScaleRatio;

    // Rotation: +180° to flip frame to face user (PNG faces outward by default)
    const rotationDeg = (transform.rotationRad * (180 / Math.PI)) + 180;

    return {
      position: 'absolute',
      left: `${displayX}px`,
      top: `${displayY}px`,
      // Apply: translate(-50%, -50%) to center on bridge, then scale, then rotate
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
          
          {/* Fit indicator badge */}
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

        {/* Debug info (remove in production) */}
        {transform && (
          <div className="mt-2 text-xs text-muted-foreground font-mono">
            Scale: {transform.scale.toFixed(3)} | 
            Rotation: {(transform.rotationRad * 180 / Math.PI).toFixed(1)}° | 
            Position: ({transform.centerX.toFixed(0)}, {transform.centerY.toFixed(0)})
          </div>
        )}
      </div>

      {/* Frames selector */}
      <GlassesSelector
        frames={FRAMES}
        selectedFrame={selectedFrame}
        onSelectFrame={setSelectedFrame}
        faceWidthMm={capturedData.measurements.face_width}
      />
    </div>
  );
}
