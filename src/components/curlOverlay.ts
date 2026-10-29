import type { PageFlip } from 'page-flip/dist/js/page-flip.module.js';

export type FoldingPage = {
  state: {
    area: Array<{ x: number; y: number } | null>;
    position: { x: number; y: number };
    angle: number;
  };
  render: {
    getContext: () => CanvasRenderingContext2D;
    convertToGlobal: (point: { x: number; y: number }) => { x: number; y: number };
  };
  draw: () => void;
};

function withPageArea(page: FoldingPage, paint: (context: CanvasRenderingContext2D) => void) {
  const context = page.render.getContext();
  const origin = page.render.convertToGlobal(page.state.position);
  context.save();
  context.translate(origin.x, origin.y);
  context.beginPath();
  let moved = false;
  for (const point of page.state.area) {
    if (!point) continue;
    const global = page.render.convertToGlobal(point);
    context.lineTo(global.x - origin.x, global.y - origin.y);
    moved = true;
  }
  if (moved) {
    context.closePath();
    context.rotate(page.state.angle);
    paint(context);
  }
  context.restore();
}

/** Back of the folding sheet only. The flat front face still uses the page image. */
export function paintBlankBack(page: FoldingPage, dark: boolean) {
  withPageArea(page, (context) => {
    context.fillStyle = dark ? '#000000' : '#ffffff';
    context.fill();
  });
}

/**
 * Erase the reveal polygon from the turning-sheet bitmap.
 * page-flip draws that polygon with the bottom page; leaving it empty shows the live canvas.
 */
export function punchRevealedPage(page: FoldingPage) {
  withPageArea(page, (context) => {
    context.globalCompositeOperation = 'destination-out';
    context.fillStyle = '#000000';
    context.fill();
  });
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

type CurlFlipUi = {
  resizeCanvas?: () => void;
  getCanvas?: () => HTMLCanvasElement;
};

type CurlFlipRender = {
  canvas?: HTMLCanvasElement;
  drawFrame?: () => void;
  clear?: () => void;
  getContext?: () => CanvasRenderingContext2D;
};

/** Drop the previous frame. An opaque fill would hide the live page behind the curl. */
export function clearCurlFrame(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement, dpr: number) {
  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.restore();
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/** page-flip renders its canvas at CSS pixels; scale it up for the turning sheet on retina displays. */
export function enableRetinaCurlCanvas(
  host: HTMLElement,
  flip: PageFlip,
  cssWidth: number,
  cssHeight: number,
  _dark: boolean,
) {
  const ui = (flip as { getUI?: () => CurlFlipUi }).getUI?.();
  const render = (flip as { getRender?: () => CurlFlipRender }).getRender?.();
  const canvas = ui?.getCanvas?.() ?? host.querySelector('canvas');
  const context = render?.getContext?.();
  if (!canvas || !context || !render?.drawFrame || !render.clear) return;

  const cssW = Math.max(1, Math.round(cssWidth));
  const cssH = Math.max(1, Math.round(cssHeight));
  // The revealed page is the live canvas, not this bitmap. Cap the sheet so a 3x phone does not repaint it every frame.
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const syncCanvas = () => {
    const physicalW = Math.max(1, Math.round(cssW * dpr));
    const physicalH = Math.max(1, Math.round(cssH * dpr));
    if (canvas.width !== physicalW || canvas.height !== physicalH) {
      canvas.width = physicalW;
      canvas.height = physicalH;
    }
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
  };

  if (ui) ui.resizeCanvas = syncCanvas;
  syncCanvas();

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';

  render.clear = () => {
    clearCurlFrame(context, canvas, dpr);
  };

  const originalDrawFrame = render.drawFrame.bind(render);
  render.drawFrame = () => {
    syncCanvas();
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    originalDrawFrame();
  };
}

export function adaptCurlCanvas(host: HTMLElement, dark: boolean) {
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
