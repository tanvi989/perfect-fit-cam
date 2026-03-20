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
  /** |left iris y − right iris y| in normalized landmark space (0–1); low = level eyes for PD */
  eyeLevelDelta: number;
  /** Frames in a row with geometric PD checks passing; must reach steady target to capture */
  steadyFrames: number;
  landmarks: FaceLandmarks | null;
  allChecksPassed: boolean;
  validationChecks: ValidationCheck[];
}

export interface CreditCardValidation {
  cardDetected: boolean;
  cardFullyVisible: boolean;
  cardInPosition: boolean;
  cardTilted: boolean;
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
  pd: number;
  pd_left: number;
  pd_right: number;
  /** Second opinion: InsightFace 2d106 ONNX (Hugging Face); same iris mm/px ruler as primary */
  pd_hf?: number | null;
  pd_hf_left?: number | null;
  pd_hf_right?: number | null;
  jaw_width?: number;
  chin_width?: number;
  /** Chin width / bizygomatic width — style / jaw hints */
  chin_to_face_width_ratio?: number;
  /** ~0–1: iris height between forehead and chin landmarks (frontal photo) */
  eye_vertical_position_ratio?: number;
  /** Pupil → lower eyelid proxy mm (not clinical segment height) */
  segment_height_proxy_mm?: number | null;
  nose_bridge_left: number;
  nose_bridge_right: number;
  face_width: number;
  face_height: number;
  face_ratio: number;
}

export interface ApiScale {
  mm_per_pixel: number;
  iris_diameter_px: number;
  /** Same iris geometry as primary, but iris-diameter scale only (no face blend / prior / hint). */
  pd_mm_iris_scale_only?: number;
  /** IPD if we assumed 145 mm bizygomatic width (weak prior). */
  pd_mm_face_scale_only?: number;
  /** IPD from anthropometric prior ∝ face width (iris-scaled). */
  pd_prior_mm?: number;
  pd_note?: string;
  pd_reliability?: string;
  pd_client_hint_mm?: number;
  pd_method?: string;
  pd_client_hint_ignored_mm?: number;
  pd_hf_model?: string | null;
  pd_hf_provenance?: string | null;
  pd_hf_note?: string | null;
  pd_hf_error?: string | null;
  pd_hf_delta_mm?: number | null;
  pd_hf_px_horizontal?: number | null;
  pd_hf_ratio_iris?: number | null;
  /** eye_band_bicentric, ratio_matched_pair, or combined after fallback */
  pd_hf_method?: string | null;
}

export interface ApiDebug {
  pd_error_mm: number;
  expected_accuracy: string;
}

export interface ApiGenderEstimate {
  label: string;
  confidence: number;
  low_confidence?: boolean;
  model?: string | null;
  prob_male?: number;
  prob_female?: number;
  error?: string;
}

/** Adience-style age bucket from Hugging Face `onnxmodelzoo/age_googlenet` ONNX */
export interface ApiAgeEstimate {
  bucket: string;
  bucket_index?: number | null;
  confidence: number;
  low_confidence?: boolean;
  model?: string | null;
  provenance?: string | null;
  error?: string;
}

export interface ApiLensHeightGuidance {
  label: string;
  suggested_lens_height_mm_min: number;
  suggested_lens_height_mm_max: number;
  explanation: string;
}

export interface ApiSegmentHeightBlock {
  pupil_to_lower_lid_proxy_mm?: number | null;
  note?: string;
  progressives_disclaimer?: string;
}

export interface ApiCatalogFrameFit {
  id: string;
  name: string;
  frame_total_width_mm: number;
  frame_nose_bridge_mm: number;
  frame_lens_width_mm: number;
  width_vs_face: string;
  width_explanation: string;
  bridge_vs_estimate: string;
  bridge_explanation: string;
  overall_label: string;
}

export interface ApiEyewearInsights {
  face_width_bucket: string;
  face_width_bucket_recommendation?: string;
  face_width_mm?: number | null;
  face_height_mm?: number | null;
  suggested_frame_total_width_mm?: { min: number; max: number };
  lens_height_guidance?: ApiLensHeightGuidance;
  segment_height?: ApiSegmentHeightBlock;
  eye_vertical_position_ratio?: number | null;
  chin_to_face_width_ratio?: number | null;
  pd_reliability?: string;
  pd_blend_method?: string | null;
  monocular_asymmetry_mm?: number | null;
  nose_bridge_asymmetry_mm?: number | null;
  nose_bridge_proxy_mm?: number | null;
  catalog_frame_fit?: ApiCatalogFrameFit[];
  capture_quality?: {
    pd_geometry?: string;
    eyes_open_frontal_hint?: string;
  };
  features_status?: Record<string, string>;
  fit_hint?: string;
  warnings?: string[];
  style_tips?: string[];
  disclaimer?: string;
  age_estimate?: ApiAgeEstimate;
}

/** Browser / device / network snapshot at capture (from client, echoed by API). */
export type ApiClientCapture = import('@/lib/captureClientInfo').CaptureClientInfo;

export interface ApiLandmarks {
  scale: ApiScale;
  mm: ApiMeasurements;
  face_shape: string;
  debug: ApiDebug;
  gender?: ApiGenderEstimate;
  eyewear?: ApiEyewearInsights;
  client_capture?: ApiClientCapture;
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

export interface ApiLandmarksResponse {
  success: boolean;
  landmarks: ApiLandmarks & { eyewear?: ApiEyewearInsights };
}

export interface CapturedData {
  imageDataUrl: string;
  processedImageDataUrl: string; // After glasses removal if needed
  glassesDetected: boolean;
  landmarks: FaceLandmarks;
  measurements: ApiMeasurements;
  faceShape: string;
  gender?: ApiGenderEstimate;
  eyewear?: ApiEyewearInsights;
  clientCapture?: ApiClientCapture;
  apiResponse?: ApiLandmarksResponse; // Full API response
  timestamp: number;
}