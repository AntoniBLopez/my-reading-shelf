import type { FigureCue, FigureKind } from '@/lib/rsvp/figures/types';

const LABEL =
  /^(?:figura|figure|fig\.?|tabla|table|cuadro|gr[aá]fico|imagen|image|l[aá]mina|plate)$/i;
const NUMBER = /^[[(]?(\d+(?:\.\d+)*)[)\].:;,!?]*$/;

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

export function findMentions(words: readonly string[]): FigureMention[] {
  const mentions: FigureMention[] = [];
  for (let index = 0; index < words.length - 1; index += 1) {
    if (!LABEL.test(words[index])) continue;
    const match = NUMBER.exec(words[index + 1]);
    if (!match) continue;
    const kind = figureKind(words[index]);
    const number = match[1];
    mentions.push({
      cue: { key: figureKey(kind, number), label: figureLabel(kind, number), kind, number },
      endIndex: index + 1,
    });
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
