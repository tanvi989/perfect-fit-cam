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
  leftEyeAR: number; // eye aspect ratio for debugging
  rightEyeAR: number; // eye aspect ratio for debugging
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

export interface FrameOffsets {
  offsetX: number;  // Horizontal offset in pixels (positive = right)
  offsetY: number;  // Vertical offset in pixels (positive = down)
  scaleAdjust: number; // Scale multiplier (1.0 = no change)
  rotationAdjust: number; // Rotation adjustment in degrees
}

export interface GlassesFrame {
  id: string;
  name: string;
  imageUrl: string;
  category: 'rectangular' | 'round' | 'aviator' | 'cat-eye' | 'square';
  color: string;
  width: number; // frame width in mm
  lensWidth: number; // lens width in mm
  noseBridge: number; // nose bridge in mm
  templeLength: number; // temple length in mm
  offsets?: FrameOffsets; // Per-frame fine-tune offsets
}

export type CameraState = 'requesting' | 'granted' | 'denied' | 'error';

export interface ApiMeasurements {
  pd_total: number;
  pd_left: number;
  pd_right: number;
  nose_left: number;
  nose_right: number;
  nose_total: number;
  fitting_height: number;
  face_width: number;
  face_height: number;
  face_shape_ratio: number;
}

export interface RegionPoint {
  x: number;
  y: number;
}

export interface ApiRegionPoints {
  left_eye_center: RegionPoint;
  right_eye_center: RegionPoint;
  left_eyebrow: RegionPoint;
  right_eyebrow: RegionPoint;
  nose_tip: RegionPoint;
  left_ear: RegionPoint;
  right_ear: RegionPoint;
  chin: RegionPoint;
}

export interface ApiScale {
  mm_per_pixel: number;
  pixels_per_mm: number;
}

export interface ApiLandmarksResponse {
  mm: ApiMeasurements;
  pixel?: ApiMeasurements;
  scale?: ApiScale;
  region_points?: ApiRegionPoints;
}

export interface CapturedData {
  imageDataUrl: string;
  processedImageDataUrl: string; // After glasses removal if needed
  glassesDetected: boolean;
  landmarks: FaceLandmarks;
  measurements: ApiMeasurements;
  apiLandmarks?: ApiLandmarksResponse; // Full API response with region_points and scale
  timestamp: number;
}