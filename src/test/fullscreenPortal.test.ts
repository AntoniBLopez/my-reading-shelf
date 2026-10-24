import { afterEach, describe, expect, it } from 'vitest';
import { fullscreenPortalTarget, nativeFullscreenElement } from '@/lib/fullscreenPortal';

describe('fullscreen portal target', () => {
  afterEach(() => {
    delete (document as { fullscreenElement?: Element | null }).fullscreenElement;
  });

  it('should use the native fullscreen element as the RSVP portal', () => {
    const host = document.createElement('div');
    const doc = { fullscreenElement: host, body: document.body } as unknown as Document;
    expect(nativeFullscreenElement(doc)).toBe(host);
    expect(fullscreenPortalTarget(doc, document.createElement('section'))).toBe(host);
  });

  it('should use the webkit fullscreen element when the standard one is missing', () => {
    const host = document.createElement('div');
    const doc = { fullscreenElement: null, webkitFullscreenElement: host, body: document.body } as unknown as Document;
    expect(nativeFullscreenElement(doc)).toBe(host);
    expect(fullscreenPortalTarget(doc)).toBe(host);
  });

  it('should use the CSS fullscreen root when the browser has no fullscreen element', () => {
    const cssRoot = document.createElement('div');
    const doc = { fullscreenElement: null, body: document.body } as unknown as Document;
    expect(fullscreenPortalTarget(doc, cssRoot)).toBe(cssRoot);
  });

  it('should fall back to document.body when nothing is fullscreen', () => {
    const doc = { fullscreenElement: null, body: document.body } as unknown as Document;
    expect(fullscreenPortalTarget(doc, null)).toBe(document.body);
    expect(fullscreenPortalTarget(doc)).toBe(document.body);
  });
});
