import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { notifyReaderSearch } from '@/lib/pwaAutoReload';

/** Publish the router query so a pending PWA reload can run once the book closes. */
export function usePwaAutoReload(): void {
  const { search } = useLocation();
  useLayoutEffect(() => {
    notifyReaderSearch(search);
  }, [search]);
}
