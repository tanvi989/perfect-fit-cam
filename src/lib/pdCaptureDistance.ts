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
