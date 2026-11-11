import { isTurnBlockedTarget } from '@/lib/pageTurnGesture';

/** Outer bands of the page itself. The middle of the page toggles the fullscreen bar. */
export const PAGE_TURN_BAND = 0.4;

export type ReaderBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type MarginTurnAction = 'prev' | 'next' | 'center';

const PAGE_SELECTOR = '[data-reader-page]';

/**
 * The page element under the pointer, in viewport coordinates.
 * A decorative frame around the page is not a page: the gutter uses the reader.
 */
export function readerPageBox(target: EventTarget | null): ReaderBox | null {
  if (!(target instanceof Element)) return null;
  const page = target.closest(PAGE_SELECTOR);
  if (!(page instanceof HTMLElement)) return null;
  const box = page.getBoundingClientRect();
  if (box.width <= 0 || box.height <= 0) return null;
  return { left: box.left, top: box.top, width: box.width, height: box.height };
}

function inside(clientX: number, clientY: number, box: ReaderBox): boolean {
  const x = clientX - box.left;
  const y = clientY - box.top;
  return x >= 0 && y >= 0 && x <= box.width && y <= box.height;
}

/**
 * Desktop double-click / touch double-tap.
 * Empty space uses the whole reader pane: left of center goes back, right of center
 * goes forward, from top to bottom. The book frame is not a boundary.
 * A hit on the page keeps the page's own side bands and center control.
 */
export function marginTurnAction(
  clientX: number,
  clientY: number,
  viewport: ReaderBox,
  page: ReaderBox | null,
  blocked: boolean,
): MarginTurnAction | null {
  if (blocked || !inside(clientX, clientY, viewport)) return null;
  if (page && page.width > 0) {
    const rel = (clientX - page.left) / page.width;
    if (rel < PAGE_TURN_BAND) return 'prev';
    if (rel > 1 - PAGE_TURN_BAND) return 'next';
    return 'center';
  }
  const rel = (clientX - viewport.left) / viewport.width;
  return rel < 0.5 ? 'prev' : 'next';
}

export function marginTurnBlocked(target: EventTarget | null, textSelected: boolean): boolean {
  return textSelected || isTurnBlockedTarget(target);
}
