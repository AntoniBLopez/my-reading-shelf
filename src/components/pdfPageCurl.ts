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

function snapshotCanvas(source: HTMLCanvasElement, invert: boolean, mirror: boolean): string {
  const copy = document.createElement('canvas');
  copy.width = source.width;
  copy.height = source.height;
  const context = copy.getContext('2d');
  if (!context) return source.toDataURL('image/jpeg', 0.86);
  if (invert) context.filter = 'invert(1)';
  if (mirror) {
    context.translate(copy.width, 0);
    context.scale(-1, 1);
  }
  context.drawImage(source, 0, 0);
  return copy.toDataURL('image/jpeg', 0.86);
}

function isOpaqueWhite(style: CanvasRenderingContext2D['fillStyle']): boolean {
  if (typeof style !== 'string') return false;
  const value = style.replace(/\s/g, '').toLowerCase();
  return value === 'white' || value === '#fff' || value === '#ffffff' || value === 'rgb(255,255,255)';
}

function shadowAlpha(color: string): number | null {
  const match = /rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*([0-9.]+)\s*\)/i.exec(color);
  if (!match) return null;
  const alpha = Number(match[1]);
  return Number.isFinite(alpha) ? alpha : null;
}

/** Light mode: keep the black crease, but well below the library's 0.5 default. */
function softenLightShadow(color: string): string {
  const alpha = shadowAlpha(color);
  if (alpha == null) return color;
  return `rgba(0, 0, 0, ${Math.min(0.18, alpha * 0.36).toFixed(3)})`;
}

/** Dark mode: a black crease on a black page disappears. Use a faint light edge instead. */
function softenDarkShadow(color: string): string {
  const alpha = shadowAlpha(color);
  if (alpha == null) return color;
  return `rgba(255, 255, 255, ${Math.min(0.14, alpha * 0.28).toFixed(3)})`;
}

function adaptCurlCanvas(host: HTMLElement, dark: boolean) {
  const canvas = host.querySelector('canvas');
  const context = canvas?.getContext('2d');
  if (!context) return;

  const soften = dark ? softenDarkShadow : softenLightShadow;
  const createLinearGradient = context.createLinearGradient.bind(context);
  context.createLinearGradient = (x0, y0, x1, y1) => {
    const gradient = createLinearGradient(x0, y0, x1, y1);
    const addColorStop = gradient.addColorStop.bind(gradient);
    gradient.addColorStop = (offset, color) => {
      addColorStop(offset, soften(String(color)));
    };
    return gradient;
  };

  if (!dark) return;

  const fillRect = context.fillRect.bind(context);
  context.fillRect = (x, y, width, height) => {
    if (!isOpaqueWhite(context.fillStyle)) {
      fillRect(x, y, width, height);
      return;
    }
    const previous = context.fillStyle;
    context.fillStyle = '#000000';
    fillRect(x, y, width, height);
    context.fillStyle = previous;
  };
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
  const mirror = args.direction === 'prev';
  const currentUrl = snapshotCanvas(args.current, args.invert, mirror);
  const otherUrl = snapshotCanvas(args.other, args.invert, mirror);
  await Promise.all([preload(currentUrl), preload(otherUrl)]);
  if (!args.scene.isConnected) {
    return {
      move: () => undefined,
      release: () => args.onResult(false),
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
    flippingTime: 520,
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
  let retried = false;
  let wantCommit = false;
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
  };

  const finish = (committed: boolean) => {
    if (settled) return;
    settled = true;
    if (!committed) removeDom();
    args.onResult(committed);
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
    if (!armed || !wantCommit || event.data !== 'read') return;
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
    const started = performance.now();
    let waiting = false;
    const done = () => {
      if (waiting) return;
      waiting = true;
      let painted = false;
      const tick = () => {
        if (settled) {
          resolve();
          return;
        }
        const ready = pagesReady() || performance.now() - started > 450;
        if (!ready) {
          window.requestAnimationFrame(tick);
          return;
        }
        // The book canvas still shows its blank frame until the next draw. Stay hidden through that paint.
        if (!painted) {
          painted = true;
          window.requestAnimationFrame(() => window.requestAnimationFrame(tick));
          return;
        }
        host.classList.add('pdf-page-curl--ready');
        resolve();
      };
      window.requestAnimationFrame(tick);
    };
    flip.on('init', done);
    flip.loadFromImages(images);
    adaptCurlCanvas(host, args.invert);
    window.setTimeout(done, 80);
  });
  armed = true;

  const prime = (point: CurlPoint) => {
    if (primed || settled) return;
    const lib = toLib(point);
    const anchor = { x: args.width * 0.9, y: lib.y };
    const nudge = { x: anchor.x - 12, y: anchor.y };
    flip.startUserTouch(anchor);
    flip.userMove(nudge, true);
    primed = true;
    last = lib;
    flip.userMove(lib, true);
  };

  return {
    move(clientX, clientY) {
      if (settled) return;
      prime(localPoint(clientX, clientY));
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
          x: args.width * 0.98,
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
