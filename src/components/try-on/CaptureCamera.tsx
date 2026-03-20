import { useRef, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCamera } from '@/hooks/useCamera';
import { useFaceDetection } from '@/hooks/useFaceDetection';
import { getPdSteadyFramesRequired } from '@/lib/pdCaptureDistance';
import { useCaptureData } from '@/context/CaptureContext';
import { useVoiceGuidance } from '@/hooks/useVoiceGuidance';
import { CameraPermission } from './CameraPermission';
import { FaceGuideOverlay } from './FaceGuideOverlay';
import { Loader2, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { detectGlasses, removeGlasses, detectLandmarks } from '@/services/glassesApi';
import { logPdCalculationTraceToConsole } from '@/lib/pdTraceConsole';
import { toast } from 'sonner';

export function CaptureCamera() {
  const navigate = useNavigate();
  const { cameraState, error, videoRef, streamRef, requestCamera } = useCamera();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [videoSize, setVideoSize] = useState({ width: 1280, height: 720 });
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const pdHintMmRef = useRef<number | null>(null);
  const { setCapturedData } = useCaptureData();
  const { speakGuidance, speak, cancel: cancelVoice } = useVoiceGuidance({ enabled: true, debounceMs: 3000 });

  const faceValidationState = useFaceDetection({
    videoRef,
    canvasRef,
    isActive: cameraState === 'granted' && !isCapturing && !isProcessing,
    pdHintOutRef: pdHintMmRef,
  });

  // All checks passed - just face validation now
  const allChecksPassed = faceValidationState.allChecksPassed;

  // Voice guidance for face positioning
  useEffect(() => {
    if (cameraState === 'granted' && !isCapturing && !isProcessing && faceValidationState.faceDetected) {
      if (!allChecksPassed) {
        speakGuidance(faceValidationState.validationChecks);
      }
    }
  }, [
    cameraState,
    isCapturing,
    isProcessing,
    faceValidationState.faceDetected,
    allChecksPassed,
    faceValidationState.validationChecks,
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

      speak('Image captured');

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
      const hint = pdHintMmRef.current;
      const measureResult = await detectLandmarks(
        processedImageDataUrl,
        hint != null && Number.isFinite(hint) ? hint : undefined,
        glassesDetected
          ? { genderSourceDataUrl: imageDataUrl }
          : undefined,
      );

      if (!measureResult.success || !measureResult.landmarks?.mm) {
        throw new Error(
          measureResult.error?.trim() || 'Failed to get measurements (no mm in response)',
        );
      }

      logPdCalculationTraceToConsole(measureResult.landmarks);

      // Save data and navigate - include full API landmarks response
      setCapturedData({
        imageDataUrl,
        processedImageDataUrl,
        glassesDetected,
        landmarks: faceValidationState.landmarks,
        measurements: measureResult.landmarks.mm,
        faceShape: measureResult.landmarks.face_shape,
        gender: measureResult.landmarks.gender,
        emotion: measureResult.landmarks.emotion,
        eyewear: measureResult.landmarks.eyewear,
        clientCapture: measureResult.landmarks.client_capture,
        apiResponse: measureResult,
        timestamp: Date.now(),
      });

      navigate('/results');
    } catch (err) {
      console.error('Processing error:', err);
      const msg =
        err instanceof Error && err.message ? err.message : 'Failed to process image. Please try again.';
      toast.error(msg.length > 180 ? `${msg.slice(0, 177)}…` : msg);
      setIsCapturing(false);
      setCountdown(null);
      setIsProcessing(false);
    }
  }, [videoRef, faceValidationState.landmarks, setCapturedData, navigate, speak, pdHintMmRef]);

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

  /** Manual capture when auto-alignment countdown never completes (same pipeline as auto). */
  const handleManualSnap = useCallback(() => {
    if (isProcessing) return;
    if (!videoRef.current) {
      toast.message('Camera not ready');
      return;
    }
    if (!faceValidationState.faceDetected || !faceValidationState.landmarks) {
      toast.message('Show your face in the frame first, then tap Snap');
      return;
    }
    if (countdownRef.current) {
      clearTimeout(countdownRef.current);
      countdownRef.current = null;
    }
    setCountdown(null);
    setIsCapturing(false);
    cancelVoice();
    captureAndProcess();
  }, [
    isProcessing,
    faceValidationState.faceDetected,
    faceValidationState.landmarks,
    captureAndProcess,
    cancelVoice,
  ]);

  const canManualSnap =
    !!faceValidationState.faceDetected &&
    !!faceValidationState.landmarks &&
    !isProcessing;

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

      {/* Face guide overlay with oval - always visible */}
      <FaceGuideOverlay
        isValid={allChecksPassed}
        faceDetected={faceValidationState.faceDetected}
        validationChecks={faceValidationState.validationChecks}
        debugValues={{
          faceWidthPercent: faceValidationState.faceWidthPercent,
          leftEyeAR: faceValidationState.leftEyeAR,
          rightEyeAR: faceValidationState.rightEyeAR,
          headTilt: faceValidationState.headTilt,
          headRotation: faceValidationState.headRotation,
          brightness: faceValidationState.brightness,
          eyeLevelDelta: faceValidationState.eyeLevelDelta,
          steadyFrames: faceValidationState.steadyFrames,
          steadyRequired: getPdSteadyFramesRequired(),
          maxHeadTilt: 6,
          maxHeadRotation: 8,
          maxEyeYDelta: 0.012,
        }}
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

      {/* Manual snap — same capture as auto; use if checklist stays red */}
      {!isProcessing && (
        <div className="absolute bottom-0 left-0 right-0 z-30 flex flex-col items-center gap-2 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 px-4 pointer-events-none">
          <Button
            type="button"
            size="lg"
            disabled={!canManualSnap}
            className="pointer-events-auto rounded-full h-14 px-8 text-base font-semibold shadow-lg disabled:opacity-40"
            onClick={handleManualSnap}
          >
            <Camera className="h-5 w-5 mr-2" />
            Snap photo
          </Button>
          <p className="pointer-events-auto text-[11px] text-white/70 text-center max-w-sm leading-snug drop-shadow-md">
            Auto-capture runs when the checklist is green. If it won’t turn green, center your face and tap{' '}
            <span className="text-white/90">Snap photo</span> — PD may be less accurate if alignment was off.
          </p>
        </div>
      )}
    </div>
  );
}
