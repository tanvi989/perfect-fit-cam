import { useEffect, useRef, useState, useCallback } from 'react';
import type { FaceLandmarks, FaceValidationState, ValidationCheck } from '@/types/face-validation';

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

const THRESHOLDS = {
  maxHeadTilt: 10, // degrees
  maxHeadRotation: 15, // degrees
  minFaceWidthPercent: 15,
  maxFaceWidthPercent: 70,
  minBrightness: 80,
  maxBrightness: 220,
  minContrast: 0.3,
  eyeAspectRatioThreshold: 0.01, // Very low threshold to easily pass
};

interface UseFaceDetectionProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  isActive: boolean;
}

export function useFaceDetection({ videoRef, canvasRef, isActive }: UseFaceDetectionProps) {
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
    landmarks: null,
    allChecksPassed: false,
    validationChecks: [],
  });

  const faceMeshRef = useRef<any>(null);
  const animationFrameRef = useRef<number>();
  const lastProcessTime = useRef<number>(0);

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

  const generateValidationChecks = useCallback((state: Omit<FaceValidationState, 'validationChecks' | 'allChecksPassed'>): ValidationCheck[] => {
    const checks: ValidationCheck[] = [
      {
        id: 'face-detected',
        label: 'Face Detection',
        passed: state.faceDetected && state.faceCount === 1,
        message: !state.faceDetected 
          ? 'No face detected' 
          : state.faceCount > 1 
            ? 'Multiple faces detected' 
            : 'Face detected',
        severity: state.faceDetected && state.faceCount === 1 ? 'pass' : 'fail',
      },
      {
        id: 'head-straight',
        label: 'Head Position',
        passed: Math.abs(state.headTilt) <= THRESHOLDS.maxHeadTilt,
        message: Math.abs(state.headTilt) <= THRESHOLDS.maxHeadTilt 
          ? 'Head is straight' 
          : state.headTilt > 0 
            ? 'Tilt head left' 
            : 'Tilt head right',
        severity: Math.abs(state.headTilt) <= THRESHOLDS.maxHeadTilt ? 'pass' : 'fail',
      },
      {
        id: 'no-rotation',
        label: 'Face Forward',
        passed: Math.abs(state.headRotation) <= THRESHOLDS.maxHeadRotation,
        message: Math.abs(state.headRotation) <= THRESHOLDS.maxHeadRotation 
          ? 'Facing forward' 
          : state.headRotation > 0 
            ? 'Turn head left' 
            : 'Turn head right',
        severity: Math.abs(state.headRotation) <= THRESHOLDS.maxHeadRotation ? 'pass' : 'fail',
      },
      {
        id: 'distance',
        label: 'Distance',
        passed: state.faceWidthPercent >= THRESHOLDS.minFaceWidthPercent && 
                state.faceWidthPercent <= THRESHOLDS.maxFaceWidthPercent,
        message: state.faceWidthPercent < THRESHOLDS.minFaceWidthPercent 
          ? 'Move closer' 
          : state.faceWidthPercent > THRESHOLDS.maxFaceWidthPercent 
            ? 'Move back' 
            : 'Perfect distance',
        severity: state.faceWidthPercent >= THRESHOLDS.minFaceWidthPercent && 
                  state.faceWidthPercent <= THRESHOLDS.maxFaceWidthPercent ? 'pass' : 'fail',
      },
      {
        id: 'lighting',
        label: 'Lighting',
        passed: state.brightness >= THRESHOLDS.minBrightness && 
                state.brightness <= THRESHOLDS.maxBrightness &&
                state.contrast >= THRESHOLDS.minContrast,
        message: state.brightness < THRESHOLDS.minBrightness 
          ? 'Too dark - add light' 
          : state.brightness > THRESHOLDS.maxBrightness 
            ? 'Too bright' 
            : state.contrast < THRESHOLDS.minContrast 
              ? 'Reduce shadows' 
              : 'Good lighting',
        severity: state.brightness >= THRESHOLDS.minBrightness && 
                  state.brightness <= THRESHOLDS.maxBrightness &&
                  state.contrast >= THRESHOLDS.minContrast ? 'pass' : 'fail',
      },
      {
        id: 'eyes-open',
        label: 'Eyes Visible',
        passed: state.leftEyeOpen && state.rightEyeOpen,
        message: state.leftEyeOpen && state.rightEyeOpen 
          ? 'Eyes open' 
          : 'Keep eyes open',
        severity: state.leftEyeOpen && state.rightEyeOpen ? 'pass' : 'fail',
      },
    ];
    
    return checks;
  }, []);

  const processResults = useCallback((results: any) => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const { brightness, contrast } = analyzeImageQuality(video, canvas);

    if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
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
        landmarks: null,
      };
      
      const checks = generateValidationChecks(newState);
      setValidationState({
        ...newState,
        validationChecks: checks,
        allChecksPassed: false,
      });
      return;
    }

    const faceCount = results.multiFaceLandmarks.length;
    const landmarks = extractLandmarks(results.multiFaceLandmarks[0]);
    
    const headTilt = calculateHeadTilt(landmarks);
    const headRotation = calculateHeadRotation(landmarks);
    const faceWidthPercent = calculateFaceWidthPercent(landmarks, video.videoWidth);
    
    const leftEyeAR = calculateEyeAspectRatio(landmarks.leftEyeUpper, landmarks.leftEyeLower);
    const rightEyeAR = calculateEyeAspectRatio(landmarks.rightEyeUpper, landmarks.rightEyeLower);
    
    const leftEyeOpen = leftEyeAR > THRESHOLDS.eyeAspectRatioThreshold;
    const rightEyeOpen = rightEyeAR > THRESHOLDS.eyeAspectRatioThreshold;

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
      landmarks,
    };

    const checks = generateValidationChecks(newState);
    const allChecksPassed = checks.every(check => check.passed);

    setValidationState({
      ...newState,
      validationChecks: checks,
      allChecksPassed,
    });
  }, [videoRef, canvasRef, analyzeImageQuality, extractLandmarks, calculateHeadTilt, calculateHeadRotation, calculateFaceWidthPercent, calculateEyeAspectRatio, generateValidationChecks]);

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
          maxNumFaces: 2,
          refineLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
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
            } catch (e) {
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
        } catch (e) {
          // Instance may already be deleted, ignore error
        }
        localFaceMesh = null;
      }
      faceMeshRef.current = null;
    };
  }, [isActive, videoRef, processResults]);

  return validationState;
}