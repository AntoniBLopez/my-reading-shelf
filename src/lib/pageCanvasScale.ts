/** Current page on a touch screen. Phones often report 3 or 4. */
export const TOUCH_LEAF_DPR_CAP = 2;

/** Page revealed under the sliding sheet. It is only visible during the gesture. */
export const TOUCH_NEIGHBOR_DPR_CAP = 1;

/** Desktop neighbor. Sharp enough for the short glide, lighter than a 3x bitmap. */
export const FINE_NEIGHBOR_DPR_CAP = 2;

export type PagePixelRole = 'leaf' | 'neighbor';

export function pageDevicePixelRatio(devicePixelRatio: number, touchPrimary: boolean, role: PagePixelRole): number {
  const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  if (role === 'neighbor') return Math.min(dpr, touchPrimary ? TOUCH_NEIGHBOR_DPR_CAP : FINE_NEIGHBOR_DPR_CAP);
  if (touchPrimary) return Math.min(dpr, TOUCH_LEAF_DPR_CAP);
  return dpr;
}
