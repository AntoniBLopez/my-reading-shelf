import { useState } from 'react';
import { act, render } from '@testing-library/react';
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
      const ref = React.useRef<HTMLCanvasElement>(null);
      React.useEffect(() => {
        const canvas = ref.current;
        if (canvas) {
          canvas.width = 12;
          canvas.height = 16;
          canvas.dataset.page = String(pageNumber);
        }
        onRenderSuccess?.({ pageNumber });
      }, [pageNumber, onRenderSuccess]);
      return <canvas ref={ref}>{pageNumber}</canvas>;
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

function pointer(type: 'pointerdown' | 'pointermove' | 'pointerup', node: EventTarget, clientX: number, clientY: number) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY, button: 0 });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  Object.defineProperty(event, 'pointerType', { value: 'mouse' });
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
      numPages={6}
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

function textOf(selector: string): string {
  return document.querySelector(selector)?.textContent ?? '';
}

describe('revealed page identity', () => {
  let frames: FrameRequestCallback[] = [];

  function flushFrames() {
    const batch = frames.splice(0, frames.length);
    act(() => {
      for (const frame of batch) frame(performance.now());
    });
  }

  beforeEach(() => {
    frames = [];
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(rect);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high',
      translate() {},
      scale() {},
      drawImage() {},
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(() => {});
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,sheet');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('GIVEN a forward drag WHEN the page is released THEN the hole stays on the page that was revealed', () => {
    render(<Reader />);
    const scene = document.querySelector('.pdf-turn-scene');
    if (!scene) throw new Error('missing scene');

    pointer('pointerdown', scene, 240, 80);
    pointer('pointermove', window, 40, 84);
    flushFrames();

    expect(textOf('.pdf-turn-leaf')).toBe('2');
    expect(textOf('.pdf-turn-under--next')).toBe('3');

    pointer('pointerup', window, 40, 84);

    expect(textOf('.pdf-turn-leaf')).toBe('3');
    expect(textOf('.pdf-turn-under--next')).toBe('3');
    expect(textOf('.pdf-turn-prefetch--next')).toBe('4');
  });

  it('GIVEN a backward drag WHEN the page is released THEN the hole stays on the previous page', () => {
    render(<Reader initialPage={4} />);
    const scene = document.querySelector('.pdf-turn-scene');
    if (!scene) throw new Error('missing scene');

    pointer('pointerdown', scene, 40, 80);
    pointer('pointermove', window, 240, 84);
    flushFrames();

    expect(textOf('.pdf-turn-leaf')).toBe('4');
    expect(textOf('.pdf-turn-under--prev')).toBe('3');

    pointer('pointerup', window, 240, 84);

    expect(textOf('.pdf-turn-leaf')).toBe('3');
    expect(textOf('.pdf-turn-under--prev')).toBe('3');
    expect(textOf('.pdf-turn-prefetch--prev')).toBe('2');
  });

  it('GIVEN a short drag WHEN it is released THEN the original page stays', () => {
    render(<Reader />);
    const scene = document.querySelector('.pdf-turn-scene');
    if (!scene) throw new Error('missing scene');

    pointer('pointerdown', scene, 200, 100);
    pointer('pointermove', window, 170, 104);
    flushFrames();
    pointer('pointerup', window, 170, 104);

    expect(textOf('.pdf-turn-leaf')).toBe('2');
    expect(textOf('.pdf-turn-under--next')).toBe('3');
    expect(document.querySelector('.pdf-turn-prefetch--next')).toBeNull();
  });
});
