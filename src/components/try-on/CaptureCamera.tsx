import { useRef, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCamera } from '@/hooks/useCamera';
import { useFaceDetection } from '@/hooks/useFaceDetection';
import { useCaptureData } from '@/context/CaptureContext';
import { CameraPermission } from './CameraPermission';
import { FaceGuideOverlay } from './FaceGuideOverlay';
import { ValidationChecklist } from './ValidationChecklist';
import { Camera, CheckCircle2, Loader2 } from 'lucide-react';
import { detectGlasses, removeGlasses, detectLandmarks } from '@/services/glassesApi';
import { toast } from 'sonner';

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
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const { setCapturedData } = useCaptureData();

  const validationState = useFaceDetection({
    videoRef,
    canvasRef,
    isActive: cameraState === 'granted' && !isCapturing && !isProcessing,
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

  // Capture and process image
  const captureAndProcess = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !validationState.landmarks) return;

    setIsProcessing(true);
    
    try {
      // Capture image from video
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');

      // Draw mirrored image
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0);

      const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9);

      // Step 1: Detect glasses
      setProcessingStep('Detecting glasses...');
      const detectResult = await detectGlasses(imageDataUrl);
      
      let processedImageDataUrl = imageDataUrl;
      let glassesDetected = false;

      // Step 2: Remove glasses if detected
      if (detectResult.success && detectResult.glasses_detected) {
        glassesDetected = true;
        setProcessingStep('Removing glasses...');
        const removeResult = await removeGlasses(imageDataUrl);
        if (removeResult.success && removeResult.edited_image_base64) {
          processedImageDataUrl = `data:image/png;base64,${removeResult.edited_image_base64}`;
        }
      }

      // Step 3: Get measurements from API
      setProcessingStep('Measuring face dimensions...');
      const measureResult = await detectLandmarks(processedImageDataUrl);

      if (!measureResult.success || !measureResult.mm) {
        throw new Error('Failed to get measurements');
      }

      // Save data and navigate
      setCapturedData({
        imageDataUrl,
        processedImageDataUrl,
        glassesDetected,
        landmarks: validationState.landmarks,
        measurements: measureResult.mm,
        timestamp: Date.now(),
      });

      navigate('/results');
    } catch (err) {
      console.error('Processing error:', err);
      toast.error('Failed to process image. Please try again.');
      setIsCapturing(false);
      setCountdown(null);
      setIsProcessing(false);
    }
  }, [videoRef, validationState.landmarks, setCapturedData, navigate]);

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
      captureAndProcess();
    }

    return () => {
      if (countdownRef.current) {
        clearTimeout(countdownRef.current);
      }
    };
  }, [countdown, captureAndProcess]);

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
          {countdown !== null && countdown > 0 && !isProcessing && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <div className="text-center">
                <div className="text-8xl font-bold text-white animate-pulse">
                  {countdown}
                </div>
                <p className="text-white/80 text-lg mt-2">Hold still...</p>
              </div>
            </div>
          )}

          {/* Processing overlay */}
          {isProcessing && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <div className="text-center space-y-4">
                <Loader2 className="h-16 w-16 text-white animate-spin mx-auto" />
                <p className="text-white text-lg font-medium">{processingStep}</p>
              </div>
            </div>
          )}

          {/* Ready indicator */}
          {validationState.allChecksPassed && countdown === null && !isProcessing && (
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
