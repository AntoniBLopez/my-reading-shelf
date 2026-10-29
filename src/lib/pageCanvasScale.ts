/** Current page on a touch screen. Phones often report 3 or 4. */
export const TOUCH_LEAF_DPR_CAP = 2;

export type PagePixelRole = 'leaf' | 'neighbor';

/**
 * Every mounted page uses the settled page's ratio.
 * The page under the curl is on screen for the whole gesture, so a lower
 * neighbor ratio would look soft until the drop swapped it for the leaf.
 */
export function pageDevicePixelRatio(
  devicePixelRatio: number,
  touchPrimary: boolean,
  _role: PagePixelRole = 'leaf',
): number {
  const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  if (touchPrimary) return Math.min(dpr, TOUCH_LEAF_DPR_CAP);
  return dpr;
}
