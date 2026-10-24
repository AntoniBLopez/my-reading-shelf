import type { Box } from '@/lib/rsvp/figures/types';

export interface BitmapContext {
  drawImage(
    source: BitmapSource,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ): void;
}

export interface BitmapSource {
  width: number;
  height: number;
  getContext?: (kind: '2d') => BitmapContext | null;
  toBlob?: (callback: (blob: Blob | null) => void, type?: string) => void;
  toDataURL?: (type?: string) => string;
}

export interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function intersect(page: Box, crop: Box): Box {
  if (!(crop.width > 1) || !(crop.height > 1)) return page;
  const x = Math.max(page.x, crop.x);
  const y = Math.max(page.y, crop.y);
  const right = Math.min(page.x + page.width, crop.x + crop.width);
  const top = Math.min(page.y + page.height, crop.y + crop.height);
  if (right - x < 2 || top - y < 2) return page;
  return { x, y, width: right - x, height: top - y };
}

/** Map a PDF box (y grows upward) onto a painted page bitmap (y grows downward). */
export function viewportCrop(page: Box, crop: Box, pixelWidth: number, pixelHeight: number): PixelRect {
  const region = intersect(page, crop);
  const sx = pixelWidth / Math.max(1, page.width);
  const sy = pixelHeight / Math.max(1, page.height);
  const x = (region.x - page.x) * sx;
  const y = (page.y + page.height - (region.y + region.height)) * sy;
  const width = region.width * sx;
  const height = region.height * sy;
  const left = Math.max(0, Math.min(pixelWidth - 1, x));
  const top = Math.max(0, Math.min(pixelHeight - 1, y));
  const right = Math.max(left + 1, Math.min(pixelWidth, x + width));
  const bottom = Math.max(top + 1, Math.min(pixelHeight, y + height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export async function bitmapUrl(canvas: BitmapSource): Promise<string | null> {
  if (canvas.toBlob) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob?.((value) => resolve(value), 'image/png'));
    if (blob && blob.size > 0) return URL.createObjectURL(blob);
  }
  const data = canvas.toDataURL?.('image/png');
  if (data && data.length > 64) return data;
  return null;
}

/**
 * Copy a region of a page that is already painted. A degenerate crop falls
 * back to the whole bitmap so the reader still gets an image.
 */
export async function cropPaintedPage(
  source: BitmapSource,
  page: Box,
  crop: Box,
  create: () => BitmapSource,
): Promise<string | null> {
  if (source.width < 2 || source.height < 2) return null;
  const rect = viewportCrop(page, crop, source.width, source.height);
  const out = create();
  out.width = Math.max(1, Math.ceil(rect.width));
  out.height = Math.max(1, Math.ceil(rect.height));
  const context = out.getContext?.('2d');
  if (!context) return bitmapUrl(source);
  context.drawImage(source, rect.x, rect.y, rect.width, rect.height, 0, 0, out.width, out.height);
  return bitmapUrl(out);
}
