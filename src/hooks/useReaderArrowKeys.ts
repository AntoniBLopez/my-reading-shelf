import { useEffect, useRef } from 'react';
import type { PageTurn } from '@/hooks/useReaderMarginTurn';
import { isTypingTarget } from '@/lib/keyboard';
import { turnDirectionFromKey } from '@/lib/pageTurnGesture';

/** Arrow keys turn the page. Zoom keys stay with the reader zoom control. */
export function useReaderArrowKeys(active: boolean, blocked: () => boolean, turn: PageTurn): void {
  const blockedRef = useRef(blocked);
  const turnRef = useRef(turn);
  blockedRef.current = blocked;
  turnRef.current = turn;

  useEffect(() => {
    if (!active) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (blockedRef.current() || isTypingTarget(event.target)) return;
      const direction = turnDirectionFromKey(event.key);
      if (!direction) return;
      event.preventDefault();
      turnRef.current(direction);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active]);
}
