import { useEffect } from 'react';
import { isFullscreenKey, isTypingTarget } from '@/lib/keyboard';

/** F toggles the same fullscreen handler as the reader button, even while RSVP is open. */
export function useFullscreenKey(enabled: boolean, onToggle: () => void) {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target) || !isFullscreenKey(event)) return;
      event.preventDefault();
      event.stopPropagation();
      onToggle();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [enabled, onToggle]);
}
