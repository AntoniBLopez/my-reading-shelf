import { BLANK_REVEALED_PAGE, SNAPSHOT_MAX_EDGE, encodeCanvas, snapshotCanvas } from '@/components/curlSheetBitmap';

const MAX_SHEETS = 8;

export type CurlSheet = { url: string; owned: boolean };

type SheetEntry = {
  pixels: ImageData;
  width: number;
  height: number;
  urls: Map<string, string>;
  pending: Map<string, Promise<string>>;
};

const sheets = new Map<string, SheetEntry>();
let dormant = false;
let watching = false;

function noteHidden() {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') dormant = true;
}

function ensureWatch(): void {
  if (watching || typeof document === 'undefined') return;
  watching = true;
  document.addEventListener('visibilitychange', noteHidden);
  document.addEventListener('freeze', () => {
    dormant = true;
  });
}

function sheetKey(source: HTMLCanvasElement): string | null {
  const page = source.dataset.page;
  if (!page || source.width < 2 || source.height < 2) return null;
  return `${page}:${source.width}x${source.height}`;
}

function copyPixels(source: HTMLCanvasElement): ImageData | null {
  const scale = Math.min(1, SNAPSHOT_MAX_EDGE / Math.max(source.width, source.height));
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const copy = document.createElement('canvas');
  copy.width = width;
  copy.height = height;
  const context = copy.getContext('2d', { willReadFrequently: true });
  if (!context || typeof context.getImageData !== 'function') return null;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(source, 0, 0, width, height);
  return context.getImageData(0, 0, width, height);
}

function inverted(pixels: ImageData): ImageData {
  const data = new Uint8ClampedArray(pixels.data);
  for (let index = 0; index < data.length; index += 4) {
    data[index] = 255 - data[index];
    data[index + 1] = 255 - data[index + 1];
    data[index + 2] = 255 - data[index + 2];
  }
  return new ImageData(data, pixels.width, pixels.height);
}

function paintVariant(entry: SheetEntry, invert: boolean, mirror: boolean): HTMLCanvasElement | null {
  const base = document.createElement('canvas');
  base.width = entry.width;
  base.height = entry.height;
  const context = base.getContext('2d');
  if (!context) return null;
  context.putImageData(invert ? inverted(entry.pixels) : entry.pixels, 0, 0);
  if (!mirror) return base;
  const flipped = document.createElement('canvas');
  flipped.width = entry.width;
  flipped.height = entry.height;
  const out = flipped.getContext('2d');
  if (!out) return base;
  out.translate(flipped.width, 0);
  out.scale(-1, 1);
  out.drawImage(base, 0, 0);
  return flipped;
}

function drop(key: string) {
  const entry = sheets.get(key);
  sheets.delete(key);
  if (!entry) return;
  for (const url of entry.urls.values()) {
    if (url.startsWith('blob:')) URL.revokeObjectURL(url);
  }
}

function trim(keep: string) {
  for (const key of sheets.keys()) {
    if (sheets.size <= MAX_SHEETS) return;
    if (key === keep) continue;
    drop(key);
  }
}

/**
 * Keep the sheet pixels from the moment pdf.js finishes painting.
 * A later turn must not drawImage the live canvas: after a long hide Chrome
 * drops that backing store and the read blocks the click for seconds.
 */
export function rememberPageSheet(source: HTMLCanvasElement): void {
  ensureWatch();
  try {
    const key = sheetKey(source);
    if (!key || sheets.has(key)) return;
    const pixels = copyPixels(source);
    if (!pixels) return;
    sheets.set(key, {
      pixels,
      width: pixels.width,
      height: pixels.height,
      urls: new Map(),
      pending: new Map(),
    });
    trim(key);
  } catch {
    // The live snapshot path still works while the tab is visible.
  }
}

export async function openCurlSheet(source: HTMLCanvasElement, invert: boolean, mirror: boolean): Promise<CurlSheet> {
  ensureWatch();
  noteHidden();
  const entry = sheets.get(sheetKey(source) ?? '');
  if (entry) {
    const variant = `${invert ? 1 : 0}:${mirror ? 1 : 0}`;
    const cached = entry.urls.get(variant);
    if (cached) return { url: cached, owned: false };
    const pending = entry.pending.get(variant);
    if (pending) return pending.then((url) => ({ url, owned: false }));
    const canvas = paintVariant(entry, invert, mirror);
    if (!canvas) return { url: BLANK_REVEALED_PAGE, owned: false };
    const job = encodeCanvas(canvas).then((url) => {
      entry.urls.set(variant, url);
      entry.pending.delete(variant);
      return url;
    });
    entry.pending.set(variant, job);
    return job.then((url) => ({ url, owned: false }));
  }
  if (dormant) return { url: BLANK_REVEALED_PAGE, owned: false };
  const url = await snapshotCanvas(source, invert, mirror);
  return { url, owned: typeof url === 'string' && url.startsWith('blob:') };
}

export function resetPageSheets(): void {
  for (const key of [...sheets.keys()]) drop(key);
  dormant = false;
}
