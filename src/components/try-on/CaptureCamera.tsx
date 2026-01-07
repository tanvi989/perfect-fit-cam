import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCamera } from '@/hooks/useCamera';
import { useFaceDetection } from '@/hooks/useFaceDetection';
import { useCreditCardDetection } from '@/hooks/useCreditCardDetection';
import { useCaptureData } from '@/context/CaptureContext';
import { useVoiceGuidance } from '@/hooks/useVoiceGuidance';
import { CameraPermission } from './CameraPermission';
import { FaceGuideOverlay } from './FaceGuideOverlay';
import { CreditCardGuide } from './CreditCardGuide';
import { Loader2 } from 'lucide-react';
import { detectGlasses, removeGlasses, detectLandmarks } from '@/services/glassesApi';
import { toast } from 'sonner';
import type { ValidationCheck } from '@/types/face-validation';

export function CaptureCamera() {
  const navigate = useNavigate();
  const { cameraState, error, videoRef, streamRef, requestCamera } = useCamera();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cardDetectionCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [videoSize, setVideoSize] = useState({ width: 1280, height: 720 });
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const { setCapturedData } = useCaptureData();
  const { speakGuidance, speak, cancel: cancelVoice } = useVoiceGuidance({ enabled: true, debounceMs: 3000 });

  const faceValidationState = useFaceDetection({
    videoRef,
    canvasRef,
    isActive: cameraState === 'granted' && !isCapturing && !isProcessing,
  });

  // Calculate card guide area based on face position (normalized coordinates)
  const cardGuideArea = useMemo(() => {
    if (!faceValidationState.landmarks) {
      // Default position when no face detected - right side of frame near cheek area
      return {
        x: 0.55, // Right side (mirrored)
        y: 0.45,  // Mid-face level
        width: 0.2,
        height: 0.12,
      };
    }
    
    // Position relative to detected face - on the right cheek (from camera perspective)
    const faceRight = faceValidationState.landmarks.faceRight;
    const noseTip = faceValidationState.landmarks.noseTip;
    
    return {
      x: faceRight.x + 0.05, // Just outside the right side of face
      y: noseTip.y - 0.02, // At nose level
      width: 0.18,
      height: 0.11,
    };
  }, [faceValidationState.landmarks]);

  const cardDetectionState = useCreditCardDetection({
    videoRef,
    canvasRef: cardDetectionCanvasRef,
    isActive: cameraState === 'granted' && !isCapturing && !isProcessing && faceValidationState.faceDetected,
    cardGuideArea,
  });

  // Combined validation checks including credit card
  const combinedValidationChecks = useMemo((): ValidationCheck[] => {
    const faceChecks = [...faceValidationState.validationChecks];
    
    // Add credit card validation check
    const cardCheck: ValidationCheck = {
      id: 'credit-card',
      label: 'Credit Card',
      passed: cardDetectionState.cardDetected && cardDetectionState.cardFullyVisible,
      message: !cardDetectionState.cardDetected
        ? 'Place card on cheek'
        : !cardDetectionState.cardFullyVisible
          ? 'Card not fully visible'
          : cardDetectionState.cardTilted
            ? 'Hold card flat'
            : 'Card detected',
      severity: cardDetectionState.cardDetected && cardDetectionState.cardFullyVisible ? 'pass' : 'fail',
    };
    
    faceChecks.push(cardCheck);
    return faceChecks;
  }, [faceValidationState.validationChecks, cardDetectionState]);

  // All checks passed including credit card
  const allChecksPassed = useMemo(() => {
    return faceValidationState.allChecksPassed && 
           cardDetectionState.cardDetected && 
           cardDetectionState.cardFullyVisible;
  }, [faceValidationState.allChecksPassed, cardDetectionState.cardDetected, cardDetectionState.cardFullyVisible]);

  // Voice guidance for face positioning and card placement
  useEffect(() => {
    if (cameraState === 'granted' && !isCapturing && !isProcessing && faceValidationState.faceDetected) {
      if (!allChecksPassed) {
        speakGuidance(combinedValidationChecks);
      }
    }
  }, [
    cameraState,
    isCapturing,
    isProcessing,
    faceValidationState.faceDetected,
    allChecksPassed,
    combinedValidationChecks,
    speakGuidance,
  ]);

  // Cancel voice when capturing starts
  useEffect(() => {
    if (isCapturing || isProcessing) {
      cancelVoice();
    }
  }, [isCapturing, isProcessing, cancelVoice]);

  // Attach stream to video element when both are available
  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    
    if (video && stream && cameraState === 'granted') {
      video.srcObject = stream;
      video.play().catch(console.error);
    }
  }, [videoRef, streamRef, cameraState]);

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

    if (video.videoWidth > 0) {
      setVideoSize({ width: video.videoWidth, height: video.videoHeight });
    }

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    
    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [videoRef, cameraState]);

  // Download image function
  const downloadImage = useCallback((dataUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  // Capture and process image
  const captureAndProcess = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !faceValidationState.landmarks) return;

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

      // Download the captured image with credit card reference
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      downloadImage(imageDataUrl, `face-capture-with-card-${timestamp}.jpg`);
      speak('Image captured and downloaded');

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

      if (!measureResult.success || !measureResult.landmarks?.mm) {
        throw new Error('Failed to get measurements');
      }

      // Save data and navigate - include full API landmarks response
      setCapturedData({
        imageDataUrl,
        processedImageDataUrl,
        glassesDetected,
        landmarks: faceValidationState.landmarks,
        measurements: measureResult.landmarks.mm,
        apiLandmarks: measureResult.landmarks, // Store full response with region_points and scale
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
  }, [videoRef, faceValidationState.landmarks, setCapturedData, navigate, downloadImage, speak]);

  // Auto-capture countdown when all checks pass
  useEffect(() => {
    if (allChecksPassed && !isCapturing && countdown === null) {
      setIsCapturing(true);
      setCountdown(3);
    } else if (!allChecksPassed && isCapturing) {
      // Reset if validation fails during countdown
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      setIsCapturing(false);
      setCountdown(null);
    }
  }, [allChecksPassed, isCapturing, countdown]);

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
    <div className="h-screen w-screen bg-black relative overflow-hidden" ref={containerRef}>
      {/* Fullscreen camera */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
        style={{ transform: 'scaleX(-1)' }}
      />
      <canvas ref={canvasRef} className="hidden" />
      <canvas ref={cardDetectionCanvasRef} className="hidden" />

      {/* Face guide overlay with oval - always visible */}
      <FaceGuideOverlay
        isValid={allChecksPassed}
        faceDetected={faceValidationState.faceDetected}
        validationChecks={combinedValidationChecks}
        debugValues={{
          faceWidthPercent: faceValidationState.faceWidthPercent,
          leftEyeAR: faceValidationState.leftEyeAR,
          rightEyeAR: faceValidationState.rightEyeAR,
          headTilt: faceValidationState.headTilt,
          headRotation: faceValidationState.headRotation,
          brightness: faceValidationState.brightness,
        }}
      />

      {/* Credit card guide overlay */}
      <CreditCardGuide
        isValid={cardDetectionState.cardDetected && cardDetectionState.cardFullyVisible}
        cardDetected={cardDetectionState.cardDetected}
        cardFullyVisible={cardDetectionState.cardFullyVisible}
      />

      {/* Countdown overlay */}
      {countdown !== null && countdown > 0 && !isProcessing && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-20">
          <div className="text-center">
            <div className="text-9xl font-bold text-white animate-pulse drop-shadow-lg">
              {countdown}
            </div>
            <p className="text-white/90 text-xl mt-4 font-medium">Hold still...</p>
          </div>
        </div>
      )}

      {/* Processing overlay */}
      {isProcessing && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-20">
          <div className="text-center space-y-6">
            <Loader2 className="h-20 w-20 text-white animate-spin mx-auto" />
            <p className="text-white text-xl font-medium">{processingStep}</p>
          </div>
        </div>
      )}
    </div>
  );
}
