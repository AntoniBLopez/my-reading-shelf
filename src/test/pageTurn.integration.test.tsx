import { useState } from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PDFPageStage } from '@/components/PDFPageStage';

vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}));

vi.mock('react-pdf', async () => {
  const React = await import('react');
  return {
    pdfjs: { GlobalWorkerOptions: { workerSrc: '' } },
    Document: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Page: ({
      pageNumber,
      onRenderSuccess,
    }: {
      pageNumber: number;
      onRenderSuccess?: (page: { pageNumber: number }) => void;
    }) => {
      React.useEffect(() => {
        onRenderSuccess?.({ pageNumber });
      }, [pageNumber, onRenderSuccess]);
      return <span>{pageNumber}</span>;
    },
  };
});

const rect = {
  width: 300,
  height: 400,
  top: 0,
  left: 0,
  right: 300,
  bottom: 400,
  x: 0,
  y: 0,
  toJSON() {
    return {};
  },
} as DOMRect;

function pointer(
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  node: EventTarget,
  values: { clientX: number; clientY: number },
) {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: values.clientX,
    clientY: values.clientY,
    button: 0,
  });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  Object.defineProperty(event, 'pointerType', { value: 'touch' });
  act(() => {
    node.dispatchEvent(event);
  });
}

function Reader({ initialPage = 2 }: { initialPage?: number }) {
  const [page, setPage] = useState(initialPage);
  return (
    <PDFPageStage
      pdfUrl="blob:test"
      pageNumber={page}
      numPages={5}
      pageWidth={300}
      scale={1}
      showBookBorder={false}
      getCanTurn={() => true}
      onCommit={setPage}
      onDocumentLoadSuccess={() => {}}
      onDocumentLoadError={() => {}}
      onItemClick={() => {}}
    />
  );
}

function leaf() {
  const node = document.querySelector('.pdf-turn-leaf');
  if (!(node instanceof HTMLElement)) throw new Error('missing leaf');
  return node;
}

describe('GIVEN the reader', () => {
  let frames: FrameRequestCallback[] = [];

  function flushFrames() {
    const batch = frames.splice(0, frames.length);
    act(() => {
      for (const frame of batch) frame(performance.now());
    });
  }

  beforeEach(() => {
    frames = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(rect);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('WHEN the user swipes left THEN the flip animation runs and the next page is shown', async () => {
    render(<Reader />);
    const scene = document.querySelector('.pdf-turn-scene');
    if (!scene) throw new Error('missing scene');

    pointer('pointerdown', scene, { clientX: 220, clientY: 80 });
    pointer('pointermove', window, { clientX: 40, clientY: 90 });
    flushFrames();

    expect(leaf().classList.contains('pdf-turn-leaf--follow')).toBe(true);
    expect(leaf().style.transform).toContain('rotateY(');
    expect(scene.getAttribute('data-turn')).toBe('next');
    expect(leaf().textContent).toBe('2');

    pointer('pointerup', window, { clientX: 40, clientY: 90 });
    await waitFor(() => expect(leaf().textContent).toBe('3'));
    await waitFor(() => expect(leaf().style.transform).toBe(''));
  });

  it('WHEN the user cancels the swipe THEN the same page stays', async () => {
    render(<Reader />);
    const scene = document.querySelector('.pdf-turn-scene');
    if (!scene) throw new Error('missing scene');

    pointer('pointerdown', scene, { clientX: 200, clientY: 100 });
    pointer('pointermove', window, { clientX: 160, clientY: 104 });
    flushFrames();
    expect(leaf().style.transform).toContain('rotateY(');
    expect(scene.getAttribute('data-turn')).toBe('next');

    pointer('pointerup', window, { clientX: 160, clientY: 104 });
    await waitFor(() => expect(leaf().style.transform).toBe(''));
    expect(leaf().textContent).toBe('2');
    expect(scene.hasAttribute('data-turn')).toBe(false);
  });
});
