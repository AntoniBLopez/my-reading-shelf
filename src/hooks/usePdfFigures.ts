import { useCallback, useEffect, useRef, type RefObject } from 'react';
import type { BitmapSource } from '@/lib/rsvp/figures/paintBitmap';
import { createPdfFigureResolver, type FigureDocument } from '@/lib/rsvp/figures/pdfFigures';
import type { FigureCue, FigureImage } from '@/lib/rsvp/figures/types';
import type { ReadablePdf } from '@/lib/rsvp/pageText';

/**
 * One resolver per open file. Cropped object URLs are revoked when the file changes.
 */
export function usePdfFigures(
  pdfUrl: string | null,
  pdfRef: RefObject<ReadablePdf | null>,
  rootRef?: RefObject<HTMLElement | null>,
) {
  const resolverRef = useRef<ReturnType<typeof createPdfFigureResolver> | null>(null);

  useEffect(() => {
    const paintedPage = (pageNumber: number): BitmapSource | null => {
      const canvas = rootRef?.current?.querySelector(`canvas[data-page="${pageNumber}"]`);
      return canvas instanceof HTMLCanvasElement ? (canvas as unknown as BitmapSource) : null;
    };
    const resolver = pdfUrl
      ? createPdfFigureResolver(() => pdfRef.current as unknown as FigureDocument | null, pdfUrl, paintedPage)
      : null;
    resolverRef.current = resolver;
    return () => {
      resolver?.dispose();
      if (resolverRef.current === resolver) resolverRef.current = null;
    };
  }, [pdfUrl, pdfRef, rootRef]);

  const resolveFigure = useCallback((cue: FigureCue, pageNumber: number): Promise<FigureImage | null> => {
    return resolverRef.current?.resolve(cue, pageNumber) ?? Promise.resolve(null);
  }, []);

  const listOrphans = useCallback((pageNumber: number, mentioned: ReadonlySet<string>) => {
    return resolverRef.current?.listOrphans(pageNumber, mentioned) ?? Promise.resolve([]);
  }, []);

  const prefetch = useCallback((pageNumber: number) => {
    resolverRef.current?.prefetch(pageNumber);
  }, []);

  return { resolveFigure, listOrphans, prefetch };
}
