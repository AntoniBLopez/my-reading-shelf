import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { cn } from '@/lib/utils';

const TURN_MS = 300;
const DRAG_START_PX = 18;
const COMMIT_PROGRESS = 0.28;
const COMMIT_VELOCITY = 0.55;

const pdfDocOptions = {
  wasmUrl: `${import.meta.env.BASE_URL}wasm/`,
};

type TurnDirection = 'next' | 'prev';

type Gesture = {
  pointerId: number;
  startX: number;
  startY: number;
  startT: number;
  lastX: number;
  lastT: number;
  vx: number;
  dir: TurnDirection | null;
  active: boolean;
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
  onDocumentLoadSuccess: (args: { numPages: number }) => void;
  onDocumentLoadError: (error: Error) => void;
  onItemClick: (args: { pageNumber: number }) => void;
}

export const PDFPageStage = forwardRef<PDFPageStageHandle, PDFPageStageProps>(function PDFPageStage(
  props,
  ref
) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const leafRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const progressRef = useRef(0);
  const dirRef = useRef<TurnDirection | null>(null);
  const lockRef = useRef(false);
  const commitOnceRef = useRef(false);
  const pendingLeafRef = useRef<number | null>(null);
  const animGenRef = useRef(0);
  const animRafRef = useRef<number | null>(null);
  const leafPageRef = useRef(props.pageNumber);
  const numPagesRef = useRef(props.numPages);
  const onCommitRef = useRef(props.onCommit);
  const onTurnActiveRef = useRef(props.onTurnActive);
  const getCanTurnRef = useRef(props.getCanTurn);
  onCommitRef.current = props.onCommit;
  onTurnActiveRef.current = props.onTurnActive;
  getCanTurnRef.current = props.getCanTurn;

  const [slots, setSlots] = useState(() => ({
    leaf: props.pageNumber,
    next: props.pageNumber + 1,
    prev: props.pageNumber - 1,
  }));

  leafPageRef.current = slots.leaf;
  numPagesRef.current = props.numPages;

  const file = useMemo(() => props.pdfUrl, [props.pdfUrl]);

  const cancelAnim = useCallback(() => {
    animGenRef.current += 1;
    if (animRafRef.current != null) {
      cancelAnimationFrame(animRafRef.current);
      animRafRef.current = null;
    }
  }, []);

  const applyProgress = useCallback((dir: TurnDirection, progress: number) => {
    const scene = sceneRef.current;
    const leaf = leafRef.current;
    if (!scene || !leaf) return;
    const p = Math.max(0, Math.min(1, progress));
    progressRef.current = p;
    dirRef.current = dir;
    if (p < 0.001) {
      delete scene.dataset.turn;
      scene.style.removeProperty('--turn-shade');
      leaf.style.transform = '';
      leaf.style.transformOrigin = '';
      return;
    }
    scene.dataset.turn = dir;
    scene.style.setProperty('--turn-shade', String(Math.sin(p * Math.PI) * 0.55));
    const angle = dir === 'next' ? -180 * p : 180 * p;
    leaf.style.transformOrigin = dir === 'next' ? 'left center' : 'right center';
    leaf.style.transform = `rotateY(${angle}deg)`;
  }, []);

  const applyReset = useCallback(() => {
    progressRef.current = 0;
    dirRef.current = null;
    const scene = sceneRef.current;
    const leaf = leafRef.current;
    if (scene) {
      delete scene.dataset.turn;
      scene.style.removeProperty('--turn-shade');
    }
    if (leaf) {
      leaf.style.transform = '';
      leaf.style.transformOrigin = '';
    }
  }, []);

  const finishSettle = useCallback(() => {
    const target = pendingLeafRef.current;
    if (target == null) return;
    pendingLeafRef.current = null;
    applyReset();
    setSlots({ leaf: target, next: target + 1, prev: target - 1 });
    lockRef.current = false;
    commitOnceRef.current = false;
    onTurnActiveRef.current?.(false);
  }, [applyReset]);

  const settleTo = useCallback(
    (dir: TurnDirection, target: number) => {
      if (commitOnceRef.current) return;
      const max = numPagesRef.current;
      if (target < 1 || target > max) {
        applyReset();
        lockRef.current = false;
        onTurnActiveRef.current?.(false);
        return;
      }
      commitOnceRef.current = true;
      lockRef.current = true;
      pendingLeafRef.current = target;
      applyProgress(dir, 1);
      setSlots((current) => ({ ...current, leaf: target }));
      onCommitRef.current(target);
      window.setTimeout(() => {
        if (pendingLeafRef.current === target) finishSettle();
      }, 500);
    },
    [applyProgress, applyReset, finishSettle]
  );

  const animateProgress = useCallback(
    (from: number, to: number, dir: TurnDirection, onDone: () => void) => {
      cancelAnim();
      const gen = animGenRef.current;
      const start = performance.now();
      const duration = Math.max(140, TURN_MS * Math.abs(to - from));
      const tick = (now: number) => {
        if (animGenRef.current !== gen) return;
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - (1 - t) ** 3;
        applyProgress(dir, from + (to - from) * eased);
        if (t < 1) animRafRef.current = requestAnimationFrame(tick);
        else onDone();
      };
      animRafRef.current = requestAnimationFrame(tick);
    },
    [applyProgress, cancelAnim]
  );

  const revertTurn = useCallback(() => {
    const dir = dirRef.current;
    const progress = progressRef.current;
    gestureRef.current = null;
    if (pendingLeafRef.current != null) return;
    lockRef.current = false;
    if (dir && progress > 0.01) {
      animateProgress(progress, 0, dir, () => {
        applyReset();
        onTurnActiveRef.current?.(false);
      });
      return;
    }
    applyReset();
    onTurnActiveRef.current?.(false);
  }, [animateProgress, applyReset]);

  const startTurn = useCallback(
    (dir: TurnDirection) => {
      if (lockRef.current || gestureRef.current?.active) return;
      const from = leafPageRef.current;
      const target = dir === 'next' ? from + 1 : from - 1;
      const max = numPagesRef.current;
      if (target < 1 || target > max) return;
      lockRef.current = true;
      commitOnceRef.current = false;
      onTurnActiveRef.current?.(true);
      applyProgress(dir, 0.001);
      animateProgress(0, 1, dir, () => settleTo(dir, target));
    },
    [animateProgress, applyProgress, settleTo]
  );

  useImperativeHandle(
    ref,
    () => ({
      turn: startTurn,
      cancel: revertTurn,
    }),
    [revertTurn, startTurn]
  );

  useEffect(() => {
    if (lockRef.current) return;
    setSlots({
      leaf: props.pageNumber,
      next: props.pageNumber + 1,
      prev: props.pageNumber - 1,
    });
  }, [props.pageNumber]);

  useEffect(() => {
    const el = sceneRef.current;
    if (!el) return;
    const onMove = (event: TouchEvent) => {
      if (gestureRef.current?.active) event.preventDefault();
    };
    el.addEventListener('touchmove', onMove, { passive: false });
    return () => {
      el.removeEventListener('touchmove', onMove);
      cancelAnim();
    };
  }, [cancelAnim]);

  const handleLeafRender = useCallback(
    (page: pdfjs.PDFPageProxy) => {
      if (pendingLeafRef.current != null && page.pageNumber === pendingLeafRef.current) {
        finishSettle();
      }
    },
    [finishSettle]
  );

  const endGesture = useCallback(() => {
      const gesture = gestureRef.current;
      gestureRef.current = null;
      if (!gesture?.active || !gesture.dir) return;

      const page = leafPageRef.current;
      const max = numPagesRef.current;
      const blocked =
        (gesture.dir === 'next' && page >= max) || (gesture.dir === 'prev' && page <= 1);
      const progress = progressRef.current;
      const flick =
        gesture.dir === 'next' ? gesture.vx < -COMMIT_VELOCITY : gesture.vx > COMMIT_VELOCITY;
      const target = gesture.dir === 'next' ? page + 1 : page - 1;

      if (!blocked && (progress >= COMMIT_PROGRESS || (flick && progress > 0.08))) {
        lockRef.current = true;
        const dir = gesture.dir;
        if (progress >= 0.98) {
          settleTo(dir, target);
          return;
        }
        animateProgress(progress, 1, dir, () => settleTo(dir, target));
        return;
      }

      animateProgress(progress, 0, gesture.dir, () => {
        applyReset();
        onTurnActiveRef.current?.(false);
      });
    },
    [animateProgress, applyReset, settleTo]
  );

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (lockRef.current || gestureRef.current) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (!getCanTurnRef.current()) return;
    gestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startT: performance.now(),
      lastX: event.clientX,
      lastT: performance.now(),
      vx: 0,
      dir: null,
      active: false,
    };
  }, []);

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const gesture = gestureRef.current;
      if (!gesture || event.pointerId !== gesture.pointerId) return;
      if (lockRef.current && !gesture.active) {
        gestureRef.current = null;
        return;
      }

      const dx = event.clientX - gesture.startX;
      const dy = event.clientY - gesture.startY;

      if (!gesture.active) {
        if (!getCanTurnRef.current()) {
          gestureRef.current = null;
          return;
        }
        if (Math.abs(dy) > DRAG_START_PX && Math.abs(dy) > Math.abs(dx)) {
          gestureRef.current = null;
          return;
        }
        if (performance.now() - gesture.startT > 420 && Math.hypot(dx, dy) < DRAG_START_PX) {
          gestureRef.current = null;
          return;
        }
        if (Math.abs(dx) < DRAG_START_PX || Math.abs(dx) <= Math.abs(dy)) return;

        gesture.active = true;
        gesture.dir = dx < 0 ? 'next' : 'prev';
        onTurnActiveRef.current?.(true);
        event.currentTarget.setPointerCapture(event.pointerId);
      }

      if (!gesture.dir) return;

      const now = performance.now();
      const dt = now - gesture.lastT;
      if (dt > 0) gesture.vx = (event.clientX - gesture.lastX) / dt;
      gesture.lastX = event.clientX;
      gesture.lastT = now;

      const width = Math.max(1, leafRef.current?.getBoundingClientRect().width ?? 1);
      let progress = gesture.dir === 'next' ? -dx / width : dx / width;
      const page = leafPageRef.current;
      const max = numPagesRef.current;
      const blocked =
        (gesture.dir === 'next' && page >= max) || (gesture.dir === 'prev' && page <= 1);
      progress = blocked ? Math.min(Math.max(progress, 0), 0.07) : Math.max(0, Math.min(1, progress));
      applyProgress(gesture.dir, progress);
    },
    [applyProgress]
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!gestureRef.current || event.pointerId !== gestureRef.current.pointerId) return;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      endGesture();
    },
    [endGesture]
  );

  const pageProps = {
    width: props.pageWidth,
    scale: props.scale,
    loading: null as null,
    className: 'bg-white dark:bg-black',
  };

  const showPrev = props.numPages > 0 && slots.prev >= 1 && slots.prev <= props.numPages;
  const showNext = props.numPages > 0 && slots.next >= 1 && slots.next <= props.numPages;

  return (
    <div className="pdf-viewer-pdf-wrapper" data-show-border={props.showBookBorder}>
      <Document
        file={file}
        options={pdfDocOptions}
        onLoadSuccess={props.onDocumentLoadSuccess}
        onLoadError={props.onDocumentLoadError}
        onItemClick={props.onItemClick}
        loading={null}
        className={cn(props.showBookBorder && 'shadow-lg')}
      >
        <div
          ref={sceneRef}
          className={cn('pdf-turn-scene', props.panFree && 'pdf-turn-scene--free')}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {showPrev && (
            <div className="pdf-turn-under pdf-turn-under--prev" aria-hidden>
              <Page
                {...pageProps}
                pageNumber={slots.prev}
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
            </div>
          )}
          {showNext && (
            <div className="pdf-turn-under pdf-turn-under--next" aria-hidden>
              <Page
                {...pageProps}
                pageNumber={slots.next}
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
            </div>
          )}
          <div ref={leafRef} className="pdf-turn-leaf">
            <div className="pdf-turn-shade" />
            <Page
              {...pageProps}
              pageNumber={slots.leaf}
              renderTextLayer
              renderAnnotationLayer
              onRenderSuccess={handleLeafRender}
            />
          </div>
        </div>
      </Document>
    </div>
  );
});
