import { createRef, useState, type Ref } from 'react';
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

function Stage({
  page,
  onCommit,
  numPages = 5,
  enabled = true,
  stageRef,
}: {
  page: number;
  onCommit: (page: number) => void;
  numPages?: number;
  enabled?: boolean;
  stageRef?: Ref<PDFPageStageHandle>;
}) {
  return (
    <PDFPageStage
      ref={stageRef}
      pdfUrl="blob:test"
      pageNumber={page}
      numPages={numPages}
      pageWidth={300}
      scale={1}
      showBookBorder={false}
      getCanTurn={() => enabled}
      onCommit={onCommit}
      onDocumentLoadSuccess={() => {}}
      onDocumentLoadError={() => {}}
      onItemClick={() => {}}
    />
  );
}

/** jsdom 20 has no PointerEvent, and a plain Event drops coordinates. */
function pointer(
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  node: EventTarget,
  values: { clientX: number; clientY: number; pointerId?: number }
) {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: values.clientX,
    clientY: values.clientY,
    button: 0,
  });
  Object.defineProperty(event, 'pointerId', { value: values.pointerId ?? 1 });
  Object.defineProperty(event, 'pointerType', { value: 'touch' });
  act(() => {
    node.dispatchEvent(event);
  });
}

function Reader({
  initialPage,
  numPages = 5,
  enabled = true,
  onCommit,
  stageRef,
}: {
  initialPage: number;
  numPages?: number;
  enabled?: boolean;
  onCommit?: (page: number) => void;
  stageRef?: Ref<PDFPageStageHandle>;
}) {
  const [page, setPage] = useState(initialPage);
  return (
    <Stage
      page={page}
      numPages={numPages}
      enabled={enabled}
      stageRef={stageRef}
      onCommit={(next) => {
        onCommit?.(next);
        setPage(next);
      }}
    />
  );
}

describe('page turn drag', () => {
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

  function leaf() {
    const node = document.querySelector('.pdf-turn-leaf');
    if (!node) throw new Error('missing leaf');
    return node as HTMLElement;
  }

  it('follows the finger and turns the page on a horizontal swipe', async () => {
    const onCommit = vi.fn();
    const view = render(<Reader initialPage={2} onCommit={onCommit} />);
    const scene = document.querySelector('.pdf-turn-scene');
    if (!scene) throw new Error('missing scene');

    pointer('pointerdown', scene, { clientX: 200, clientY: 80 });
    pointer('pointermove', window, { clientX: 40, clientY: 84 });
    flushFrames();

    const angle = Number(leaf().style.transform.match(/rotateY\(([-\d.]+)deg\)/)?.[1]);
    expect(leaf().style.transform).toContain('perspective(');
    expect(angle).toBeCloseTo(-(160 / 300) * 180, 1);
    expect(leaf().classList.contains('pdf-turn-leaf--follow')).toBe(true);
    expect(scene.getAttribute('data-turn')).toBe('next');
    expect(onCommit).not.toHaveBeenCalled();

    pointer('pointerup', window, { clientX: 40, clientY: 84 });

    await waitFor(() => expect(onCommit).toHaveBeenCalledWith(3));
    await waitFor(() => expect(leaf().textContent).toBe('3'));
    expect(leaf().style.transform).toBe('');
    view.unmount();
  });

  it('does not turn on a small drag', async () => {
    const onCommit = vi.fn();
    render(<Reader initialPage={2} onCommit={onCommit} />);
    const scene = document.querySelector('.pdf-turn-scene');
    if (!scene) throw new Error('missing scene');

    pointer('pointerdown', scene, { clientX: 200, clientY: 80 });
    pointer('pointermove', window, { clientX: 190, clientY: 82 });
    pointer('pointerup', window, { clientX: 190, clientY: 82 });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 250));
    });
    expect(onCommit).not.toHaveBeenCalled();
    expect(leaf().textContent).toBe('2');
    expect(leaf().style.transform).toBe('');
  });

  it('does not turn on a vertical drag', async () => {
    const onCommit = vi.fn();
    render(<Reader initialPage={2} onCommit={onCommit} />);
    const scene = document.querySelector('.pdf-turn-scene');
    if (!scene) throw new Error('missing scene');

    pointer('pointerdown', scene, { clientX: 120, clientY: 40 });
    pointer('pointermove', window, { clientX: 124, clientY: 120 });
    pointer('pointerup', window, { clientX: 124, clientY: 120 });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 250));
    });
    expect(onCommit).not.toHaveBeenCalled();
    expect(leaf().style.transform).toBe('');
    expect(scene.hasAttribute('data-turn')).toBe(false);
  });

  it('does not leave the first or last page', async () => {
    const onCommit = vi.fn();
    render(<Reader initialPage={1} numPages={4} onCommit={onCommit} />);
    const scene = document.querySelector('.pdf-turn-scene');
    if (!scene) throw new Error('missing scene');

    pointer('pointerdown', scene, { clientX: 40, clientY: 80 });
    pointer('pointermove', window, { clientX: 200, clientY: 80 });
    flushFrames();
    const angle = Number.parseFloat(leaf().style.transform.match(/rotateY\(([-\d.]+)deg\)/)?.[1] ?? '0');
    expect(Math.abs(angle)).toBeGreaterThan(0);
    expect(Math.abs(angle)).toBeLessThan(30);
    expect(scene.hasAttribute('data-turn')).toBe(false);
    pointer('pointerup', window, { clientX: 200, clientY: 80 });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 250));
    });
    expect(onCommit).not.toHaveBeenCalled();
    expect(leaf().textContent).toBe('1');
  });

  it('commits a short flick when the finger is moving fast', async () => {
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const onCommit = vi.fn();
    render(<Reader initialPage={2} onCommit={onCommit} />);
    const scene = document.querySelector('.pdf-turn-scene');
    if (!scene) throw new Error('missing scene');

    pointer('pointerdown', scene, { clientX: 180, clientY: 90 });
    now = 1016;
    pointer('pointermove', window, { clientX: 140, clientY: 92 });
    pointer('pointerup', window, { clientX: 140, clientY: 92 });

    await waitFor(() => expect(onCommit).toHaveBeenCalledWith(3));
  });

  it('turns from the reader controls with the same release', async () => {
    const onCommit = vi.fn();
    const stageRef = createRef<PDFPageStageHandle>();
    render(<Reader initialPage={2} onCommit={onCommit} stageRef={stageRef} />);
    stageRef.current?.turn('prev');
    await waitFor(() => expect(onCommit).toHaveBeenCalledWith(1));
    await waitFor(() => expect(leaf().textContent).toBe('1'));
  });

  it('ignores a swipe while zoom, pinch, or a selection blocks turning', async () => {
    const onCommit = vi.fn();
    render(<Reader initialPage={2} onCommit={onCommit} enabled={false} />);
    const scene = document.querySelector('.pdf-turn-scene');
    if (!scene) throw new Error('missing scene');

    pointer('pointerdown', scene, { clientX: 220, clientY: 70 });
    pointer('pointermove', window, { clientX: 20, clientY: 70 });
    pointer('pointerup', window, { clientX: 20, clientY: 70 });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 250));
    });
    expect(onCommit).not.toHaveBeenCalled();
    expect(leaf().style.transform).toBe('');
  });
});
