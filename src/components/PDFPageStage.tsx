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
import { createPageCurl, PageCurlSession } from '@/components/pdfPageCurl';

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
  lastY: number;
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
  const prevUnderRef = useRef<HTMLDivElement>(null);
  const nextUnderRef = useRef<HTMLDivElement>(null);
  const curlRef = useRef<PageCurlSession | null>(null);
  const curlGenRef = useRef(0);
  const pendingReleaseRef = useRef<{ progress: number; commit: boolean; x: number; y: number } | null>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const progressRef = useRef(0);
  const lockRef = useRef(false);
  const commitOnceRef = useRef(false);
  const pendingLeafRef = useRef<number | null>(null);
  const turnTargetRef = useRef<number | null>(null);
  const settleGenRef = useRef(0);
  const curlLaunchRef = useRef(false);
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

  const coverLeaf = useCallback((covered: boolean) => {
    leafRef.current?.classList.toggle('pdf-turn-leaf--covered', covered);
  }, []);

  const dropCurl = useCallback(() => {
    curlGenRef.current += 1;
    curlRef.current?.destroy();
    curlRef.current = null;
    sceneRef.current?.querySelectorAll('.pdf-page-curl').forEach((node) => node.remove());
    curlLaunchRef.current = false;
    pendingReleaseRef.current = null;
    coverLeaf(false);
  }, [coverLeaf]);

  const finishSettle = useCallback(() => {
    const target = pendingLeafRef.current;
    if (target == null) return;
    pendingLeafRef.current = null;
    if (turnTargetRef.current === target) turnTargetRef.current = null;
    dropCurl();
    setSlots({ leaf: target, next: target + 1, prev: target - 1 });
    lockRef.current = false;
    commitOnceRef.current = false;
    progressRef.current = 0;
    onTurnActiveRef.current?.(false);
  }, [dropCurl]);

  const rememberSettle = useCallback(
    (target: number) => {
      const gen = ++settleGenRef.current;
      pendingLeafRef.current = target;
      turnTargetRef.current = target;
      window.setTimeout(() => {
        if (settleGenRef.current !== gen) return;
        if (pendingLeafRef.current === target) finishSettle();
      }, 500);
    },
    [finishSettle]
  );

  const settleTo = useCallback(
    (target: number) => {
      if (commitOnceRef.current) return;
      const max = numPagesRef.current;
      if (target < 1 || target > max) {
        dropCurl();
        lockRef.current = false;
        onTurnActiveRef.current?.(false);
        return;
      }
      commitOnceRef.current = true;
      lockRef.current = true;
      setSlots((current) => ({ ...current, leaf: target }));
      onCommitRef.current(target);
      rememberSettle(target);
    },
    [dropCurl, rememberSettle]
  );

  const jumpTo = useCallback(
    (target: number) => {
      const max = numPagesRef.current;
      if (target < 1 || target > max) {
        dropCurl();
        lockRef.current = false;
        turnTargetRef.current = null;
        onTurnActiveRef.current?.(false);
        return;
      }
      dropCurl();
      commitOnceRef.current = true;
      lockRef.current = true;
      setSlots({ leaf: target, next: target + 1, prev: target - 1 });
      onCommitRef.current(target);
      onTurnActiveRef.current?.(false);
      rememberSettle(target);
    },
    [dropCurl, rememberSettle]
  );

  const pageCanvas = (root: HTMLElement | null) => {
    const canvas = root?.querySelector('canvas');
    if (!canvas || canvas.width < 2 || canvas.height < 2) return null;
    return canvas;
  };

  const launchCurl = useCallback(
    (dir: TurnDirection, target: number, auto: boolean) => {
      const scene = sceneRef.current;
      const leaf = leafRef.current;
      const current = pageCanvas(leaf);
      const other = pageCanvas(dir === 'next' ? nextUnderRef.current : prevUnderRef.current);
      if (!scene || !leaf || !current || !other) {
        settleTo(target);
        return;
      }

      const gen = ++curlGenRef.current;
      const rect = leaf.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) {
        settleTo(target);
        return;
      }
      void createPageCurl({
        scene,
        width: rect.width,
        height: rect.height,
        direction: dir,
        current,
        other,
        invert: document.documentElement.classList.contains('dark'),
        onVisible: () => {
          if (gen !== curlGenRef.current) return;
          coverLeaf(true);
        },
        onResult: (committed) => {
          if (gen !== curlGenRef.current) return;
          curlRef.current = null;
          if (committed) settleTo(target);
          else {
            coverLeaf(false);
            lockRef.current = false;
            commitOnceRef.current = false;
            curlLaunchRef.current = false;
            if (turnTargetRef.current === target) turnTargetRef.current = null;
            progressRef.current = 0;
            onTurnActiveRef.current?.(false);
          }
        },
      }).then((session) => {
        if (gen !== curlGenRef.current) {
          session.destroy();
          return;
        }
        curlRef.current = session;
        const pending = pendingReleaseRef.current;
        pendingReleaseRef.current = null;
        const gesture = gestureRef.current;
        if (pending) {
          session.move(pending.x, pending.y);
          session.release(pending.progress, pending.commit);
        } else if (auto || !gesture?.active) session.release(1, true);
        else session.move(gesture.lastX, gesture.lastY);
      }).catch(() => {
        if (gen !== curlGenRef.current) return;
        settleTo(target);
      });
    },
    [coverLeaf, settleTo]
  );

  const revertTurn = useCallback(() => {
    gestureRef.current = null;
    if (pendingLeafRef.current != null) return;
    dropCurl();
    lockRef.current = false;
    progressRef.current = 0;
    onTurnActiveRef.current?.(false);
  }, [dropCurl]);

  const startTurn = useCallback(
    (dir: TurnDirection) => {
      if (gestureRef.current?.active) return;
      const from = turnTargetRef.current ?? leafPageRef.current;
      const target = dir === 'next' ? from + 1 : from - 1;
      const max = numPagesRef.current;
      if (target < 1 || target > max) return;
      const busy = lockRef.current || curlLaunchRef.current || curlRef.current != null;
      if (busy) {
        jumpTo(target);
        return;
      }
      turnTargetRef.current = target;
      lockRef.current = true;
      commitOnceRef.current = false;
      curlLaunchRef.current = true;
      onTurnActiveRef.current?.(true);
      launchCurl(dir, target, true);
    },
    [jumpTo, launchCurl]
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
      dropCurl();
    };
  }, [dropCurl]);

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
      const shouldCommit = !blocked && (progress >= COMMIT_PROGRESS || (flick && progress > 0.08));
      lockRef.current = true;

      if (curlRef.current) {
        curlRef.current.release(progress, shouldCommit);
        return;
      }
      if (!curlLaunchRef.current || !shouldCommit) {
        dropCurl();
        lockRef.current = false;
        onTurnActiveRef.current?.(false);
        return;
      }
      pendingReleaseRef.current = { progress, commit: true, x: gesture.lastX, y: gesture.lastY };
    },
    [dropCurl]
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
      lastY: event.clientY,
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
        event.currentTarget.style.touchAction = 'none';
        event.currentTarget.setPointerCapture(event.pointerId);
      }

      if (!gesture.dir) return;

      const now = performance.now();
      const dt = now - gesture.lastT;
      if (dt > 0) gesture.vx = (event.clientX - gesture.lastX) / dt;
      gesture.lastX = event.clientX;
      gesture.lastY = event.clientY;
      gesture.lastT = now;

      const width = Math.max(1, leafRef.current?.getBoundingClientRect().width ?? 1);
      let progress = gesture.dir === 'next' ? -dx / width : dx / width;
      const page = leafPageRef.current;
      const max = numPagesRef.current;
      const blocked =
        (gesture.dir === 'next' && page >= max) || (gesture.dir === 'prev' && page <= 1);
      progress = blocked ? 0 : Math.max(0, Math.min(1, progress));
      progressRef.current = progress;

      if (!blocked && !curlLaunchRef.current) {
        curlLaunchRef.current = true;
        lockRef.current = true;
        const target = gesture.dir === 'next' ? page + 1 : page - 1;
        launchCurl(gesture.dir, target, false);
      }
      curlRef.current?.move(event.clientX, event.clientY);
    },
    [launchCurl]
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!gestureRef.current || event.pointerId !== gestureRef.current.pointerId) return;
      event.currentTarget.style.touchAction = '';
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
            <div ref={prevUnderRef} className="pdf-turn-under pdf-turn-under--prev" aria-hidden>
              <Page
                {...pageProps}
                pageNumber={slots.prev}
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
            </div>
          )}
          {showNext && (
            <div ref={nextUnderRef} className="pdf-turn-under pdf-turn-under--next" aria-hidden>
              <Page
                {...pageProps}
                pageNumber={slots.next}
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
            </div>
          )}
          <div ref={leafRef} className="pdf-turn-leaf">
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
