import { useEffect, useState } from 'react';
import type { FaceLandmarks, GlassesFrame } from '@/types/face-validation';

interface GlassesOverlayProps {
  landmarks: FaceLandmarks | null;
  selectedFrame: GlassesFrame | null;
  videoWidth: number;
  videoHeight: number;
  containerWidth: number;
  containerHeight: number;
}

export function GlassesOverlay({ 
  landmarks, 
  selectedFrame, 
  videoWidth, 
  videoHeight,
  containerWidth,
  containerHeight
}: GlassesOverlayProps) {
  const [position, setPosition] = useState({ x: 0, y: 0, width: 0, rotation: 0 });

  useEffect(() => {
    if (!landmarks || !selectedFrame) return;

    // Calculate scale factor between video and container
    const scaleX = containerWidth / videoWidth;
    const scaleY = containerHeight / videoHeight;

    // Get eye positions in container coordinates
    const leftEyeX = landmarks.leftEye.x * containerWidth;
    const leftEyeY = landmarks.leftEye.y * containerHeight;
    const rightEyeX = landmarks.rightEye.x * containerWidth;
    const rightEyeY = landmarks.rightEye.y * containerHeight;

    // Calculate center point between eyes
    const centerX = (leftEyeX + rightEyeX) / 2;
    const centerY = (leftEyeY + rightEyeY) / 2;

    // Calculate eye distance for scaling
    const eyeDistance = Math.sqrt(
      Math.pow(rightEyeX - leftEyeX, 2) + Math.pow(rightEyeY - leftEyeY, 2)
    );

    // Glasses width should be about 2.5x the eye distance
    const glassesWidth = eyeDistance * 2.8;

    // Calculate rotation from eye positions
    const rotation = Math.atan2(rightEyeY - leftEyeY, rightEyeX - leftEyeX) * (180 / Math.PI);

    setPosition({
      x: centerX,
      y: centerY,
      width: glassesWidth,
      rotation,
    });
  }, [landmarks, selectedFrame, videoWidth, videoHeight, containerWidth, containerHeight]);

  if (!landmarks || !selectedFrame) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <img
        src={selectedFrame.imageUrl}
        alt={selectedFrame.name}
        className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-75"
        style={{
          left: position.x,
          top: position.y,
          width: position.width,
          transform: `translate(-50%, -50%) rotate(${position.rotation}deg)`,
        }}
      />
    </div>
  );
}