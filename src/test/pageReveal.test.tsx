import { useState } from 'react';
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PDFPageStage } from '@/components/PDFPageStage';
import { clearCurlFrame, punchRevealedPage, type FoldingPage } from '@/components/curlOverlay';
import { shouldSnapshotForCurl } from '@/components/curlSheetBitmap';
import '@/index.css';

vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}));

const PAGE_WIDTH = 300;
const PAGE_HEIGHT = 400;

vi.mock('react-pdf', async () => {
  const React = await import('react');
  return {
    pdfjs: { GlobalWorkerOptions: { workerSrc: '' } },
    Document: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Page: ({
      pageNumber,
      width,
      devicePixelRatio,
      onRenderSuccess,
    }: {
      pageNumber: number;
      width?: number;
      devicePixelRatio?: number;
      onRenderSuccess?: (page: { pageNumber: number }) => void;
    }) => {
      const ref = React.useRef<HTMLCanvasElement>(null);
      React.useEffect(() => {
        const canvas = ref.current;
        const cssWidth = width ?? PAGE_WIDTH;
        const ratio = devicePixelRatio ?? 1;
        if (canvas) {
          canvas.width = Math.round(cssWidth * ratio);
          canvas.height = Math.round(PAGE_HEIGHT * ratio);
          canvas.style.width = `${cssWidth}px`;
          canvas.style.height = `${PAGE_HEIGHT}px`;
        }
        onRenderSuccess?.({ pageNumber });
      }, [pageNumber, width, devicePixelRatio, onRenderSuccess]);
      return <canvas ref={ref} />;
    },
  };
});

const rect = {
  width: PAGE_WIDTH,
  height: PAGE_HEIGHT,
  top: 0,
  left: 0,
  right: PAGE_WIDTH,
  bottom: PAGE_HEIGHT,
  x: 0,
  y: 0,
  toJSON() {
    return {};
  },
} as DOMRect;

function media(matches: boolean) {
  return (query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

function pointer(type: 'pointerdown' | 'pointermove' | 'pointerup', node: EventTarget, clientX: number, clientY: number) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY, button: 0 });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  Object.defineProperty(event, 'pointerType', { value: 'mouse' });
  act(() => {
    node.dispatchEvent(event);
  });
}

function Reader() {
  const [page, setPage] = useState(2);
  return (
    <PDFPageStage
      pdfUrl="blob:test"
      pageNumber={page}
      numPages={5}
      pageWidth={PAGE_WIDTH}
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

function canvasIn(selector: string): HTMLCanvasElement {
  const node = document.querySelector(`${selector} canvas`);
  if (!(node instanceof HTMLCanvasElement)) throw new Error(`missing canvas ${selector}`);
  return node;
}

function backingRatio(canvas: HTMLCanvasElement): number {
  const cssWidth = Number.parseFloat(canvas.style.width);
  return canvas.width / cssWidth;
}

describe('sharp page reveal', () => {
  let frames: FrameRequestCallback[] = [];
  const snapped: string[] = [];

  function flushFrames() {
    const batch = frames.splice(0, frames.length);
    act(() => {
      for (const frame of batch) frame(performance.now());
    });
  }

  beforeEach(() => {
    frames = [];
    snapped.length = 0;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      if (frames[id - 1]) frames[id - 1] = () => {};
    });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(rect);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(function (this: HTMLCanvasElement) {
      snapped.push(this.dataset.page ?? '');
      return 'data:image/jpeg;base64,sheet';
    });
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 3 });
    window.matchMedia = media(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function holdNextDrag() {
    const scene = document.querySelector('.pdf-turn-scene');
    if (!scene) throw new Error('missing scene');
    pointer('pointerdown', scene, 240, 80);
    pointer('pointermove', window, 40, 84);
    flushFrames();
    return scene;
  }

  it('should render the revealed page at the screen ratio while the drag is held', () => {
    render(<Reader />);
    const scene = holdNextDrag();
    const leaf = canvasIn('.pdf-turn-leaf');
    const revealed = canvasIn('.pdf-turn-under--next');
    expect(scene.getAttribute('data-turn')).toBe('next');
    expect(leaf.dataset.page).toBe('2');
    expect(revealed.dataset.page).toBe('3');
    expect(backingRatio(leaf)).toBe(window.devicePixelRatio);
    expect(backingRatio(revealed)).toBe(window.devicePixelRatio);
    expect(revealed.width).toBe(PAGE_WIDTH * window.devicePixelRatio);
    expect(revealed.height).toBe(PAGE_HEIGHT * window.devicePixelRatio);
    expect(snapped).toEqual(['2']);
    expect(snapped).not.toContain('3');
    expect(revealed.style.filter).not.toMatch(/blur/i);
    expect(getComputedStyle(revealed).filter).not.toMatch(/blur/i);
    expect(getComputedStyle(scene.querySelector('.pdf-turn-under--next') as Element).visibility).toBe('visible');

    pointer('pointerup', window, 40, 84);
    const settled = canvasIn('.pdf-turn-leaf');
    expect(settled.dataset.page).toBe('3');
    expect(backingRatio(settled)).toBe(window.devicePixelRatio);
    expect(settled.width).toBe(revealed.width);
    expect(settled.height).toBe(revealed.height);
  });

  it('should keep a touch drag on the same resolution the settled page already uses', () => {
    window.matchMedia = media(true);
    render(<Reader />);
    holdNextDrag();
    const leaf = canvasIn('.pdf-turn-leaf');
    const revealed = canvasIn('.pdf-turn-under--next');
    expect(backingRatio(leaf)).toBe(2);
    expect(backingRatio(revealed)).toBe(2);
    expect(revealed.width).toBe(PAGE_WIDTH * 2);
    expect(snapped).toEqual(['2']);

    pointer('pointerup', window, 40, 84);
    expect(backingRatio(canvasIn('.pdf-turn-leaf'))).toBe(2);
  });

  it('should snapshot only the folding sheet', () => {
    expect(shouldSnapshotForCurl('sheet')).toBe(true);
    expect(shouldSnapshotForCurl('revealed')).toBe(false);
  });

  it('should erase the reveal polygon instead of painting a bitmap', () => {
    const calls: string[] = [];
    const context = {
      save: () => calls.push('save'),
      restore: () => calls.push('restore'),
      translate: () => calls.push('translate'),
      beginPath: () => calls.push('begin'),
      lineTo: () => calls.push('line'),
      closePath: () => calls.push('close'),
      rotate: () => calls.push('rotate'),
      fill: () => calls.push('fill'),
      fillStyle: '',
      globalCompositeOperation: 'source-over',
    } as unknown as CanvasRenderingContext2D;
    const page: FoldingPage = {
      state: { area: [{ x: 1, y: 2 }], position: { x: 0, y: 0 }, angle: 0.2 },
      render: {
        getContext: () => context,
        convertToGlobal: (point) => point,
      },
      draw: () => {},
    };
    punchRevealedPage(page);
    expect(calls).toContain('fill');
    expect(calls.indexOf('fill')).toBeGreaterThan(calls.indexOf('rotate'));
    let compositeAtFill = 'source-over';
    const recording = {
      ...context,
      globalCompositeOperation: 'source-over',
      fill: () => {
        compositeAtFill = recording.globalCompositeOperation;
      },
    } as unknown as CanvasRenderingContext2D;
    punchRevealedPage({ ...page, render: { ...page.render, getContext: () => recording } });
    expect(compositeAtFill).toBe('destination-out');
  });

  it('should clear the curl frame without an opaque cover', () => {
    const calls: string[] = [];
    const context = {
      save: () => calls.push('save'),
      restore: () => calls.push('restore'),
      setTransform: () => calls.push('transform'),
      clearRect: () => calls.push('clear'),
      fillRect: () => calls.push('fill'),
    } as unknown as CanvasRenderingContext2D;
    clearCurlFrame(context, { width: 90, height: 120 } as HTMLCanvasElement, 3);
    expect(calls).toContain('clear');
    expect(calls).not.toContain('fill');
  });
});
