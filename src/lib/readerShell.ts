export const ULTRAWIDE_MIN_PX = 2200;
export const TEXT_COLUMN_CH = 70;

/** Windowed reader on a desktop, fullscreen on a phone and in F-mode. */
export function readerShellClass(fullscreen: boolean): string {
  if (fullscreen) {
    return 'fixed inset-0 left-0 top-0 z-[100] h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 rounded-none border-0';
  }
  return 'h-[92vh] w-[min(1400px,94vw)] max-w-[min(1400px,94vw)] min-[2200px]:w-[min(1840px,94vw)] min-[2200px]:max-w-[min(1840px,94vw)] max-md:fixed max-md:inset-0 max-md:left-0 max-md:top-0 max-md:h-[100dvh] max-md:w-screen max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-none';
}

/** Page layout width. An ultrawide window keeps the text near 70ch at the desktop zoom. */
export function layoutPageWidth(
  measured: number,
  viewportWidth: number,
  chPx: number,
  desktopScale: number,
  fullscreen: boolean,
): number {
  if (fullscreen || viewportWidth < ULTRAWIDE_MIN_PX || !(chPx > 0) || !(desktopScale > 0)) return measured;
  return Math.min(measured, (TEXT_COLUMN_CH * chPx) / desktopScale);
}

export function chPixelWidth(font: string): number {
  if (typeof document === 'undefined') return 8;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return 8;
  context.font = font || '16px sans-serif';
  const width = context.measureText('0').width;
  return width > 0 ? width : 8;
}

export function pagesRemainingLabel(remaining: number): string {
  if (remaining === 1) return 'Te queda 1 página';
  return `Te quedan ${remaining} páginas`;
}
