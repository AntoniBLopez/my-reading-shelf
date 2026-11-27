import { ANCHOR_CHARS, MAX_SENTENCE, MAX_WORDS } from './constants';

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function cleanSelection(raw: string): string {
  return raw
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .replace(/[^\p{L}\p{N}'’-]+$/u, '');
}

export function countWords(value: string): number {
  const cleaned = value.trim();
  if (!cleaned) return 0;
  return cleaned.split(/\s+/).length;
}

export function selectionIssue(raw: string): 'empty' | 'too_long' | null {
  const cleaned = cleanSelection(raw);
  if (!cleaned) return 'empty';
  if (countWords(cleaned) > MAX_WORDS) return 'too_long';
  return null;
}

export function normalizeWord(value: string): string {
  return cleanSelection(value).toLowerCase();
}

export function wordPattern(normalized: string): RegExp {
  const parts = normalized.split(' ').filter(Boolean).map(escapeRegExp);
  if (!parts.length) return /$^/u;
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${parts.join('\\s+')})(?![\\p{L}\\p{N}])`, 'giu');
}

export function extractSentence(text: string, start: number, end: number): string {
  let from = 0;
  for (let index = start - 1; index >= 0; index -= 1) {
    const char = text[index];
    if (char === '.' || char === '!' || char === '?' || char === '\n') {
      from = index + 1;
      break;
    }
  }
  let to = text.length;
  for (let index = end; index < text.length; index += 1) {
    const char = text[index];
    if (char === '.' || char === '!' || char === '?' || char === '\n') {
      to = char === '\n' ? index : index + 1;
      break;
    }
  }
  const sentence = text.slice(from, to).replace(/\s+/g, ' ').trim();
  if (sentence.length <= MAX_SENTENCE) return sentence;
  return sentence.slice(0, MAX_SENTENCE).trim();
}

export function anchorsFor(text: string, start: number, end: number): { before: string; after: string } {
  return {
    before: text.slice(Math.max(0, start - ANCHOR_CHARS), start),
    after: text.slice(end, end + ANCHOR_CHARS),
  };
}

export function scoreAnchor(before: string, after: string, wantBefore: string, wantAfter: string): number {
  let score = 0;
  const back = Math.min(before.length, wantBefore.length);
  for (let index = 1; index <= back; index += 1) {
    if (before[before.length - index] !== wantBefore[wantBefore.length - index]) break;
    score += 1;
  }
  const forward = Math.min(after.length, wantAfter.length);
  for (let index = 0; index < forward; index += 1) {
    if (after[index] !== wantAfter[index]) break;
    score += 1;
  }
  return score;
}
