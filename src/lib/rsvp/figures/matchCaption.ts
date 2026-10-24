import { figureKind, figureKey, figureLabel, normalizeFigureNumber } from '@/lib/rsvp/figures/references';
import type { Box, FigureCue } from '@/lib/rsvp/figures/types';

export interface TextBox {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CaptionLine {
  text: string;
  box: Box;
}

const CAPTION =
  /^(figura|figure|fig\.?|tabla|table|cuadro|grafico|imagen|image|lamina|plate)\s+(\d+(?:[.\-–—]\d+)*)\b/;

export function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Group PDF text boxes into visual lines. Y grows upward. */
export function groupLines(items: readonly TextBox[]): CaptionLine[] {
  const sorted = items.filter((item) => item.text.trim()).sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: TextBox[][] = [];
  for (const item of sorted) {
    const current = lines[lines.length - 1];
    const previous = current?.[current.length - 1];
    const font = Math.max(item.height, previous?.height ?? 0, 1);
    if (!previous || Math.abs(item.y - previous.y) > font * 0.6) lines.push([item]);
    else current.push(item);
  }
  return lines.map((line) => {
    const ordered = [...line].sort((a, b) => a.x - b.x);
    const x = Math.min(...ordered.map((item) => item.x));
    const y = Math.min(...ordered.map((item) => item.y));
    const right = Math.max(...ordered.map((item) => item.x + item.width));
    const top = Math.max(...ordered.map((item) => item.y + item.height));
    return {
      text: ordered.map((item) => item.text.trim()).filter(Boolean).join(' '),
      box: { x, y, width: Math.max(0, right - x), height: Math.max(0, top - y) },
    };
  });
}

export function matchCaption(line: string): FigureCue | null {
  const match = CAPTION.exec(fold(line));
  if (!match) return null;
  const kind = figureKind(match[1]);
  const number = normalizeFigureNumber(match[2]);
  if (!number) return null;
  return { key: figureKey(kind, number), label: figureLabel(kind, number), kind, number };
}

export function captionBox(lines: readonly CaptionLine[], cue: FigureCue): Box | null {
  for (const line of lines) {
    const found = matchCaption(line.text);
    if (found?.key === cue.key) return line.box;
  }
  return null;
}

/** Captions on this page that the body never cites. */
export function orphanCaptions(lines: readonly CaptionLine[], mentioned: ReadonlySet<string>): FigureCue[] {
  const seen = new Set<string>();
  const orphans: FigureCue[] = [];
  for (const line of lines) {
    const cue = matchCaption(line.text);
    if (!cue || mentioned.has(cue.key) || seen.has(cue.key)) continue;
    seen.add(cue.key);
    orphans.push(cue);
  }
  return orphans;
}
