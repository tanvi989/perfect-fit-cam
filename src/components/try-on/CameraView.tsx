import { useRef, useEffect, useState } from 'react';
import { useFaceDetection } from '@/hooks/useFaceDetection';
import { usePDMeasurement } from '@/hooks/usePDMeasurement';
import { FaceGuideOverlay } from './FaceGuideOverlay';
import { ValidationChecklist } from './ValidationChecklist';
import { PDDisplay } from './PDDisplay';
import { GlassesOverlay } from './GlassesOverlay';
import { GlassesSelector } from './GlassesSelector';
import type { GlassesFrame } from '@/types/face-validation';

// Demo glasses frames (user will replace with their own)
const DEMO_FRAMES: GlassesFrame[] = [
  {
    id: '1',
    name: 'Classic Rectangle',
    imageUrl: 'https://images.unsplash.com/photo-1574258495973-f010dfbb5371?w=300&h=120&fit=crop&auto=format',
    category: 'rectangular',
    color: 'Black',
    width: 140,
  },
  {
    id: '2',
    name: 'Round Vintage',
    imageUrl: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=300&h=120&fit=crop&auto=format',
    category: 'round',
    color: 'Gold',
    width: 130,
  },
  {
    id: '3',
    name: 'Modern Aviator',
    imageUrl: 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=300&h=120&fit=crop&auto=format',
    category: 'aviator',
    color: 'Silver',
    width: 145,
  },
];

interface CameraViewProps {
  videoRef: React.RefObject<HTMLVideoElement>;
}

export function CameraView({ videoRef }: CameraViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [videoSize, setVideoSize] = useState({ width: 1280, height: 720 });
  const [selectedFrame, setSelectedFrame] = useState<GlassesFrame | null>(null);

  const validationState = useFaceDetection({
    videoRef,
    canvasRef,
    isActive: true,
  });

  const pdMeasurement = usePDMeasurement({
    landmarks: validationState.landmarks,
    videoWidth: videoSize.width,
    videoHeight: videoSize.height,
  });

  // Track container size for overlay positioning
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Track video dimensions
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setVideoSize({
        width: video.videoWidth,
        height: video.videoHeight,
      });
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    return () => video.removeEventListener('loadedmetadata', handleLoadedMetadata);
  }, [videoRef]);

  return (
    <div className="min-h-screen bg-background">
      <div className="flex flex-col lg:flex-row h-screen">
        {/* Camera section */}
        <div className="flex-1 relative bg-black" ref={containerRef}>
          {/* Video element */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
          />

          {/* Hidden canvas for image processing */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Face guide overlay */}
          <FaceGuideOverlay 
            isValid={validationState.allChecksPassed}
            faceDetected={validationState.faceDetected}
          />

          {/* Glasses overlay */}
          {validationState.allChecksPassed && selectedFrame && (
            <GlassesOverlay
              landmarks={validationState.landmarks}
              selectedFrame={selectedFrame}
              videoWidth={videoSize.width}
              videoHeight={videoSize.height}
              containerWidth={containerSize.width}
              containerHeight={containerSize.height}
            />
          )}
        </div>

        {/* Sidebar */}
        <div className="w-full lg:w-80 bg-background border-t lg:border-t-0 lg:border-l border-border p-4 space-y-4 overflow-y-auto">
          {/* Validation checklist */}
          <ValidationChecklist checks={validationState.validationChecks} />

          {/* PD Display */}
          <PDDisplay 
            measurement={pdMeasurement}
            isReady={validationState.allChecksPassed}
          />

          {/* Glasses selector */}
          <GlassesSelector
            frames={DEMO_FRAMES}
            selectedFrame={selectedFrame}
            onSelectFrame={setSelectedFrame}
          />
        </div>
      </div>
    </div>
  );
}