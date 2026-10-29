import { PageFlip } from 'page-flip/dist/js/page-flip.module.js';
import { adaptCurlCanvas, enableRetinaCurlCanvas, paintBlankBack, punchRevealedPage, type FoldingPage } from '@/components/curlOverlay';
import { BLANK_REVEALED_PAGE, shouldSnapshotForCurl, snapshotCanvas } from '@/components/curlSheetBitmap';

export type CurlPoint = { x: number; y: number };

export type PageCurlSession = {
  move: (clientX: number, clientY: number) => void;
  /** Finish the peel if `shouldCommit`, otherwise let the sheet fall back. */
  release: (progress: number, shouldCommit: boolean) => void;
  destroy: () => void;
};

type CreatePageCurlArgs = {
  scene: HTMLElement;
  width: number;
  height: number;
  direction: 'next' | 'prev';
  current: HTMLCanvasElement;
  other: HTMLCanvasElement;
  invert: boolean;
  onResult: (committed: boolean) => void;
  /** Fires once the curl sheet is actually on screen. */
  onVisible?: () => void;
  /** Drop this curl when a newer turn has already taken the page. */
  isCancelled?: () => boolean;
  flippingTime?: number;
};

export async function createPageCurl(args: CreatePageCurlArgs): Promise<PageCurlSession> {
  const mirror = args.direction === 'prev';
  const currentUrl = shouldSnapshotForCurl('sheet')
    ? await snapshotCanvas(args.current, args.invert, mirror)
    : BLANK_REVEALED_PAGE;
  // The page underneath is the live PDF canvas. A snapshot here is what made the reveal soft.
  const otherUrl = shouldSnapshotForCurl('revealed')
    ? await snapshotCanvas(args.other, args.invert, mirror)
    : BLANK_REVEALED_PAGE;
  const snapshotUrls = [currentUrl, otherUrl];
  if (args.isCancelled?.() || !args.scene.isConnected) {
    for (const url of snapshotUrls) {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    }
    return {
      move: () => undefined,
      release: () => undefined,
      destroy: () => undefined,
    };
  }

  const host = document.createElement('div');
  host.className = mirror ? 'pdf-page-curl pdf-page-curl--mirror' : 'pdf-page-curl';
  args.scene.appendChild(host);

  // Prev is a forward curl of mirrored snapshots, then flipped back with CSS,
  // so the sheet peels from the left the same way next peels from the right.
  const images = [currentUrl, otherUrl];
  const successIndex = 1;

  const flip = new PageFlip(host, {
    width: Math.max(1, Math.round(args.width)),
    height: Math.max(1, Math.round(args.height)),
    size: 'fixed',
    usePortrait: true,
    showCover: false,
    drawShadow: true,
    maxShadowOpacity: args.invert ? 0.5 : 0.28,
    flippingTime: args.flippingTime ?? 520,
    useMouseEvents: false,
    showPageCorners: false,
    disableFlipByClick: false,
    mobileScrollSupport: true,
    swipeDistance: 8,
    startPage: 0,
    autoSize: false,
    clickEventForward: false,
  });

  let armed = false;
  let settled = false;
  let removed = false;
  let primed = false;
  let shown = false;
  let retried = false;
  let wantCommit = false;
  let queuedRelease: { progress: number; commit: boolean } | null = null;
  let queuedMove: CurlPoint | null = null;
  let last: CurlPoint = {
    x: args.width * 0.9,
    y: args.height * 0.72,
  };

  const toLib = (point: CurlPoint): CurlPoint =>
    mirror ? { x: args.width - point.x, y: point.y } : point;

  const localPoint = (clientX: number, clientY: number): CurlPoint => {
    const rect = host.getBoundingClientRect();
    const width = rect.width || args.width;
    const height = rect.height || args.height;
    return {
      x: Math.max(0, Math.min(width, clientX - rect.left)),
      y: Math.max(0, Math.min(height, clientY - rect.top)),
    };
  };

  const cornerFor = (point: CurlPoint): 'top' | 'bottom' => (point.y < args.height / 2 ? 'top' : 'bottom');

  const removeDom = () => {
    if (removed) return;
    removed = true;
    try {
      flip.destroy();
    } catch {
      host.remove();
    }
    for (const url of snapshotUrls) {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    }
  };

  const finish = (committed: boolean) => {
    if (settled) return;
    settled = true;
    args.onResult(committed);
    // A committed turn stays up until the real page has painted. Removing it here flashes the page.
    if (!committed) removeDom();
  };

  const playAuto = () => {
    flip.flipNext(cornerFor(last));
  };

  const pagesReady = () => {
    const canvas = host.querySelector('canvas');
    if (!canvas || canvas.width < 2 || canvas.height < 2) return false;
    const count = flip.getPageCount();
    if (count < 2) return false;
    for (let index = 0; index < count; index += 1) {
      let page: { isLoad?: boolean; image?: HTMLImageElement };
      try {
        page = flip.getPage(index);
      } catch {
        return false;
      }
      const image = page?.image;
      if (image && image.complete && image.naturalWidth > 0) page.isLoad = true;
      if (!page?.isLoad) return false;
    }
    return true;
  };

  flip.on('flip', (event) => {
    if (!armed || !wantCommit) return;
    if (event.data === successIndex) finish(true);
  });

  flip.on('changeState', (event) => {
    if (!armed || event.data !== 'read') return;
    if (!wantCommit) {
      finish(false);
      return;
    }
    const index = flip.getCurrentPageIndex();
    if (wantCommit && index === successIndex) {
      finish(true);
      return;
    }
    if (wantCommit && !retried) {
      retried = true;
      window.setTimeout(() => {
        if (!settled) playAuto();
      }, 0);
      return;
    }
    finish(false);
  });

  const showCurl = () => {
    if (shown || settled) return;
    host.classList.add('pdf-page-curl--ready');
    shown = true;
    args.onVisible?.();
    const pendingMove = queuedMove;
    queuedMove = null;
    if (pendingMove) track(pendingMove);
    const queued = queuedRelease;
    queuedRelease = null;
    if (queued) releaseNow(queued.progress, queued.commit);
  };

  const started = performance.now();
  let revealing = false;
  const reveal = () => {
    if (revealing || settled) return;
    revealing = true;
    let paintFrames = 0;
    const tick = () => {
      if (settled) return;
      if (pagesReady()) {
        paintFrames += 1;
        // Retina resize clears the canvas once; wait for a stable painted frame before swapping layers.
        if (paintFrames < 3) {
          window.requestAnimationFrame(tick);
          return;
        }
        showCurl();
        return;
      }
      if (performance.now() - started > 450) {
        finish(false);
        return;
      }
      window.requestAnimationFrame(tick);
    };
    window.requestAnimationFrame(tick);
  };
  flip.on('init', reveal);
  flip.loadFromImages(images);
  const render = (flip as { getRender?: () => { drawBookShadow?: () => void } }).getRender?.();
  if (render) render.drawBookShadow = () => undefined;
  enableRetinaCurlCanvas(host, flip, args.width, args.height, args.invert);
  const folding = flip.getPage(0) as FoldingPage;
  folding.draw = () => paintBlankBack(folding, args.invert);
  const revealed = flip.getPage(1) as FoldingPage;
  revealed.draw = () => punchRevealedPage(revealed);
  adaptCurlCanvas(host, args.invert);
  host.querySelector('canvas')?.style.setProperty('filter', 'none', 'important');
  window.setTimeout(reveal, 80);
  armed = true;

  const track = (point: CurlPoint) => {
    const lib = toLib(point);
    last = lib;
    if (!primed) {
      const anchor = { x: args.width * 0.9, y: lib.y };
      const nudge = { x: anchor.x - 12, y: anchor.y };
      flip.startUserTouch(anchor);
      flip.userMove(nudge, true);
      primed = true;
    }
    flip.userMove(lib, true);
  };

  const glideToCommit = () => {
    const from = last.x;
    const to = -1;
    let step = 0;
    const steps = 6;
    const frame = () => {
      if (settled) return;
      step += 1;
      const point = { x: from + ((to - from) * step) / steps, y: last.y };
      flip.userMove(point, true);
      last = point;
      if (step < steps) {
        window.requestAnimationFrame(frame);
        return;
      }
      flip.userStop(point, false);
    };
    window.requestAnimationFrame(frame);
  };

  const releaseNow = (progress: number, shouldCommit: boolean) => {
    if (settled) return;
    wantCommit = shouldCommit;
    if (!shouldCommit) {
      if (!primed) {
        finish(false);
        return;
      }
      const back = {
        x: args.width * 0.98,
        y: last.y,
      };
      flip.userMove(back, true);
      flip.userStop(back, false);
      window.setTimeout(() => {
        if (!settled) finish(false);
      }, 700);
      return;
    }
    if (!primed) {
      playAuto();
      return;
    }
    if (last.x <= 0) flip.userStop(last, false);
    else glideToCommit();
  };

  let moveFrame = 0;
  return {
    move(clientX, clientY) {
      if (settled || !armed) return;
      const point = localPoint(clientX, clientY);
      if (!shown) {
        queuedMove = point;
        return;
      }
      queuedMove = point;
      if (moveFrame) return;
      moveFrame = window.requestAnimationFrame(() => {
        moveFrame = 0;
        const next = queuedMove;
        queuedMove = null;
        if (next && !settled) track(next);
      });
    },
    release(progress, shouldCommit) {
      if (settled) return;
      if (!shown) {
        wantCommit = shouldCommit;
        queuedRelease = { progress, commit: shouldCommit };
        return;
      }
      releaseNow(progress, shouldCommit);
    },
    destroy() {
      settled = true;
      removeDom();
    },
  };
}
