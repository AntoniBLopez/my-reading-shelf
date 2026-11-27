import { elementIsDark, filterInverts } from './luminance';
import { selectedHitIndex } from './model';
import { highlightName, paletteColor } from './palette';
import { findHits } from './scan';
import type { HighlightKind, ThemeName, WordMark } from './types';

export interface PaintItem {
  range: Range;
  name: string;
  color: string;
}

export function planHighlights(
  root: ParentNode,
  marks: readonly WordMark[],
  pageNumber: number,
  doc: Document,
  flashIds: ReadonlySet<string>,
): { items: PaintItem[]; counts: Record<string, number> } {
  const theme: ThemeName = themeFor(root);
  const inverted = root instanceof Element ? filterInverts(root) : false;
  const items: PaintItem[] = [];
  const counts: Record<string, number> = {};
  for (const mark of marks) {
    const { hits } = findHits(root, mark.normalized, doc);
    counts[mark.id] = hits.length;
    const selected = selectedHitIndex(hits, mark, pageNumber);
    hits.forEach((hit, index) => {
      const kind = kindFor(mark, index === selected, flashIds.has(mark.id));
      items.push({
        range: hit.range,
        name: highlightName(mark.colorIndex, theme, kind, inverted),
        color: paletteColor(mark.colorIndex),
      });
    });
  }
  return { items, counts };
}

function themeFor(root: ParentNode): ThemeName {
  if (document.documentElement.classList.contains('dark')) return 'dark';
  if (root instanceof Element && elementIsDark(root)) return 'dark';
  return 'light';
}

function kindFor(mark: WordMark, selected: boolean, flashing: boolean): HighlightKind {
  if (mark.learned) return 'learned';
  if (selected) return 'sel';
  if (flashing) return 'flash';
  return 'other';
}
