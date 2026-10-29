import { createRef, useState, type Ref } from 'react';
import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

function leafText(): string {
  return document.querySelector('.pdf-turn-leaf')?.textContent ?? '';
}

function Reader({
  stageRef,
  numPages = 8,
  initialPage = 2,
}: {
  stageRef?: Ref<PDFPageStageHandle>;
  numPages?: number;
  initialPage?: number;
}) {
  const [page, setPage] = useState(initialPage);
  return (
    <PDFPageStage
      ref={stageRef}
      pdfUrl="blob:test"
      pageNumber={page}
      numPages={numPages}
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

describe('rapid page turns', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should commit every arrow turn without waiting for the previous page to finish', () => {
    const stageRef = createRef<PDFPageStageHandle>();
    render(<Reader stageRef={stageRef} />);
    expect(leafText()).toBe('2');

    act(() => {
      stageRef.current?.turn('next');
      stageRef.current?.turn('next');
      stageRef.current?.turn('prev');
      stageRef.current?.turn('next');
    });

    expect(leafText()).toBe('4');
    expect(document.querySelector('.pdf-turn-under--next')?.textContent).toBe('5');
    expect(document.querySelector('.pdf-turn-under--prev')?.textContent).toBe('3');
  });

  it('should stop at the ends of the book while earlier rapid turns still land', () => {
    const stageRef = createRef<PDFPageStageHandle>();
    render(<Reader stageRef={stageRef} initialPage={7} />);

    act(() => {
      stageRef.current?.turn('next');
      stageRef.current?.turn('next');
      stageRef.current?.turn('next');
    });

    expect(leafText()).toBe('8');
  });

  it('should commit the page while a curl snapshot is still pending', () => {
    vi.useFakeTimers();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high',
      translate() {},
      scale() {},
      drawImage() {},
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(() => {});

    const stageRef = createRef<PDFPageStageHandle>();
    render(<Reader stageRef={stageRef} />);
    const scene = document.querySelector('.pdf-turn-scene');
    if (!scene) throw new Error('missing scene');
    for (const page of [1, 2, 3, 4]) {
      const canvas = document.createElement('canvas');
      canvas.width = 24;
      canvas.height = 32;
      canvas.dataset.page = String(page);
      scene.appendChild(canvas);
    }

    act(() => {
      stageRef.current?.turn('next');
      stageRef.current?.turn('next');
    });

    expect(scene.getAttribute('data-committed')).toBe('4');
    expect(leafText()).toBe('3');
    expect(vi.getTimerCount()).toBeGreaterThan(0);
  });
});
