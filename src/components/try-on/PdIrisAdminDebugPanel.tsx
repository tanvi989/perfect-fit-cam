import type { IrisPdSummary } from '@/lib/pdIrisCaptureSummary';
import {
  IRIS_LANDMARK_PD_CONSTANTS as PY,
  IRIS_LANDMARK_PD_CONSTANTS_SOURCE,
} from '@/constants/irisLandmarkPdConstants';
import { cn } from '@/lib/utils';

type Props = {
  summary: IrisPdSummary;
  /** Wider layout when pinned to full results page */
  variant?: 'card' | 'page';
};

/**
 * Admin-visible PD / iris geometry: iris Ø in px (the PD ruler), centres, IPD px + image-plane cm.
 */
export function PdIrisAdminDebugPanel({ summary: irisPdSummary, variant = 'card' }: Props) {
  const maxW = variant === 'page' ? 'max-w-4xl' : 'max-w-lg';
  const mm = irisPdSummary.mmPerPixel;
  const cmPerPx = mm != null && Number.isFinite(mm) ? mm / 10 : null;
  const fmtCm = (px: number | null | undefined) => {
    if (px == null || !Number.isFinite(px) || cmPerPx == null) return null;
    return (px * cmPerPx).toFixed(2);
  };
  const dCm =
    irisPdSummary.distancePx != null &&
    Number.isFinite(irisPdSummary.distancePx) &&
    cmPerPx != null
      ? (irisPdSummary.distancePx * cmPerPx).toFixed(2)
      : null;

  const hasDiam =
    irisPdSummary.irisDiameterMeanPx != null ||
    irisPdSummary.irisDiameterLeftPx != null ||
    irisPdSummary.irisDiameterRightPx != null;

  return (
    <div className={cn('w-full space-y-3', maxW, variant === 'card' && 'mx-auto')}>
      {variant === 'page' && (
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Admin / support — PD &amp; iris debug
        </p>
      )}

      {hasDiam && (
        <div className="rounded-md border border-primary/30 bg-primary/[0.08] px-3 py-2.5 text-sm text-left">
          <p className="text-xs font-bold text-foreground mb-1">
            Iris size in pixels (diameter Ø — limbus edge chords on MediaPipe iris ring; server may inflate mean
            when IPD/iris ratio is implausibly high; used as mm/px ruler)
          </p>
          <p className="font-medium text-foreground/95 tabular-nums">
            <span className="text-muted-foreground font-normal">Left iris Ø</span>{' '}
            {irisPdSummary.irisDiameterLeftPx != null ? (
              <>
                <span className="font-mono text-foreground">{irisPdSummary.irisDiameterLeftPx.toFixed(2)}</span> px
              </>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
            <span className="text-muted-foreground mx-1.5">|</span>
            <span className="text-muted-foreground font-normal">Right iris Ø</span>{' '}
            {irisPdSummary.irisDiameterRightPx != null ? (
              <>
                <span className="font-mono text-foreground">{irisPdSummary.irisDiameterRightPx.toFixed(2)}</span> px
              </>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
            <span className="text-muted-foreground mx-1.5">|</span>
            <span className="text-muted-foreground font-normal">Mean Ø</span>{' '}
            {irisPdSummary.irisDiameterMeanPx != null ? (
              <>
                <span className="font-mono text-foreground">{irisPdSummary.irisDiameterMeanPx.toFixed(2)}</span> px
              </>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </p>
          {irisPdSummary.source != null && (
            <p className="text-[10px] text-muted-foreground mt-1">
              Source:{' '}
              {irisPdSummary.source === 'live_preview' ? 'live camera preview' : 'server processed image'}
            </p>
          )}
        </div>
      )}

      <div className="rounded-md border border-border/70 bg-muted/30 px-3 py-2.5 text-sm leading-relaxed text-left">
        <p>
          <span className="text-muted-foreground">Iris detected:</span>{' '}
          <span className="font-semibold text-foreground">{irisPdSummary.detected ? 'Yes' : 'No'}</span>
          {irisPdSummary.source === 'live_preview' && (
            <span className="text-muted-foreground text-xs ml-1">(live preview)</span>
          )}
          {irisPdSummary.source === 'server_image' && (
            <span className="text-muted-foreground text-xs ml-1">(server image)</span>
          )}
        </p>
        <p className="mt-1">
          <span className="text-muted-foreground">Iris left at</span>{' '}
          {irisPdSummary.left ? (
            <>
              x ={' '}
              <span className="font-mono tabular-nums text-foreground">{irisPdSummary.left.x.toFixed(1)}</span> px, y ={' '}
              <span className="font-mono tabular-nums text-foreground">{irisPdSummary.left.y.toFixed(1)}</span> px
            </>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
          <span className="text-muted-foreground"> · Iris right at</span>{' '}
          {irisPdSummary.right ? (
            <>
              x ={' '}
              <span className="font-mono tabular-nums text-foreground">{irisPdSummary.right.x.toFixed(1)}</span> px, y ={' '}
              <span className="font-mono tabular-nums text-foreground">{irisPdSummary.right.y.toFixed(1)}</span> px
            </>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </p>
        <p className="mt-1">
          <span className="text-muted-foreground">Distance between irises:</span>{' '}
          {irisPdSummary.distancePx != null && Number.isFinite(irisPdSummary.distancePx) ? (
            <>
              <span className="font-mono font-semibold tabular-nums text-foreground">
                {irisPdSummary.distancePx.toFixed(2)}
              </span>{' '}
              px
            </>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </p>
      </div>

      <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-2.5 text-sm leading-relaxed text-left">
        <p>
          <span className="text-muted-foreground">Iris detected:</span>{' '}
          <span className="font-semibold text-foreground">{irisPdSummary.detected ? 'Yes' : 'No'}</span>
          {irisPdSummary.source === 'live_preview' && (
            <span className="text-muted-foreground text-xs ml-1">(live preview)</span>
          )}
          {irisPdSummary.source === 'server_image' && (
            <span className="text-muted-foreground text-xs ml-1">(server image)</span>
          )}
        </p>
        <p className="mt-1">
          <span className="text-muted-foreground">Iris left at</span>{' '}
          {irisPdSummary.left && fmtCm(irisPdSummary.left.x) != null ? (
            <>
              x ={' '}
              <span className="font-mono tabular-nums text-foreground">{fmtCm(irisPdSummary.left.x)}</span> cm, y ={' '}
              <span className="font-mono tabular-nums text-foreground">{fmtCm(irisPdSummary.left.y)}</span> cm
            </>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
          <span className="text-muted-foreground"> · Iris right at</span>{' '}
          {irisPdSummary.right && fmtCm(irisPdSummary.right.x) != null ? (
            <>
              x ={' '}
              <span className="font-mono tabular-nums text-foreground">{fmtCm(irisPdSummary.right.x)}</span> cm, y ={' '}
              <span className="font-mono tabular-nums text-foreground">{fmtCm(irisPdSummary.right.y)}</span> cm
            </>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </p>
        <p className="mt-1">
          <span className="text-muted-foreground">Distance between irises:</span>{' '}
          {dCm != null ? (
            <>
              <span className="font-mono font-semibold tabular-nums text-foreground">{dCm}</span> cm
            </>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </p>
        <p className="text-[10px] text-muted-foreground mt-1.5">
          cm values use the iris-scale mm/px from the preview (live) or the API image (server); they describe distances
          in the photo plane, not &quot;cm from the lens.&quot;
        </p>
      </div>

      <div className="rounded-md border border-slate-500/25 bg-slate-500/[0.06] px-3 py-2.5 text-left text-xs dark:bg-slate-950/40">
          <p className="font-semibold text-foreground mb-2">
            Static PD priors on server ({IRIS_LANDMARK_PD_CONSTANTS_SOURCE} · ~20–33)
          </p>
          <dl className="grid grid-cols-[minmax(0,1.2fr)_auto] gap-x-3 gap-y-1 text-[11px]">
            <dt className="text-muted-foreground">KNOWN_FACE_WIDTH_MM</dt>
            <dd className="font-mono tabular-nums text-foreground">{PY.KNOWN_FACE_WIDTH_MM}</dd>
            <dt className="text-muted-foreground">CALIB_DISTANCE_MM</dt>
            <dd className="font-mono tabular-nums text-foreground">{PY.CALIB_DISTANCE_MM}</dd>
            <dt className="text-muted-foreground">IRIS_DIAMETER_MM</dt>
            <dd className="font-mono tabular-nums text-foreground">{PY.IRIS_DIAMETER_MM}</dd>
            <dt className="text-muted-foreground">IPD_TO_FACE_WIDTH_PRIOR (= 62.5/145)</dt>
            <dd className="font-mono tabular-nums text-foreground">
              {PY.IPD_TO_FACE_WIDTH_PRIOR.toFixed(6)}
            </dd>
            <dt className="text-muted-foreground">FACE_PD_BLEND</dt>
            <dd className="font-mono tabular-nums text-foreground">{PY.FACE_PD_BLEND}</dd>
            <dt className="text-muted-foreground">PRIOR_BLEND_MM</dt>
            <dd className="font-mono tabular-nums text-foreground">{PY.PRIOR_BLEND_MM}</dd>
            <dt className="text-muted-foreground">PD_IRIS_FACE_DISAGREE_MM</dt>
            <dd className="font-mono tabular-nums text-foreground">{PY.PD_IRIS_FACE_DISAGREE_MM}</dd>
            <dt className="text-muted-foreground">HINT_MAX_DELTA_MM</dt>
            <dd className="font-mono tabular-nums text-foreground">{PY.HINT_MAX_DELTA_MM}</dd>
            <dt className="text-muted-foreground">HINT_BLEND</dt>
            <dd className="font-mono tabular-nums text-foreground">{PY.HINT_BLEND}</dd>
          </dl>
          <p className="text-[10px] text-muted-foreground mt-2 font-mono leading-snug">
            MediaPipe iris ring indices · L_IRIS_IDX: [{PY.L_IRIS_IDX.join(', ')}] · R_IRIS_IDX: [
            {PY.R_IRIS_IDX.join(', ')}]
          </p>
      </div>
    </div>
  );
}
