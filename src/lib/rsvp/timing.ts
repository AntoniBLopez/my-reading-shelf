import { clampWpm } from '@/lib/rsvp/wpm';

const SENTENCE_END = /(?:[.!?…]|\.\.\.)['")\]]*$/;
const CLAUSE_BREAK = /[,;:–—]['")\]]*$/;

/** A word that closes a sentence: period, question mark, exclamation, or ellipsis. */
export function endsSentence(word: string): boolean {
  return SENTENCE_END.test(word);
}

/** Extra hold for punctuation and long words. The larger pause wins. */
export function delayFactor(word: string): number {
  let factor = 1;
  if (endsSentence(word)) factor = 2;
  else if (CLAUSE_BREAK.test(word)) factor = 1.5;

  const letters = word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').length;
  if (letters >= 12) factor = Math.max(factor, 1.4);
  else if (letters >= 8) factor = Math.max(factor, 1.25);
  return factor;
}

/** Milliseconds the current word stays on screen. */
export function wordDelayMs(wpm: number, factor: number): number {
  const safeFactor = Number.isFinite(factor) && factor > 0 ? factor : 1;
  return (60_000 / clampWpm(wpm)) * safeFactor;
}
