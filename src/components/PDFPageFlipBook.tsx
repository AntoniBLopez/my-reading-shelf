import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import HTMLFlipBook from 'react-pageflip';
import { Document, Page, pdfjs } from 'react-pdf';
import { cn } from '@/lib/utils';

const PAGE_FLIP_DURATION_MS = 420;

const pdfDocOptions = {
  wasmUrl: `${import.meta.env.BASE_URL}wasm/`,
};

type FlipDirection = 'next' | 'prev';

export interface PDFPageFlipBookHandle {
  flipNext: () => boolean;
  flipPrev: () => boolean;
}

interface PDFPageFlipBookProps {
  pdfUrl: string;
  pageNumber: number;
  numPages: number;
  pageWidth: number;
  scale: number;
  showBookBorder: boolean;
  onPageChange: (page: number) => void;
  onDocumentLoadSuccess: (args: { numPages: number }) => void;
  onDocumentLoadError: (error: Error) => void;
  onItemClick: (args: { pageNumber: number }) => void;
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

export const PDFPageFlipBook = forwardRef<PDFPageFlipBookHandle, PDFPageFlipBookProps>(
  function PDFPageFlipBook(props, ref) {
    const flipBookRef = useRef<{ pageFlip: () => PageFlipApi } | null>(null);
    const isFlippingRef = useRef(false);
    const flipDirectionRef = useRef<FlipDirection | null>(null);
    const pageNumberRef = useRef(props.pageNumber);
    pageNumberRef.current = props.pageNumber;

    const [slots, setSlots] = useState(() => ({
      front: props.pageNumber,
      back: Math.min(props.pageNumber + 1, props.numPages || props.pageNumber + 1),
    }));
    const [pageHeight, setPageHeight] = useState(0);

    const bookWidth = Math.max(1, Math.round(props.pageWidth * props.scale));
    const bookHeight = pageHeight > 0 ? pageHeight : Math.max(1, Math.round(bookWidth * 1.414));

    const syncSlotsAtRest = useCallback(
      (page: number) => {
        setSlots({
          front: page,
          back: Math.min(page + 1, props.numPages || page),
        });
        flipBookRef.current?.pageFlip()?.turnToPage(0);
      },
      [props.numPages]
    );

    useEffect(() => {
      if (isFlippingRef.current) return;
      syncSlotsAtRest(props.pageNumber);
    }, [props.pageNumber, props.numPages, syncSlotsAtRest]);

    const finishFlip = useCallback(
      (direction: FlipDirection) => {
        if (!isFlippingRef.current || flipDirectionRef.current !== direction) return;

        const current = pageNumberRef.current;
        const nextPage = direction === 'next' ? current + 1 : current - 1;
        isFlippingRef.current = false;
        flipDirectionRef.current = null;

        props.onPageChange(nextPage);
        flipBookRef.current?.pageFlip()?.turnToPage(0);
        setSlots({
          front: nextPage,
          back: Math.min(nextPage + 1, props.numPages || nextPage),
        });
      },
      [props.onPageChange, props.numPages]
    );

    const handleFlip = useCallback(
      (e: { data: number }) => {
        if (!isFlippingRef.current) return;
        const direction = flipDirectionRef.current;
        if (!direction) return;

        if (direction === 'next' && e.data === 1) finishFlip('next');
        else if (direction === 'prev' && e.data === 0) finishFlip('prev');
      },
      [finishFlip]
    );

    const handleChangeState = useCallback(
      (e: { data: string }) => {
        if (e.data !== 'read' || !isFlippingRef.current) return;

        const flip = flipBookRef.current?.pageFlip();
        const index = flip?.getCurrentPageIndex() ?? 0;
        const direction = flipDirectionRef.current;
        if (direction === 'next' && index === 1) finishFlip('next');
        else if (direction === 'prev' && index === 0) finishFlip('prev');
        else if (direction) {
          isFlippingRef.current = false;
          flipDirectionRef.current = null;
          syncSlotsAtRest(pageNumberRef.current);
        }
      },
      [finishFlip, syncSlotsAtRest]
    );

    const handlePageRenderSuccess = useCallback(
      (page: pdfjs.PDFPageProxy) => {
        const viewport = page.getViewport({ scale: 1 });
        const height = Math.round(bookWidth * (viewport.height / viewport.width));
        if (height > 0) setPageHeight(height);
      },
      [bookWidth]
    );

    useEffect(() => {
      setPageHeight(0);
    }, [props.pageWidth, props.scale, props.pdfUrl]);

    useImperativeHandle(
      ref,
      () => ({
        flipNext: () => {
          const current = pageNumberRef.current;
          if (isFlippingRef.current || current >= props.numPages) return false;

          const flip = flipBookRef.current?.pageFlip();
          if (!flip) return false;

          flipDirectionRef.current = 'next';
          setSlots({ front: current, back: current + 1 });

          requestAnimationFrame(() => {
            flip.turnToPage(0);
            requestAnimationFrame(() => {
              isFlippingRef.current = true;
              flip.flipNext('bottom');
            });
          });
          return true;
        },
        flipPrev: () => {
          const current = pageNumberRef.current;
          if (isFlippingRef.current || current <= 1) return false;

          const flip = flipBookRef.current?.pageFlip();
          if (!flip) return false;

          flipDirectionRef.current = 'prev';
          setSlots({ front: current - 1, back: current });

          requestAnimationFrame(() => {
            flip.turnToPage(1);
            requestAnimationFrame(() => {
              isFlippingRef.current = true;
              flip.flipPrev('bottom');
            });
          });
          return true;
        },
      }),
      [props.numPages]
    );

    const pageProps = {
      width: props.pageWidth,
      scale: props.scale,
      loading: null as null,
      className: 'bg-white dark:bg-black',
      renderTextLayer: true,
      renderAnnotationLayer: true,
    };

    return (
      <div className="pdf-viewer-pdf-wrapper" data-show-border={props.showBookBorder}>
        <Document
          file={props.pdfUrl}
          options={pdfDocOptions}
          onLoadSuccess={props.onDocumentLoadSuccess}
          onLoadError={props.onDocumentLoadError}
          onItemClick={props.onItemClick}
          loading={null}
          className={cn(props.showBookBorder && 'shadow-lg')}
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
            startPage={0}
            drawShadow
            flippingTime={PAGE_FLIP_DURATION_MS}
            usePortrait
            startZIndex={0}
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
                pageNumber={slots.front}
                onRenderSuccess={handlePageRenderSuccess}
              />
            </FlipPage>
            <FlipPage>
              <Page {...pageProps} pageNumber={slots.back} />
            </FlipPage>
          </HTMLFlipBook>
        </Document>
      </div>
    );
  }
);

interface PageFlipApi {
  getCurrentPageIndex: () => number;
  turnToPage: (page: number) => void;
  flipNext: (corner: 'top' | 'bottom') => void;
  flipPrev: (corner: 'top' | 'bottom') => void;
}
