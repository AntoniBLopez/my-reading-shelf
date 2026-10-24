import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { Document, Page, pdfjs } from 'react-pdf';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { cn } from '@/lib/utils';
import { useCoarsePointer } from '@/hooks/useCoarsePointer';
import { usePageSwipe } from '@/hooks/usePageSwipe';
import { pageDevicePixelRatio } from '@/lib/pageCanvasScale';
import type { TurnDirection } from '@/lib/pageTurnGesture';
import { textItemsToPageText, type ReadablePdf } from '@/lib/rsvp/pageText';
import 'react-pdf/src/Page/AnnotationLayer.css';
import 'react-pdf/src/Page/TextLayer.css';

// Same module as <Document>/<Page>, and a local worker so the reader works offline.
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const assetBase = import.meta.env.BASE_URL;

const pdfDocOptions = {
  wasmUrl: `${assetBase}wasm/`,
  cMapUrl: `${assetBase}cmaps/`,
  cMapPacked: true,
  standardFontDataUrl: `${assetBase}standard_fonts/`,
};

export interface PDFPageStageHandle {
  turn: (direction: TurnDirection) => void;
  cancel: () => void;
}

interface PDFPageStageProps {
  pdfUrl: string;
  pageNumber: number;
  numPages: number;
  pageWidth: number;
  scale: number;
  showBookBorder: boolean;
  getCanTurn: () => boolean;
  panFree?: boolean;
  onCommit: (page: number) => void;
  onTurnActive?: (active: boolean) => void;
  onDocumentLoadSuccess: (pdf: ReadablePdf) => void;
  onDocumentLoadError: (error: Error) => void;
  onItemClick: (args: { pageNumber: number }) => void;
  onPageText?: (pageNumber: number, text: string) => void;
}

function slotsFor(page: number) {
  return {
    leaf: page,
    next: page + 1,
    prev: page - 1,
  };
}

export const PDFPageStage = forwardRef<PDFPageStageHandle, PDFPageStageProps>(function PDFPageStage(
  props,
  ref
) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const leafRef = useRef<HTMLDivElement>(null);
  const slotsRef = useRef(slotsFor(props.pageNumber));
  const [slots, setSlots] = useState(() => slotsFor(props.pageNumber));
  const [layoutEpoch, setLayoutEpoch] = useState(0);
  slotsRef.current = slots;

  const file = useMemo(() => props.pdfUrl, [props.pdfUrl]);
  const { resolvedTheme } = useTheme();
  const themeKey = resolvedTheme === 'dark' ? 'dark' : 'light';
  const touchPrimary = useCoarsePointer();
  const pixelRatio = typeof window === 'undefined' ? 1 : window.devicePixelRatio;
  const leafPixelRatio = pageDevicePixelRatio(pixelRatio, touchPrimary, 'leaf');
  const neighborPixelRatio = pageDevicePixelRatio(pixelRatio, touchPrimary, 'neighbor');

  const commitPage = (page: number) => {
    const dir: TurnDirection = page >= slotsRef.current.leaf ? 'next' : 'prev';
    setSlots({
      leaf: page,
      next: dir === 'next' ? page : page + 1,
      prev: dir === 'prev' ? page : page - 1,
    });
    props.onCommit(page);
  };

  const { onPointerDown, turn, cancel, settle, isLocked } = usePageSwipe({
    page: props.pageNumber,
    pageCount: props.numPages,
    enabled: props.getCanTurn,
    leafRef,
    sceneRef,
    onCommit: commitPage,
    onActive: (active) => {
      props.onTurnActive?.(active);
      if (!active) setLayoutEpoch((epoch) => epoch + 1);
    },
  });

  const locked = isLocked;
  useEffect(() => {
    if (locked()) return;
    setSlots((current) => {
      const next = slotsFor(props.pageNumber);
      if (
        current.leaf === next.leaf &&
        current.next === next.next &&
        current.prev === next.prev
      ) {
        return current;
      }
      return next;
    });
  }, [props.pageNumber, layoutEpoch, locked]);

  useImperativeHandle(ref, () => ({ turn, cancel }), [turn, cancel]);

  useEffect(() => {
    const el = sceneRef.current;
    if (!el) return;
    const syncSelection = () => {
      const selection = window.getSelection();
      const selected = !!(
        selection &&
        !selection.isCollapsed &&
        selection.toString().trim() &&
        selection.anchorNode &&
        el.contains(selection.anchorNode)
      );
      el.classList.toggle('pdf-turn-scene--selecting', selected);
    };
    document.addEventListener('selectionchange', syncSelection);
    syncSelection();
    return () => document.removeEventListener('selectionchange', syncSelection);
  }, []);

  const handleLeafRender = useCallback((page: { pageNumber: number }) => {
    const slotsNow = slotsRef.current;
    sceneRef.current?.querySelectorAll('.pdf-turn-leaf canvas, .pdf-turn-under canvas').forEach((node) => {
      if (!(node instanceof HTMLCanvasElement) || node.closest('.pdf-page-curl')) return;
      const slot = node.closest('.pdf-turn-leaf')
        ? slotsNow.leaf
        : node.closest('.pdf-turn-under--next')
          ? slotsNow.next
          : slotsNow.prev;
      node.dataset.page = String(slot);
    });
    settle(page.pageNumber);
  }, [settle]);

  const onPageTextRef = useRef(props.onPageText);
  onPageTextRef.current = props.onPageText;
  const handlePageText = useCallback((content: { items?: readonly unknown[] } | null, pageNumber: number) => {
    const text = textItemsToPageText(content?.items ?? []);
    if (text) onPageTextRef.current?.(pageNumber, text);
  }, []);

  const pageProps = {
    width: props.pageWidth,
    scale: props.scale,
    loading: null as null,
    className: 'bg-white dark:bg-black',
  };

  const inBook = (page: number) => props.numPages > 0 && page >= 1 && page <= props.numPages;

  return (
    <div className="pdf-viewer-pdf-wrapper" data-show-border={props.showBookBorder} data-theme={themeKey}>
      <Document
        file={file}
        options={pdfDocOptions}
        suspense={false}
        onLoadSuccess={props.onDocumentLoadSuccess}
        onLoadError={props.onDocumentLoadError}
        onItemClick={props.onItemClick}
        loading={null}
        className={cn(props.showBookBorder && 'shadow-lg')}
      >
        <div
          ref={sceneRef}
          className={cn('pdf-turn-scene', props.panFree && 'pdf-turn-scene--free')}
          onPointerDown={onPointerDown}
        >
          {inBook(slots.prev) && (
            <div className="pdf-turn-under pdf-turn-under--prev" aria-hidden>
              <Page {...pageProps} devicePixelRatio={neighborPixelRatio} key={`${themeKey}-${slots.prev}`} pageNumber={slots.prev} renderTextLayer={false} renderAnnotationLayer={false} onRenderSuccess={handleLeafRender} />
            </div>
          )}
          {inBook(slots.next) && (
            <div className="pdf-turn-under pdf-turn-under--next" aria-hidden>
              <Page {...pageProps} devicePixelRatio={neighborPixelRatio} key={`${themeKey}-${slots.next}`} pageNumber={slots.next} renderTextLayer={false} renderAnnotationLayer={false} onRenderSuccess={handleLeafRender} />
            </div>
          )}
          <div ref={leafRef} className="pdf-turn-leaf">
            <div className="pdf-turn-face pdf-turn-face--front">
              <Page
                {...pageProps}
                devicePixelRatio={leafPixelRatio}
                key={`${themeKey}-${slots.leaf}`}
                pageNumber={slots.leaf}
                renderTextLayer
                renderAnnotationLayer
                onRenderSuccess={handleLeafRender}
                onGetTextSuccess={(content) => handlePageText(content, slots.leaf)}
              />
              <div className="pdf-turn-crease" aria-hidden />
            </div>
            <div className="pdf-turn-face pdf-turn-face--back" aria-hidden />
          </div>
        </div>
      </Document>
    </div>
  );
});
