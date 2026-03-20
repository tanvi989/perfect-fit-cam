/**
 * Map normalized MediaPipe coords (0–1 in source frame) to % positions inside a container
 * that shows the video with object-fit: cover and optional horizontal flip (selfie mirror).
 */

import type { LivePdGeometryDebug } from '@/lib/irisGeometry';

export function normalizedToLayoutPercent(
  nx: number,
  ny: number,
  videoW: number,
  videoH: number,
  containerW: number,
  containerH: number,
  mirrorX: boolean,
): { leftPct: number; topPct: number } {
  if (videoW <= 0 || videoH <= 0 || containerW <= 0 || containerH <= 0) {
    return { leftPct: 50, topPct: 50 };
  }
  const ix = nx * videoW;
  const iy = ny * videoH;
  const scale = Math.max(containerW / videoW, containerH / videoH);
  const dispW = videoW * scale;
  const dispH = videoH * scale;
  const offX = (containerW - dispW) / 2;
  const offY = (containerH - dispH) / 2;
  let x = ix * scale + offX;
  const y = iy * scale + offY;
  if (mirrorX) x = containerW - x;
  return {
    leftPct: (x / containerW) * 100,
    topPct: (y / containerH) * 100,
  };
}

export function irisSegmentLayoutPercents(
  live: LivePdGeometryDebug,
  containerW: number,
  containerH: number,
  mirrorX: boolean,
): {
  left: { leftPct: number; topPct: number };
  right: { leftPct: number; topPct: number };
} {
  const { videoWidth: vw, videoHeight: vh, leftIrisCenterPx: li, rightIrisCenterPx: ri } = live;
  return {
    left: normalizedToLayoutPercent(li.x / vw, li.y / vh, vw, vh, containerW, containerH, mirrorX),
    right: normalizedToLayoutPercent(ri.x / vw, ri.y / vh, vw, vh, containerW, containerH, mirrorX),
  };
}
