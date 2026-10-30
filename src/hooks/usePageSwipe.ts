import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { flushSync } from 'react-dom';
import {
  clampPointerToBox,
  directionFromDx,
  gesturePhase,
  isEdgeBlocked,
  isTurnBlockedTarget,
  nextVelocity,
  shouldCommitTurn,
  targetPage,
  turnProgress,
  type PointerBox,
  type TurnDirection,
} from '@/lib/pageTurnGesture';
import { PageTurnSession, type CurlGesture } from '@/hooks/pageTurnSession';

type Gesture = CurlGesture & {
  pointerId: number;
  startX: number;
  startY: number;
  lastT: number;
  vx: number;
  dir: TurnDirection | null;
  top: number;
  bounds: PointerBox | null;
};

function measureBook(node: HTMLElement | null): { bounds: PointerBox; width: number; height: number } | null {
  const box = node?.getBoundingClientRect();
  if (!box || box.width < 1 || box.height < 1) return null;
  return {
    bounds: { left: box.left, top: box.top, right: box.right, bottom: box.bottom },
    width: box.width,
    height: box.height,
  };
}

function readerSurface(scene: HTMLElement | null): HTMLElement | null {
  const surface = scene?.closest('[data-reader-surface]');
  return surface instanceof HTMLElement ? surface : scene;
}

type UsePageSwipeArgs = {
  page: number;
  pageCount: number;
  enabled: () => boolean;
  leafRef: RefObject<HTMLElement | null>;
  sceneRef: RefObject<HTMLElement | null>;
  surfaceRef?: RefObject<HTMLElement | null>;
  onCommit: (page: number) => void;
  onBegin?: (gen: number) => void;
  onSettled?: (gen: number) => void;
  /** The curl is covering the leaf, or no curl will. The visible page may catch up. */
  onCovered?: () => void;
  /** Show the page the curl sheet is about to draw, not the page it reveals. */
  onAlign?: (page: number) => void;
  onActive?: (active: boolean) => void;
};

export function usePageSwipe({
  page,
  pageCount,
  enabled,
  leafRef,
  sceneRef,
  surfaceRef,
  onCommit,
  onBegin,
  onSettled,
  onCovered,
  onAlign,
  onActive,
}: UsePageSwipeArgs) {
  const pageRef = useRef(page);
  const pageCountRef = useRef(pageCount);
  const onCommitRef = useRef(onCommit);
  const onBeginRef = useRef(onBegin ?? (() => {}));
  const onSettledRef = useRef(onSettled ?? (() => {}));
  const onCoveredRef = useRef(onCovered ?? (() => {}));
  const onAlignRef = useRef(onAlign ?? (() => {}));
  const onActiveRef = useRef(onActive);
  const enabledRef = useRef(enabled);
  pageRef.current = page;
  pageCountRef.current = pageCount;
  onCommitRef.current = onCommit;
  onBeginRef.current = onBegin ?? (() => {});
  onSettledRef.current = onSettled ?? (() => {});
  onCoveredRef.current = onCovered ?? (() => {});
  onAlignRef.current = onAlign ?? (() => {});
  onActiveRef.current = onActive;
  enabledRef.current = enabled;

  const gestureRef = useRef<Gesture | null>(null);
  const pointersRef = useRef(new Set<number>());
  const rafRef = useRef(0);
  const pendingDirRef = useRef<TurnDirection | null>(null);
  const touchArmedRef = useRef(false);
  const touchHostRef = useRef<HTMLElement | null>(null);

  const blockTouchRef = useRef((event: TouchEvent) => {
    if (!gestureRef.current?.active || !event.cancelable) return;
    event.preventDefault();
  });

  const cancelFollow = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    pendingDirRef.current = null;
  };

  const disarmTouch = () => {
    const host = touchHostRef.current;
    if (!host || !touchArmedRef.current) return;
    host.removeEventListener('touchmove', blockTouchRef.current);
    touchArmedRef.current = false;
    touchHostRef.current = null;
  };

  const sessionRef = useRef<PageTurnSession | null>(null);
  if (!sessionRef.current) {
    sessionRef.current = new PageTurnSession({
      leafRef,
      sceneRef,
      onCommitRef,
      onBeginRef,
      onSettledRef,
      onCoveredRef,
      onActiveRef,
      gestureRef,
      cancelFollow,
      disarmTouch,
    });
  }
  const session = sessionRef.current;

  const armTouch = () => {
    const host = readerSurface(sceneRef.current);
    if (!host || touchArmedRef.current) return;
    host.addEventListener('touchmove', blockTouchRef.current, { passive: false });
    touchArmedRef.current = true;
    touchHostRef.current = host;
  };

  const drawFollow = () => {
    rafRef.current = 0;
    const dir = pendingDirRef.current;
    const gesture = gestureRef.current;
    if (!gesture?.active) return;
    session.setTurn(dir);
    session.markFollow(true);
    const leaf = leafRef.current;
    if (leaf) {
      leaf.style.transform = '';
      leaf.style.transformOrigin = '';
    }
    if (dir && gesture.dir) {
      const from = pageRef.current;
      const target = targetPage(from, gesture.dir);
      session.ensureCurl(gesture.dir, from, target);
      session.moveCurl(gesture.lastX, gesture.lastY);
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
      session.resetSheet();
      return;
    }
    const blocked = isEdgeBlocked(gesture.dir, pageRef.current, pageCountRef.current);
    const dx = gesture.lastX - gesture.startX;
    const progress = turnProgress(dx, gesture.width, gesture.dir);
    const commit = shouldCommitTurn({ progress, vx: gesture.vx, dir: gesture.dir, blocked });
    const target = targetPage(pageRef.current, gesture.dir);
    if (!commit || blocked) {
      if (session.hasCurl()) session.releaseCurl(progress, false);
      else session.resetSheet();
      return;
    }
    if (session.hasCurl()) session.releaseCurl(progress, true);
    session.finishCommit(target);
    session.revealIfIdle();
  };

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const gesture = gestureRef.current;
      if (!gesture || event.pointerId !== gesture.pointerId) return;
      if (!enabledRef.current()) {
        gestureRef.current = null;
        session.resetSheet();
        return;
      }
      const point = gesture.bounds
        ? clampPointerToBox(event.clientX, event.clientY, gesture.bounds)
        : { x: event.clientX, y: event.clientY };
      const dx = point.x - gesture.startX;
      const dy = point.y - gesture.startY;
      if (!gesture.active) {
        const phase = gesturePhase(dx, dy);
        if (phase === 'vertical') {
          gestureRef.current = null;
          return;
        }
        if (phase !== 'horizontal') return;
        gesture.active = true;
        session.cutCurl();
        session.beginGesture();
        flushSync(() => onAlignRef.current(pageRef.current));
        gesture.dir = directionFromDx(dx);
        armTouch();
      }
      if (!gesture.dir) return;
      const now = performance.now();
      gesture.vx = nextVelocity(gesture.vx, gesture.lastX, point.x, gesture.lastT, now);
      gesture.lastX = point.x;
      gesture.lastY = point.y;
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
    const onPointerDown = (event: PointerEvent) => {
      if (isTurnBlockedTarget(event.target)) return;
      pointersRef.current.add(event.pointerId);
      if (pointersRef.current.size > 1) {
        pointersRef.current.delete(event.pointerId);
        if (gestureRef.current && !session.isLocked()) session.resetSheet();
        return;
      }
      if (gestureRef.current) return;
      if (!enabledRef.current()) return;
      if (event.pointerType === 'mouse' && event.button !== 0) {
        pointersRef.current.delete(event.pointerId);
        return;
      }
      const book = measureBook(leafRef.current);
      if (!book) {
        pointersRef.current.delete(event.pointerId);
        return;
      }
      const point = clampPointerToBox(event.clientX, event.clientY, book.bounds);
      gestureRef.current = {
        pointerId: event.pointerId,
        startX: point.x,
        startY: point.y,
        lastX: point.x,
        lastY: point.y,
        lastT: performance.now(),
        vx: 0,
        dir: null,
        active: false,
        width: book.width,
        height: book.height,
        top: book.bounds.top,
        bounds: book.bounds,
      };
    };
    const surface = surfaceRef?.current ?? readerSurface(sceneRef.current);
    surface?.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      surface?.removeEventListener('pointerdown', onPointerDown);
      session.dispose();
      cancelFollow();
      disarmTouch();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    // The session and the listeners read the latest page through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const turn = useCallback((dir: TurnDirection) => {
    if (gestureRef.current?.active) return;
    if (!enabledRef.current()) return;
    if (isEdgeBlocked(dir, pageRef.current, pageCountRef.current)) return;
    const from = pageRef.current;
    const target = targetPage(from, dir);
    session.cutCurl();
    // Keep the leaf on the page the sheet will show. Committing first paints the
    // next page, and the curl then covers that with the previous one.
    flushSync(() => onAlignRef.current(from));
    session.setTurn(dir);
    const curling = session.ensureCurl(dir, from, target, true);
    session.beginGesture();
    session.finishCommit(target);
    if (!curling) onCoveredRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cancel = useCallback(() => {
    session.resetSheet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isLocked = useCallback(() => session.isLocked(), [session]);

  return { turn, cancel, settle: session.settle, isLocked };
}
