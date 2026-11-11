import { useEffect, useRef } from 'react';
import type { TurnDirection } from '@/lib/pageTurnGesture';
import {
  marginTurnAction,
  marginTurnBlocked,
  readerPageBox,
  type ReaderBox,
} from '@/lib/readerMarginTurn';

const DOUBLE_TAP_DELAY_MS = 450;
const TAP_MOVEMENT_THRESHOLD_PX = 12;
/** A touch double-tap also synthesizes a click. Ignore that click so the page moves once. */
const TOUCH_CLICK_GUARD_MS = 700;

/** Keys, header arrows, and this gesture all call the stage turn. */
export type PageTurn = (direction: TurnDirection) => void;

type UseReaderMarginTurnArgs = {
  /** The reader pane. Passed as the element so the listener follows the dialog mount. */
  viewport: HTMLElement | null;
  active: boolean;
  /** False on a phone or tablet, where the touch double-tap owns the gesture. */
  desktop: boolean;
  canTurn: () => boolean;
  textSelected: () => boolean;
  turn: PageTurn;
  onCenter: () => void;
};

function boxOf(node: HTMLElement): ReaderBox {
  const box = node.getBoundingClientRect();
  return { left: box.left, top: box.top, width: box.width, height: box.height };
}

/**
 * Page turns from a double-click (mouse) or a double-tap (touch) on the reader pane.
 * The listener sits on the reader viewport, so the gutter above and beside the book
 * is included. A mouse drag is ignored here; touch drags stay in the page swipe.
 */
export function useReaderMarginTurn({
  viewport,
  active,
  desktop,
  canTurn,
  textSelected,
  turn,
  onCenter,
}: UseReaderMarginTurnArgs): void {
  const desktopRef = useRef(desktop);
  const canTurnRef = useRef(canTurn);
  const textSelectedRef = useRef(textSelected);
  const turnRef = useRef(turn);
  const onCenterRef = useRef(onCenter);
  desktopRef.current = desktop;
  canTurnRef.current = canTurn;
  textSelectedRef.current = textSelected;
  turnRef.current = turn;
  onCenterRef.current = onCenter;

  useEffect(() => {
    if (!active || !viewport) return undefined;
    const node = viewport;

    let lastTap: { time: number; x: number; y: number } | null = null;
    let tapTimer = 0;
    let touchTurnAt = 0;

    const apply = (clientX: number, clientY: number, target: EventTarget | null) => {
      const action = marginTurnAction(
        clientX,
        clientY,
        boxOf(node),
        readerPageBox(target),
        marginTurnBlocked(target, textSelectedRef.current()),
      );
      if (!action || !canTurnRef.current()) return;
      if (action === 'center') onCenterRef.current();
      else turnRef.current(action);
    };

    const onDoubleClick = (event: MouseEvent) => {
      if (!desktopRef.current || event.button !== 0) return;
      if (Date.now() - touchTurnAt < TOUCH_CLICK_GUARD_MS) return;
      apply(event.clientX, event.clientY, event.target);
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== 'touch' || textSelectedRef.current()) return;
      const now = Date.now();
      const { clientX: x, clientY: y } = event;
      if (
        lastTap &&
        now - lastTap.time < DOUBLE_TAP_DELAY_MS &&
        Math.abs(x - lastTap.x) < TAP_MOVEMENT_THRESHOLD_PX &&
        Math.abs(y - lastTap.y) < TAP_MOVEMENT_THRESHOLD_PX
      ) {
        lastTap = null;
        window.clearTimeout(tapTimer);
        apply(x, y, event.target);
        touchTurnAt = now;
        event.preventDefault();
        return;
      }
      lastTap = { time: now, x, y };
      window.clearTimeout(tapTimer);
      tapTimer = window.setTimeout(() => {
        lastTap = null;
      }, DOUBLE_TAP_DELAY_MS);
    };

    node.addEventListener('dblclick', onDoubleClick);
    node.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.clearTimeout(tapTimer);
      node.removeEventListener('dblclick', onDoubleClick);
      node.removeEventListener('pointerdown', onPointerDown);
    };
  }, [active, viewport]);
}
