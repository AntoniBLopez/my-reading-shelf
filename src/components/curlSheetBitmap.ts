/** Long edge of the turning-sheet bitmap. A full retina PNG encode was stalling the turn for seconds. */
export const SNAPSHOT_MAX_EDGE = 1400;

export type CurlBitmapRole = 'sheet' | 'revealed';

/** The revealed page stays the live canvas. Only the folding sheet is a bitmap. */
export function shouldSnapshotForCurl(role: CurlBitmapRole): boolean {
  return role === 'sheet';
}

/** 1×1 stand-in so page-flip still has two pages. It is never drawn. */
export const BLANK_REVEALED_PAGE =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

function invertPixels(context: CanvasRenderingContext2D, width: number, height: number) {
  const image = context.getImageData(0, 0, width, height);
  const data = image.data;
  for (let index = 0; index < data.length; index += 4) {
    data[index] = 255 - data[index];
    data[index + 1] = 255 - data[index + 1];
    data[index + 2] = 255 - data[index + 2];
  }
  context.putImageData(image, 0, 0);
}

/** JPEG or blob URL for a canvas that already holds the sheet. Never reads another canvas. */
export async function encodeCanvas(canvas: HTMLCanvasElement): Promise<string> {
  const blob = await new Promise<Blob | null>((resolve) => {
    if (typeof canvas.toBlob !== 'function') {
      resolve(null);
      return;
    }
    // toBlob sometimes never calls back. The page turn must not wait on it.
    const timer = window.setTimeout(() => resolve(null), 240);
    canvas.toBlob((value) => {
      window.clearTimeout(timer);
      resolve(value);
    }, 'image/jpeg', 0.86);
  });
  if (blob) return URL.createObjectURL(blob);
  try {
    if (typeof canvas.toDataURL === 'function') {
      const data = canvas.toDataURL('image/jpeg', 0.86);
      if (typeof data === 'string') return data;
    }
  } catch {
    // A lost canvas context rejects the encode. The turn still has to move.
  }
  return BLANK_REVEALED_PAGE;
}

/** One bitmap per gesture. Object URLs avoid a synchronous base64 encode on the drag. */
export async function snapshotCanvas(source: HTMLCanvasElement, invert: boolean, mirror: boolean): Promise<string> {
  const width = Math.max(1, source.width);
  const height = Math.max(1, source.height);
  const scale = Math.min(1, SNAPSHOT_MAX_EDGE / Math.max(width, height));
  const copy = document.createElement('canvas');
  copy.width = Math.max(1, Math.round(width * scale));
  copy.height = Math.max(1, Math.round(height * scale));
  const context = copy.getContext('2d', { willReadFrequently: true });
  if (!context) {
    try {
      const data = source.toDataURL('image/jpeg', 0.86);
      return typeof data === 'string' ? data : BLANK_REVEALED_PAGE;
    } catch {
      return BLANK_REVEALED_PAGE;
    }
  }
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  if (mirror) {
    context.translate(copy.width, 0);
    context.scale(-1, 1);
  }
  context.drawImage(source, 0, 0, copy.width, copy.height);
  // Pixel invert, not ctx.filter: mobile browsers often ignore the filter and the sheet stays light.
  if (invert) invertPixels(context, copy.width, copy.height);
  return encodeCanvas(copy);
}
