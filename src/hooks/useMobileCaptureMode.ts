import { useSyncExternalStore } from 'react';
import { getMobileCaptureSnapshot, subscribeMobileCapture } from '@/lib/pdCaptureDistance';

/** Reactive “mobile / touch capture” flag — matches relaxed PD gates & copy (resize + orientation). */
export function useMobileCaptureMode(): boolean {
  return useSyncExternalStore(subscribeMobileCapture, getMobileCaptureSnapshot, () => false);
}
