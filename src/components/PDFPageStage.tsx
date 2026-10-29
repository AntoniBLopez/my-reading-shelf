import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { Document, pdfjs } from 'react-pdf';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { cn } from '@/lib/utils';
import { useCoarsePointer } from '@/hooks/useCoarsePointer';
import { usePageSwipe } from '@/hooks/usePageSwipe';
import { TurnSlot } from '@/components/TurnSlot';
import { pageDevicePixelRatio } from '@/lib/pageCanvasScale';
import type { TurnDirection } from '@/lib/pageTurnGesture';
import {
  beginTurn,
  commitTurnSlots,
  prefetchNeighbor,
  settleTurn,
  shownNeighbor,
  slotsForPage,
} from '@/lib/pageTurnSlots';
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

export const PDFPageStage = forwardRef<PDFPageStageHandle, PDFPageStageProps>(function PDFPageStage(
  props,
  ref
) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const leafRef = useRef<HTMLDivElement>(null);
  const genRef = useRef(0);
  const [slots, setSlots] = useState(() => slotsForPage(props.pageNumber));

  const file = useMemo(() => props.pdfUrl, [props.pdfUrl]);
  const { resolvedTheme } = useTheme();
  const themeKey = resolvedTheme === 'dark' ? 'dark' : 'light';
  const touchPrimary = useCoarsePointer();
  const pixelRatio = typeof window === 'undefined' ? 1 : window.devicePixelRatio;
  const pageRatio = pageDevicePixelRatio(pixelRatio, touchPrimary, 'leaf');

  const commitPage = (page: number) => {
    // The hole already shows `page`. Keep it there; the next neighbor is only a prefetch.
    setSlots((current) => commitTurnSlots(current, page));
    props.onCommit(page);
  };

  const pageNumberRef = useRef(props.pageNumber);
  pageNumberRef.current = props.pageNumber;

  const { onPointerDown, turn, cancel, settle, isLocked } = usePageSwipe({
    page: props.pageNumber,
    pageCount: props.numPages,
    enabled: props.getCanTurn,
    leafRef,
    sceneRef,
    onCommit: commitPage,
    onBegin: (gen) => {
      genRef.current = gen;
      setSlots((current) => (current.hole == null ? current : beginTurn(current, gen)));
    },
    onSettled: (gen) => {
      setSlots((current) => {
        if (genRef.current !== gen) return current;
        const settled = settleTurn({ ...current, gen }, gen);
        return settled.leaf === pageNumberRef.current
          ? settled
          : slotsForPage(pageNumberRef.current, settled.gen);
      });
    },
    onActive: (active) => {
      props.onTurnActive?.(active);
    },
  });

  const locked = isLocked;
  useEffect(() => {
    if (locked()) return;
    setSlots((current) =>
      current.leaf === props.pageNumber ? current : slotsForPage(props.pageNumber, current.gen),
    );
  }, [props.pageNumber, locked]);

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

  const handleLeafRender = useCallback((pageNumber: number) => {
    settle(pageNumber);
  }, [settle]);

  const onPageTextRef = useRef(props.onPageText);
  onPageTextRef.current = props.onPageText;
  const handlePageText = useCallback((content: { items?: readonly unknown[] } | null, pageNumber: number) => {
    const text = textItemsToPageText(content?.items ?? []);
    if (text) onPageTextRef.current?.(pageNumber, text);
  }, []);

  const inBook = (page: number) => props.numPages > 0 && page >= 1 && page <= props.numPages;
  const nextPage = shownNeighbor(slots, 'next');
  const prevPage = shownNeighbor(slots, 'prev');
  const ahead = prefetchNeighbor(slots, 'next');
  const behind = prefetchNeighbor(slots, 'prev');
  const neighborLayers = [
    { page: prevPage, className: 'pdf-turn-under pdf-turn-under--prev' },
    { page: nextPage, className: 'pdf-turn-under pdf-turn-under--next' },
    behind == null
      ? null
      : {
          page: behind,
          className: 'pdf-turn-prefetch pdf-turn-prefetch--prev invisible pointer-events-none absolute inset-0',
        },
    ahead == null
      ? null
      : {
          page: ahead,
          className: 'pdf-turn-prefetch pdf-turn-prefetch--next invisible pointer-events-none absolute inset-0',
        },
  ].filter((layer): layer is { page: number; className: string } => layer != null && inBook(layer.page));
  const neighbors = new Map<number, string>();
  for (const layer of neighborLayers) {
    if (!neighbors.has(layer.page)) neighbors.set(layer.page, layer.className);
  }
  const slotProps = {
    pageWidth: props.pageWidth,
    scale: props.scale,
    devicePixelRatio: pageRatio,
    themeKey,
    onReady: handleLeafRender,
  };

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
          {[...neighbors.entries()].map(([page, className]) => (
            <TurnSlot key={page} {...slotProps} pageNumber={page} className={className} text={false} />
          ))}
          <div ref={leafRef} className="pdf-turn-leaf">
            <div className="pdf-turn-face pdf-turn-face--front">
              <TurnSlot
                {...slotProps}
                pageNumber={slots.leaf}
                className="pdf-turn-face-page"
                text
                onText={handlePageText}
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
