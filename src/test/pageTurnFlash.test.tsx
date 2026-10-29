import { createRef, useState, type Ref } from 'react';
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PDFPageStage, type PDFPageStageHandle } from '@/components/PDFPageStage';

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

function Reader({
  stageRef,
  initialPage = 2,
  onCommit,
}: {
  stageRef?: Ref<PDFPageStageHandle>;
  initialPage?: number;
  onCommit?: (page: number) => void;
}) {
  const [page, setPage] = useState(initialPage);
  return (
    <PDFPageStage
      ref={stageRef}
      pdfUrl="blob:test"
      pageNumber={page}
      numPages={12}
      pageWidth={300}
      scale={1}
      showBookBorder={false}
      getCanTurn={() => true}
      onCommit={(next) => {
        onCommit?.(next);
        setPage(next);
      }}
      onDocumentLoadSuccess={() => {}}
      onDocumentLoadError={() => {}}
      onItemClick={() => {}}
    />
  );
}

function textOf(selector: string): string {
  return document.querySelector(selector)?.textContent ?? '';
}

/** Pages a reader can see: the leaf, plus the under slot the open turn reveals. */
function visiblePages(): number[] {
  const pages = [Number(textOf('.pdf-turn-leaf'))];
  const turn = document.querySelector('.pdf-turn-scene')?.getAttribute('data-turn');
  if (turn === 'next' || turn === 'prev') {
    pages.push(Number(textOf(`.pdf-turn-under--${turn}`)));
  }
  return pages.filter((page) => Number.isFinite(page));
}

describe('rapid turns then a slow step', () => {
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
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('GIVEN overlapping turns WHEN a slow drag drops THEN only the origin and destination are visible', () => {
    const stageRef = createRef<PDFPageStageHandle>();
    render(<Reader stageRef={stageRef} />);
    const scene = document.querySelector('.pdf-turn-scene');
    if (!scene) throw new Error('missing scene');

    act(() => {
      for (let step = 0; step < 4; step += 1) stageRef.current?.turn('next');
    });
    expect(textOf('.pdf-turn-leaf')).toBe('6');

    const origin = 6;
    const destination = 7;
    const seen = new Set<number>();
    const watch = () => {
      for (const page of visiblePages()) seen.add(page);
    };

    pointer('pointerdown', scene, 260, 80);
    pointer('pointermove', window, 40, 84);
    flushFrames();
    watch();

    expect(textOf('.pdf-turn-leaf')).toBe(String(origin));
    expect(textOf('.pdf-turn-under--next')).toBe(String(destination));

    pointer('pointerup', window, 40, 84);
    flushFrames();
    watch();
    act(() => {
      vi.advanceTimersByTime(1600);
    });
    watch();

    expect(textOf('.pdf-turn-leaf')).toBe(String(destination));
    expect([...seen].every((page) => page === origin || page === destination)).toBe(true);
    expect(textOf('.pdf-turn-under--next')).not.toBe(String(origin));
  });

  it('GIVEN overlapping turns WHEN a slow arrow follows THEN the previous page does not flash', () => {
    const stageRef = createRef<PDFPageStageHandle>();
    let revealedAtCommit = 'missing';
    let armed = false;
    render(
      <Reader
        stageRef={stageRef}
        onCommit={() => {
          if (!armed) return;
          revealedAtCommit = textOf('.pdf-turn-under--next');
        }}
      />,
    );

    act(() => {
      for (let step = 0; step < 3; step += 1) stageRef.current?.turn('next');
    });
    expect(textOf('.pdf-turn-leaf')).toBe('5');

    armed = true;
    act(() => {
      stageRef.current?.turn('next');
    });

    expect(revealedAtCommit).toBe('6');
    expect(textOf('.pdf-turn-leaf')).toBe('6');
    expect(textOf('.pdf-turn-under--next')).not.toBe('5');
  });
});
