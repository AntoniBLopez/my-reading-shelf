import { usePwaAutoReload } from '@/hooks/usePwaAutoReload';

/** Applies a finished deploy without reloading over an open book. */
export function PwaAutoReload() {
  usePwaAutoReload();
  return null;
}
