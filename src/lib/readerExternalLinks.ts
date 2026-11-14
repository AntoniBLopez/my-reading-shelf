/**
 * External URLs in book text (PDF annotation links, EPUB anchors, any other
 * rendered link) open in a new tab. In-document jumps stay inside the book.
 *
 * pdf.js stores the browsing context on the link service as LinkTarget, not as
 * a string. BLANK is the value that makes the annotation layer emit target=_blank.
 */

/** Same numeric values as pdf.js `LinkTarget`. */
export const LinkTarget = {
  NONE: 0,
  SELF: 1,
  BLANK: 2,
  PARENT: 3,
  TOP: 4,
} as const;

export const READER_EXTERNAL_LINK_REL = 'noopener noreferrer';
export const READER_EXTERNAL_LINK_FEATURES = 'noopener,noreferrer';
/** react-pdf stores the target name; pdf.js stores LinkTarget.BLANK. */
export const READER_EXTERNAL_LINK_TARGET_ATTR = '_blank' as const;

const PAGE_TURN_EVENTS = ['pointerdown', 'dblclick'] as const;
const ACTIVATE_EVENTS = ['click', 'auxclick'] as const;

export type ReaderLinkService = {
  externalLinkTarget: number | null;
  externalLinkRel: string | null;
  setExternalLinkTarget?: (target?: '_self' | '_blank' | '_parent' | '_top') => void;
  setExternalLinkRel?: (rel?: string) => void;
};

/** Point the pdf.js annotation link service at a new tab. */
export function applyReaderExternalLinkPolicy(linkService: ReaderLinkService): void {
  linkService.externalLinkTarget = LinkTarget.BLANK;
  linkService.externalLinkRel = READER_EXTERNAL_LINK_REL;
  linkService.setExternalLinkTarget?.(READER_EXTERNAL_LINK_TARGET_ATTR);
  linkService.setExternalLinkRel?.(READER_EXTERNAL_LINK_REL);
}

function eventNode(target: EventTarget | null): Node | null {
  if (!target || typeof target !== 'object') return null;
  const node = target as Node;
  // An EPUB iframe has its own window, so instanceof Element is false here.
  if (typeof node.nodeType !== 'number') return null;
  return node;
}

export function bookAnchor(target: EventTarget | null): HTMLAnchorElement | null {
  const node = eventNode(target);
  if (!node) return null;
  const element = node.nodeType === 1 ? (node as Element) : node.parentElement;
  const anchor = element?.closest?.('a') ?? null;
  if (!anchor || anchor.tagName !== 'A') return null;
  return anchor as HTMLAnchorElement;
}

function framedDocument(anchor: HTMLAnchorElement): boolean {
  const view = anchor.ownerDocument.defaultView;
  const top = view?.top ?? null;
  return view != null && top != null && view !== top;
}

/**
 * Absolute URL that must leave the reader, or null when the link is an
 * in-document jump (table of contents, page destination, EPUB chapter).
 */
export function externalBookUrl(anchor: HTMLAnchorElement): string | null {
  if (anchor.closest('[data-internal-link]')) return null;
  const raw = anchor.getAttribute('href');
  if (raw == null) return null;
  const href = raw.trim();
  if (href === '' || href === '#' || href.startsWith('#') || /^javascript:/i.test(href)) return null;

  const target = (anchor.getAttribute('target') || '').toLowerCase();
  const view = anchor.ownerDocument.defaultView;
  const base = anchor.ownerDocument.baseURI || view?.location.href || 'http://localhost/';
  let url: URL;
  try {
    url = new URL(href, base);
  } catch {
    return null;
  }

  const app = view?.top?.location ?? view?.location ?? null;
  const sameDocument =
    app != null &&
    url.origin === app.origin &&
    url.pathname === app.pathname &&
    url.search === app.search;
  if (sameDocument) return null;

  const explicitExternal = /^(https?:|mailto:|tel:)/i.test(href) || href.startsWith('//');
  if (explicitExternal) return url.href;

  const escapesFrame = framedDocument(anchor) && (target === '_top' || target === '_parent');
  if (escapesFrame) return url.href;

  if (!framedDocument(anchor) && app && (url.pathname !== app.pathname || url.search !== app.search)) {
    return url.href;
  }

  return null;
}

export function openExternalBookLink(url: string): Window | null {
  const opened = window.open(url, READER_EXTERNAL_LINK_TARGET_ATTR, READER_EXTERNAL_LINK_FEATURES);
  if (opened) opened.opener = null;
  return opened;
}

function stampExternalAnchor(anchor: HTMLAnchorElement, url: string): void {
  anchor.href = url;
  anchor.target = READER_EXTERNAL_LINK_TARGET_ATTR;
  anchor.rel = READER_EXTERNAL_LINK_REL;
}

/** A press on a book link must not bubble into a page-turn gesture. */
export function onBookLinkPointer(event: Event): void {
  const anchor = bookAnchor(event.target);
  if (!anchor || anchor.getAttribute('href') == null) return;
  event.stopPropagation();
}

/** External URLs open in a new tab. In-document links keep their own handler. */
export function onBookLinkActivate(event: Event): void {
  if (event.type !== 'click' && event.type !== 'auxclick') return;
  const anchor = bookAnchor(event.target);
  if (!anchor || anchor.getAttribute('href') == null) return;
  event.stopPropagation();
  const url = externalBookUrl(anchor);
  if (!url) return;
  event.preventDefault();
  stampExternalAnchor(anchor, url);
  openExternalBookLink(url);
}

function listen(target: EventTarget, add: boolean, pointer: EventListener, activate: EventListener): void {
  for (const type of PAGE_TURN_EVENTS) {
    if (add) target.addEventListener(type, pointer);
    else target.removeEventListener(type, pointer);
  }
  for (const type of ACTIVATE_EVENTS) {
    if (add) target.addEventListener(type, activate);
    else target.removeEventListener(type, activate);
  }
}

function stampTree(root: ParentNode): void {
  root.querySelectorAll('a[href]').forEach((node) => {
    if (node.tagName !== 'A') return;
    const anchor = node as HTMLAnchorElement;
    const url = externalBookUrl(anchor);
    if (url) stampExternalAnchor(anchor, url);
  });
}

/**
 * Delegated safety net for every anchor inside book content, including a
 * same-origin EPUB iframe. Cross-origin frames are not readable.
 */
export function bindBookContentLinkGuard(root: HTMLElement): () => void {
  const pointer: EventListener = (event) => onBookLinkPointer(event);
  const activate: EventListener = (event) => onBookLinkActivate(event);
  const documents = new Set<Document>();
  const loads = new Map<HTMLIFrameElement, () => void>();

  const attachDocument = (doc: Document) => {
    if (documents.has(doc)) return;
    documents.add(doc);
    listen(doc, true, pointer, activate);
    stampTree(doc);
  };

  const bindFrame = (frame: HTMLIFrameElement) => {
    const hook = () => {
      try {
        if (frame.contentDocument) attachDocument(frame.contentDocument);
      } catch {
        // A cross-origin frame cannot be patched from the reader.
      }
    };
    if (!loads.has(frame)) {
      loads.set(frame, hook);
      frame.addEventListener('load', hook);
    }
    hook();
  };

  const scan = () => {
    stampTree(root);
    root.querySelectorAll('iframe').forEach((node) => {
      if (node instanceof HTMLIFrameElement) bindFrame(node);
    });
  };

  listen(root, true, pointer, activate);
  scan();
  const observer = new MutationObserver(scan);
  observer.observe(root, { childList: true, subtree: true });

  return () => {
    observer.disconnect();
    listen(root, false, pointer, activate);
    for (const doc of documents) listen(doc, false, pointer, activate);
    for (const [frame, hook] of loads) frame.removeEventListener('load', hook);
  };
}
