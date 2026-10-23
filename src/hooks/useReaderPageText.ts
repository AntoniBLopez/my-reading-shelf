import { useCallback, useRef, type RefObject } from 'react';
import { readReaderPageText, type ReadablePdf } from '@/lib/rsvp/pageText';

/**
 * Text already parsed for a painted page, plus a fresh read when RSVP opens
 * before that parse lands. The map is dropped when the file changes so a
 * previous book cannot answer for the next one.
 */
export function useReaderPageText(
  pdfUrl: string | null,
  pdfRef: RefObject<ReadablePdf | null>,
  rootRef: RefObject<ParentNode | null>,
) {
  const cacheRef = useRef(new Map<number, string>());
  const urlRef = useRef<string | null>(null);

  if (urlRef.current !== pdfUrl) {
    urlRef.current = pdfUrl;
    pdfRef.current = null;
    cacheRef.current = new Map();
  }

  const rememberPageText = useCallback((page: number, text: string) => {
    if (page >= 1 && text) cacheRef.current.set(page, text);
  }, []);

  const loadPageText = useCallback((page: number) => {
    const cached = cacheRef.current.get(page);
    if (cached) return Promise.resolve(cached);
    return readReaderPageText(pdfRef.current, page, rootRef.current);
  }, [pdfRef, rootRef]);

  return { rememberPageText, loadPageText };
}
