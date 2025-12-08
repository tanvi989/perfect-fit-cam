import { useState } from 'react';
import { useCaptureData } from '@/context/CaptureContext';
import { GlassesSelector } from './GlassesSelector';
import { Glasses } from 'lucide-react';
import type { GlassesFrame } from '@/types/face-validation';

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

export function FramesTab() {
  const { capturedData } = useCaptureData();
  const [selectedFrame, setSelectedFrame] = useState<GlassesFrame | null>(null);

  if (!capturedData) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">No capture data available</p>
      </div>
    );
  }

  const { landmarks, measurements } = capturedData;

  // Calculate glasses position based on landmarks and real dimensions
  const getGlassesStyle = () => {
    if (!selectedFrame || !landmarks) return {};

    // Get user's face width in mm from API measurements
    const userFaceWidthMm = measurements.face_width;
    const frameWidthMm = selectedFrame.width;

    // Calculate the ratio: how much of the face width the frame covers
    const frameToFaceRatio = frameWidthMm / userFaceWidthMm;

    // Get face width in normalized coordinates (0-1)
    const faceWidthNormalized = Math.abs(landmarks.faceRight.x - landmarks.faceLeft.x);

    // Calculate glasses width as percentage based on real dimensions
    const glassesWidthPercent = faceWidthNormalized * frameToFaceRatio * 100;

    // Eye center for positioning
    const eyeCenterX = (landmarks.leftEye.x + landmarks.rightEye.x) / 2;
    const eyeCenterY = (landmarks.leftEye.y + landmarks.rightEye.y) / 2;

    // Calculate roll angle from eye positions
    const deltaY = landmarks.rightEye.y - landmarks.leftEye.y;
    const deltaX = landmarks.rightEye.x - landmarks.leftEye.x;
    const roll = Math.atan2(deltaY, deltaX) * (180 / Math.PI);

    // Aspect ratio for height (typical glasses are ~40% as tall as wide)
    const glassesHeightPercent = glassesWidthPercent * 0.4;

    return {
      position: 'absolute' as const,
      left: `${eyeCenterX * 100}%`,
      top: `${eyeCenterY * 100}%`,
      width: `${glassesWidthPercent}%`,
      height: `${glassesHeightPercent}%`,
      transform: `translate(-50%, -50%) rotate(${roll}deg)`,
      transformOrigin: 'center center',
    };
  };

  return (
    <div className="space-y-6 p-4">
      {/* Try-on Preview */}
      <div className="bg-muted/30 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <Glasses className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">Virtual Try-On Preview</h3>
        </div>
        
        <div className="relative rounded-lg overflow-hidden bg-black aspect-[4/3]">
          <img
            src={capturedData.processedImageDataUrl}
            alt="Try-on preview"
            className="w-full h-full object-contain"
          />
          
          {/* Glasses overlay */}
          {selectedFrame && (
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
      </div>

      {/* Frames selector */}
      <GlassesSelector
        frames={FRAMES}
        selectedFrame={selectedFrame}
        onSelectFrame={setSelectedFrame}
      />
    </div>
  );
}
