import type { CaptionLine } from '@/lib/rsvp/figures/matchCaption';
import { matchCaption } from '@/lib/rsvp/figures/matchCaption';
import { findMentions } from '@/lib/rsvp/figures/references';
import type { Box } from '@/lib/rsvp/figures/types';
import { tokenize } from '@/lib/rsvp/tokenize';

type WordToken = { word: string; endsBlock?: boolean };

/**
 * The caption line sits directly under the graphic.
 * PDF y grows upward, so the caption top is at or just below the image bottom.
 */
export function isCaptionDirectlyBelow(caption: Box, image: Box): boolean {
  const overlap = Math.min(caption.x + caption.width, image.x + image.width) - Math.max(caption.x, image.x);
  if (overlap <= 0) return false;
  const gap = image.y - (caption.y + caption.height);
  const band = Math.max(caption.height * 2.5, 28);
  return gap >= -Math.max(4, caption.height * 0.35) && gap <= band;
}

function findSequence(tokens: readonly WordToken[], words: readonly string[], from: number): number {
  if (words.length === 0) return -1;
  for (let index = from; index <= tokens.length - words.length; index += 1) {
    let same = true;
    for (let offset = 0; offset < words.length; offset += 1) {
      if (tokens[index + offset]?.word !== words[offset]) {
        same = false;
        break;
      }
    }
    if (same) return index;
  }
  return -1;
}

/**
 * Token indexes of figure numbers whose own line is the caption under the image.
 * Lines are aligned to the token stream once, in reading order.
 */
export function captionNumberIndexes(
  tokens: readonly WordToken[],
  lines: readonly CaptionLine[],
  images: readonly Box[],
): number[] {
  const indexes: number[] = [];
  const pending = lines.map((line) => ({
    line,
    words: tokenize(line.text).map((token) => token.word),
  }));
  let cursor = 0;
  while (pending.length > 0 && cursor < tokens.length) {
    let best: { slot: number; at: number } | null = null;
    for (let slot = 0; slot < pending.length; slot += 1) {
      const words = pending[slot].words;
      if (words.length === 0) continue;
      const at = findSequence(tokens, words, cursor);
      if (at < 0) continue;
      if (!best || at < best.at) best = { slot, at };
    }
    if (!best) break;
    const { line, words } = pending[best.slot];
    pending.splice(best.slot, 1);
    cursor = best.at + words.length;
    if (!matchCaption(line.text) || !images.some((image) => isCaptionDirectlyBelow(line.box, image))) continue;
    const mention = findMentions(words)[0];
    if (mention) indexes.push(best.at + mention.endIndex);
  }
  return indexes;
}
