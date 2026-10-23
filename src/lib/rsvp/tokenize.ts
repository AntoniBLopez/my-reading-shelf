import { delayFactor } from '@/lib/rsvp/timing';

export interface RsvpToken {
  word: string;
  /** Index of the highlighted optimal recognition point inside `word`. */
  orpIndex: number;
  delayFactor: number;
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

export function tokenize(text: string): RsvpToken[] {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => ({
      word,
      orpIndex: orpIndex(word),
      delayFactor: delayFactor(word),
    }));
}
