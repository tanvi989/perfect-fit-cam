import { getCaptureClientInfo } from '@/lib/captureClientInfo';

/** Deployed API — override with VITE_API_BASE_URL in .env.local for local backend */
const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ?? 'https://vtob.multifolks.com'
).replace(/\/+$/, '');

// Session management - simple incrementing IDs stored in sessionStorage
function getSessionIds(): { guestId: string; sessionId: string } {
  let guestId = sessionStorage.getItem('guest_id');
  let sessionId = sessionStorage.getItem('session_id');
  
  if (!guestId) {
    guestId = String(Date.now());
    sessionStorage.setItem('guest_id', guestId);
  }
  
  if (!sessionId) {
    sessionId = String(Date.now());
    sessionStorage.setItem('session_id', sessionId);
  }
  
  return { guestId, sessionId };
}

export interface GlassesDetectResponse {
  success: boolean;
  glasses_detected: boolean;
  confidence: number;
  edited_image_base64?: string;
}

export interface GlassesRemoveResponse {
  success: boolean;
  edited_image_base64: string;
}

export interface LandmarkMeasurements {
  pd: number;
  pd_left: number;
  pd_right: number;
  pd_hf?: number | null;
  pd_hf_left?: number | null;
  pd_hf_right?: number | null;
  jaw_width?: number;
  chin_width?: number;
  chin_to_face_width_ratio?: number;
  eye_vertical_position_ratio?: number;
  segment_height_proxy_mm?: number | null;
  nose_bridge_left: number;
  nose_bridge_right: number;
  face_width: number;
  face_height: number;
  face_ratio: number;
}

export interface Scale {
  mm_per_pixel: number;
  iris_diameter_px: number;
  pd_px_used?: number;
  pd_px_horizontal?: number;
  pd_px_euclidean?: number;
  pd_px_euclidean_raw?: number;
  pd_geometry?: string;
  pd_mm_iris_scale_only?: number;
  pd_mm_face_scale_only?: number;
  pd_prior_mm?: number;
  face_width_px?: number;
  pd_reliability?: string;
  pd_note?: string;
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
  pd_hf_method?: string | null;
}

export interface DebugInfo {
  pd_error_mm: number;
  expected_accuracy: string;
  pd_calculation_trace?: Record<string, unknown> | null;
}

export interface GenderEstimate {
  label: string;
  confidence: number;
  low_confidence?: boolean;
  model?: string | null;
  prob_male?: number;
  prob_female?: number;
  error?: string;
}

/** FER+ emotion head from Hugging Face `onnxmodelzoo/emotion-ferplus-8` */
export interface EmotionEstimate {
  label: string;
  confidence: number;
  low_confidence?: boolean;
  label_index?: number;
  model?: string | null;
  error?: string;
}

export interface AgeEstimate {
  bucket: string;
  bucket_index?: number | null;
  confidence: number;
  low_confidence?: boolean;
  model?: string | null;
  provenance?: string | null;
  error?: string;
}

export interface EyewearInsights {
  face_width_bucket: string;
  face_width_bucket_recommendation?: string;
  face_width_mm?: number | null;
  face_height_mm?: number | null;
  suggested_frame_total_width_mm?: { min: number; max: number };
  lens_height_guidance?: {
    label: string;
    suggested_lens_height_mm_min: number;
    suggested_lens_height_mm_max: number;
    explanation: string;
  };
  segment_height?: {
    pupil_to_lower_lid_proxy_mm?: number | null;
    note?: string;
    progressives_disclaimer?: string;
  };
  eye_vertical_position_ratio?: number | null;
  chin_to_face_width_ratio?: number | null;
  pd_reliability?: string;
  pd_blend_method?: string | null;
  monocular_asymmetry_mm?: number | null;
  nose_bridge_asymmetry_mm?: number | null;
  nose_bridge_proxy_mm?: number | null;
  catalog_frame_fit?: Array<{
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
  }>;
  capture_quality?: { pd_geometry?: string; eyes_open_frontal_hint?: string };
  features_status?: Record<string, string>;
  fit_hint?: string;
  warnings?: string[];
  style_tips?: string[];
  disclaimer?: string;
  age_estimate?: AgeEstimate;
}

/** Echo + persist: browser / screen / network snapshot from capture time */
export type ClientCaptureInfo = ReturnType<typeof getCaptureClientInfo>;

export interface LandmarksDetectResponse {
  success: boolean;
  /** Server-side failure message when success is false */
  error?: string;
  landmarks?: {
    scale: Scale;
    mm: LandmarkMeasurements;
    face_shape: string;
    debug: DebugInfo;
    gender?: GenderEstimate;
    emotion?: EmotionEstimate;
    eyewear?: EyewearInsights;
    client_capture?: ClientCaptureInfo;
  };
}

function messageFromApiBody(data: unknown, fallback: string): string {
  if (!data || typeof data !== 'object') return fallback;
  const o = data as Record<string, unknown>;
  if (typeof o.error === 'string' && o.error.trim()) return o.error.trim();
  const d = o.detail;
  if (typeof d === 'string' && d.trim()) return d.trim();
  if (Array.isArray(d) && d.length > 0) {
    try {
      return JSON.stringify(d);
    } catch {
      return fallback;
    }
  }
  if (d && typeof d === 'object') {
    try {
      return JSON.stringify(d);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export interface SelectFrameResponse {
  success: boolean;
  message?: string;
  frame_image?: string;
  fitting_height?: number;
}

async function dataURLtoBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

export async function detectGlasses(imageDataUrl: string): Promise<GlassesDetectResponse> {
  try {
    const { guestId, sessionId } = getSessionIds();
    const blob = await dataURLtoBlob(imageDataUrl);
    const formData = new FormData();
    formData.append('file', blob, 'capture.jpg');

    const response = await fetch(`${API_BASE}/glasses/detect?guest_id=${guestId}&session_id=${sessionId}`, {
      method: 'POST',
      headers: { 'accept': 'application/json' },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Failed to detect glasses: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.error('Glasses detection API error:', error);
    // Return default response if API fails (CORS or network issue)
    return { success: true, glasses_detected: false, confidence: 0 };
  }
}

export async function removeGlasses(imageDataUrl: string): Promise<GlassesRemoveResponse> {
  try {
    const { guestId, sessionId } = getSessionIds();
    const blob = await dataURLtoBlob(imageDataUrl);
    const formData = new FormData();
    formData.append('image', blob, 'capture.jpg');

    const response = await fetch(`${API_BASE}/glasses/remove?guest_id=${guestId}&session_id=${sessionId}`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Failed to remove glasses: ${response.status}`);
    }

    // Check content type - API might return image directly or JSON
    const contentType = response.headers.get('content-type') || '';
    
    if (contentType.includes('image')) {
      // API returns image directly - convert to base64
      const imageBlob = await response.blob();
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          // Remove data URL prefix to get just base64
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(imageBlob);
      });
      return { success: true, edited_image_base64: base64 };
    }

    // Otherwise parse as JSON
    return response.json();
  } catch (error) {
    console.error('Glasses removal API error:', error);
    throw new Error('Failed to remove glasses from image');
  }
}

export async function detectLandmarks(
  imageDataUrl: string,
  pdHintMm?: number,
  options?: { genderSourceDataUrl?: string | null },
): Promise<LandmarksDetectResponse> {
  try {
    const { guestId, sessionId } = getSessionIds();
    const blob = await dataURLtoBlob(imageDataUrl);
    const formData = new FormData();
    formData.append('file', blob, 'capture.jpg');
    if (pdHintMm != null && Number.isFinite(pdHintMm)) {
      formData.append('pd_hint_mm', pdHintMm.toFixed(2));
    }
    const gSrc = options?.genderSourceDataUrl;
    if (gSrc && gSrc !== imageDataUrl) {
      const gBlob = await dataURLtoBlob(gSrc);
      formData.append('gender_image', gBlob, 'original_for_gender.jpg');
    }

    try {
      const clientPayload = JSON.stringify(getCaptureClientInfo());
      if (clientPayload.length < 16_384) {
        formData.append('client_capture', clientPayload);
      }
    } catch {
      /* ignore client info in non-browser contexts */
    }

    const response = await fetch(`${API_BASE}/landmarks/detect?guest_id=${guestId}&session_id=${sessionId}`, {
      method: 'POST',
      headers: { 'accept': 'application/json' },
      body: formData,
    });

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new Error(
        response.ok
          ? 'Landmarks API returned invalid JSON'
          : `Landmarks API HTTP ${response.status} (no JSON body)`,
      );
    }

    if (!response.ok) {
      const msg = messageFromApiBody(data, `HTTP ${response.status}`);
      throw new Error(`Landmarks failed (${response.status}): ${msg}`);
    }

    const parsed = data as LandmarksDetectResponse;
    if (!parsed.success) {
      const msg = messageFromApiBody(parsed, 'Server returned success=false');
      throw new Error(msg);
    }
    if (!parsed.landmarks?.mm) {
      throw new Error('Landmarks response missing measurements (mm)');
    }

    return parsed;
  } catch (error) {
    console.error('Landmarks detection API error:', error);
    if (error instanceof Error && error.message.startsWith('Landmarks')) {
      throw error;
    }
    if (error instanceof Error && (error.message.includes('fetch') || error.name === 'TypeError')) {
      throw new Error(
        `Cannot reach API at ${API_BASE}. Check network, HTTPS, and CORS. ${error.message}`,
      );
    }
    throw error instanceof Error ? error : new Error(String(error));
  }
}

export async function selectFrame(
  frameImageDataUrl: string,
  frameId: string,
  frameName: string,
  dimensions: string
): Promise<SelectFrameResponse> {
  try {
    const { guestId, sessionId } = getSessionIds();
    const blob = await dataURLtoBlob(frameImageDataUrl);
    const formData = new FormData();
    formData.append('guest_id', guestId);
    formData.append('session_id', sessionId);
    formData.append('frame_id', frameId);
    formData.append('frame_name', frameName);
    formData.append('dimensions', dimensions);
    formData.append('selected_frame_image', blob, 'frame_selection.jpg');

    const response = await fetch(`${API_BASE}/virtual-tryon/select-frame`, {
      method: 'POST',
      headers: { 'accept': 'application/json' },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Failed to save frame selection: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.error('Select frame API error:', error);
    throw new Error('Failed to save frame selection');
  }
}
