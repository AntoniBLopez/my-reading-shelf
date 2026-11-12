import { createRef, useState, type Ref } from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PDFPageStage, type PDFPageStageHandle } from '@/components/PDFPageStage';
import { createPageCurl } from '@/components/pdfPageCurl';
import { BLANK_REVEALED_PAGE } from '@/components/curlSheetBitmap';
import { bindCurlRuntime } from '@/lib/curlRuntime';
import { bindPageTurnRecovery } from '@/lib/pageTurnRecovery';
import { openCurlSheet, rememberPageSheet, resetPageSheets } from '@/lib/pageSheetMemory';
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

function setVisibility(value: 'hidden' | 'visible') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => value });
}

function queueFrames() {
  const queue: FrameRequestCallback[] = [];
  const request = (callback: FrameRequestCallback) => {
    queue.push(callback);
    return queue.length;
  };
  vi.stubGlobal('requestAnimationFrame', request);
  window.requestAnimationFrame = request;
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    queue[id - 1] = () => {};
  });
  return {
    queue,
    pump(times: number, now: number) {
      for (let step = 0; step < times; step += 1) {
        const batch = queue.splice(0, queue.length);
        for (const frame of batch) frame(now);
      }
    },
  };
}

describe('page turn after a long idle', () => {
  afterEach(() => {
    resetPageSheets();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
    setVisibility('visible');
  });

  it('GIVEN painted pixels WHEN the tab is hidden for a long time THEN the next sheet does not read that canvas', async () => {
    const source = document.createElement('canvas');
    source.width = 900;
    source.height = 1200;
    source.dataset.page = '4';
    let reads = 0;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high',
      drawImage(image: CanvasImageSource) {
        if (image === source) reads += 1;
      },
      getImageData(_x: number, _y: number, width: number, height: number) {
        return new ImageData(width, height);
      },
      putImageData() {},
      translate() {},
      scale() {},
    }) as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(function (this: HTMLCanvasElement) {
      if (this === source) reads += 10;
      return 'data:image/jpeg;base64,sheet';
    });

    rememberPageSheet(source);
    expect(reads).toBe(1);
    setVisibility('hidden');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    const started = performance.now();
    const sheet = await openCurlSheet(source, false, false);
    expect(performance.now() - started).toBeLessThan(50);
    expect(reads).toBe(1);
    expect(sheet.owned).toBe(false);
    expect(sheet.url).not.toBe('');

    setVisibility('visible');
    const again = await openCurlSheet(source, false, false);
    expect(reads).toBe(1);
    expect(again.url).toBe(sheet.url);
  });

  it('GIVEN no stored pixels WHEN the tab is hidden THEN the turn does not encode the cold canvas', async () => {
    const source = document.createElement('canvas');
    source.width = 2000;
    source.height = 3000;
    source.dataset.page = '11';
    const encoded: string[] = [];
    vi.spyOn(source, 'toDataURL').mockImplementation(() => {
      encoded.push('source');
      return 'data:image/jpeg;base64,cold';
    });
    setVisibility('hidden');
    const started = performance.now();
    const sheet = await openCurlSheet(source, false, true);
    expect(performance.now() - started).toBeLessThan(50);
    expect(encoded).toEqual([]);
    expect(sheet.url).toBe(BLANK_REVEALED_PAGE);

    setVisibility('visible');
    const after = await openCurlSheet(source, false, true);
    expect(encoded).toEqual([]);
    expect(after.url).toBe(BLANK_REVEALED_PAGE);
  });

  it('GIVEN repeated hide and show WHEN sheets are remembered THEN only one visibility listener is installed', () => {
    const added: string[] = [];
    const original = document.addEventListener.bind(document);
    vi.spyOn(document, 'addEventListener').mockImplementation((type, listener, options) => {
      added.push(String(type));
      original(type, listener as EventListener, options);
    });
    const source = document.createElement('canvas');
    source.width = 20;
    source.height = 30;
    source.dataset.page = '1';
    const before = added.length;
    rememberPageSheet(source);
    const installed = added.length - before;
    expect(installed).toBeLessThanOrEqual(2);
    for (let step = 0; step < 20; step += 1) {
      setVisibility(step % 2 === 0 ? 'hidden' : 'visible');
      document.dispatchEvent(new Event('visibilitychange'));
      rememberPageSheet(source);
    }
    expect(added.length - before).toBe(installed);
  });

  it('GIVEN a curl runtime WHEN it is released THEN frames and resize listeners do not keep running', () => {
    const frames = queueFrames();
    let draws = 0;
    let resizes = 0;
    const onResize = () => {
      resizes += 1;
    };
    const release = bindCurlRuntime(() => {
      window.addEventListener('resize', onResize);
      window.addEventListener('resize', onResize);
      const loop = () => {
        draws += 1;
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    });
    frames.pump(3, 1000);
    expect(draws).toBeGreaterThan(0);
    const running = draws;
    release();
    window.dispatchEvent(new Event('resize'));
    frames.pump(10, 1000 + 10 * 60 * 1000);
    expect(draws).toBe(running);
    expect(resizes).toBe(0);
  });

  it('GIVEN many curls WHEN each one is destroyed THEN frame callbacks stay bounded', async () => {
    const frames = queueFrames();
    let draws = 0;
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
      callback?.(new Blob(['sheet'], { type: 'image/jpeg' }));
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({
      save() {},
      restore() {},
      translate() {},
      rotate() {},
      scale() {},
      beginPath() {},
      rect() {},
      clip() {},
      fillRect() {},
      clearRect() {
        draws += 1;
      },
      moveTo() {},
      lineTo() {},
      closePath() {},
      fill() {},
      stroke() {},
      arc() {},
      drawImage() {},
      setTransform() {},
      putImageData() {},
      getImageData(_x: number, _y: number, width: number, height: number) {
        return new ImageData(width, height);
      },
      createLinearGradient() {
        return { addColorStop() {} };
      },
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high',
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
    }) as unknown as CanvasRenderingContext2D);
    const scene = document.createElement('div');
    document.body.append(scene);
    const page = (number: number) => {
      const canvas = document.createElement('canvas');
      canvas.width = 120;
      canvas.height = 160;
      canvas.dataset.page = String(number);
      scene.append(canvas);
      rememberPageSheet(canvas);
      return canvas;
    };
    for (let step = 0; step < 6; step += 1) {
      const session = await createPageCurl({
        scene,
        width: 120,
        height: 160,
        direction: 'next',
        current: page(step + 1),
        other: page(step + 2),
        invert: false,
        onResult: () => {},
      });
      frames.pump(2, 2000 + step);
      session.destroy();
    }
    expect(draws).toBeGreaterThan(0);
    const drawn = draws;
    const queued = frames.queue.length;
    frames.pump(8, 2000 + 10 * 60 * 1000);
    expect(draws).toBe(drawn);
    expect(frames.queue.length).toBeLessThanOrEqual(queued);
    expect(document.querySelectorAll('.pdf-page-curl').length).toBe(0);
    scene.remove();
  });

  it('GIVEN recovery is bound WHEN the tab hides and shows THEN listeners and timers are not duplicated', () => {
    const intervals: number[] = [];
    const originalInterval = window.setInterval.bind(window);
    vi.spyOn(window, 'setInterval').mockImplementation(((handler, timeout, ...args) => {
      intervals.push(Number(timeout) || 0);
      return originalInterval(handler, timeout as number, ...args);
    }) as typeof window.setInterval);
    const added: string[] = [];
    const original = document.addEventListener.bind(document);
    vi.spyOn(document, 'addEventListener').mockImplementation((type, listener, options) => {
      added.push(String(type));
      original(type, listener as EventListener, options);
    });
    const unbind = bindPageTurnRecovery(() => {}, () => {});
    const listeners = added.length;
    for (let step = 0; step < 25; step += 1) {
      setVisibility(step % 2 === 0 ? 'hidden' : 'visible');
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('blur'));
      window.dispatchEvent(new Event('pageshow'));
      document.dispatchEvent(new Event('freeze'));
      document.dispatchEvent(new Event('resume'));
    }
    expect(added.length).toBe(listeners);
    expect(intervals).toEqual([]);
    unbind();
  });

  it('GIVEN an open reader WHEN the tab hides and shows many times THEN the next turn still advances once', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(rect);
    const intervals: number[] = [];
    const originalInterval = window.setInterval.bind(window);
    vi.spyOn(window, 'setInterval').mockImplementation(((handler, timeout, ...args) => {
      intervals.push(Number(timeout) || 0);
      return originalInterval(handler, timeout as number, ...args);
    }) as typeof window.setInterval);
    const stageRef = createRef<PDFPageStageHandle>();
    function Reader({ stageRef: ref }: { stageRef?: Ref<PDFPageStageHandle> }) {
      const [page, setPage] = useState(2);
      return (
        <PDFPageStage
          ref={ref}
          pdfUrl="blob:test"
          pageNumber={page}
          numPages={8}
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
    render(<Reader stageRef={stageRef} />);
    const mountedIntervals = intervals.length;
    for (let step = 0; step < 12; step += 1) {
      setVisibility(step % 2 === 0 ? 'hidden' : 'visible');
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
    }
    expect(intervals.length).toBe(mountedIntervals);
    setVisibility('visible');
    const scene = document.querySelector('.pdf-turn-scene');
    act(() => {
      stageRef.current?.turn('next');
    });
    await waitFor(() => expect(scene?.getAttribute('data-committed')).toBe('3'));
    act(() => {
      stageRef.current?.turn('next');
    });
    await waitFor(() => expect(scene?.getAttribute('data-committed')).toBe('4'));
  });
});
