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

export function marginTurnBlocked(target: EventTarget | null, textSelected: boolean, margin = false): boolean {
  if (isTurnBlockedTarget(target)) return true;
  // A gutter double-click must turn even if the browser just selected a nearby word.
  if (margin) return false;
  return textSelected;
}

/** Empty reader space: not the page, and not a control. */
export function isReaderMarginTarget(target: EventTarget | null, viewport: HTMLElement | null): boolean {
  if (!viewport || !(target instanceof Node) || !viewport.contains(target)) return false;
  if (isTurnBlockedTarget(target)) return false;
  return readerPageBox(target) == null;
}

/** The second press of a double-click. That press is what selects a word. */
export function marginPressSelectsWord(detail: number, button: number): boolean {
  return button === 0 && detail >= 2;
}

export function readSelectionText(): string {
  const selection = typeof window === 'undefined' ? null : window.getSelection();
  if (!selection || selection.isCollapsed) return '';
  return selection.toString();
}

/** The browser selected something new while the pointer was in the gutter. */
export function selectionCameFromMarginClick(before: string, after: string): boolean {
  return after !== '' && after !== before;
}

export function clearTextSelection(): void {
  window.getSelection()?.removeAllRanges();
}
