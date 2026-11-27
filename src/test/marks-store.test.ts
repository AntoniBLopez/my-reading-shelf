import { describe, expect, it } from 'vitest';
import { createGateway, dropBookMarks, sanitizeMarks } from '@/lib/marks/store';
import type { WordMark } from '@/lib/marks/types';

const mark: WordMark = {
  id: 'm1',
  normalized: 'bruma',
  display: 'bruma',
  colorIndex: 2,
  context: 'La bruma cubre el muelle.',
  learned: false,
  createdAt: 10,
  anchorBefore: 'La ',
  anchorAfter: ' cubre',
  pageNumber: 4,
  nodeIndex: 0,
  startOffset: 3,
};

describe('word mark storage', () => {
  it('should drop malformed records and keep the sentence', () => {
    expect(sanitizeMarks([{ id: 'ok', normalized: 'a', display: 'A', context: 'A está aquí.' }, null, { display: 'nope' }])).toEqual([
      expect.objectContaining({ id: 'ok', context: 'A está aquí.', pageNumber: 1 }),
    ]);
  });

  it('should keep marks per book and queue them until the network returns', async () => {
    localStorage.clear();
    const pushed: WordMark[][] = [];
    const remote = {
      async pull() {
        return [] as WordMark[];
      },
      async push(_userId: string, _bookId: string, marks: WordMark[]) {
        pushed.push(marks);
        return true;
      },
    };
    const offline = createGateway('reader', remote, () => false);
    await offline.save('book-a', [mark]);
    await offline.save('book-b', []);
    expect(await offline.load('book-a')).toEqual([mark]);
    expect(await offline.load('book-b')).toEqual([]);
    expect(pushed).toHaveLength(0);

    const online = createGateway('reader', remote, () => true);
    await online.flush('book-a');
    expect(pushed).toEqual([[mark]]);
    expect(await online.load('book-b')).toEqual([]);
  });

  it('should drop one book without clearing the other', async () => {
    localStorage.clear();
    const gateway = createGateway('reader', null, () => false);
    await gateway.save('book-a', [mark]);
    await gateway.save('book-b', [{ ...mark, id: 'm2', normalized: 'faro' }]);
    dropBookMarks('reader', 'book-a');
    expect(await gateway.load('book-a')).toEqual([]);
    expect(await gateway.load('book-b')).toEqual([expect.objectContaining({ id: 'm2' })]);
  });
});
