import { describe, expect, it } from 'vitest';
import { extractSentence, normalizeWord, selectionIssue } from '@/lib/marks/text';
import { toggleWord } from '@/lib/marks/model';
import { findHits } from '@/lib/marks/scan';
import { selectedHitIndex } from '@/lib/marks/model';

describe('word mark text', () => {
  it('should reject an empty selection and a phrase longer than four words', () => {
    expect(selectionIssue('   ')).toBe('empty');
    expect(selectionIssue('uno dos tres cuatro cinco')).toBe('too_long');
    expect(selectionIssue('  ¡Bruma! ')).toBeNull();
    expect(normalizeWord('  ¡Bruma! ')).toBe('bruma');
  });

  it('should keep the sentence around the marked word', () => {
    const text = 'Llegó tarde. La bruma cubre el muelle. Siguió andando.';
    const start = text.indexOf('bruma');
    expect(extractSentence(text, start, start + 5)).toBe('La bruma cubre el muelle.');
  });

  it('should give each word its own color and free that color when the word is removed', () => {
    const first = toggleWord([], blank('bruma'));
    const second = toggleWord(first.marks, blank('muelle'));
    expect(second.marks.map((mark) => mark.colorIndex)).toEqual([0, 1]);
    const removed = toggleWord(second.marks, blank('bruma'));
    expect(removed.action).toBe('unmarked');
    const third = toggleWord(removed.marks, blank('faro'));
    expect(third.marks.map((mark) => mark.colorIndex)).toEqual([1, 0]);
  });

  it('should treat the chosen occurrence as selected only on its page', () => {
    const root = document.createElement('div');
    root.innerHTML = '<span>bruma</span><span> y bruma</span>';
    const { hits } = findHits(root, 'bruma', document);
    expect(hits).toHaveLength(2);
    const chosen = hits[1];
    const index = selectedHitIndex(hits, {
      learned: false,
      pageNumber: 3,
      nodeIndex: chosen.nodeIndex,
      startOffset: chosen.start,
      anchorBefore: chosen.before,
      anchorAfter: chosen.after,
    }, 3);
    expect(index).toBe(1);
    expect(selectedHitIndex(hits, {
      learned: false,
      pageNumber: 3,
      nodeIndex: chosen.nodeIndex,
      startOffset: chosen.start,
      anchorBefore: chosen.before,
      anchorAfter: chosen.after,
    }, 4)).toBe(-1);
  });
});

function blank(word: string) {
  return {
    normalized: word,
    display: word,
    context: word,
    anchorBefore: '',
    anchorAfter: '',
    pageNumber: 1,
    nodeIndex: 0,
    startOffset: 0,
  };
}
