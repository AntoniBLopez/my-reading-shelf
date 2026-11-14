import { useEffect, type RefObject } from 'react';
import { bindBookContentLinkGuard } from '@/lib/readerExternalLinks';

/** Keep book-content links from navigating the tab the reader is open in. */
export function useReaderExternalLinks(rootRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    return bindBookContentLinkGuard(root);
  }, [rootRef]);
}
