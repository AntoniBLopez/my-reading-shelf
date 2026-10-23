import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { createPdfFigureResolver, type FigureDocument } from '@/lib/rsvp/figures/pdfFigures';
import type { FigureCue, FigureImage } from '@/lib/rsvp/figures/types';
import type { ReadablePdf } from '@/lib/rsvp/pageText';

/**
 * One resolver per open file. Cropped object URLs are revoked when the file changes.
 */
export function usePdfFigures(pdfUrl: string | null, pdfRef: RefObject<ReadablePdf | null>) {
  const resolverRef = useRef<ReturnType<typeof createPdfFigureResolver> | null>(null);

  useEffect(() => {
    const resolver = pdfUrl
      ? createPdfFigureResolver(() => pdfRef.current as unknown as FigureDocument | null, pdfUrl)
      : null;
    resolverRef.current = resolver;
    return () => {
      resolver?.dispose();
      if (resolverRef.current === resolver) resolverRef.current = null;
    };
  }, [pdfUrl, pdfRef]);

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
