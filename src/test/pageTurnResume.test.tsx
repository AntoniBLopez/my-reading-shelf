import { createRef, useRef, useState, type Ref } from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PDFPageStage, type PDFPageStageHandle } from '@/components/PDFPageStage';
import { PageTurnSession } from '@/hooks/pageTurnSession';
import { useReaderInteractionResume } from '@/hooks/useReaderInteractionResume';

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

function pointer(type: 'pointerdown' | 'pointermove' | 'pointerup', node: EventTarget, clientX: number, clientY: number) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY, button: 0 });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  Object.defineProperty(event, 'pointerType', { value: 'touch' });
  act(() => {
    node.dispatchEvent(event);
  });
}

function Reader({ stageRef }: { stageRef?: Ref<PDFPageStageHandle> }) {
  const [page, setPage] = useState(2);
  return (
    <PDFPageStage
      ref={stageRef}
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

function setVisibility(value: 'hidden' | 'visible') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => value });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

describe('page turn resume', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
  });

  it('GIVEN a drag in progress WHEN the tab is hidden and shown THEN the next control still turns the page', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(rect);
    const stageRef = createRef<PDFPageStageHandle>();
    render(<Reader stageRef={stageRef} />);
    const scene = document.querySelector('.pdf-turn-scene');
    if (!scene) throw new Error('missing scene');

    pointer('pointerdown', scene, 220, 80);
    pointer('pointermove', window, 40, 86);

    act(() => {
      stageRef.current?.turn('next');
    });
    expect(scene.getAttribute('data-committed')).toBe('2');

    setVisibility('hidden');
    setVisibility('visible');
    act(() => {
      stageRef.current?.turn('next');
    });
    await waitFor(() => expect(scene.getAttribute('data-committed')).toBe('3'));
    act(() => {
      stageRef.current?.turn('next');
    });
    await waitFor(() => expect(scene.getAttribute('data-committed')).toBe('4'));
    expect(document.querySelector('.pdf-turn-leaf')?.textContent).toBe('4');
  });

  it('GIVEN a committed turn whose timer was discarded WHEN the reader recovers THEN that page stays and the next turn advances once', () => {
    vi.useFakeTimers();
    const scene = document.createElement('div');
    const leaf = document.createElement('div');
    document.body.append(scene, leaf);
    const settled: number[] = [];
    const committed: number[] = [];
    const gestureRef = { current: null as { active: boolean; width: number; height: number; lastX: number; lastY: number } | null };
    const session = new PageTurnSession({
      leafRef: { current: leaf },
      sceneRef: { current: scene },
      onCommitRef: { current: (page) => committed.push(page) },
      onBeginRef: { current: () => {} },
      onSettledRef: { current: () => settled.push(1) },
      onCoveredRef: { current: () => {} },
      onActiveRef: { current: undefined },
      gestureRef,
      cancelFollow: () => {},
      disarmTouch: () => {},
    });

    session.beginGesture();
    session.finishCommit(5);
    expect(session.isLocked()).toBe(true);
    expect(committed).toEqual([5]);
    vi.clearAllTimers();
    expect(session.isLocked()).toBe(true);

    session.recover();
    expect(session.isLocked()).toBe(false);
    expect(settled).toEqual([1]);
    expect(committed).toEqual([5]);

    session.beginGesture();
    session.finishCommit(6);
    expect(committed).toEqual([5, 6]);
    scene.remove();
    leaf.remove();
  });

  it('GIVEN a pinch that never received touchend WHEN the tab is hidden THEN page turns are allowed again', () => {
    const pinching = { current: true };
    function Harness() {
      const seen = useRef(pinching);
      const [, refresh] = useState(0);
      useReaderInteractionResume(
        true,
        () => {
          seen.current.current = false;
          refresh((value) => value + 1);
        },
        () => {
          seen.current.current = false;
        },
      );
      return <div>{seen.current.current ? 'blocked' : 'free'}</div>;
    }
    const view = render(<Harness />);
    expect(view.getByText('blocked')).toBeTruthy();
    setVisibility('hidden');
    expect(view.getByText('free')).toBeTruthy();
    expect(pinching.current).toBe(false);
  });
});
