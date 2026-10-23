import { FigureImageCache, figureCacheKey } from '@/lib/rsvp/figures/cache';
import { captionBox, groupLines, orphanCaptions, type CaptionLine } from '@/lib/rsvp/figures/matchCaption';
import { imageBoxesFromOps } from '@/lib/rsvp/figures/operatorImages';
import { chooseCrop } from '@/lib/rsvp/figures/crop';
import { textBoxesFromItems } from '@/lib/rsvp/figures/textBoxes';
import type { Box, FigureCue, FigureImage } from '@/lib/rsvp/figures/types';

interface FigureViewport {
  width: number;
  height: number;
  convertToViewportRectangle: (rect: number[]) => number[];
}

export interface FigurePage {
  view?: ArrayLike<number>;
  getViewport: (params: { scale: number }) => FigureViewport;
  render: (params: { canvas: HTMLCanvasElement; viewport: FigureViewport }) => { promise: Promise<unknown> };
  getTextContent: () => Promise<{ items: readonly unknown[] }>;
  getOperatorList?: () => Promise<{ fnArray: ArrayLike<number>; argsArray: ArrayLike<unknown> }>;
}

export interface FigureDocument {
  numPages: number;
  getPage: (pageNumber: number) => Promise<FigurePage>;
}

interface PageFacts {
  lines: CaptionLine[];
  images: Box[];
  pageBox: Box;
}

const NEARBY = [0, 1, -1, 2, -2];

function pageBoxOf(page: FigurePage): Box {
  const view = page.view;
  const x0 = Number(view?.[0] ?? 0);
  const y0 = Number(view?.[1] ?? 0);
  const x1 = Number(view?.[2] ?? 612);
  const y1 = Number(view?.[3] ?? 792);
  return {
    x: Math.min(x0, x1),
    y: Math.min(y0, y1),
    width: Math.max(1, Math.abs(x1 - x0)),
    height: Math.max(1, Math.abs(y1 - y0)),
  };
}

async function paintCrop(page: FigurePage, box: Box): Promise<string | null> {
  const pageWidth = pageBoxOf(page).width;
  const viewport = page.getViewport({ scale: Math.min(1.5, 900 / pageWidth) });
  const full = document.createElement('canvas');
  full.width = Math.max(1, Math.ceil(viewport.width));
  full.height = Math.max(1, Math.ceil(viewport.height));
  await page.render({ canvas: full, viewport }).promise;
  const rect = viewport.convertToViewportRectangle([box.x, box.y, box.x + box.width, box.y + box.height]);
  const left = Math.max(0, Math.min(rect[0], rect[2]));
  const top = Math.max(0, Math.min(rect[1], rect[3]));
  const width = Math.max(1, Math.min(full.width - left, Math.abs(rect[2] - rect[0])));
  const height = Math.max(1, Math.min(full.height - top, Math.abs(rect[3] - rect[1])));
  const crop = document.createElement('canvas');
  crop.width = Math.ceil(width);
  crop.height = Math.ceil(height);
  const context = crop.getContext('2d');
  if (!context) return null;
  context.drawImage(full, left, top, width, height, 0, 0, crop.width, crop.height);
  const blob = await new Promise<Blob | null>((resolve) => crop.toBlob((value) => resolve(value), 'image/png'));
  return blob ? URL.createObjectURL(blob) : null;
}

/**
 * Locate a figure around the page being read and cache the cropped image.
 * pdf.js already runs text and operator lists on its worker; this only stitches
 * boxes and paints once per figure, off the RSVP timer.
 */
export function createPdfFigureResolver(getDoc: () => FigureDocument | null, docKey: string) {
  const images = new FigureImageCache();
  const facts = new Map<number, PageFacts>();
  const loading = new Map<number, Promise<PageFacts | null>>();
  let disposed = false;

  async function loadFacts(pageNumber: number): Promise<PageFacts | null> {
    const cached = facts.get(pageNumber);
    if (cached) return cached;
    const pending = loading.get(pageNumber);
    if (pending) return pending;
    const job = readFacts(pageNumber).then(
      (value) => {
        loading.delete(pageNumber);
        if (value && !disposed) facts.set(pageNumber, value);
        return value;
      },
      () => {
        loading.delete(pageNumber);
        return null;
      },
    );
    loading.set(pageNumber, job);
    return job;
  }

  async function readFacts(pageNumber: number): Promise<PageFacts | null> {
    const doc = getDoc();
    if (!doc || pageNumber < 1 || pageNumber > doc.numPages) return null;
    const page = await doc.getPage(pageNumber);
    const text = await page.getTextContent();
    const lines = groupLines(textBoxesFromItems(text.items));
    let imageBoxes: Box[] = [];
    if (page.getOperatorList) {
      const ops = await page.getOperatorList();
      imageBoxes = imageBoxesFromOps(ops.fnArray, ops.argsArray);
    }
    return { lines, images: imageBoxes, pageBox: pageBoxOf(page) };
  }

  async function locate(cue: FigureCue, around: number): Promise<{ pageNumber: number; box: Box } | null> {
    const doc = getDoc();
    if (!doc) return null;
    for (const delta of NEARBY) {
      const pageNumber = around + delta;
      if (pageNumber < 1 || pageNumber > doc.numPages) continue;
      const pageFacts = await loadFacts(pageNumber);
      if (!pageFacts) continue;
      const caption = captionBox(pageFacts.lines, cue);
      if (!caption) continue;
      return { pageNumber, box: chooseCrop(pageFacts.pageBox, caption, pageFacts.images).box };
    }
    const fallback = await loadFacts(around);
    if (!fallback) return null;
    return { pageNumber: around, box: fallback.pageBox };
  }

  return {
    prefetch(pageNumber: number) {
      if (disposed) return;
      void loadFacts(pageNumber);
      void loadFacts(pageNumber + 1);
    },
    resolve(cue: FigureCue, around: number): Promise<FigureImage | null> {
      if (disposed) return Promise.resolve(null);
      const key = figureCacheKey(docKey, cue.key);
      const cached = images.get(key);
      if (cached) return Promise.resolve({ url: cached, label: cue.label });
      return images.memoize(key, async () => {
        const found = await locate(cue, around);
        const doc = getDoc();
        if (!found || !doc) throw new Error('figure-missing');
        const page = await doc.getPage(found.pageNumber);
        const url = await paintCrop(page, found.box);
        if (!url) throw new Error('figure-paint');
        return url;
      }).then(
        (url) => ({ url, label: cue.label }),
        () => null,
      );
    },
    async listOrphans(pageNumber: number, mentioned: ReadonlySet<string>): Promise<FigureCue[]> {
      if (disposed) return [];
      const pageFacts = await loadFacts(pageNumber);
      if (!pageFacts) return [];
      return orphanCaptions(pageFacts.lines, mentioned);
    },
    dispose() {
      disposed = true;
      images.revokeAll();
      facts.clear();
    },
  };
}
