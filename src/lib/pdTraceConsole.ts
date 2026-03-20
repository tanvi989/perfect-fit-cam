import type { LivePdGeometryDebug } from '@/lib/irisGeometry';

/** Mirrors backend `_build_pd_calculation_trace` shape (loose for forward compat). */
export interface PdCalculationTrace {
  summary?: string;
  constants?: Record<string, number>;
  pixels?: Record<string, unknown>;
  intermediate_mm?: Record<string, unknown>;
  scale_extra_echo?: Record<string, unknown>;
  hf_and_extra_scale?: Record<string, unknown>;
  formulas_plaintext?: string[];
}

function round4(x: number): number {
  return Math.round(x * 1e4) / 1e4;
}

/**
 * Pretty-print server-side PD math in the browser console after /landmarks/detect.
 * Server sends `landmarks.debug.pd_calculation_trace` from iris_landmark_service.py.
 */
export function logPdCalculationTraceToConsole(landmarks: {
  debug?: {
    pd_calculation_trace?: PdCalculationTrace;
    pd_error_mm?: number;
    expected_accuracy?: string;
  };
  scale?: { face_width_px?: number; pd_note?: string };
  mm?: { pd?: number };
}): void {
  const trace = landmarks.debug?.pd_calculation_trace;
  if (!trace) {
    console.warn(
      '[PD trace] No pd_calculation_trace in API response (needs updated backend).',
      'Scale/mm snapshot:',
      { scale: landmarks.scale, mm: landmarks.mm },
    );
    return;
  }

  const header = '%c PD calculation — end-to-end (see formulas_plaintext) ';
  console.groupCollapsed(header, 'background:#0d47a1;color:#fff;padding:4px 8px;border-radius:4px;');
  console.log('%cConstants & inputs', 'font-weight:bold;color:#1565c0');
  console.log('constants', trace.constants);
  console.log('pixels (image + iris geometry)', trace.pixels);
  console.log('%cIntermediate mm', 'font-weight:bold;color:#1565c0');
  console.log('intermediate_mm', trace.intermediate_mm);
  if (trace.hf_and_extra_scale && Object.keys(trace.hf_and_extra_scale).length > 0) {
    console.log('%cHF PD scale echo', 'font-weight:bold;color:#1565c0');
    console.log(trace.hf_and_extra_scale);
  }
  if (trace.scale_extra_echo && Object.keys(trace.scale_extra_echo).length > 0) {
    console.log('%cscale_extra_echo (server)', 'font-weight:bold;color:#1565c0');
    console.log(trace.scale_extra_echo);
  }
  console.log('%cStep-by-step formulas (plaintext)', 'font-weight:bold;color:#2e7d32');
  if (Array.isArray(trace.formulas_plaintext)) {
    console.log(trace.formulas_plaintext.join('\n'));
  }
  console.log('%cFull JSON (copy/paste)', 'font-weight:bold;color:#6a1b9a');
  console.log(JSON.stringify(trace, null, 2));
  console.groupEnd();
}

/**
 * One-shot after capture: live video geometry vs server on the **uploaded** image (may differ slightly).
 */
export function logPdSnapReport(
  liveLastFrame: LivePdGeometryDebug | null,
  pdHintMmSent: number | undefined | null,
  landmarks: {
    debug?: {
      pd_calculation_trace?: PdCalculationTrace;
      pd_error_mm?: number;
      expected_accuracy?: string;
    };
    scale?: Record<string, unknown>;
    mm?: { pd?: number };
  },
): void {
  const serverPd = landmarks.mm?.pd;
  console.info(
    '%c[PD SNAP REPORT]%c Live preview geometry vs server (expand groups below)',
    'background:#6a1b9a;color:#fff;padding:4px 8px;border-radius:4px;font-weight:bold',
    'color:#888',
  );
  console.info(
    '— Client: last live frame before shutter (video resolution / mirror may differ from JPEG):',
    liveLastFrame,
  );
  console.info('— pd_hint_mm sent to API:', pdHintMmSent ?? null);
  console.info('— Server: mm.pd (display):', serverPd);
  if (liveLastFrame != null && serverPd != null && Number.isFinite(serverPd)) {
    const irisPrev = liveLastFrame.pdMmIrisScaleOnly;
    const facePrev = liveLastFrame.pdMmFaceScaleOnly;
    console.info('— Quick compare (mm): server display vs client iris-only preview:', {
      server_pd: serverPd,
      client_iris_ruler_preview: irisPrev,
      delta_server_minus_iris_preview: round4(Number(serverPd) - irisPrev),
      client_face_ruler_preview: facePrev,
      delta_server_minus_face_preview: round4(Number(serverPd) - facePrev),
    });
  }
  const trace = landmarks.debug?.pd_calculation_trace;
  if (trace?.pixels) {
    console.info('— Server trace: pixels object (from **decoded upload**):', trace.pixels);
  }
  logPdCalculationTraceToConsole(landmarks);
}
