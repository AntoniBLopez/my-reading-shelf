import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { flushSync } from 'react-dom';
import {
  directionFromDx,
  gesturePhase,
  GLIDE_MS,
  isEdgeBlocked,
  leafOffsetPx,
  nextVelocity,
  releaseOffsetPx,
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

type PendingPaint = {
  x: number;
  dir: TurnDirection | null;
};

const SETTLE_FALLBACK_MS = 480;

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

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
  const glideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef(0);
  const pendingPaintRef = useRef<PendingPaint | null>(null);
  const touchArmedRef = useRef(false);
  const paintModeRef = useRef<'follow' | 'glide' | 'rest'>('rest');

  const blockTouchRef = useRef((event: TouchEvent) => {
    if (!gestureRef.current?.active || !event.cancelable) return;
    event.preventDefault();
  });

  const clearGlide = () => {
    if (glideTimerRef.current != null) {
      clearTimeout(glideTimerRef.current);
      glideTimerRef.current = null;
    }
  };

  const clearSettle = () => {
    if (settleTimerRef.current != null) {
      clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
  };

  const cancelFollow = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    pendingPaintRef.current = null;
  };

  const paint = (x: number, mode: 'follow' | 'glide' | 'rest') => {
    const leaf = leafRef.current;
    if (!leaf) return;
    if (paintModeRef.current !== mode) {
      paintModeRef.current = mode;
      leaf.classList.toggle('pdf-turn-leaf--follow', mode === 'follow');
      leaf.classList.toggle('pdf-turn-leaf--glide', mode === 'glide');
    }
    leaf.style.transform = mode === 'rest' ? '' : `translate3d(${x}px,0,0)`;
  };

  const setTurn = (dir: TurnDirection | null) => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (dir) scene.dataset.turn = dir;
    else delete scene.dataset.turn;
  };

  const drawFollow = () => {
    rafRef.current = 0;
    const pending = pendingPaintRef.current;
    if (!pending) return;
    pendingPaintRef.current = null;
    setTurn(pending.dir);
    paint(pending.x, 'follow');
  };

  const scheduleFollow = (x: number, dir: TurnDirection | null) => {
    pendingPaintRef.current = { x, dir };
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(drawFollow);
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
    if (pendingTargetRef.current == null) return;
    pendingTargetRef.current = null;
    clearSettle();
    paint(0, 'rest');
    setTurn(null);
    lockRef.current = false;
    notifyActive(false);
  };

  const settle = useCallback((paintedPage?: number) => {
    if (pendingTargetRef.current == null) return;
    if (paintedPage != null && paintedPage !== pendingTargetRef.current) return;
    finishSettle();
  }, []);

  const finishCommit = (target: number) => {
    lockRef.current = true;
    pendingTargetRef.current = target;
    flushSync(() => {
      onCommitRef.current(target);
    });
    if (pendingTargetRef.current == null) return;
    clearSettle();
    settleTimerRef.current = setTimeout(finishSettle, SETTLE_FALLBACK_MS);
  };

  const glideTo = (x: number, then: () => void) => {
    clearGlide();
    if (prefersReducedMotion()) {
      paint(x, 'rest');
      then();
      return;
    }
    paint(x, 'glide');
    const leaf = leafRef.current;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      leaf?.removeEventListener('transitionend', finish);
      clearGlide();
      then();
    };
    leaf?.addEventListener('transitionend', finish);
    glideTimerRef.current = setTimeout(finish, GLIDE_MS + 40);
  };

  const resetSheet = () => {
    cancelFollow();
    disarmTouch();
    clearGlide();
    clearSettle();
    pendingTargetRef.current = null;
    paint(0, 'rest');
    setTurn(null);
    gestureRef.current = null;
    lockRef.current = false;
    notifyActive(false);
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
    const progress = turnProgress(gesture.lastX - gesture.startX, gesture.width, gesture.dir);
    const commit = shouldCommitTurn({ progress, vx: gesture.vx, dir: gesture.dir, blocked });
    lockRef.current = true;
    const dest = releaseOffsetPx(gesture.width, gesture.dir, commit);
    const target = targetPage(pageRef.current, gesture.dir);
    glideTo(dest, () => {
      if (commit) finishCommit(target);
      else resetSheet();
    });
  };

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const gesture = gestureRef.current;
      if (!gesture || event.pointerId !== gesture.pointerId || lockRef.current) return;
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
      scheduleFollow(leafOffsetPx(dx, gesture.width, gesture.dir, blocked), blocked ? null : gesture.dir);
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
      cancelFollow();
      disarmTouch();
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
    if (lockRef.current || gestureRef.current) return;
    if (!enabledRef.current()) return;
    if (event.pointerType === 'mouse' && event.button != null && event.button !== 0) return;
    const target = event.target;
    if (target instanceof Element && target.closest('a, button, input, textarea, select')) return;
    const width = Math.max(1, leafRef.current?.getBoundingClientRect().width || 1);
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
      width,
    };
  }, [leafRef]);

  const turn = useCallback((dir: TurnDirection) => {
    if (lockRef.current || gestureRef.current?.active) return;
    if (!enabledRef.current()) return;
    if (isEdgeBlocked(dir, pageRef.current, pageCountRef.current)) return;
    const width = Math.max(1, leafRef.current?.getBoundingClientRect().width || 1);
    const target = targetPage(pageRef.current, dir);
    lockRef.current = true;
    notifyActive(true);
    setTurn(dir);
    glideTo(releaseOffsetPx(width, dir, true), () => finishCommit(target));
  }, [leafRef]);

  const cancel = useCallback(() => {
    if (lockRef.current && !gestureRef.current) return;
    resetSheet();
  }, []);

  const isLocked = useCallback(
    () => lockRef.current || pendingTargetRef.current != null,
    []
  );

  return { onPointerDown, turn, cancel, settle, isLocked };
}
