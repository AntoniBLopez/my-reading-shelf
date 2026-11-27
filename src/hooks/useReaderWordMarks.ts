import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { useBookMarks } from '@/hooks/useBookMarks';
import { useHighlightLayer } from '@/hooks/useHighlightLayer';
import { useMarksGateway } from '@/hooks/useMarksGateway';
import { copy } from '@/lib/marks/copy';
import { isMarkWordKey, isReviewPanelKey } from '@/lib/marks/keys';
import { isTypingTarget } from '@/lib/keyboard';
import { FLASH_MS } from '@/lib/marks/constants';
import { clearNativeSelection, isFrontReader, readPageSelection } from '@/lib/marks/selection';
import type { MarksGateway } from '@/lib/marks/store';
import type { WordMark } from '@/lib/marks/types';

const NO_MARKS: WordMark[] = [];
import type { ActiveToast } from '@/hooks/useBookMarks';

export interface ReaderWordControls {
  marks: WordMark[];
  counts: Record<string, number>;
  pageNumber: number;
  bookTitle: string;
  panelOpen: boolean;
  toast: ActiveToast | null;
  toggleSelection: () => void;
  togglePanel: () => void;
  closePanel: () => void;
  goTo: (mark: WordMark) => void;
  remove: (id: string) => void;
  learn: (id: string) => void;
  undo: () => void;
  dismissToast: () => void;
}

interface Options {
  bookId: string;
  bookTitle: string;
  pageNumber: number;
  surfaceRef: RefObject<HTMLElement | null>;
  active: boolean;
  shortcuts: boolean;
  onGoToPage: (page: number) => void;
  gateway?: MarksGateway;
  panelRef?: RefObject<boolean>;
}

export function useReaderWordMarks({
  bookId,
  bookTitle,
  pageNumber,
  surfaceRef,
  active,
  shortcuts,
  onGoToPage,
  gateway,
  panelRef,
}: Options): ReaderWordControls {
  const liveGateway = useMarksGateway();
  const book = useBookMarks(bookId, gateway ?? liveGateway);
  const [panelOpen, setPanelOpen] = useState(false);
  const [flashIds, setFlashIds] = useState<string[]>([]);
  const counts = useHighlightLayer(surfaceRef, active ? book.marks : NO_MARKS, pageNumber, flashIds, active);
  const pageRef = useRef(pageNumber);
  const pending = useRef<string | null>(null);
  pageRef.current = pageNumber;
  if (panelRef) panelRef.current = panelOpen;

  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const pulse = useCallback((id: string, times: number) => {
    if (reduced()) return;
    let left = times;
    const run = () => {
      setFlashIds([id]);
      window.setTimeout(() => {
        setFlashIds([]);
        left -= 1;
        if (left > 0) window.setTimeout(run, 90);
      }, FLASH_MS);
    };
    run();
  }, []);

  const toggleSelection = useCallback(() => {
    const read = readPageSelection(surfaceRef.current, pageRef.current, document);
    if ('issue' in read) {
      if (read.issue === 'ignore') return;
      book.notify(read.issue === 'too_long' ? copy.tooLong : copy.selectFirst);
      return;
    }
    const result = book.toggle(read.input, read.count);
    clearNativeSelection(document);
    if (result.action === 'marked') pulse(result.mark.id, 1);
  }, [book, pulse, surfaceRef]);

  const togglePanel = useCallback(() => setPanelOpen((open) => !open), []);
  const closePanel = useCallback(() => setPanelOpen(false), []);

  const goTo = useCallback((mark: WordMark) => {
    onGoToPage(mark.pageNumber);
    if (mark.pageNumber === pageRef.current) pulse(mark.id, 2);
    else pending.current = mark.id;
  }, [onGoToPage, pulse]);

  useEffect(() => {
    const id = pending.current;
    if (!id || !book.marks.some((mark) => mark.id === id && mark.pageNumber === pageNumber)) return;
    pending.current = null;
    pulse(id, 2);
  }, [pageNumber, book.marks, pulse]);

  useEffect(() => {
    if (!shortcuts) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isFrontReader(surfaceRef.current, document)) return;
      const field = event.target instanceof Element && event.target.closest('input, textarea, [contenteditable="true"]');
      if (field) return;
      if (isReviewPanelKey(event)) {
        event.preventDefault();
        event.stopPropagation();
        togglePanel();
        return;
      }
      if (isTypingTarget(event.target) || !isMarkWordKey(event)) return;
      event.preventDefault();
      event.stopPropagation();
      toggleSelection();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [shortcuts, togglePanel, toggleSelection]);

  return {
    marks: book.marks,
    counts,
    pageNumber,
    bookTitle,
    panelOpen,
    toast: book.toast,
    toggleSelection,
    togglePanel,
    closePanel,
    goTo,
    remove: book.remove,
    learn: book.learn,
    undo: book.undo,
    dismissToast: book.dismissToast,
  };
}
