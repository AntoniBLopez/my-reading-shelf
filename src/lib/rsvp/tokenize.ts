import type { FigureCue } from '@/lib/rsvp/figures/types';
import { delayFactor } from '@/lib/rsvp/timing';

export interface RsvpToken {
  word: string;
  /** Index of the highlighted optimal recognition point inside `word`. */
  orpIndex: number;
  delayFactor: number;
  /** Present on the last word of the sentence that first mentions a figure or table. */
  figureAfter?: FigureCue;
  /** Last word before a paragraph or block break, even when it has no period. */
  endsBlock?: boolean;
}

/**
 * Spritz-style pivot, about one third into the word.
 * Leading punctuation (¿ ¡ ") is skipped so the colored letter is a real character.
 */
export function orpIndex(word: string): number {
  if (!word) return 0;
  const leading = word.match(/^[^\p{L}\p{N}]*/u)?.[0].length ?? 0;
  const core = word.slice(leading).replace(/[^\p{L}\p{N}]+$/u, '');
  const length = core.length;
  if (length === 0) return 0;
  const pivot = length <= 1 ? 0 : length <= 5 ? 1 : length <= 9 ? 2 : length <= 13 ? 3 : 4;
  return Math.min(word.length - 1, leading + pivot);
}

function stripInvisibles(text: string): string {
  return text
    .replace(/\u00AD/g, '')
    .replace(/\u200B/g, '')
    .replace(/\u200C/g, '')
    .replace(/\u200D/g, '')
    .replace(/\uFEFF/g, '');
}

/** Drop soft hyphens and zero-width characters, then trim. Empty results are discarded. */
export function cleanToken(raw: string): string {
  return stripInvisibles(raw).replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
}

export function tokenize(text: string): RsvpToken[] {
  const normalized = stripInvisibles(text).replace(/\u00A0/g, ' ').trim();
  const tokens: RsvpToken[] = [];
  const pattern = /\S+/g;
  let match: RegExpExecArray | null;
  let previousEnd = 0;
  while ((match = pattern.exec(normalized))) {
    const word = cleanToken(match[0]);
    const gap = normalized.slice(previousEnd, match.index);
    previousEnd = match.index + match[0].length;
    if (!word) continue;
    if (tokens.length > 0 && gap.includes('\n')) tokens[tokens.length - 1].endsBlock = true;
    tokens.push({
      word,
      orpIndex: orpIndex(word),
      delayFactor: delayFactor(word),
    });
  }
  if (tokens.length > 0) tokens[tokens.length - 1].endsBlock = true;
  return tokens;
}
