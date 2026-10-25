import { useEffect, useRef, useState } from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PDFPageStage, type PDFPageStageHandle } from '@/components/PDFPageStage';
import { turnDirectionFromKey } from '@/lib/pageTurnGesture';

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
  Object.defineProperty(event, 'pointerType', { value: 'mouse' });
  act(() => {
    node.dispatchEvent(event);
  });
}

function Reader({ fullscreen = false }: { fullscreen?: boolean }) {
  const [page, setPage] = useState(3);
  const stageRef = useRef<PDFPageStageHandle>(null);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const direction = turnDirectionFromKey(event.key);
      if (!direction) return;
      event.preventDefault();
      stageRef.current?.turn(direction);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <div data-reader-mode={fullscreen ? 'fullscreen' : 'window'}>
      <button type="button" onClick={() => stageRef.current?.turn('prev')}>
        Previous page
      </button>
      <button type="button" onClick={() => stageRef.current?.turn('next')}>
        Next page
      </button>
      <PDFPageStage
        ref={stageRef}
        pdfUrl="blob:test"
        pageNumber={page}
        numPages={10}
        pageWidth={300}
        scale={1}
        showBookBorder={false}
        getCanTurn={() => true}
        onCommit={setPage}
        onDocumentLoadSuccess={() => {}}
        onDocumentLoadError={() => {}}
        onItemClick={() => {}}
      />
    </div>
  );
}

function leafText(): string {
  return document.querySelector('.pdf-turn-leaf')?.textContent ?? '';
}

function swipeNext() {
  const scene = document.querySelector('.pdf-turn-scene');
  if (!scene) throw new Error('missing scene');
  pointer('pointerdown', scene, { clientX: 240, clientY: 80 });
  pointer('pointermove', window, { clientX: 40, clientY: 84 });
  pointer('pointerup', window, { clientX: 40, clientY: 84 });
}

describe('GIVEN the reader can turn pages', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(rect);
  });

  it('GIVEN the open reader WHEN arrow keys are pressed in quick succession THEN each press turns a page', () => {
    render(<Reader />);
    expect(leafText()).toBe('3');

    for (const key of ['ArrowRight', 'ArrowRight', 'ArrowLeft', 'ArrowRight']) {
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      });
    }

    expect(leafText()).toBe('5');
  });

  it('GIVEN fullscreen WHEN arrow keys are pressed in quick succession THEN each press turns a page', () => {
    render(<Reader fullscreen />);
    expect(document.querySelector('[data-reader-mode="fullscreen"]')).toBeTruthy();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });

    expect(leafText()).toBe('4');
  });

  it('GIVEN the page turn controls WHEN they are clicked rapidly THEN every click turns a page', () => {
    render(<Reader />);
    const buttons = document.querySelectorAll('button');
    const previous = buttons[0];
    const following = buttons[1];
    if (!previous || !following) throw new Error('missing controls');

    fireEvent.click(following);
    fireEvent.click(following);
    fireEvent.click(previous);

    expect(leafText()).toBe('4');
  });

  it('GIVEN the page WHEN it is swiped twice without waiting THEN both swipes turn the page', () => {
    render(<Reader />);
    swipeNext();
    expect(leafText()).toBe('4');
    swipeNext();
    expect(leafText()).toBe('5');
  });
});
