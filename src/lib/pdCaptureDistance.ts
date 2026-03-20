/**
 * PD capture “working distance” is device-dependent:
 * - Desktop webcams: user sits farther; ~60 cm is realistic.
 * - Phones: full arm extension is awkward; use a comfortable selfie distance instead.
 * Face-width % bands in useFaceDetection are scaled from these targets.
 */
export const PD_DESKTOP_TARGET_DISTANCE_CM = 60;
export const PD_MOBILE_TARGET_DISTANCE_CM = 42;

/** Exported for tests / tools; prefer getMobileCaptureSnapshot + subscribeMobileCapture in React. */
export function computeMobileCaptureMode(): boolean {
  if (typeof window === 'undefined') return false;

  const w = window.innerWidth;
  const h = window.innerHeight;
  const shortSide = Math.min(w, h);

  // Narrow portrait phones
  if (shortSide <= 480 || w <= 768) return true;

  try {
    // Primary: touch-optimised devices (phones, most tablets) even in landscape
    if (window.matchMedia('(pointer: coarse)').matches) return true;
  } catch {
    /* ignore */
  }

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  if (/Android|iPhone|iPad|iPod|webOS|Mobile|IEMobile|BlackBerry|Silk/i.test(ua)) return true;

  // iPadOS desktop UA
  if (
    typeof navigator !== 'undefined' &&
    /Mac/.test(navigator.platform) &&
    'ontouchend' in document &&
    (navigator.maxTouchPoints ?? 0) > 1
  ) {
    return true;
  }

  return false;
}

export function getMobileCaptureSnapshot(): boolean {
  return computeMobileCaptureMode();
}

export function subscribeMobileCapture(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};

  window.addEventListener('resize', onStoreChange);
  window.addEventListener('orientationchange', onStoreChange);

  const mql: MediaQueryList[] = [];
  try {
    for (const q of ['(pointer: coarse)', '(max-width: 768px)']) {
      const m = window.matchMedia(q);
      m.addEventListener('change', onStoreChange);
      mql.push(m);
    }
  } catch {
    /* ignore */
  }

  return () => {
    window.removeEventListener('resize', onStoreChange);
    window.removeEventListener('orientationchange', onStoreChange);
    for (const m of mql) {
      try {
        m.removeEventListener('change', onStoreChange);
      } catch {
        /* ignore */
      }
    }
  };
}

export function isMobileCaptureViewport(): boolean {
  return getMobileCaptureSnapshot();
}

/**
 * Desktop: stricter steady lock; mobile: shorter so captures complete in the field.
 * Mobile alignment rules are loosened in useFaceDetection; server PD stays iris-based.
 */
export const PD_STEADY_FRAMES_DESKTOP = 10;
export const PD_STEADY_FRAMES_MOBILE = 5;

export function getPdSteadyFramesRequired(): number {
  return getMobileCaptureSnapshot() ? PD_STEADY_FRAMES_MOBILE : PD_STEADY_FRAMES_DESKTOP;
}
