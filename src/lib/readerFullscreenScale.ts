/** Zoom already used for a large desktop monitor in fullscreen. */
export const LARGE_DESKTOP_FULLSCREEN_SCALE = 0.3;

/** Zoom for a normal laptop, whose CSS viewport is much smaller than its panel. */
export const LAPTOP_FULLSCREEN_SCALE = 0.5;

export type FullscreenScreen = {
  viewportWidth: number;
  viewportHeight: number;
  screenWidth: number;
  screenHeight: number;
  devicePixelRatio: number;
};

function positive(value: number, fallback = 0): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * `screen.width` is CSS pixels in current browsers.
 * If a value tracks the physical panel (about `viewport * devicePixelRatio`), fold it back.
 */
export function cssScreenLength(screenLength: number, viewportLength: number, devicePixelRatio: number): number {
  const reported = positive(screenLength);
  const viewport = positive(viewportLength);
  const dpr = positive(devicePixelRatio, 1);
  if (reported === 0) return viewport;
  if (viewport === 0 || dpr <= 1.05) return reported;
  const asCss = reported / dpr;
  const physicalGap = Math.abs(reported - viewport * dpr);
  const cssGap = Math.abs(reported - viewport);
  if (physicalGap + 48 < cssGap) return asCss;
  return reported;
}

/** A 3440×1440 monitor at 100%, or any desktop whose CSS viewport is that large. */
export function isLargeDesktopScreen(screen: FullscreenScreen): boolean {
  const dpr = positive(screen.devicePixelRatio, 1);
  const viewportWidth = positive(screen.viewportWidth);
  const viewportHeight = positive(screen.viewportHeight);
  const width = Math.max(viewportWidth, cssScreenLength(screen.screenWidth, viewportWidth, dpr));
  const height = Math.max(viewportHeight, cssScreenLength(screen.screenHeight, viewportHeight, dpr));
  const aspect = width / Math.max(height, 1);
  if (width >= 2400 && height >= 1200) return true;
  return aspect >= 2.05 && width >= 2200;
}

/** Fullscreen page zoom for a desktop layout. Mobile keeps its own scale. */
export function desktopFullscreenScale(screen: FullscreenScreen): number {
  return isLargeDesktopScreen(screen) ? LARGE_DESKTOP_FULLSCREEN_SCALE : LAPTOP_FULLSCREEN_SCALE;
}

export function readFullscreenScreen(): FullscreenScreen {
  const display = window.screen;
  return {
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    screenWidth: display?.width ?? window.innerWidth,
    screenHeight: display?.height ?? window.innerHeight,
    devicePixelRatio: window.devicePixelRatio || 1,
  };
}
