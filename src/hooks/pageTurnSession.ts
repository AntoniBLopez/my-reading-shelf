import type { RefObject } from 'react';
import { flushSync } from 'react-dom';
import { createPageCurl, type PageCurlSession } from '@/components/pdfPageCurl';
import type { TurnDirection } from '@/lib/pageTurnGesture';

export type CurlGesture = {
  active: boolean;
  width: number;
  height: number;
  lastX: number;
  lastY: number;
};

type SessionHost = {
  leafRef: RefObject<HTMLElement | null>;
  sceneRef: RefObject<HTMLElement | null>;
  onCommitRef: { current: (page: number) => void };
  onBeginRef: { current: (gen: number) => void };
  onSettledRef: { current: (gen: number) => void };
  onActiveRef: { current: ((active: boolean) => void) | undefined };
  gestureRef: { current: CurlGesture | null };
  cancelFollow: () => void;
  disarmTouch: () => void;
};

const SETTLE_FALLBACK_MS = 480;

/** Curl lifetime for one mounted scene. A new gesture bumps `turnGen` so old timers do nothing. */
export class PageTurnSession {
  lock = false;
  pendingTarget: number | null = null;
  private notified = false;
  private painted = false;
  private curlSettled = false;
  private rush = false;
  private settleTimer: ReturnType<typeof setTimeout> | null = null;
  private curl: PageCurlSession | null = null;
  private curlGen = 0;
  private launching = false;
  private turnGen = 0;

  constructor(private host: SessionHost) {}

  isLocked(): boolean {
    return this.lock || this.pendingTarget != null;
  }

  private clearSettle() {
    if (this.settleTimer != null) {
      clearTimeout(this.settleTimer);
      this.settleTimer = null;
    }
  }

  private destroyCurl() {
    this.curlGen += 1;
    this.launching = false;
    this.curl?.destroy();
    this.curl = null;
    this.host.sceneRef.current?.querySelectorAll('.pdf-page-curl').forEach((node) => node.remove());
    this.host.leafRef.current?.classList.remove('pdf-turn-leaf--covered');
  }

  setTurn(dir: TurnDirection | null) {
    const scene = this.host.sceneRef.current;
    if (!scene) return;
    if (dir) scene.dataset.turn = dir;
    else delete scene.dataset.turn;
  }

  markFollow(following: boolean) {
    const leaf = this.host.leafRef.current;
    if (!leaf) return;
    leaf.classList.toggle('pdf-turn-leaf--follow', following);
    if (!following) {
      leaf.style.transform = '';
      leaf.style.transformOrigin = '';
    }
  }

  private paintedCanvas(pageNumber: number): HTMLCanvasElement | null {
    const scene = this.host.sceneRef.current;
    if (!scene) return null;
    const stamped = scene.querySelector(`canvas[data-page="${pageNumber}"]`);
    if (!(stamped instanceof HTMLCanvasElement) || stamped.closest('.pdf-page-curl')) return null;
    if (stamped.width < 2 || stamped.height < 2) return null;
    return stamped;
  }

  private notifyActive(active: boolean) {
    if (this.notified === active) return;
    this.notified = active;
    this.host.onActiveRef.current?.(active);
  }

  /** Release the pinned hole before the new curl reads the destination canvas. */
  beginGesture() {
    this.turnGen += 1;
    const gen = this.turnGen;
    flushSync(() => {
      this.host.onBeginRef.current(gen);
    });
    this.notifyActive(true);
  }

  private finishSettle(gen: number) {
    if (gen !== this.turnGen) return;
    if (this.pendingTarget == null && !this.curl && !this.launching) {
      this.lock = false;
      return;
    }
    this.pendingTarget = null;
    this.painted = false;
    this.curlSettled = false;
    this.clearSettle();
    this.destroyCurl();
    this.markFollow(false);
    this.setTurn(null);
    this.lock = false;
    this.notifyActive(false);
    this.host.onSettledRef.current(gen);
  }

  settle = (paintedPage?: number) => {
    if (this.pendingTarget == null) return;
    if (paintedPage != null && paintedPage !== this.pendingTarget) return;
    if ((this.curl || this.launching) && !this.curlSettled) {
      this.painted = true;
      return;
    }
    this.finishSettle(this.turnGen);
  };

  private armSettle(target: number, gen: number) {
    this.clearSettle();
    const started = performance.now();
    const tick = () => {
      this.settleTimer = null;
      if (this.pendingTarget !== target || this.turnGen !== gen) return;
      const curling = (this.curl != null || this.launching) && !this.curlSettled;
      if ((curling || !this.painted) && performance.now() - started < 1400) {
        this.settleTimer = setTimeout(tick, 64);
        return;
      }
      this.finishSettle(gen);
    };
    this.settleTimer = setTimeout(tick, SETTLE_FALLBACK_MS);
  }

  finishCommit(target: number) {
    const gen = this.turnGen;
    this.lock = false;
    this.pendingTarget = target;
    this.painted = false;
    this.curlSettled = false;
    flushSync(() => {
      this.host.onCommitRef.current(target);
    });
    if (this.pendingTarget == null || this.turnGen !== gen) return;
    this.armSettle(target, gen);
  }

  /** Drop a curl that is still playing so the next turn can start. */
  cutCurl() {
    if (this.curl || this.launching) this.rush = true;
    this.clearSettle();
    this.destroyCurl();
    this.curlSettled = false;
    this.lock = false;
  }

  resetSheet() {
    const gen = this.turnGen;
    this.host.cancelFollow();
    this.host.disarmTouch();
    this.clearSettle();
    this.pendingTarget = null;
    this.destroyCurl();
    this.markFollow(false);
    this.setTurn(null);
    this.host.gestureRef.current = null;
    this.lock = false;
    this.notifyActive(false);
    this.host.onSettledRef.current(gen);
  }

  moveCurl(x: number, y: number) {
    this.curl?.move(x, y);
  }

  releaseCurl(progress: number, commit: boolean) {
    this.curl?.release(progress, commit);
  }

  hasCurl(): boolean {
    return this.curl != null;
  }

  ensureCurl(dir: TurnDirection, from: number, target: number, auto = false): boolean {
    if (this.curl || this.launching) return true;
    const scene = this.host.sceneRef.current;
    const current = this.paintedCanvas(from);
    const other = this.paintedCanvas(target);
    const gesture = this.host.gestureRef.current;
    if (!scene || !current || !other || current === other) return false;
    const width = Math.max(1, gesture?.width || this.host.leafRef.current?.clientWidth || 1);
    const height = Math.max(1, gesture?.height || this.host.leafRef.current?.clientHeight || 1);
    const gen = ++this.curlGen;
    const flippingTime = this.rush ? 200 : 520;
    this.rush = false;
    this.launching = true;
    const turnGen = this.turnGen;
    void createPageCurl({
      scene,
      width,
      height,
      direction: dir,
      current,
      other,
      invert: document.documentElement.classList.contains('dark'),
      flippingTime,
      isCancelled: () => gen !== this.curlGen,
      onVisible: () => {
        if (gen !== this.curlGen) return;
        this.host.leafRef.current?.classList.add('pdf-turn-leaf--covered');
      },
      onResult: (committed) => {
        if (gen !== this.curlGen) return;
        this.launching = false;
        if (!committed) {
          if (this.pendingTarget == null) this.resetSheet();
          else this.finishSettle(turnGen);
          return;
        }
        this.curlSettled = true;
        if (this.pendingTarget == null) this.finishCommit(target);
        else if (this.painted) this.finishSettle(turnGen);
      },
    }).then((session) => {
      if (gen !== this.curlGen) {
        session.destroy();
        return;
      }
      this.curl = session;
      this.launching = false;
      const live = this.host.gestureRef.current;
      if (auto || !live?.active) session.release(1, true);
      else session.move(live.lastX, live.lastY);
    }).catch(() => {
      if (gen !== this.curlGen) return;
      this.launching = false;
      if (auto && this.pendingTarget == null) this.finishCommit(target);
    });
    return true;
  }

  dispose() {
    this.curlGen += 1;
    this.clearSettle();
    this.curl?.destroy();
    this.curl = null;
  }
}
