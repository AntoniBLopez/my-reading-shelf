import { useState, type Ref } from 'react';
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PDFPageStage, type PDFPageStageHandle } from '@/components/PDFPageStage';

const { pageRender } = vi.hoisted(() => ({ pageRender: vi.fn() }));

vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}));

vi.mock('react-pdf', async () => {
  const React = await import('react');
  return {
    pdfjs: { GlobalWorkerOptions: { workerSrc: '' } },
    Document: ({ children, className }: { children: React.ReactNode; className?: string }) => (
      <div className={className}>{children}</div>
    ),
    Page: ({
      pageNumber,
      devicePixelRatio,
      onRenderSuccess,
    }: {
      pageNumber: number;
      devicePixelRatio?: number;
      onRenderSuccess?: (page: { pageNumber: number }) => void;
    }) => {
      pageRender(pageNumber, devicePixelRatio);
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

const originalMatchMedia = window.matchMedia;

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

function pointer(
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  node: EventTarget,
  values: { clientX: number; clientY: number }
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

function Reader({ initialPage = 3 }: { initialPage?: number }) {
  const [page, setPage] = useState(initialPage);
  const stageRef = { current: null } as Ref<PDFPageStageHandle>;
  return (
    <PDFPageStage
      ref={stageRef}
      pdfUrl="blob:test"
      pageNumber={page}
      numPages={8}
      pageWidth={300}
      scale={1}
      showBookBorder
      getCanTurn={() => true}
      onCommit={setPage}
      onDocumentLoadSuccess={() => {}}
      onDocumentLoadError={() => {}}
      onItemClick={() => {}}
    />
  );
}

describe('page turn performance', () => {
  let frames: FrameRequestCallback[] = [];

  function flushFrames() {
    const batch = frames.splice(0, frames.length);
    act(() => {
      for (const frame of batch) frame(performance.now());
    });
  }

  beforeEach(() => {
    frames = [];
    pageRender.mockClear();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      if (frames[id - 1]) frames[id - 1] = () => {};
    });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(rect);
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 3 });
    window.matchMedia = originalMatchMedia;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    window.matchMedia = originalMatchMedia;
  });

  it('GIVEN a drag WHEN frames are flushed THEN the page paints once and is not rendered again', () => {
    render(<Reader />);
    const scene = document.querySelector('.pdf-turn-scene');
    if (!scene) throw new Error('missing scene');
    const rendersAfterMount = pageRender.mock.calls.length;
    expect(rendersAfterMount).toBeGreaterThan(0);
    pageRender.mockClear();

    const rectCalls = vi.mocked(HTMLElement.prototype.getBoundingClientRect).mock.calls.length;
    pointer('pointerdown', scene, { clientX: 240, clientY: 80 });
    for (let step = 1; step <= 12; step += 1) {
      pointer('pointermove', window, { clientX: 240 - step * 15, clientY: 82 });
    }

    expect(pageRender).not.toHaveBeenCalled();
    expect(vi.mocked(HTMLElement.prototype.getBoundingClientRect).mock.calls.length).toBe(rectCalls + 1);
    expect(frames).toHaveLength(1);
    const leaf = document.querySelector('.pdf-turn-leaf');
    if (!(leaf instanceof HTMLElement)) throw new Error('missing leaf');
    expect(leaf.getAttribute('style') ?? '').not.toContain('rotateY');

    flushFrames();
    expect(leaf.style.transform).not.toContain('rotateY');
    expect(scene.getAttribute('data-turn')).toBe('next');
    expect(pageRender).not.toHaveBeenCalled();
  });

  it('GIVEN a pointer down WHEN the move is vertical THEN no touch listener is installed', () => {
    render(<Reader />);
    const scene = document.querySelector('.pdf-turn-scene');
    if (!scene) throw new Error('missing scene');
    const added: Array<{ type: string; passive?: boolean }> = [];
    const original = scene.addEventListener.bind(scene);
    vi.spyOn(scene, 'addEventListener').mockImplementation((type, listener, options) => {
      const passive = typeof options === 'object' && options !== null ? options.passive : undefined;
      added.push({ type: String(type), passive });
      original(type, listener as EventListener, options);
    });

    pointer('pointerdown', scene, { clientX: 120, clientY: 40 });
    pointer('pointermove', window, { clientX: 124, clientY: 160 });
    expect(added.some((entry) => entry.type === 'touchmove')).toBe(false);

    pointer('pointerup', window, { clientX: 124, clientY: 160 });
    pointer('pointerdown', scene, { clientX: 240, clientY: 80 });
    pointer('pointermove', window, { clientX: 40, clientY: 84 });
    expect(added).toContainEqual({ type: 'touchmove', passive: false });
  });

  it('GIVEN a touch screen WHEN the stage mounts THEN the revealed page uses the settled page resolution', () => {
    window.matchMedia = media(true);
    render(<Reader initialPage={3} />);
    const pages = pageRender.mock.calls.map(([page, ratio]) => ({ page, ratio }));
    expect(pages.map((entry) => entry.page).sort()).toEqual([2, 3, 4]);
    expect(pages.every((entry) => entry.ratio === 2)).toBe(true);
  });

  it('GIVEN a desktop screen WHEN the stage mounts THEN the revealed page keeps the screen ratio', () => {
    window.matchMedia = media(false);
    render(<Reader initialPage={3} />);
    const leaf = pageRender.mock.calls.find(([page]) => page === 3);
    const neighbor = pageRender.mock.calls.find(([page]) => page === 4);
    expect(leaf?.[1]).toBe(3);
    expect(neighbor?.[1]).toBe(3);
    expect(pageRender.mock.calls.some(([page]) => page === 5 || page === 1)).toBe(false);
  });
});
