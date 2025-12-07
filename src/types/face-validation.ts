export interface FaceLandmarks {
  leftEye: { x: number; y: number; z: number };
  rightEye: { x: number; y: number; z: number };
  noseTip: { x: number; y: number; z: number };
  leftEar: { x: number; y: number; z: number };
  rightEar: { x: number; y: number; z: number };
  chin: { x: number; y: number; z: number };
  forehead: { x: number; y: number; z: number };
  leftEyeUpper: { x: number; y: number; z: number };
  leftEyeLower: { x: number; y: number; z: number };
  rightEyeUpper: { x: number; y: number; z: number };
  rightEyeLower: { x: number; y: number; z: number };
  faceLeft: { x: number; y: number; z: number };
  faceRight: { x: number; y: number; z: number };
}

export interface ValidationCheck {
  id: string;
  label: string;
  passed: boolean;
  message: string;
  severity: 'pass' | 'warning' | 'fail';
}

export interface FaceValidationState {
  faceDetected: boolean;
  faceCount: number;
  headTilt: number; // degrees, 0 is straight
  headRotation: number; // degrees, 0 is forward
  faceWidthPercent: number; // percentage of frame width
  brightness: number; // 0-255
  contrast: number; // 0-1
  leftEyeOpen: boolean;
  rightEyeOpen: boolean;
  landmarks: FaceLandmarks | null;
  allChecksPassed: boolean;
  validationChecks: ValidationCheck[];
}

export interface PDMeasurement {
  leftPupilX: number;
  rightPupilX: number;
  pdPixels: number;
  pdMillimeters: number;
  faceWidthPixels: number;
}

export interface GlassesFrame {
  id: string;
  name: string;
  imageUrl: string;
  category: 'rectangular' | 'round' | 'aviator' | 'cat-eye' | 'square';
  color: string;
  width: number; // normalized width for scaling
}

export type CameraState = 'requesting' | 'granted' | 'denied' | 'error';