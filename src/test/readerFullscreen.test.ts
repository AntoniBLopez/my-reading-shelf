import { describe, expect, it, afterEach } from 'vitest';
import {
  clickStaysInReaderFullscreen,
  focusReaderFullscreenRoot,
  guardReaderFullscreenClick,
} from '@/lib/readerFullscreen';

describe('reader fullscreen focus', () => {
  it('should move focus into the fullscreen root when the active control sits outside it', () => {
    const root = document.createElement('div');
    root.tabIndex = -1;
    const outside = document.createElement('button');
    outside.textContent = 'Cerrar';
    document.body.append(outside, root);
    outside.focus();

    focusReaderFullscreenRoot(root);

    expect(document.activeElement).toBe(root);
    outside.remove();
    root.remove();
  });

  it('should leave focus on a control that is already inside the fullscreen root', () => {
    const root = document.createElement('div');
    root.tabIndex = -1;
    const inside = document.createElement('button');
    inside.textContent = 'Página siguiente';
    root.append(inside);
    document.body.append(root);
    inside.focus();

    focusReaderFullscreenRoot(root);

    expect(document.activeElement).toBe(inside);
    root.remove();
  });

  it('should keep clicks inside the fullscreen pane and ignore the backdrop only while that pane is fullscreen', () => {
    const root = document.createElement('div');
    const page = document.createElement('button');
    root.append(page);
    const backdrop = document.createElement('div');
    expect(clickStaysInReaderFullscreen(root, page)).toBe(true);
    expect(clickStaysInReaderFullscreen(root, backdrop)).toBe(false);

    const idle = outside(backdrop);
    guardReaderFullscreenClick(root, idle);
    expect(idle.defaultPrevented).toBe(false);

    const inside = outside(page);
    guardReaderFullscreenClick(root, inside);
    expect(inside.defaultPrevented).toBe(true);

    Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => root });
    const covered = outside(backdrop);
    guardReaderFullscreenClick(root, covered);
    expect(covered.defaultPrevented).toBe(true);
  });
});

afterEach(() => {
  delete (document as { fullscreenElement?: Element }).fullscreenElement;
});

function outside(target: EventTarget) {
  return {
    target,
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
  };
}
