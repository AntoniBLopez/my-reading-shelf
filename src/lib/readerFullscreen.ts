type OutsideInteraction = {
  target: EventTarget | null;
  preventDefault: () => void;
  detail?: { originalEvent?: Event };
};

function nativeFullscreenElement(): Element | null {
  const doc = document as Document & { webkitFullscreenElement?: Element | null };
  return document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

/**
 * The fullscreen pane must own focus before requestFullscreen.
 * The header close control sits outside that pane and unmounts on entry.
 * If it still holds focus, the browser drops focus to the document body and the
 * next click is delivered to the dialog backdrop, which closes the book and
 * tears down the fullscreen element.
 */
export function focusReaderFullscreenRoot(root: HTMLElement | null): void {
  if (!root) return;
  const active = document.activeElement;
  if (active instanceof Node && root.contains(active)) return;
  root.focus({ preventScroll: true });
}

function interactionTarget(event: OutsideInteraction): EventTarget | null {
  return event.detail?.originalEvent?.target ?? event.target;
}

/** A click inside the reader pane, including the browser fullscreen element, stays in the book. */
export function clickStaysInReaderFullscreen(root: HTMLElement | null, target: EventTarget | null): boolean {
  if (!(target instanceof Node)) return false;
  if (root?.contains(target)) return true;
  const native = nativeFullscreenElement();
  return !!native && (native === target || native.contains(target));
}

/**
 * Radix outside events carry the real click on detail.originalEvent.
 * While the reader pane is the browser fullscreen element, a click must not
 * dismiss the dialog — the backdrop sits outside the top layer and would
 * otherwise close the book.
 */
export function guardReaderFullscreenClick(root: HTMLElement | null, event: OutsideInteraction): void {
  if (clickStaysInReaderFullscreen(root, interactionTarget(event))) {
    event.preventDefault();
    return;
  }
  const native = nativeFullscreenElement();
  if (root && native && (native === root || root.contains(native))) event.preventDefault();
}
