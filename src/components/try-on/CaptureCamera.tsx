import { useRef, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCamera } from '@/hooks/useCamera';
import { useFaceDetection } from '@/hooks/useFaceDetection';
import { usePDMeasurement } from '@/hooks/usePDMeasurement';
import { useCaptureData } from '@/context/CaptureContext';
import { CameraPermission } from './CameraPermission';
import { FaceGuideOverlay } from './FaceGuideOverlay';
import { ValidationChecklist } from './ValidationChecklist';
import { Camera, CheckCircle2 } from 'lucide-react';

const INSTRUCTIONS = [
  { icon: '📍', text: 'Position your face within the oval guide' },
  { icon: '🎯', text: 'Keep your head straight and centered' },
  { icon: '💡', text: 'Ensure good lighting on your face' },
  { icon: '✨', text: 'System will auto-capture when aligned' },
  { icon: '⏱️', text: 'Hold still during the capture countdown' },
];

export function CaptureCamera() {
  const navigate = useNavigate();
  const { cameraState, error, videoRef, requestCamera } = useCamera();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [videoSize, setVideoSize] = useState({ width: 1280, height: 720 });
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const { setCapturedData } = useCaptureData();

  const validationState = useFaceDetection({
    videoRef,
    canvasRef,
    isActive: cameraState === 'granted' && !isCapturing,
  });

  const pdMeasurement = usePDMeasurement({
    landmarks: validationState.landmarks,
    videoWidth: videoSize.width,
    videoHeight: videoSize.height,
  });

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

  // Capture image from video
  const captureImage = useCallback(() => {
    const video = videoRef.current;
    if (!video || !validationState.landmarks || !pdMeasurement) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw mirrored image
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);

    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9);

    // Calculate confidence based on PD value range (typical adult PD is 54-74mm)
    const pd = pdMeasurement.pdMillimeters;
    let confidence: 'low' | 'medium' | 'high' = 'low';
    if (pd >= 54 && pd <= 74) {
      confidence = 'high';
    } else if (pd >= 48 && pd <= 80) {
      confidence = 'medium';
    }

    setCapturedData({
      imageDataUrl,
      landmarks: validationState.landmarks,
      pdMeasurement: {
        value: pdMeasurement.pdMillimeters,
        confidence,
        leftPD: pdMeasurement.pdMillimeters / 2,
        rightPD: pdMeasurement.pdMillimeters / 2,
      },
      timestamp: Date.now(),
    });

    navigate('/results');
  }, [videoRef, validationState.landmarks, pdMeasurement, setCapturedData, navigate]);

  // Auto-capture countdown when all checks pass
  useEffect(() => {
    if (validationState.allChecksPassed && !isCapturing && countdown === null) {
      setIsCapturing(true);
      setCountdown(3);
    } else if (!validationState.allChecksPassed && isCapturing) {
      // Reset if validation fails during countdown
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      setIsCapturing(false);
      setCountdown(null);
    }
  }, [validationState.allChecksPassed, isCapturing, countdown]);

  // Countdown timer
  useEffect(() => {
    if (countdown !== null && countdown > 0) {
      countdownRef.current = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
    } else if (countdown === 0) {
      captureImage();
    }

    return () => {
      if (countdownRef.current) {
        clearTimeout(countdownRef.current);
      }
    };
  }, [countdown, captureImage]);

  const handleRequestCamera = useCallback(() => {
    requestCamera();
  }, [requestCamera]);

  if (cameraState !== 'granted') {
    return (
      <CameraPermission
        cameraState={cameraState}
        error={error}
        onRequestCamera={handleRequestCamera}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex flex-col lg:flex-row h-screen">
        {/* Camera section */}
        <div className="flex-1 relative bg-black" ref={containerRef}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
          />
          <canvas ref={canvasRef} className="hidden" />

          <FaceGuideOverlay
            isValid={validationState.allChecksPassed}
            faceDetected={validationState.faceDetected}
          />

          {/* Countdown overlay */}
          {countdown !== null && countdown > 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <div className="text-center">
                <div className="text-8xl font-bold text-white animate-pulse">
                  {countdown}
                </div>
                <p className="text-white/80 text-lg mt-2">Hold still...</p>
              </div>
            </div>
          )}

          {/* Ready indicator */}
          {validationState.allChecksPassed && countdown === null && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-medical-success/90 text-white px-4 py-2 rounded-full flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">Ready to capture</span>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-full lg:w-96 bg-background border-t lg:border-t-0 lg:border-l border-border p-6 space-y-6 overflow-y-auto">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Camera className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Face Capture</h1>
              <p className="text-sm text-muted-foreground">Follow the instructions below</p>
            </div>
          </div>

          {/* Quick Instructions */}
          <div className="bg-muted/50 rounded-xl p-4 space-y-3">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              📋 Quick Instructions
            </h2>
            <ul className="space-y-2">
              {INSTRUCTIONS.map((instruction, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span>{instruction.icon}</span>
                  <span>{instruction.text}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Validation checklist */}
          <ValidationChecklist checks={validationState.validationChecks} />
        </div>
      </div>
    </div>
  );
}
