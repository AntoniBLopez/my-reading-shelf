import { useEffect } from 'react';
import { isToggleKey, isTypingTarget } from '@/lib/keyboard';

/** Space and Enter call the same center-of-page handler that shows or hides the header. */
export function useReaderChromeKeys(enabled: boolean, onToggleHeader: () => void) {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target) || !isToggleKey(event)) return;
      event.preventDefault();
      event.stopPropagation();
      onToggleHeader();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [enabled, onToggleHeader]);
}
