type FullscreenDoc = Document & { webkitFullscreenElement?: Element | null };

/** The element the Fullscreen API is showing, including the WebKit name used by older Safari. */
export function nativeFullscreenElement(doc: Document): Element | null {
  return doc.fullscreenElement ?? (doc as FullscreenDoc).webkitFullscreenElement ?? null;
}

/**
 * Where an overlay must be mounted so it stays visible.
 * A native fullscreen element hides everything outside it. The CSS fallback root
 * covers that case on phones that skip the Fullscreen API. Otherwise the overlay
 * belongs on document.body.
 */
export function fullscreenPortalTarget(doc: Document, cssFallback?: Element | null): HTMLElement {
  const native = nativeFullscreenElement(doc);
  if (native instanceof HTMLElement) return native;
  if (cssFallback instanceof HTMLElement) return cssFallback;
  return doc.body;
}
