import { useState, useMemo } from 'react';
import { useCaptureData } from '@/context/CaptureContext';
import { GlassesSelector } from './GlassesSelector';
import { Glasses, AlertCircle, CheckCircle, Info } from 'lucide-react';
import type { GlassesFrame, ApiRegionPoints, ApiScale } from '@/types/face-validation';
import { cn } from '@/lib/utils';

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

type FitCategory = 'tight' | 'perfect' | 'loose';

interface FrameTransform {
  x: number;           // Center X position in pixels
  y: number;           // Center Y position in pixels
  scale: number;       // Scale factor for the frame
  rotationDeg: number; // Rotation in degrees
  frameWidthPx: number; // Frame width in pixels
  fit: FitCategory;    // Fit classification
}

/**
 * Calculate center point from array of [x, y] coordinates
 */
function calculateCenter(points: number[][]): { x: number; y: number } {
  if (!points || points.length === 0) {
    return { x: 0, y: 0 };
  }
  const sumX = points.reduce((acc, p) => acc + p[0], 0);
  const sumY = points.reduce((acc, p) => acc + p[1], 0);
  return {
    x: sumX / points.length,
    y: sumY / points.length,
  };
}

/**
 * Compute frame transform using backend region_points and mm_per_pixel
 * API returns arrays of [x, y] coordinates for each facial feature
 */
function computeFrameTransform(
  frameWidthMm: number,
  faceWidthMm: number,
  regionPoints: any,
  scale: ApiScale,
  imageWidth: number,
  imageHeight: number
): FrameTransform | null {
  // API returns left_eye and right_eye as arrays of [x, y] points
  const leftEyePoints = regionPoints.left_eye;
  const rightEyePoints = regionPoints.right_eye;
  
  if (!leftEyePoints || !rightEyePoints || leftEyePoints.length === 0 || rightEyePoints.length === 0) {
    console.warn('Missing eye data in region_points');
    return null;
  }
  
  // 1. Calculate eye centers from point arrays
  const leftEyeCenter = calculateCenter(leftEyePoints);
  const rightEyeCenter = calculateCenter(rightEyePoints);
  
  // 2. Calculate eye midpoint (center between eyes)
  const eyeMidpointX = (leftEyeCenter.x + rightEyeCenter.x) / 2;
  const eyeMidpointY = (leftEyeCenter.y + rightEyeCenter.y) / 2;
  
  // 3. Calculate eyebrow baseline for vertical alignment
  const leftEyebrowPoints = regionPoints.left_eyebrow;
  const rightEyebrowPoints = regionPoints.right_eyebrow;
  let eyebrowMidpointY = eyeMidpointY - 30; // Default offset
  
  if (leftEyebrowPoints && rightEyebrowPoints) {
    const leftEyebrowCenter = calculateCenter(leftEyebrowPoints);
    const rightEyebrowCenter = calculateCenter(rightEyebrowPoints);
    eyebrowMidpointY = (leftEyebrowCenter.y + rightEyebrowCenter.y) / 2;
  }
  
  // 4. Calculate rotation angle from eye line
  const rotationRad = Math.atan2(
    rightEyeCenter.y - leftEyeCenter.y,
    rightEyeCenter.x - leftEyeCenter.x
  );
  const rotationDeg = rotationRad * (180 / Math.PI);
  
  // 5. Convert frame width from mm to pixels using mm_per_pixel
  const mmPerPixel = scale.mm_per_pixel || 0.3;
  const frameWidthPx = frameWidthMm / mmPerPixel;
  
  // 6. Position frame - center horizontally on eye midpoint
  // Vertically position between eyes and eyebrows
  const verticalOffset = (eyeMidpointY - eyebrowMidpointY) * 0.4;
  const x = eyeMidpointX;
  const y = eyeMidpointY - verticalOffset;
  
  // 7. Fit classification based on frame width vs face width
  const diff = frameWidthMm - faceWidthMm;
  let fit: FitCategory;
  if (diff <= -3) {
    fit = 'tight';
  } else if (diff >= 5) {
    fit = 'loose';
  } else {
    fit = 'perfect';
  }
  
  console.log('Frame transform calculated:', { x, y, frameWidthPx, rotationDeg, fit });
  
  return {
    x,
    y,
    scale: frameWidthPx / imageWidth,
    rotationDeg,
    frameWidthPx,
    fit,
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
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

  // Get image dimensions when loaded
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
  };

  const transform = useMemo(() => {
    if (!selectedFrame || !capturedData?.apiLandmarks) {
      return null;
    }

    const { apiLandmarks, measurements } = capturedData;
    
    // Check if we have required data from API
    if (!apiLandmarks.region_points || !apiLandmarks.scale) {
      console.warn('Missing region_points or scale from API');
      return null;
    }

    if (imageSize.width === 0 || imageSize.height === 0) {
      return null;
    }

    return computeFrameTransform(
      selectedFrame.width,
      measurements.face_width,
      apiLandmarks.region_points,
      apiLandmarks.scale,
      imageSize.width,
      imageSize.height
    );
  }, [selectedFrame, capturedData, imageSize]);

  if (!capturedData) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">No capture data available</p>
      </div>
    );
  }

  // Calculate glasses overlay style using pixel-based transform
  const getGlassesStyle = () => {
    if (!transform || imageSize.width === 0) return {};

    // Frame height is approximately 40% of width
    const frameHeightPx = transform.frameWidthPx * 0.4;

    return {
      position: 'absolute' as const,
      left: `${(transform.x / imageSize.width) * 100}%`,
      top: `${(transform.y / imageSize.height) * 100}%`,
      width: `${(transform.frameWidthPx / imageSize.width) * 100}%`,
      height: `${(frameHeightPx / imageSize.height) * 100}%`,
      transform: `translate(-50%, -50%) rotate(${transform.rotationDeg}deg)`,
      transformOrigin: 'center center',
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
          {fitInfo && transform && (
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
            onLoad={handleImageLoad}
          />
          
          {/* Glasses overlay */}
          {selectedFrame && transform && (
            <div 
              className="pointer-events-none"
              style={getGlassesStyle()}
            >
              <img
                src={selectedFrame.imageUrl}
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
        {fitInfo && transform && (
          <div className={cn("mt-3 flex items-center gap-2 text-sm", fitInfo.color)}>
            <FitIcon className="h-4 w-4 flex-shrink-0" />
            <span>{fitInfo.message}</span>
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
