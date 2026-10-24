import { describe, expect, it, vi } from 'vitest';
import { FigureImageCache, figureCacheKey } from '@/lib/rsvp/figures/cache';
import { chooseCrop } from '@/lib/rsvp/figures/crop';
import { captionBox, groupLines, matchCaption, orphanCaptions } from '@/lib/rsvp/figures/matchCaption';
import { imageBoxesFromOps } from '@/lib/rsvp/figures/operatorImages';
import { cropPaintedPage, viewportCrop } from '@/lib/rsvp/figures/paintBitmap';
import { createPdfFigureResolver } from '@/lib/rsvp/figures/pdfFigures';
import { attachFigureCues, findMentions, sentenceEndIndex } from '@/lib/rsvp/figures/references';
import { tokenize } from '@/lib/rsvp/tokenize';
import { textBoxesFromItems } from '@/lib/rsvp/figures/textBoxes';
import type { Box, FigureCue } from '@/lib/rsvp/figures/types';

const PAGE: Box = { x: 0, y: 0, width: 600, height: 800 };

function cue(key: string, kind: FigureCue['kind'], number: string): FigureCue {
  return { key, label: `${kind === 'table' ? 'Tabla' : 'Figura'} ${number}`, kind, number };
}

describe('figure references', () => {
  it('should detect Spanish and English figure and table references regardless of case', () => {
    const words = ['mira', 'FIGURA', '1.1', 'en', 'Figure', '2.3', 'y', 'Fig.', '4', 'más', 'Tabla', '1.2', 'o', 'table', '3'];
    expect(findMentions(words).map((mention) => mention.cue.key)).toEqual([
      'figure:1.1',
      'figure:2.3',
      'figure:4',
      'table:1.2',
      'table:3',
    ]);
    expect(findMentions(['cuadro', '2', 'gráfico', '8', 'Image', '9']) .map((mention) => mention.cue.label)).toEqual([
      'Tabla 2',
      'Figura 8',
      'Figura 9',
    ]);
  });

  it('should attach a figure cue only to the first mention, at the end of its sentence', () => {
    const tokens = attachFigureCues(tokenize('Figura 1.1 luego. Fig. 1.1 otra vez. Tabla 1.1 cierra.'));
    const first = tokens.filter((token) => token.figureAfter?.key === 'figure:1.1');
    expect(first).toHaveLength(1);
    expect(first[0].word).toBe('luego.');
    expect(tokens.find((token) => token.word === '1.1')?.figureAfter).toBeUndefined();
    expect(tokens.find((token) => token.figureAfter?.key === 'table:1.1')?.word).toBe('cierra.');
  });

  it('should keep reading a mid-sentence mention until the period', () => {
    const tokens = attachFigureCues(tokenize('Como se ve en la Figura 1.1 el sistema continúa.'));
    expect(tokens.find((token) => token.word === '1.1')?.figureAfter).toBeUndefined();
    expect(tokens.find((token) => token.figureAfter)?.word).toBe('continúa.');
    expect(sentenceEndIndex(tokens, 5)).toBe(tokens.findIndex((token) => token.word === 'continúa.'));
  });

  it('should end a caption without a period at the block break', () => {
    const tokens = attachFigureCues(tokenize('Figura 1.1 El esquema\nSigue el párrafo largo.'));
    expect(tokens.find((token) => token.word === 'esquema')?.endsBlock).toBe(true);
    expect(tokens.find((token) => token.figureAfter)?.word).toBe('esquema');
    expect(tokens.find((token) => token.word === 'largo.')?.figureAfter).toBeUndefined();
  });

  it('should join hyphenated, dashed, and split figure numbers', () => {
    expect(findMentions(['Figura', '1-1']).map((mention) => mention.cue.number)).toEqual(['1.1']);
    expect(findMentions(['Figura', '1–1']).map((mention) => mention.cue.number)).toEqual(['1.1']);
    expect(findMentions(['Figura', '1', '.1']).map((mention) => mention.cue.number)).toEqual(['1.1']);
    expect(findMentions(['Figura', '1.', '1']).map((mention) => mention.cue.key)).toEqual(['figure:1.1']);
    expect(findMentions(['Figura1.1']).map((mention) => mention.cue.label)).toEqual(['Figura 1.1']);
    expect(findMentions(['lámina', '4']).map((mention) => mention.cue.key)).toEqual(['figure:4']);
  });
});

describe('figure captions', () => {
  it('should match a caption line for Figura 1.1 and ignore a cited figure when listing orphans', () => {
    const lines = groupLines([
      { text: 'Figura', x: 40, y: 100, width: 48, height: 12 },
      { text: '1.1', x: 92, y: 101, width: 24, height: 12 },
      { text: 'Tabla', x: 40, y: 40, width: 36, height: 12 },
      { text: '2', x: 80, y: 40, width: 10, height: 12 },
    ]);
    const typed = textBoxesFromItems([
      { str: ['Figura', ' ', '1.1'], width: 70, height: 12, transform: Float32Array.from([12, 0, 0, 12, 40, 100]) },
    ]);
    expect(matchCaption(lines[0].text)).toEqual(cue('figure:1.1', 'figure', '1.1'));
    expect(captionBox(lines, cue('figure:1.1', 'figure', '1.1'))).toMatchObject({ x: 40, y: 100 });
    expect(matchCaption(groupLines(typed)[0].text)?.key).toBe('figure:1.1');
    expect(orphanCaptions(lines, new Set(['figure:1.1'])).map((item) => item.key)).toEqual(['table:2']);
  });
});

describe('figure crop', () => {
  it('should crop the image above the caption and fall back to the caption band', () => {
    const caption = { x: 40, y: 100, width: 80, height: 12 };
    const image = { x: 36, y: 130, width: 220, height: 160 };
    expect(chooseCrop(PAGE, caption, [image])).toEqual({ box: image, source: 'image' });

    const distant = { x: 36, y: 700, width: 220, height: 40 };
    const band = chooseCrop(PAGE, caption, [distant]);
    expect(band.source).toBe('caption');
    expect(band.box.y).toBeGreaterThanOrEqual(caption.y + caption.height);
    expect(band.box.height).toBeLessThanOrEqual(240);

    expect(chooseCrop(PAGE, null, [image])).toEqual({ box: PAGE, source: 'page' });
  });

  it('should read image boxes from an operator list', () => {
    const boxes = imageBoxesFromOps(
      [10, 12, 85, 11, 85],
      [null, [120, 0, 0, 80, 40, 500], ['Im1'], null, ['Im0']],
    );
    expect(boxes).toEqual([{ x: 40, y: 500, width: 120, height: 80 }]);
  });
});

describe('figure bitmap', () => {
  it('should map a PDF crop onto the painted bitmap and keep a non-empty image', async () => {
    const page = { x: 0, y: 0, width: 600, height: 800 };
    const crop = viewportCrop(page, { x: 40, y: 500, width: 200, height: 120 }, 300, 400);
    expect(crop.width).toBeGreaterThan(1);
    expect(crop.height).toBeGreaterThan(1);
    expect(crop.y).toBeGreaterThan(0);

    const blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/png' });
    const source = {
      width: 300,
      height: 400,
      toBlob: (callback: (value: Blob | null) => void) => callback(blob),
    };
    const url = await cropPaintedPage(source, page, { x: -10, y: -10, width: 0, height: 0 }, () => ({
      width: 0,
      height: 0,
    }));
    expect(url?.startsWith('blob:')).toBe(true);
  });

  it('should crop the page already on screen when a second pdf.js render fails', async () => {
    const render = vi.fn(() => ({ promise: Promise.reject(new Error('busy')) }));
    const painted = {
      width: 300,
      height: 400,
      toDataURL: () => `data:image/png;base64,${'a'.repeat(80)}`,
    };
    const doc = {
      numPages: 1,
      getPage: async () => ({
        view: [0, 0, 600, 800],
        getViewport: () => ({ width: 600, height: 800, convertToViewportRectangle: (rect: number[]) => rect }),
        render,
        getTextContent: async () => ({
          items: [{ str: 'Figura 1.1', width: 80, height: 12, transform: [12, 0, 0, 12, 40, 100] }],
        }),
        getOperatorList: async () => ({ fnArray: [], argsArray: [] }),
      }),
    };
    const resolver = createPdfFigureResolver(() => doc, 'book.pdf', () => painted);
    const image = await resolver.resolve(
      { key: 'figure:1.1', label: 'Figura 1.1', kind: 'figure', number: '1.1' },
      1,
    );
    expect(image?.url.startsWith('data:image/png')).toBe(true);
    expect(image?.url.length).toBeGreaterThan(64);
    expect(render).not.toHaveBeenCalled();
    resolver.dispose();
  });
});

describe('figure cache', () => {
  it('should reuse the cached object URL for the same document and figure', async () => {
    const cache = new FigureImageCache();
    const key = figureCacheKey('book.pdf', 'figure:1.1');
    expect(cache.remember(key, 'blob:a')).toBe('blob:a');
    expect(cache.remember(key, 'blob:b')).toBe('blob:a');
    expect(cache.get(key)).toBe('blob:a');

    const revoke = vi.fn();
    let calls = 0;
    const load = () => {
      calls += 1;
      return Promise.resolve('blob:c');
    };
    const pending = cache.memoize('other', load, revoke);
    await expect(Promise.all([pending, cache.memoize('other', load, revoke)])).resolves.toEqual(['blob:c', 'blob:c']);
    expect(calls).toBe(1);

    await cache.memoize('fresh', async () => {
      cache.remember('fresh', 'blob:kept');
      return 'blob:duplicate';
    }, revoke);
    expect(cache.get('fresh')).toBe('blob:kept');
    expect(revoke).toHaveBeenCalledWith('blob:duplicate');
  });
});
