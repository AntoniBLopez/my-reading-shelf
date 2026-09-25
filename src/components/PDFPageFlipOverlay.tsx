import React, { forwardRef, useCallback, useEffect, useRef } from 'react';
import HTMLFlipBook from 'react-pageflip';
import { Document, Page, pdfjs } from 'react-pdf';
import { cn } from '@/lib/utils';

const PAGE_FLIP_DURATION_MS = 420;

const pdfDocOptions = {
  wasmUrl: `${import.meta.env.BASE_URL}wasm/`,
};

export interface PDFPageFlipOverlayProps {
  pdfUrl: string;
  direction: 'next' | 'prev';
  fromPage: number;
  toPage: number;
  pageWidth: number;
  scale: number;
  showBookBorder: boolean;
  onComplete: () => void;
}

const FlipPage = forwardRef<HTMLDivElement, { children: React.ReactNode }>(function FlipPage(
  { children },
  ref
) {
  return (
    <div
      ref={ref}
      className="pdf-flip-page h-full w-full overflow-hidden bg-white dark:bg-black"
    >
      {children}
    </div>
  );
});

interface PageFlipApi {
  getCurrentPageIndex: () => number;
  turnToPage: (page: number) => void;
  flipNext: (corner: 'top' | 'bottom') => void;
  flipPrev: (corner: 'top' | 'bottom') => void;
}

export function PDFPageFlipOverlay({
  pdfUrl,
  direction,
  fromPage,
  toPage,
  pageWidth,
  scale,
  showBookBorder,
  onComplete,
}: PDFPageFlipOverlayProps) {
  const flipBookRef = useRef<{ pageFlip: () => PageFlipApi } | null>(null);
  const pagesRenderedRef = useRef(0);
  const flipStartedRef = useRef(false);
  const completedRef = useRef(false);
  const pageHeightRef = useRef(Math.max(1, Math.round(pageWidth * scale * 1.414)));
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const bookWidth = Math.max(1, Math.round(pageWidth * scale));
  const bookHeight = pageHeightRef.current;

  const leftPage = direction === 'next' ? fromPage : toPage;
  const rightPage = direction === 'next' ? toPage : fromPage;

  const completeOnce = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onCompleteRef.current();
  }, []);

  const startFlip = useCallback(() => {
    if (flipStartedRef.current) return;
    const flip = flipBookRef.current?.pageFlip();
    if (!flip) return;

    flipStartedRef.current = true;

    requestAnimationFrame(() => {
      if (direction === 'next') {
        flip.turnToPage(0);
        requestAnimationFrame(() => flip.flipNext('bottom'));
      } else {
        flip.turnToPage(1);
        requestAnimationFrame(() => flip.flipPrev('bottom'));
      }
    });
  }, [direction]);

  const handlePageRenderSuccess = useCallback(
    (page: pdfjs.PDFPageProxy) => {
      const viewport = page.getViewport({ scale: 1 });
      const height = Math.round(bookWidth * (viewport.height / viewport.width));
      if (height > 0) pageHeightRef.current = height;

      pagesRenderedRef.current += 1;
      if (pagesRenderedRef.current >= 2) startFlip();
    },
    [bookWidth, startFlip]
  );

  const handleChangeState = useCallback(
    (e: { data: string }) => {
      if (e.data !== 'read' || !flipStartedRef.current) return;
      const flip = flipBookRef.current?.pageFlip();
      const index = flip?.getCurrentPageIndex() ?? 0;
      if (direction === 'next' && index === 1) completeOnce();
      else if (direction === 'prev' && index === 0) completeOnce();
    },
    [direction, completeOnce]
  );

  const handleFlip = useCallback(
    (e: { data: number }) => {
      if (!flipStartedRef.current) return;
      if (direction === 'next' && e.data === 1) completeOnce();
      else if (direction === 'prev' && e.data === 0) completeOnce();
    },
    [direction, completeOnce]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!completedRef.current && flipStartedRef.current) completeOnce();
    }, PAGE_FLIP_DURATION_MS + 200);
    return () => clearTimeout(timer);
  }, [completeOnce]);

  const pageProps = {
    width: pageWidth,
    scale,
    loading: null as null,
    className: 'bg-white dark:bg-black',
    renderTextLayer: true,
    renderAnnotationLayer: true,
  };

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-white dark:bg-black pointer-events-none">
      <div className="pdf-viewer-pdf-wrapper" data-show-border={showBookBorder}>
        <Document
          file={pdfUrl}
          options={pdfDocOptions}
          loading={null}
          className={cn(showBookBorder && 'shadow-lg')}
        >
          <HTMLFlipBook
            ref={flipBookRef}
            className="pdf-page-flipbook"
            style={{}}
            width={bookWidth}
            height={bookHeight}
            size="fixed"
            minWidth={bookWidth}
            maxWidth={bookWidth}
            minHeight={bookHeight}
            maxHeight={bookHeight}
            startPage={direction === 'next' ? 0 : 1}
            drawShadow
            flippingTime={PAGE_FLIP_DURATION_MS}
            usePortrait
            startZIndex={30}
            autoSize={false}
            maxShadowOpacity={0.45}
            showCover={false}
            mobileScrollSupport={false}
            clickEventForward
            useMouseEvents={false}
            swipeDistance={9999}
            showPageCorners={false}
            disableFlipByClick
            onFlip={handleFlip}
            onChangeState={handleChangeState}
          >
            <FlipPage>
              <Page
                {...pageProps}
                pageNumber={leftPage}
                onRenderSuccess={handlePageRenderSuccess}
              />
            </FlipPage>
            <FlipPage>
              <Page
                {...pageProps}
                pageNumber={rightPage}
                onRenderSuccess={handlePageRenderSuccess}
              />
            </FlipPage>
          </HTMLFlipBook>
        </Document>
      </div>
    </div>
  );
}
