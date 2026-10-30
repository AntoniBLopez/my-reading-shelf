import { useRef, useState, type Ref } from 'react';
import { act, render, waitFor } from '@testing-library/react';
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
  top: 20,
  left: 40,
  right: 340,
  bottom: 420,
  x: 40,
  y: 20,
  toJSON() {
    return {};
  },
} as DOMRect;

function Reader({
  initialPage,
  onCommit,
  stageRef,
}: {
  initialPage: number;
  onCommit?: (page: number) => void;
  stageRef?: Ref<PDFPageStageHandle>;
}) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(initialPage);
  return (
    <div ref={surfaceRef} data-reader-surface="">
      <div data-reader-chrome="">
        <button type="button">Siguiente</button>
        <input aria-label="Página" />
      </div>
      <a href="#capitulo">Capítulo</a>
      <div role="menu">
        <div role="menuitem">Abrir</div>
      </div>
      <PDFPageStage
        ref={stageRef}
        pdfUrl="blob:test"
        pageNumber={page}
        numPages={5}
        pageWidth={300}
        scale={1}
        showBookBorder={false}
        getCanTurn={() => true}
        gestureSurfaceRef={surfaceRef}
        onCommit={(next) => {
          onCommit?.(next);
          setPage(next);
        }}
        onDocumentLoadSuccess={() => {}}
        onDocumentLoadError={() => {}}
        onItemClick={() => {}}
      />
    </div>
  );
}

function pointer(
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  node: EventTarget,
  values: { clientX: number; clientY: number; button?: number; pointerType?: string }
) {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: values.clientX,
    clientY: values.clientY,
    button: values.button ?? 0,
  });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  Object.defineProperty(event, 'pointerType', { value: values.pointerType ?? 'touch' });
  act(() => {
    node.dispatchEvent(event);
  });
}

describe('page turn from the reader margin', () => {
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
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      if (frames[id - 1]) frames[id - 1] = () => {};
    });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(rect);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function surface() {
    const node = document.querySelector('[data-reader-surface]');
    if (!(node instanceof HTMLElement)) throw new Error('missing reader surface');
    return node;
  }

  function leaf() {
    const node = document.querySelector('.pdf-turn-leaf');
    if (!(node instanceof HTMLElement)) throw new Error('missing leaf');
    return node;
  }

  it('GIVEN a press in the margin WHEN the finger crosses the book THEN that page turns', async () => {
    const onCommit = vi.fn();
    render(<Reader initialPage={2} onCommit={onCommit} />);
    const host = surface();
    const heard: string[] = [];
    const original = host.addEventListener.bind(host);
    vi.spyOn(host, 'addEventListener').mockImplementation((type, listener, options) => {
      heard.push(String(type));
      original(type, listener as EventListener, options);
    });

    pointer('pointerdown', host, { clientX: 380, clientY: 80 });
    pointer('pointermove', window, { clientX: 420, clientY: 82 });
    flushFrames();
    expect(host.querySelector('.pdf-turn-scene')?.hasAttribute('data-turn')).toBe(false);

    pointer('pointermove', window, { clientX: 80, clientY: 90 });
    flushFrames();
    expect(host.querySelector('.pdf-turn-scene')?.getAttribute('data-turn')).toBe('next');
    expect(leaf().classList.contains('pdf-turn-leaf--follow')).toBe(true);
    expect(heard).toContain('touchmove');
    pointer('pointerup', window, { clientX: 80, clientY: 90 });

    await waitFor(() => expect(onCommit).toHaveBeenCalledWith(3));
    await waitFor(() => expect(leaf().textContent).toBe('3'));
  });

  it('GIVEN a press past the left edge WHEN the drag is horizontal THEN the previous page stays', async () => {
    const onCommit = vi.fn();
    render(<Reader initialPage={3} onCommit={onCommit} />);
    pointer('pointerdown', surface(), { clientX: 8, clientY: 140, pointerType: 'mouse' });
    pointer('pointermove', window, { clientX: 220, clientY: 150, pointerType: 'mouse' });
    flushFrames();
    expect(surface().querySelector('.pdf-turn-scene')?.getAttribute('data-turn')).toBe('prev');
    pointer('pointerup', window, { clientX: 220, clientY: 150, pointerType: 'mouse' });
    await waitFor(() => expect(onCommit).toHaveBeenCalledWith(2));
    await waitFor(() => expect(leaf().textContent).toBe('2'));
  });

  it('GIVEN a press in the margin WHEN the drag stays outside or is vertical THEN the page stays', async () => {
    const onCommit = vi.fn();
    render(<Reader initialPage={2} onCommit={onCommit} />);
    const host = surface();
    pointer('pointerdown', host, { clientX: 380, clientY: 80 });
    pointer('pointermove', window, { clientX: 360, clientY: 84 });
    pointer('pointerup', window, { clientX: 360, clientY: 84 });
    pointer('pointerdown', host, { clientX: 380, clientY: 40 });
    pointer('pointermove', window, { clientX: 376, clientY: 220 });
    pointer('pointerup', window, { clientX: 376, clientY: 220 });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 250));
    });
    expect(onCommit).not.toHaveBeenCalled();
    expect(leaf().textContent).toBe('2');
    expect(host.querySelector('.pdf-turn-scene')?.hasAttribute('data-turn')).toBe(false);
  });

  it('GIVEN chrome in the reader WHEN the pointer starts on a control THEN the page stays', async () => {
    const onCommit = vi.fn();
    render(<Reader initialPage={2} onCommit={onCommit} />);
    const host = surface();
    const targets = [
      host.querySelector('button'),
      host.querySelector('a'),
      host.querySelector('input'),
      host.querySelector('[role="menuitem"]'),
      host.querySelector('[data-reader-chrome] span, [data-reader-chrome]'),
    ];
    for (const target of targets) {
      if (!target) throw new Error('missing control');
      pointer('pointerdown', target, { clientX: 300, clientY: 200 });
      pointer('pointermove', window, { clientX: 40, clientY: 200 });
      pointer('pointerup', window, { clientX: 40, clientY: 200 });
    }
    pointer('pointerdown', host, { clientX: 300, clientY: 200, pointerType: 'mouse', button: 2 });
    pointer('pointermove', window, { clientX: 40, clientY: 200, pointerType: 'mouse', button: 2 });
    pointer('pointerup', window, { clientX: 40, clientY: 200, pointerType: 'mouse', button: 2 });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 40));
    });
    expect(onCommit).not.toHaveBeenCalled();
    expect(leaf().textContent).toBe('2');
  });
});
