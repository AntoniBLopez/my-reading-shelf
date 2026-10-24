import type { FigureCue, FigureKind } from '@/lib/rsvp/figures/types';

const LABEL_BODY = 'figura|figure|fig\\.?|tabla|table|cuadro|gr[aá]fico|imagen|image|l[aá]mina|plate';
const LABEL = new RegExp(`^(?:${LABEL_BODY})$`, 'i');
const COMBINED = new RegExp(`^(${LABEL_BODY})\\s*(\\d+(?:[.\\-–—]\\d+)*)$`, 'i');
const NUMBER_PIECE = /^[[(]?[\d.\-–—]+[)\].:;,!?]*$/;

export interface FigureMention {
  cue: FigureCue;
  /** Index of the number token that closes the reference. */
  endIndex: number;
}

export function figureKind(label: string): FigureKind {
  const folded = label.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\.$/, '');
  if (folded === 'tabla' || folded === 'table' || folded === 'cuadro') return 'table';
  return 'figure';
}

export function figureKey(kind: FigureKind, number: string): string {
  return `${kind}:${number}`;
}

export function figureLabel(kind: FigureKind, number: string): string {
  return `${kind === 'table' ? 'Tabla' : 'Figura'} ${number}`;
}

/** `1.1`, `1-1`, `1–1`, and a trailing dot all become the same key. */
export function normalizeFigureNumber(raw: string): string | null {
  const collapsed = raw
    .replace(/[^\d.\-–—]/g, '')
    .replace(/[–—-]/g, '.')
    .replace(/\.+/g, '.')
    .replace(/^\./, '')
    .replace(/\.$/, '');
  if (!/^\d+(?:\.\d+)*$/.test(collapsed)) return null;
  return collapsed;
}

function readNumber(words: readonly string[], start: number): { number: string; endIndex: number } | null {
  let raw = '';
  let end = start - 1;
  for (let index = start; index < Math.min(words.length, start + 4); index += 1) {
    const token = words[index];
    if (!NUMBER_PIECE.test(token)) break;
    raw += token.replace(/[^\d.\-–—]/g, '');
    end = index;
    if (/\d[.\-–—]\d/.test(token)) break;
  }
  const number = normalizeFigureNumber(raw);
  if (!number) return null;
  return { number, endIndex: end };
}

function mentionAt(words: readonly string[], index: number): FigureMention | null {
  const combined = COMBINED.exec(words[index] ?? '');
  if (combined) {
    const number = normalizeFigureNumber(combined[2]);
    if (!number) return null;
    const kind = figureKind(combined[1]);
    return {
      cue: { key: figureKey(kind, number), label: figureLabel(kind, number), kind, number },
      endIndex: index,
    };
  }
  if (!LABEL.test(words[index] ?? '')) return null;
  const number = readNumber(words, index + 1);
  if (!number) return null;
  const kind = figureKind(words[index]);
  return {
    cue: { key: figureKey(kind, number.number), label: figureLabel(kind, number.number), kind, number: number.number },
    endIndex: number.endIndex,
  };
}

export function findMentions(words: readonly string[]): FigureMention[] {
  const mentions: FigureMention[] = [];
  for (let index = 0; index < words.length; index += 1) {
    const mention = mentionAt(words, index);
    if (!mention) continue;
    mentions.push(mention);
    index = mention.endIndex;
  }
  return mentions;
}

export function mentionKeys(words: readonly string[]): Set<string> {
  return new Set(findMentions(words).map((mention) => mention.cue.key));
}

/** Attach each figure to the last word of its first mention. Later mentions stay words. */
export function attachFigureCues<T extends { word: string }>(tokens: readonly T[]): (T & { figureAfter?: FigureCue })[] {
  const seen = new Set<string>();
  const cueAt = new Map<number, FigureCue>();
  for (const mention of findMentions(tokens.map((token) => token.word))) {
    if (seen.has(mention.cue.key)) continue;
    seen.add(mention.cue.key);
    cueAt.set(mention.endIndex, mention.cue);
  }
  return tokens.map((token, index) => {
    const cue = cueAt.get(index);
    return cue ? { ...token, figureAfter: cue } : { ...token };
  });
}
