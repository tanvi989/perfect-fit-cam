const API_BASE = 'http://34.121.153.224:8000';

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
  const blob = await dataURLtoBlob(imageDataUrl);
  const formData = new FormData();
  formData.append('file', blob, 'capture.jpg');

  const response = await fetch(`${API_BASE}/glasses/detect`, {
    method: 'POST',
    headers: { 'accept': 'application/json' },
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Failed to detect glasses');
  }

  return response.json();
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
  const blob = await dataURLtoBlob(imageDataUrl);
  const formData = new FormData();
  formData.append('file', blob, 'capture.jpg');

  const response = await fetch(`${API_BASE}/landmarks/detect`, {
    method: 'POST',
    headers: { 'accept': 'application/json' },
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Failed to detect landmarks');
  }

  return response.json();
}
