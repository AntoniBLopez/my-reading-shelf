export type CurlCorner = 'top' | 'bottom';

export interface CurlFold {
  corner: CurlCorner;
  /** 0 at the closed edge, 1 when the finger has crossed the page. */
  progress: number;
  /** Midpoint of the fold, in page pixels. A rigid hinge would stay on the spine. */
  foldX: number;
  foldY: number;
  /** Radians of the crease. Zero would be a horizontal cut; a stiff spin has no crease. */
  crease: number;
  /** 0–1 shadow along the crease. Strongest halfway through the peel. */
  shade: number;
}

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

/** Top or bottom corner, matching the page-flip portrait peel. */
export function curlCorner(y: number, height: number): CurlCorner {
  return y < height / 2 ? 'top' : 'bottom';
}

/**
 * Fold of one portrait sheet.
 * Next peels from the right edge, previous from the left. The crease is the
 * perpendicular bisector between the grabbed corner and the finger, so the
 * page bends instead of spinning on a fixed vertical hinge.
 */
export function curlFold(
  width: number,
  height: number,
  fingerX: number,
  fingerY: number,
  direction: 'next' | 'prev',
): CurlFold {
  const pageW = Math.max(1, width);
  const pageH = Math.max(1, height);
  const x = direction === 'prev' ? pageW - fingerX : fingerX;
  const corner = curlCorner(fingerY, pageH);
  const cornerX = pageW;
  const cornerY = corner === 'top' ? 0 : pageH;
  const clampedX = Math.min(pageW, Math.max(0, x));
  const clampedY = Math.min(pageH, Math.max(0, fingerY));
  const foldX = (cornerX + clampedX) / 2;
  const foldY = (cornerY + clampedY) / 2;
  const crease = Math.atan2(cornerY - clampedY, cornerX - clampedX);
  const progress = clamp01(1 - clampedX / pageW);
  return {
    corner,
    progress,
    foldX: direction === 'prev' ? pageW - foldX : foldX,
    foldY,
    crease,
    shade: Math.sin(progress * Math.PI),
  };
}
