import { PageFlip } from 'page-flip/dist/js/page-flip.module.js';

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
};

function snapshotCanvas(source: HTMLCanvasElement, invert: boolean): string {
  const copy = document.createElement('canvas');
  copy.width = source.width;
  copy.height = source.height;
  const context = copy.getContext('2d');
  if (!context) return source.toDataURL('image/jpeg', 0.86);
  if (invert) context.filter = 'invert(1)';
  context.drawImage(source, 0, 0);
  return copy.toDataURL('image/jpeg', 0.86);
}

function preload(src: string): Promise<void> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = src;
  });
}

export async function createPageCurl(args: CreatePageCurlArgs): Promise<PageCurlSession> {
  const currentUrl = snapshotCanvas(args.current, args.invert);
  const otherUrl = snapshotCanvas(args.other, args.invert);
  await Promise.all([preload(currentUrl), preload(otherUrl)]);
  if (!args.scene.isConnected) {
    return {
      move: () => undefined,
      release: () => args.onResult(false),
      destroy: () => undefined,
    };
  }

  const host = document.createElement('div');
  host.className = 'pdf-page-curl';
  args.scene.appendChild(host);

  const images = args.direction === 'next' ? [currentUrl, otherUrl] : [otherUrl, currentUrl];
  const successIndex = args.direction === 'next' ? 1 : 0;

  const flip = new PageFlip(host, {
    width: Math.max(1, Math.round(args.width)),
    height: Math.max(1, Math.round(args.height)),
    size: 'fixed',
    usePortrait: true,
    showCover: false,
    drawShadow: true,
    maxShadowOpacity: 0.55,
    flippingTime: 520,
    useMouseEvents: false,
    showPageCorners: false,
    disableFlipByClick: false,
    mobileScrollSupport: true,
    swipeDistance: 8,
    startPage: args.direction === 'next' ? 0 : 1,
    autoSize: false,
    clickEventForward: false,
  });

  let armed = false;
  let settled = false;
  let removed = false;
  let primed = false;
  let retried = false;
  let wantCommit = false;
  let last: CurlPoint = {
    x: args.direction === 'next' ? args.width * 0.9 : args.width * 0.1,
    y: args.height * 0.72,
  };

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
  };

  const finish = (committed: boolean) => {
    if (settled) return;
    settled = true;
    if (!committed) removeDom();
    args.onResult(committed);
  };

  const playAuto = () => {
    const corner = cornerFor(last);
    if (args.direction === 'next') flip.flipNext(corner);
    else flip.flipPrev(corner);
  };

  flip.on('flip', (event) => {
    if (!armed || !wantCommit) return;
    if (event.data === successIndex) finish(true);
  });

  flip.on('changeState', (event) => {
    if (!armed || event.data !== 'read') return;
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

  await new Promise<void>((resolve) => {
    let ready = false;
    const done = () => {
      if (ready) return;
      ready = true;
      resolve();
    };
    flip.on('init', done);
    flip.loadFromImages(images);
    armed = true;
    window.setTimeout(done, 80);
  });

  const prime = (point: CurlPoint) => {
    if (primed || settled) return;
    const anchor = {
      x: args.direction === 'next' ? args.width * 0.9 : args.width * 0.1,
      y: point.y,
    };
    const nudge = {
      x: anchor.x + (args.direction === 'next' ? -12 : 12),
      y: anchor.y,
    };
    flip.startUserTouch(anchor);
    flip.userMove(nudge, true);
    primed = true;
    last = point;
    flip.userMove(point, true);
  };

  return {
    move(clientX, clientY) {
      if (settled) return;
      const point = localPoint(clientX, clientY);
      last = point;
      prime(point);
    },
    release(progress, shouldCommit) {
      if (settled) return;
      wantCommit = shouldCommit;
      if (!shouldCommit) {
        if (!primed) {
          finish(false);
          return;
        }
        const back = {
          x: args.direction === 'next' ? args.width * 0.98 : args.width * 0.02,
          y: last.y,
        };
        flip.userMove(back, true);
        flip.userStop(back, false);
        return;
      }
      if (!primed || progress < 0.5) {
        playAuto();
        return;
      }
      flip.userStop(last, false);
    },
    destroy() {
      settled = true;
      removeDom();
    },
  };
}
