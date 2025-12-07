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
  landmarks: {
    mm: LandmarkMeasurements;
    pixel?: any;
    scale?: any;
    region_points?: any;
  };
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
  try {
    const blob = await dataURLtoBlob(imageDataUrl);
    const formData = new FormData();
    formData.append('image', blob, 'capture.jpg');

    const response = await fetch(`${API_BASE}/glasses/remove`, {
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
