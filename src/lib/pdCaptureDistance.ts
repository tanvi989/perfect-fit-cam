/**
 * PD capture “working distance” is device-dependent:
 * - Desktop webcams: user sits farther; ~60 cm is realistic.
 * - Phones: full arm extension is awkward; use a comfortable selfie distance instead.
 * Face-width % bands in useFaceDetection are scaled from these targets.
 */
export const PD_DESKTOP_TARGET_DISTANCE_CM = 60;
export const PD_MOBILE_TARGET_DISTANCE_CM = 42;

export function isMobileCaptureViewport(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;
}

/**
 * Desktop: stricter steady lock; mobile: shorter so captures complete in the field.
 * Mobile alignment rules are loosened in useFaceDetection (not distance here); server PD stays iris-based.
 */
export const PD_STEADY_FRAMES_DESKTOP = 10;
export const PD_STEADY_FRAMES_MOBILE = 5;

export function getPdSteadyFramesRequired(): number {
  return isMobileCaptureViewport() ? PD_STEADY_FRAMES_MOBILE : PD_STEADY_FRAMES_DESKTOP;
}
