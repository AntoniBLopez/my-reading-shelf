import { useEffect, useState, type RefObject } from 'react';
import { clearHighlights, paintHighlights } from '@/lib/marks/paint';
import { planHighlights } from '@/lib/marks/plan';
import { layerRoot } from '@/lib/marks/scan';
import type { WordMark } from '@/lib/marks/types';

function sameCounts(left: Record<string, number>, right: Record<string, number>): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key) => left[key] === right[key]);
}

/** Repaint after the page settles. A curl (`data-turn`) does not walk the text layer. */
export function useHighlightLayer(
  surfaceRef: RefObject<HTMLElement | null>,
  marks: readonly WordMark[],
  pageNumber: number,
  flashIds: readonly string[],
  active: boolean,
): Record<string, number> {
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface || !active) {
      clearHighlights();
      setCounts((current) => (Object.keys(current).length === 0 ? current : {}));
      return undefined;
    }
    let frame = 0;
    const paint = () => {
      if (surface.querySelector('[data-turn]')) return;
      const layer = layerRoot(surface);
      const host = layer instanceof Element ? layer : surface;
      const planned = planHighlights(host, marks, pageNumber, document, new Set(flashIds));
      paintHighlights(planned.items);
      setCounts((current) => (sameCounts(current, planned.counts) ? current : planned.counts));
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(paint);
    };
    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(surface, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-turn'] });
    const theme = new MutationObserver(schedule);
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      theme.disconnect();
      clearHighlights();
    };
  }, [surfaceRef, marks, pageNumber, flashIds, active]);

  return counts;
}
