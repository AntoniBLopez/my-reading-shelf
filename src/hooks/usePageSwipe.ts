import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { flushSync } from 'react-dom';
import { createPageCurl, type PageCurlSession } from '@/components/pdfPageCurl';
import {
  directionFromDx,
  gesturePhase,
  isEdgeBlocked,
  nextVelocity,
  shouldCommitTurn,
  targetPage,
  turnProgress,
  type TurnDirection,
} from '@/lib/pageTurnGesture';

type Gesture = {
  pointerId: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  lastT: number;
  vx: number;
  dir: TurnDirection | null;
  active: boolean;
  width: number;
  height: number;
  top: number;
};

type UsePageSwipeArgs = {
  page: number;
  pageCount: number;
  enabled: () => boolean;
  leafRef: RefObject<HTMLElement | null>;
  sceneRef: RefObject<HTMLElement | null>;
  onCommit: (page: number) => void;
  onActive?: (active: boolean) => void;
};

const SETTLE_FALLBACK_MS = 480;

export function usePageSwipe({ page, pageCount, enabled, leafRef, sceneRef, onCommit, onActive }: UsePageSwipeArgs) {
  const pageRef = useRef(page);
  const pageCountRef = useRef(pageCount);
  const onCommitRef = useRef(onCommit);
  const onActiveRef = useRef(onActive);
  const enabledRef = useRef(enabled);
  pageRef.current = page;
  pageCountRef.current = pageCount;
  onCommitRef.current = onCommit;
  onActiveRef.current = onActive;
  enabledRef.current = enabled;

  const notifiedRef = useRef(false);
  const gestureRef = useRef<Gesture | null>(null);
  const pointersRef = useRef(new Set<number>());
  const lockRef = useRef(false);
  const pendingTargetRef = useRef<number | null>(null);
  const paintedRef = useRef(false);
  const curlSettledRef = useRef(false);
  const rushRef = useRef(false);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef(0);
  const pendingDirRef = useRef<TurnDirection | null>(null);
  const touchArmedRef = useRef(false);
  const curlRef = useRef<PageCurlSession | null>(null);
  const curlGenRef = useRef(0);
  const launchingRef = useRef(false);

  const blockTouchRef = useRef((event: TouchEvent) => {
    if (!gestureRef.current?.active || !event.cancelable) return;
    event.preventDefault();
  });

  const clearSettle = () => {
    if (settleTimerRef.current != null) {
      clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
  };

  const cancelFollow = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    pendingDirRef.current = null;
  };

  const destroyCurl = () => {
    curlGenRef.current += 1;
    launchingRef.current = false;
    curlRef.current?.destroy();
    curlRef.current = null;
    sceneRef.current?.querySelectorAll('.pdf-page-curl').forEach((node) => node.remove());
    leafRef.current?.classList.remove('pdf-turn-leaf--covered');
  };

  const setTurn = (dir: TurnDirection | null) => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (dir) scene.dataset.turn = dir;
    else delete scene.dataset.turn;
  };

  const markFollow = (following: boolean) => {
    const leaf = leafRef.current;
    if (!leaf) return;
    leaf.classList.toggle('pdf-turn-leaf--follow', following);
    if (!following) {
      leaf.style.transform = '';
      leaf.style.transformOrigin = '';
    }
  };

  const paintedCanvas = (pageNumber: number): HTMLCanvasElement | null => {
    const scene = sceneRef.current;
    if (!scene) return null;
    const stamped = scene.querySelector(`canvas[data-page="${pageNumber}"]`);
    if (!(stamped instanceof HTMLCanvasElement) || stamped.closest('.pdf-page-curl')) return null;
    if (stamped.width < 2 || stamped.height < 2) return null;
    return stamped;
  };

  const disarmTouch = () => {
    const scene = sceneRef.current;
    if (!scene || !touchArmedRef.current) return;
    scene.removeEventListener('touchmove', blockTouchRef.current);
    touchArmedRef.current = false;
  };

  const armTouch = () => {
    const scene = sceneRef.current;
    if (!scene || touchArmedRef.current) return;
    scene.addEventListener('touchmove', blockTouchRef.current, { passive: false });
    touchArmedRef.current = true;
  };

  const notifyActive = (active: boolean) => {
    if (notifiedRef.current === active) return;
    notifiedRef.current = active;
    onActiveRef.current?.(active);
  };

  const finishSettle = () => {
    if (pendingTargetRef.current == null && !curlRef.current && !launchingRef.current) {
      lockRef.current = false;
      return;
    }
    pendingTargetRef.current = null;
    paintedRef.current = false;
    curlSettledRef.current = false;
    clearSettle();
    destroyCurl();
    markFollow(false);
    setTurn(null);
    lockRef.current = false;
    notifyActive(false);
  };

  const settle = useCallback((paintedPage?: number) => {
    if (pendingTargetRef.current == null) return;
    if (paintedPage != null && paintedPage !== pendingTargetRef.current) return;
    // The fold is still the old bitmaps. Leave it up until it finishes.
    if ((curlRef.current || launchingRef.current) && !curlSettledRef.current) {
      paintedRef.current = true;
      return;
    }
    finishSettle();
    // finishSettle closes over the latest refs. settle is stable for the page stage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const armSettle = (target: number) => {
    clearSettle();
    const started = performance.now();
    const tick = () => {
      settleTimerRef.current = null;
      if (pendingTargetRef.current !== target) return;
      const curling = (curlRef.current != null || launchingRef.current) && !curlSettledRef.current;
      // Keep the sheet until the fold ends and the new page has painted.
      // A new turn does not wait for this timer.
      if ((curling || !paintedRef.current) && performance.now() - started < 1400) {
        settleTimerRef.current = setTimeout(tick, 64);
        return;
      }
      finishSettle();
    };
    settleTimerRef.current = setTimeout(tick, SETTLE_FALLBACK_MS);
  };

  const finishCommit = (target: number) => {
    // The page changes now. The curl and the PDF render are not a gate.
    lockRef.current = false;
    pendingTargetRef.current = target;
    paintedRef.current = false;
    curlSettledRef.current = false;
    flushSync(() => {
      onCommitRef.current(target);
    });
    if (pendingTargetRef.current == null) return;
    armSettle(target);
  };

  /** Drop a curl that is still playing so the next turn can start. */
  const cutCurl = () => {
    if (curlRef.current || launchingRef.current) rushRef.current = true;
    clearSettle();
    destroyCurl();
    curlSettledRef.current = false;
    lockRef.current = false;
  };

  const resetSheet = () => {
    cancelFollow();
    disarmTouch();
    clearSettle();
    pendingTargetRef.current = null;
    destroyCurl();
    markFollow(false);
    setTurn(null);
    gestureRef.current = null;
    lockRef.current = false;
    notifyActive(false);
  };

  const ensureCurl = (dir: TurnDirection, from: number, target: number, auto = false) => {
    if (curlRef.current || launchingRef.current) return true;
    const scene = sceneRef.current;
    const current = paintedCanvas(from);
    const other = paintedCanvas(target);
    const gesture = gestureRef.current;
    if (!scene || !current || !other || current === other) return false;
    const width = Math.max(1, gesture?.width || leafRef.current?.clientWidth || 1);
    const height = Math.max(1, gesture?.height || leafRef.current?.clientHeight || 1);
    const gen = ++curlGenRef.current;
    const flippingTime = rushRef.current ? 200 : 520;
    rushRef.current = false;
    launchingRef.current = true;
    void createPageCurl({
      scene,
      width,
      height,
      direction: dir,
      current,
      other,
      invert: document.documentElement.classList.contains('dark'),
      flippingTime,
      isCancelled: () => gen !== curlGenRef.current,
      onVisible: () => {
        if (gen !== curlGenRef.current) return;
        leafRef.current?.classList.add('pdf-turn-leaf--covered');
      },
      onResult: (committed) => {
        if (gen !== curlGenRef.current) return;
        launchingRef.current = false;
        if (!committed) {
          if (pendingTargetRef.current == null) resetSheet();
          else finishSettle();
          return;
        }
        curlSettledRef.current = true;
        if (pendingTargetRef.current == null) finishCommit(target);
        else if (paintedRef.current) finishSettle();
      },
    }).then((session) => {
      if (gen !== curlGenRef.current) {
        session.destroy();
        return;
      }
      curlRef.current = session;
      launchingRef.current = false;
      const live = gestureRef.current;
      if (auto || !live?.active) session.release(1, true);
      else session.move(live.lastX, live.lastY);
    }).catch(() => {
      if (gen !== curlGenRef.current) return;
      launchingRef.current = false;
      if (auto && pendingTargetRef.current == null) finishCommit(target);
    });
    return true;
  };

  const drawFollow = () => {
    rafRef.current = 0;
    const dir = pendingDirRef.current;
    const gesture = gestureRef.current;
    if (!gesture?.active) return;
    setTurn(dir);
    markFollow(true);
    const leaf = leafRef.current;
    if (leaf) {
      leaf.style.transform = '';
      leaf.style.transformOrigin = '';
    }
    if (dir && gesture.dir) {
      const from = pageRef.current;
      const target = targetPage(from, gesture.dir);
      ensureCurl(gesture.dir, from, target);
      curlRef.current?.move(gesture.lastX, gesture.lastY);
    }
  };

  const scheduleFollow = (dir: TurnDirection | null) => {
    pendingDirRef.current = dir;
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(drawFollow);
  };

  const releaseGesture = () => {
    const gesture = gestureRef.current;
    gestureRef.current = null;
    cancelFollow();
    disarmTouch();
    if (!gesture?.active || !gesture.dir) {
      resetSheet();
      return;
    }
    const blocked = isEdgeBlocked(gesture.dir, pageRef.current, pageCountRef.current);
    const dx = gesture.lastX - gesture.startX;
    const progress = turnProgress(dx, gesture.width, gesture.dir);
    const commit = shouldCommitTurn({ progress, vx: gesture.vx, dir: gesture.dir, blocked });
    const target = targetPage(pageRef.current, gesture.dir);
    if (!commit || blocked) {
      if (curlRef.current) curlRef.current.release(progress, false);
      else resetSheet();
      return;
    }
    if (curlRef.current) curlRef.current.release(progress, true);
    finishCommit(target);
  };

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const gesture = gestureRef.current;
      if (!gesture || event.pointerId !== gesture.pointerId) return;
      if (!enabledRef.current()) {
        gestureRef.current = null;
        resetSheet();
        return;
      }
      const dx = event.clientX - gesture.startX;
      const dy = event.clientY - gesture.startY;
      if (!gesture.active) {
        const phase = gesturePhase(dx, dy);
        if (phase === 'vertical') {
          gestureRef.current = null;
          return;
        }
        if (phase !== 'horizontal') return;
        gesture.active = true;
        // A fold still on screen must not swallow this drag.
        cutCurl();
        gesture.dir = directionFromDx(dx);
        notifyActive(true);
        armTouch();
      }
      if (!gesture.dir) return;
      const now = performance.now();
      gesture.vx = nextVelocity(gesture.vx, gesture.lastX, event.clientX, gesture.lastT, now);
      gesture.lastX = event.clientX;
      gesture.lastY = event.clientY;
      gesture.lastT = now;
      const blocked = isEdgeBlocked(gesture.dir, pageRef.current, pageCountRef.current);
      scheduleFollow(blocked ? null : gesture.dir);
    };
    const onUp = (event: PointerEvent) => {
      pointersRef.current.delete(event.pointerId);
      const gesture = gestureRef.current;
      if (!gesture || event.pointerId !== gesture.pointerId) return;
      releaseGesture();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      curlGenRef.current += 1;
      cancelFollow();
      disarmTouch();
      curlRef.current?.destroy();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    // Listeners read the latest page through refs. The scene node stays mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    pointersRef.current.add(event.pointerId);
    if (pointersRef.current.size > 1) {
      pointersRef.current.delete(event.pointerId);
      if (gestureRef.current && !lockRef.current) resetSheet();
      return;
    }
    if (gestureRef.current) return;
    if (!enabledRef.current()) return;
    if (event.pointerType === 'mouse' && event.button != null && event.button !== 0) return;
    const target = event.target;
    if (target instanceof Element && target.closest('a, button, input, textarea, select')) return;
    const box = leafRef.current?.getBoundingClientRect();
    gestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      lastT: performance.now(),
      vx: 0,
      dir: null,
      active: false,
      width: Math.max(1, box?.width || 1),
      height: Math.max(1, box?.height || 1),
      top: box?.top || 0,
    };
    // The gesture helpers close over refs and stay correct for the mounted scene.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leafRef]);

  const turn = useCallback((dir: TurnDirection) => {
    if (gestureRef.current?.active) return;
    if (!enabledRef.current()) return;
    if (isEdgeBlocked(dir, pageRef.current, pageCountRef.current)) return;
    cutCurl();
    const from = pageRef.current;
    const target = targetPage(from, dir);
    notifyActive(true);
    setTurn(dir);
    ensureCurl(dir, from, target, true);
    finishCommit(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cancel = useCallback(() => {
    resetSheet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isLocked = useCallback(
    () => lockRef.current || pendingTargetRef.current != null,
    []
  );

  return { onPointerDown, turn, cancel, settle, isLocked };
}
