import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import type { FaceLandmarks, FaceValidationState, ValidationCheck } from '@/types/face-validation';
import { PD_DESKTOP_TARGET_DISTANCE_CM, PD_MOBILE_TARGET_DISTANCE_CM } from '@/lib/pdCaptureDistance';
import { useMobileCaptureMode } from '@/hooks/useMobileCaptureMode';
import { computeLivePdGeometry, type LivePdGeometryDebug } from '@/lib/irisGeometry';

// MediaPipe Face Mesh landmark indices
const LANDMARK_INDICES = {
  leftEye: 468, // Left iris center
  rightEye: 473, // Right iris center
  noseTip: 1,
  leftEar: 234,
  rightEar: 454,
  chin: 152,
  forehead: 10,
  leftEyeUpper: 159,
  leftEyeLower: 145,
  rightEyeUpper: 386,
  rightEyeLower: 374,
  faceLeft: 234,
  faceRight: 454,
};

// Percent ranges were tuned around FACE_WIDTH_CALIBRATION_CM; scale by target distance per device.
const FACE_WIDTH_CALIBRATION_CM = 43;

// Mobile capture: relax framing / lighting / hold time so users can finish; keep pose limits
// moderate (square-on + level eyes) so PD stays meaningful. Desktop stays strict.
const getThresholds = (isMobile: boolean) => {
  const targetDistanceCm = isMobile ? PD_MOBILE_TARGET_DISTANCE_CM : PD_DESKTOP_TARGET_DISTANCE_CM;
  const distanceScale = FACE_WIDTH_CALIBRATION_CM / targetDistanceCm;

  if (isMobile) {
    return {
      targetDistanceCm,
      steadyFramesRequired: 4,
      /** Very wide band — backend uses iris-scale PD; extremes still discouraged */
      targetFaceWidthPercent: 28 * distanceScale,
      minFaceWidthPercent: 9,
      maxFaceWidthPercent: 56,
      maxHeadTilt: 12,
      maxHeadRotation: 18,
      maxEyeYDelta: 0.028,
      minBrightness: 80,
      maxBrightness: 220,
      minContrast: 0.3,
      eyeAspectRatioThreshold: 0.006,
      ovalCenterX: 0.5,
      ovalCenterY: 0.45,
      maxFaceOffsetX: 0.16,
      maxFaceOffsetY: 0.19,
      /** Phones in poor light were blocking everyone; PD still uses iris geometry */
      skipLightingAlignmentGate: true,
      /** Oval is a guide only — pose + yaw checks still protect PD */
      skipFaceOvalAlignmentGate: true,
    };
  }

  const distance = {
    targetFaceWidthPercent: 21 * distanceScale,
    minFaceWidthPercent: 18.5 * distanceScale,
    maxFaceWidthPercent: 23 * distanceScale,
  };

  return {
    targetDistanceCm,
    steadyFramesRequired: 10,
    maxHeadTilt: 6,
    maxHeadRotation: 8,
    maxEyeYDelta: 0.012,
    ...distance,
    minBrightness: 80,
    maxBrightness: 220,
    minContrast: 0.3,
    eyeAspectRatioThreshold: 0.012,
    ovalCenterX: 0.5,
    ovalCenterY: 0.45,
    maxFaceOffsetX: 0.07,
    maxFaceOffsetY: 0.09,
    skipLightingAlignmentGate: false,
    skipFaceOvalAlignmentGate: false,
  };
};


interface UseFaceDetectionProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  isActive: boolean;
  /** Smoothed PD hint (mm) from the same MediaPipe geometry as the guide: iris rings + cheek width @ ~145mm. */
  pdHintOutRef?: React.MutableRefObject<number | null>;
  /** Updated every frame when `livePdDebug` is computed — log at snap for delta vs server. */
  livePdDebugOutRef?: React.MutableRefObject<LivePdGeometryDebug | null>;
}

export function useFaceDetection({
  videoRef,
  canvasRef,
  isActive,
  pdHintOutRef,
  livePdDebugOutRef,
}: UseFaceDetectionProps) {
  const mobileCapture = useMobileCaptureMode();
  const thresholds = useMemo(() => getThresholds(mobileCapture), [mobileCapture]);

  // Smooth the face width signal a bit to reduce jitter (especially on mobile)
  const smoothedFaceWidthPercentRef = useRef<number | null>(null);

  const [validationState, setValidationState] = useState<FaceValidationState>({
    faceDetected: false,
    faceCount: 0,
    headTilt: 0,
    headRotation: 0,
    faceWidthPercent: 0,
    brightness: 0,
    contrast: 0,
    leftEyeOpen: false,
    rightEyeOpen: false,
    leftEyeAR: 0,
    rightEyeAR: 0,
    eyeLevelDelta: 0,
    steadyFrames: 0,
    landmarks: null,
    livePdDebug: null,
    allChecksPassed: false,
    validationChecks: [],
  });

  const faceMeshRef = useRef<any>(null);
  const animationFrameRef = useRef<number>();
  const lastProcessTime = useRef<number>(0);
  const pdHintEmaRef = useRef<number | null>(null);
  const steadyFramesRef = useRef(0);
  const lastLivePdLogRef = useRef(0);

  const extractLandmarks = useCallback((landmarks: any[]): FaceLandmarks => {
    return {
      leftEye: landmarks[LANDMARK_INDICES.leftEye],
      rightEye: landmarks[LANDMARK_INDICES.rightEye],
      noseTip: landmarks[LANDMARK_INDICES.noseTip],
      leftEar: landmarks[LANDMARK_INDICES.leftEar],
      rightEar: landmarks[LANDMARK_INDICES.rightEar],
      chin: landmarks[LANDMARK_INDICES.chin],
      forehead: landmarks[LANDMARK_INDICES.forehead],
      leftEyeUpper: landmarks[LANDMARK_INDICES.leftEyeUpper],
      leftEyeLower: landmarks[LANDMARK_INDICES.leftEyeLower],
      rightEyeUpper: landmarks[LANDMARK_INDICES.rightEyeUpper],
      rightEyeLower: landmarks[LANDMARK_INDICES.rightEyeLower],
      faceLeft: landmarks[LANDMARK_INDICES.faceLeft],
      faceRight: landmarks[LANDMARK_INDICES.faceRight],
    };
  }, []);

  const calculateHeadTilt = useCallback((landmarks: FaceLandmarks): number => {
    const leftEye = landmarks.leftEye;
    const rightEye = landmarks.rightEye;
    const deltaY = rightEye.y - leftEye.y;
    const deltaX = rightEye.x - leftEye.x;
    return Math.atan2(deltaY, deltaX) * (180 / Math.PI);
  }, []);

  const calculateHeadRotation = useCallback((landmarks: FaceLandmarks): number => {
    const nose = landmarks.noseTip;
    const leftEar = landmarks.faceLeft;
    const rightEar = landmarks.faceRight;
    const faceCenter = (leftEar.x + rightEar.x) / 2;
    const offset = (nose.x - faceCenter) / (rightEar.x - leftEar.x);
    return offset * 60; // Approximate degrees
  }, []);

  const calculateFaceWidthPercent = useCallback((landmarks: FaceLandmarks, videoWidth: number): number => {
    const faceWidth = Math.abs(landmarks.faceRight.x - landmarks.faceLeft.x);
    return (faceWidth / 1) * 100; // landmarks are normalized 0-1
  }, []);

  const calculateEyeAspectRatio = useCallback((upper: { x: number; y: number }, lower: { x: number; y: number }): number => {
    return Math.abs(upper.y - lower.y);
  }, []);

  const analyzeImageQuality = useCallback((video: HTMLVideoElement, canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return { brightness: 128, contrast: 0.5 };

    canvas.width = 100;
    canvas.height = 100;
    ctx.drawImage(video, 0, 0, 100, 100);

    const imageData = ctx.getImageData(0, 0, 100, 100);
    const data = imageData.data;

    let sum = 0;
    let min = 255;
    let max = 0;

    for (let i = 0; i < data.length; i += 4) {
      const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
      sum += gray;
      min = Math.min(min, gray);
      max = Math.max(max, gray);
    }

    const brightness = sum / (data.length / 4);
    const contrast = (max - min) / 255;

    return { brightness, contrast };
  }, []);

  // Calculate if face is within the oval guide
  const calculateFaceInOval = useCallback((landmarks: FaceLandmarks | null): { inOval: boolean; offsetX: number; offsetY: number } => {
    if (!landmarks) return { inOval: false, offsetX: 0, offsetY: 0 };

    // Calculate face center from landmarks
    const faceCenterX = (landmarks.faceLeft.x + landmarks.faceRight.x) / 2;
    const faceCenterY = (landmarks.forehead.y + landmarks.chin.y) / 2;

    // Calculate offset from oval center
    const offsetX = faceCenterX - thresholds.ovalCenterX;
    const offsetY = faceCenterY - thresholds.ovalCenterY;

    // Check if within acceptable range
    const inOval = Math.abs(offsetX) <= thresholds.maxFaceOffsetX &&
                   Math.abs(offsetY) <= thresholds.maxFaceOffsetY;

    return { inOval, offsetX, offsetY };
  }, [thresholds.maxFaceOffsetX, thresholds.maxFaceOffsetY, thresholds.ovalCenterX, thresholds.ovalCenterY]);

  /** Geometric checks only — hold-steady is appended in `processResults` */
  const generateAlignmentChecks = useCallback(
    (
      state: Omit<
        FaceValidationState,
        'validationChecks' | 'allChecksPassed' | 'steadyFrames'
      > & { faceInOval?: boolean; faceOffsetX?: number; faceOffsetY?: number },
    ): ValidationCheck[] => {
      const checks: ValidationCheck[] = [
        {
          id: 'face-detected',
          label: 'One face visible',
          passed: state.faceDetected && state.faceCount === 1,
          message: !state.faceDetected
            ? 'Show your face to the camera'
            : state.faceCount > 1
              ? 'Only one person in frame'
              : 'OK',
          severity: state.faceDetected && state.faceCount === 1 ? 'pass' : 'fail',
        },
        {
          id: 'face-in-oval',
          label: 'Centered in guide',
          passed: thresholds.skipFaceOvalAlignmentGate || state.faceInOval === true,
          message: thresholds.skipFaceOvalAlignmentGate
            ? 'Comfortable framing — stay roughly centered'
            : !state.faceDetected
              ? 'Align with the oval'
              : state.faceInOval
                ? 'Centered'
                : (state.faceOffsetX || 0) > 0.04
                  ? 'Step a bit left'
                  : (state.faceOffsetX || 0) < -0.04
                    ? 'Step a bit right'
                    : (state.faceOffsetY || 0) > 0.04
                      ? 'Raise camera or lower chin'
                      : 'Lower camera or raise chin',
          severity:
            thresholds.skipFaceOvalAlignmentGate || state.faceInOval ? 'pass' : 'fail',
        },
        {
          id: 'distance',
          label: `Distance ~${thresholds.targetDistanceCm} cm`,
          passed:
            state.faceWidthPercent >= thresholds.minFaceWidthPercent &&
            state.faceWidthPercent <= thresholds.maxFaceWidthPercent,
          message:
            state.faceWidthPercent < thresholds.minFaceWidthPercent
              ? 'Move a little closer'
              : state.faceWidthPercent > thresholds.maxFaceWidthPercent
                ? 'Move a little farther'
                : `About ${thresholds.targetDistanceCm} cm — good`,
          severity:
            state.faceWidthPercent >= thresholds.minFaceWidthPercent &&
            state.faceWidthPercent <= thresholds.maxFaceWidthPercent
              ? 'pass'
              : 'fail',
        },
        {
          id: 'eyes-level',
          label: 'Eyes level (PD)',
          passed: state.eyeLevelDelta <= thresholds.maxEyeYDelta,
          message:
            state.eyeLevelDelta <= thresholds.maxEyeYDelta
              ? 'Irises level'
              : 'Level your head — don’t tilt (eyes must line up)',
          severity: state.eyeLevelDelta <= thresholds.maxEyeYDelta ? 'pass' : 'fail',
        },
        {
          id: 'head-straight',
          label: 'Head not tilted',
          passed: Math.abs(state.headTilt) <= thresholds.maxHeadTilt,
          message:
            Math.abs(state.headTilt) <= thresholds.maxHeadTilt
              ? 'Head straight'
              : state.headTilt > 0
                ? 'Straighten — tilt left ear down slightly'
                : 'Straighten — tilt right ear down slightly',
          severity: Math.abs(state.headTilt) <= thresholds.maxHeadTilt ? 'pass' : 'fail',
        },
        {
          id: 'no-rotation',
          label: 'Facing camera squarely',
          passed: Math.abs(state.headRotation) <= thresholds.maxHeadRotation,
          message:
            Math.abs(state.headRotation) <= thresholds.maxHeadRotation
              ? 'Facing forward'
              : state.headRotation > 0
                ? 'Turn slightly right — nose to center'
                : 'Turn slightly left — nose to center',
          severity: Math.abs(state.headRotation) <= thresholds.maxHeadRotation ? 'pass' : 'fail',
        },
        {
          id: 'lighting',
          label: 'Lighting',
          passed:
            thresholds.skipLightingAlignmentGate ||
            (state.brightness >= thresholds.minBrightness &&
              state.brightness <= thresholds.maxBrightness &&
              state.contrast >= thresholds.minContrast),
          message: thresholds.skipLightingAlignmentGate
            ? 'More light improves PD accuracy'
            : state.brightness < thresholds.minBrightness
              ? 'Too dark — add light in front'
              : state.brightness > thresholds.maxBrightness
                ? 'Too bright — soften light'
                : state.contrast < thresholds.minContrast
                  ? 'Reduce harsh shadows on face'
                  : 'OK',
          severity:
            thresholds.skipLightingAlignmentGate ||
            (state.brightness >= thresholds.minBrightness &&
              state.brightness <= thresholds.maxBrightness &&
              state.contrast >= thresholds.minContrast)
              ? 'pass'
              : 'fail',
        },
        {
          id: 'eyes-open',
          label: 'Eyes open & visible',
          passed: state.leftEyeOpen && state.rightEyeOpen,
          message:
            state.leftEyeOpen && state.rightEyeOpen
              ? 'Eyes visible'
              : 'Open eyes fully (needed for PD)',
          severity: state.leftEyeOpen && state.rightEyeOpen ? 'pass' : 'fail',
        },
      ];

      return checks;
    },
    [
      thresholds.maxBrightness,
      thresholds.maxEyeYDelta,
      thresholds.maxFaceWidthPercent,
      thresholds.maxHeadRotation,
      thresholds.maxHeadTilt,
      thresholds.minBrightness,
      thresholds.minContrast,
      thresholds.minFaceWidthPercent,
      thresholds.targetDistanceCm,
      thresholds.skipLightingAlignmentGate,
      thresholds.skipFaceOvalAlignmentGate,
    ],
  );

  const processResults = useCallback((results: any) => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const { brightness, contrast } = analyzeImageQuality(video, canvas);

    if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
      smoothedFaceWidthPercentRef.current = null;
      pdHintEmaRef.current = null;
      if (pdHintOutRef) pdHintOutRef.current = null;
      steadyFramesRef.current = 0;

      if (livePdDebugOutRef) livePdDebugOutRef.current = null;
      const newState = {
        faceDetected: false,
        faceCount: 0,
        headTilt: 0,
        headRotation: 0,
        faceWidthPercent: 0,
        brightness,
        contrast,
        leftEyeOpen: false,
        rightEyeOpen: false,
        leftEyeAR: 0,
        rightEyeAR: 0,
        eyeLevelDelta: 0,
        landmarks: null,
        livePdDebug: null as LivePdGeometryDebug | null,
      };

      const baseChecks = generateAlignmentChecks(newState);
      const holdSteady: ValidationCheck = {
        id: 'hold-steady',
        label: 'Hold steady (PD)',
        passed: false,
        message: 'Show your face to start alignment',
        severity: 'fail',
      };
      setValidationState({
        ...newState,
        steadyFrames: 0,
        validationChecks: [...baseChecks, holdSteady],
        allChecksPassed: false,
      });
      return;
    }

    const faceCount = results.multiFaceLandmarks.length;
    const meshLm = results.multiFaceLandmarks[0];
    const landmarks = extractLandmarks(meshLm);

    // Live geometry (same rules as server) + background PD hint for API
    const Wv = video.videoWidth;
    const Hv = video.videoHeight;
    let livePdDebug: LivePdGeometryDebug | null = null;
    if (Wv > 0 && Hv > 0 && meshLm.length >= 478) {
      livePdDebug = computeLivePdGeometry(meshLm, Wv, Hv);
      if (livePdDebugOutRef) livePdDebugOutRef.current = livePdDebug;

      if (livePdDebug && livePdDebug.faceWidthCheekPx > 20 && livePdDebug.pdPxUsed > 1) {
        const knownFaceMm = 145.0;
        const pdMm = livePdDebug.pdPxUsed * (knownFaceMm / livePdDebug.faceWidthCheekPx);
        const prev = pdHintEmaRef.current;
        const smoothed = prev == null ? pdMm : prev * 0.82 + pdMm * 0.18;
        pdHintEmaRef.current = smoothed;
        if (pdHintOutRef) pdHintOutRef.current = smoothed;
      }

      const pdDebugParam =
        typeof window !== 'undefined' &&
        (import.meta.env.DEV || /(?:^|[?&])pddebug=1(?:&|$)/.test(window.location.search));
      if (livePdDebug && pdDebugParam) {
        const now = performance.now();
        if (now - lastLivePdLogRef.current > 550) {
          lastLivePdLogRef.current = now;
          console.log(
            '%c[PD live debug — video px, same math as server iris_landmark_service]',
            'background:#0d47a1;color:#fff;padding:2px 6px;border-radius:3px',
            {
              frame: { w: livePdDebug.videoWidth, h: livePdDebug.videoHeight },
              left_iris_px: livePdDebug.leftIrisCenterPx,
              right_iris_px: livePdDebug.rightIrisCenterPx,
              iris_diam_px: {
                L: livePdDebug.irisDiameterLeftPx,
                R: livePdDebug.irisDiameterRightPx,
                mean: livePdDebug.irisDiameterMeanPx,
              },
              pd_px: {
                horizontal: livePdDebug.pdPxHorizontal,
                euclidean: livePdDebug.pdPxEuclidean,
                used: livePdDebug.pdPxUsed,
                geometry: livePdDebug.pdGeometry,
              },
              scale: {
                s_iris_mm_per_px: livePdDebug.sIrisMmPerPx,
                s_face_mm_per_px: livePdDebug.sFaceMmPerPx,
                face_width_cheek_px: livePdDebug.faceWidthCheekPx,
              },
              preview_mm: {
                iris_ruler: livePdDebug.pdMmIrisScaleOnly,
                face_ruler: livePdDebug.pdMmFaceScaleOnly,
              },
              ipd_px_over_iris_diam: livePdDebug.ipdOverIrisDiam,
              ratio_ok: livePdDebug.pdRatioOk,
              level_ratio: livePdDebug.levelRatio,
              pd_hint_mm_smoothed: pdHintEmaRef.current,
            },
          );
        }
      }
    } else if (livePdDebugOutRef) {
      livePdDebugOutRef.current = null;
    }

    const headTilt = calculateHeadTilt(landmarks);
    const headRotation = calculateHeadRotation(landmarks);

    let rawFaceWidthPercent = calculateFaceWidthPercent(landmarks, video.videoWidth);
    rawFaceWidthPercent = Number.isFinite(rawFaceWidthPercent)
      ? Math.min(100, Math.max(0, rawFaceWidthPercent))
      : 0;

    const prev = smoothedFaceWidthPercentRef.current;
    const faceWidthPercent = prev == null
      ? rawFaceWidthPercent
      : prev * 0.8 + rawFaceWidthPercent * 0.2;
    smoothedFaceWidthPercentRef.current = faceWidthPercent;

    const leftEyeAR = calculateEyeAspectRatio(landmarks.leftEyeUpper, landmarks.leftEyeLower);
    const rightEyeAR = calculateEyeAspectRatio(landmarks.rightEyeUpper, landmarks.rightEyeLower);

    const leftEyeOpen = leftEyeAR > thresholds.eyeAspectRatioThreshold;
    const rightEyeOpen = rightEyeAR > thresholds.eyeAspectRatioThreshold;

    // Check if face is in oval
    const { inOval, offsetX, offsetY } = calculateFaceInOval(landmarks);
    const eyeLevelDelta = Math.abs(landmarks.leftEye.y - landmarks.rightEye.y);

    const newState = {
      faceDetected: true,
      faceCount,
      headTilt,
      headRotation,
      faceWidthPercent,
      brightness,
      contrast,
      leftEyeOpen,
      rightEyeOpen,
      leftEyeAR,
      rightEyeAR,
      eyeLevelDelta,
      landmarks,
      livePdDebug,
      faceInOval: inOval,
      faceOffsetX: offsetX,
      faceOffsetY: offsetY,
    };

    const baseChecks = generateAlignmentChecks(newState);
    const geometricPass = baseChecks.every((check) => check.passed);
    const steadyNeed = thresholds.steadyFramesRequired;
    if (geometricPass) {
      steadyFramesRef.current = Math.min(steadyNeed, steadyFramesRef.current + 1);
    } else {
      steadyFramesRef.current = 0;
    }
    const steadyFrames = steadyFramesRef.current;
    const holdSteady: ValidationCheck = {
      id: 'hold-steady',
      label: 'Hold steady (PD)',
      passed: steadyFrames >= steadyNeed,
      message:
        steadyFrames >= steadyNeed
          ? 'Locked — capturing…'
          : geometricPass
            ? `Hold still (${steadyFrames}/${steadyNeed})`
            : 'Fix alignment first',
      severity: steadyFrames >= steadyNeed ? 'pass' : 'fail',
    };
    const checks = [...baseChecks, holdSteady];
    const allChecksPassed = checks.every((check) => check.passed);

    setValidationState({
      ...newState,
      steadyFrames,
      validationChecks: checks,
      allChecksPassed,
    });
  }, [
    videoRef,
    canvasRef,
    analyzeImageQuality,
    extractLandmarks,
    calculateHeadTilt,
    calculateHeadRotation,
    calculateFaceWidthPercent,
    calculateEyeAspectRatio,
    generateAlignmentChecks,
    thresholds.eyeAspectRatioThreshold,
    calculateFaceInOval,
    pdHintOutRef,
    thresholds.steadyFramesRequired,
    livePdDebugOutRef,
  ]);

  useEffect(() => {
    if (!isActive) return;

    let isMounted = true;
    let localFaceMesh: any = null;

    const loadFaceMesh = async () => {
      try {
        // Load FaceMesh from CDN script tag to avoid bundling issues
        const loadScript = (src: string): Promise<void> => {
          return new Promise((resolve, reject) => {
            // Check if already loaded
            if (document.querySelector(`script[src="${src}"]`)) {
              resolve();
              return;
            }
            const script = document.createElement('script');
            script.src = src;
            script.crossOrigin = 'anonymous';
            script.onload = () => resolve();
            script.onerror = reject;
            document.head.appendChild(script);
          });
        };

        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js');

        if (!isMounted) return;

        // Access FaceMesh from window object
        const FaceMeshClass = (window as any).FaceMesh;

        if (!FaceMeshClass) {
          console.error('FaceMesh class not found on window');
          return;
        }

        localFaceMesh = new FaceMeshClass({
          locateFile: (file: string) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
          },
        });

        localFaceMesh.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true,
          minDetectionConfidence: mobileCapture ? 0.4 : 0.55,
          minTrackingConfidence: mobileCapture ? 0.4 : 0.55,
        });

        localFaceMesh.onResults(processResults);
        faceMeshRef.current = localFaceMesh;

        const processFrame = async () => {
          if (!isMounted || !videoRef.current || !faceMeshRef.current) return;

          const now = performance.now();
          if (now - lastProcessTime.current < 100) { // Limit to ~10 FPS for performance
            animationFrameRef.current = requestAnimationFrame(processFrame);
            return;
          }
          lastProcessTime.current = now;

          if (videoRef.current.readyState >= 2) {
            try {
              await faceMeshRef.current.send({ image: videoRef.current });
            } catch {
              // Ignore errors if instance was closed
            }
          }

          if (isMounted) {
            animationFrameRef.current = requestAnimationFrame(processFrame);
          }
        };

        processFrame();
      } catch (error) {
        console.error('Failed to load FaceMesh:', error);
      }
    };

    loadFaceMesh();

    return () => {
      isMounted = false;

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = undefined;
      }

      // Safely close FaceMesh instance
      if (localFaceMesh) {
        try {
          localFaceMesh.close();
        } catch {
          // Instance may already be deleted, ignore error
        }
        localFaceMesh = null;
      }
      faceMeshRef.current = null;
    };
  }, [isActive, videoRef, processResults, mobileCapture]);

  return validationState;
}
