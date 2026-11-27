import { buildHighlightCss } from './palette';
import type { PaintItem } from './plan';

type HighlightLike = Set<AbstractRange> & { priority?: number };

const buckets = new Map<string, HighlightLike>();
let styled = false;

function supported(): boolean {
  return typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight !== 'undefined';
}

export function installHighlightStyles(): void {
  if (styled || typeof document === 'undefined') return;
  styled = true;
  const css = buildHighlightCss();
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  } catch {
    const style = document.createElement('style');
    style.dataset.markStyles = 'true';
    style.textContent = css;
    document.documentElement.append(style);
  }
}

export function paintHighlights(items: readonly PaintItem[]): void {
  if (!supported()) return;
  installHighlightStyles();
  const groups = new Map<string, Range[]>();
  for (const item of items) {
    const list = groups.get(item.name) ?? [];
    list.push(item.range);
    groups.set(item.name, list);
  }
  for (const [name, highlight] of buckets) {
    highlight.clear();
    if (!groups.has(name)) {
      CSS.highlights.delete(name);
      buckets.delete(name);
    }
  }
  for (const [name, ranges] of groups) {
    let highlight = buckets.get(name);
    if (!highlight) {
      highlight = new Highlight() as HighlightLike;
      try {
        highlight.priority = name.endsWith('-sel') ? 3 : name.endsWith('-flash') ? 2 : 1;
      } catch {
        /* priority is optional */
      }
      CSS.highlights.set(name, highlight as Highlight);
      buckets.set(name, highlight);
    }
    for (const range of ranges) highlight.add(range);
  }
}

export function clearHighlights(): void {
  if (!supported()) return;
  for (const [name, highlight] of buckets) {
    highlight.clear();
    CSS.highlights.delete(name);
  }
  buckets.clear();
}
