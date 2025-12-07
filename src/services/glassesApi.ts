const API_BASE = 'https://api.multifolks.aonetech.in';

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

export interface LandmarksDetectResponse {
  success: boolean;
  mm: LandmarkMeasurements;
}

async function dataURLtoBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

export async function detectGlasses(imageDataUrl: string): Promise<GlassesDetectResponse> {
  try {
    const blob = await dataURLtoBlob(imageDataUrl);
    const formData = new FormData();
    formData.append('file', blob, 'capture.jpg');

    const response = await fetch(`${API_BASE}/glasses/detect`, {
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
  const blob = await dataURLtoBlob(imageDataUrl);
  const formData = new FormData();
  formData.append('image', blob, 'capture.jpg');

  const response = await fetch(`${API_BASE}/glasses/remove`, {
    method: 'POST',
    headers: { 'accept': 'application/json' },
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Failed to remove glasses');
  }

  return response.json();
}

export async function detectLandmarks(imageDataUrl: string): Promise<LandmarksDetectResponse> {
  try {
    const blob = await dataURLtoBlob(imageDataUrl);
    const formData = new FormData();
    formData.append('file', blob, 'capture.jpg');

    const response = await fetch(`${API_BASE}/landmarks/detect`, {
      method: 'POST',
      headers: { 'accept': 'application/json' },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Failed to detect landmarks: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.error('Landmarks detection API error:', error);
    throw new Error('CORS error: The API server needs to allow requests from this domain. Please configure CORS on your backend.');
  }
}
