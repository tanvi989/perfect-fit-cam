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

  const header =
    '%c PD calculation — end-to-end (see formulas_plaintext) ';
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
