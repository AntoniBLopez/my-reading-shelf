import { nextColorIndex } from './palette';
import { scoreAnchor } from './text';
import type { NewMarkInput, WordMark } from './types';
import type { WordHit } from './scan';

export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function toggleWord(
  marks: readonly WordMark[],
  input: NewMarkInput,
): { marks: WordMark[]; action: 'marked' | 'unmarked'; mark: WordMark } {
  const existing = marks.find((mark) => mark.normalized === input.normalized);
  if (existing) {
    return { marks: marks.filter((mark) => mark.id !== existing.id), action: 'unmarked', mark: existing };
  }
  const mark: WordMark = {
    id: createId(),
    normalized: input.normalized,
    display: input.display,
    colorIndex: nextColorIndex(marks.map((item) => item.colorIndex)),
    context: input.context,
    learned: false,
    createdAt: Date.now(),
    anchorBefore: input.anchorBefore,
    anchorAfter: input.anchorAfter,
    pageNumber: input.pageNumber,
    nodeIndex: input.nodeIndex,
    startOffset: input.startOffset,
  };
  return { marks: [...marks, mark], action: 'marked', mark };
}

export function removeMark(marks: readonly WordMark[], id: string): { marks: WordMark[]; removed?: WordMark } {
  const removed = marks.find((mark) => mark.id === id);
  return { marks: marks.filter((mark) => mark.id !== id), removed };
}

export function setLearned(marks: readonly WordMark[], id: string, learned: boolean): WordMark[] {
  return marks.map((mark) => (mark.id === id ? { ...mark, learned } : mark));
}

/** The marked page keeps one stronger occurrence. Other pages stay on the lighter pass. */
export function selectedHitIndex(hits: readonly WordHit[], mark: Pick<WordMark, 'pageNumber' | 'nodeIndex' | 'startOffset' | 'anchorBefore' | 'anchorAfter' | 'learned'>, pageNumber: number): number {
  if (mark.learned || mark.pageNumber !== pageNumber || hits.length === 0) return -1;
  let best = 0;
  let score = -1;
  hits.forEach((hit, index) => {
    const exact = hit.nodeIndex === mark.nodeIndex && hit.start === mark.startOffset ? 1000 : 0;
    const next = exact + scoreAnchor(hit.before, hit.after, mark.anchorBefore, mark.anchorAfter);
    if (next > score) {
      score = next;
      best = index;
    }
  });
  return best;
}
