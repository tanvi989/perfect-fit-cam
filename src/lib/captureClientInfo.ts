/**
 * Snapshot of browser / device / connectivity for support & analytics (sent with landmark API).
 * Avoid storing sensitive data beyond typical server logs.
 */
export interface CaptureClientInfo {
  captured_at_iso: string;
  online: boolean;
  language: string;
  languages?: string[];
  time_zone?: string;
  user_agent: string;
  platform?: string;
  hardware_concurrency?: number | null;
  screen: {
    width: number;
    height: number;
    avail_width: number;
    avail_height: number;
    color_depth: number;
    pixel_depth: number;
  };
  viewport: {
    inner_width: number;
    inner_height: number;
    device_pixel_ratio: number;
  };
  connection?: {
    effective_type?: string;
    downlink_mbps?: number | null;
    rtt_ms?: number | null;
    save_data?: boolean;
  };
}

export function getCaptureClientInfo(): CaptureClientInfo {
  const nav = typeof navigator !== 'undefined' ? navigator : ({} as Navigator);
  const scr = typeof screen !== 'undefined' ? screen : ({} as Screen);
  const conn = (nav as Navigator & { connection?: NetworkInformation }).connection;

  let connection: CaptureClientInfo['connection'];
  if (conn) {
    connection = {
      effective_type: conn.effectiveType,
      downlink_mbps: typeof conn.downlink === 'number' ? conn.downlink : null,
      rtt_ms: typeof conn.rtt === 'number' ? conn.rtt : null,
      save_data: !!conn.saveData,
    };
  }

  return {
    captured_at_iso: new Date().toISOString(),
    online: !!nav.onLine,
    language: nav.language || 'unknown',
    languages:
      typeof nav.languages !== 'undefined' ? Array.from(nav.languages).slice(0, 8) : undefined,
    time_zone: (() => {
      try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
      } catch {
        return undefined;
      }
    })(),
    user_agent: nav.userAgent || 'unknown',
    platform: nav.platform || undefined,
    hardware_concurrency:
      typeof nav.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : null,
    screen: {
      width: scr.width ?? 0,
      height: scr.height ?? 0,
      avail_width: scr.availWidth ?? 0,
      avail_height: scr.availHeight ?? 0,
      color_depth: scr.colorDepth ?? 0,
      pixel_depth: scr.pixelDepth ?? 0,
    },
    viewport: {
      inner_width: typeof window !== 'undefined' ? window.innerWidth : 0,
      inner_height: typeof window !== 'undefined' ? window.innerHeight : 0,
      device_pixel_ratio: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
    },
    connection,
  };
}

interface NetworkInformation {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}
