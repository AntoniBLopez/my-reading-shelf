import { useEffect, useRef } from 'react';
import { bindPageTurnRecovery } from '@/lib/pageTurnRecovery';

/** Clear a pinch or a stale selection when the tab is hidden or shown again. */
export function useReaderInteractionResume(active: boolean, onHide: () => void, onShow: () => void): void {
  const hideRef = useRef(onHide);
  const showRef = useRef(onShow);
  hideRef.current = onHide;
  showRef.current = onShow;

  useEffect(() => {
    if (!active) return undefined;
    return bindPageTurnRecovery(
      () => hideRef.current(),
      () => showRef.current(),
    );
  }, [active]);
}
