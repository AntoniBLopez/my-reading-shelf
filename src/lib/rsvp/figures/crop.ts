import type { Box, CropChoice } from '@/lib/rsvp/figures/types';

function overlapX(a: Box, b: Box): number {
  return Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
}

function gapY(image: Box, caption: Box): number {
  if (image.y >= caption.y + caption.height) return image.y - (caption.y + caption.height);
  if (caption.y >= image.y + image.height) return caption.y - (image.y + image.height);
  return 0;
}

function clampBox(page: Box, box: Box): Box {
  const x = Math.min(Math.max(box.x, page.x), page.x + page.width);
  const y = Math.min(Math.max(box.y, page.y), page.y + page.height);
  const right = Math.min(Math.max(box.x + box.width, page.x), page.x + page.width);
  const top = Math.min(Math.max(box.y + box.height, page.y), page.y + page.height);
  return { x, y, width: Math.max(1, right - x), height: Math.max(1, top - y) };
}

/**
 * Prefer the image object nearest the caption. Otherwise take a band above the
 * caption (PDF y grows upward, so the picture sits at a higher y). With no
 * caption, keep the whole page.
 */
export function chooseCrop(page: Box, caption: Box | null, images: readonly Box[]): CropChoice {
  if (!caption) return { box: page, source: 'page' };

  let best: { box: Box; gap: number } | null = null;
  for (const image of images) {
    if (overlapX(image, caption) <= 0) continue;
    const gap = gapY(image, caption);
    if (!best || gap < best.gap) best = { box: image, gap };
  }
  if (best && best.gap <= page.height * 0.5) return { box: clampBox(page, best.box), source: 'image' };

  const band = Math.min(page.height * 0.4, 240);
  const y = Math.max(page.y, Math.min(caption.y + caption.height, page.y + page.height - band));
  return {
    box: clampBox(page, { x: page.x, y, width: page.width, height: band }),
    source: 'caption',
  };
}
