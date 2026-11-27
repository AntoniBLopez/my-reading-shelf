import { CACHE_PREFIX, OUTBOX_PREFIX } from './constants';
import type { WordMark } from './types';

export interface MarksRemote {
  pull(userId: string, bookId: string): Promise<WordMark[] | null>;
  push(userId: string, bookId: string, marks: WordMark[]): Promise<boolean>;
}

export interface MarksGateway {
  load(bookId: string): Promise<WordMark[]>;
  save(bookId: string, marks: WordMark[]): Promise<void>;
  flush(bookId: string): Promise<void>;
}

function cacheKey(userId: string): string {
  return `${CACHE_PREFIX}:${userId}`;
}

function outboxKey(userId: string): string {
  return `${OUTBOX_PREFIX}:${userId}`;
}

function readMap(key: string): Record<string, WordMark[]> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const next: Record<string, WordMark[]> = {};
    for (const [bookId, value] of Object.entries(parsed)) next[bookId] = sanitizeMarks(value);
    return next;
  } catch {
    return {};
  }
}

function writeMap(key: string, map: Record<string, WordMark[]>): void {
  localStorage.setItem(key, JSON.stringify(map));
}

export function sanitizeMarks(value: unknown): WordMark[] {
  if (!Array.isArray(value)) return [];
  return value.map(asMark).filter((mark): mark is WordMark => Boolean(mark));
}

function asMark(value: unknown): WordMark | null {
  if (!value || typeof value !== 'object') return null;
  const mark = value as Partial<WordMark>;
  if (typeof mark.id !== 'string' || typeof mark.normalized !== 'string' || typeof mark.display !== 'string') return null;
  return {
    id: mark.id,
    normalized: mark.normalized,
    display: mark.display,
    colorIndex: typeof mark.colorIndex === 'number' ? mark.colorIndex : 0,
    context: typeof mark.context === 'string' ? mark.context : '',
    learned: Boolean(mark.learned),
    createdAt: typeof mark.createdAt === 'number' ? mark.createdAt : 0,
    anchorBefore: typeof mark.anchorBefore === 'string' ? mark.anchorBefore : '',
    anchorAfter: typeof mark.anchorAfter === 'string' ? mark.anchorAfter : '',
    pageNumber: typeof mark.pageNumber === 'number' ? mark.pageNumber : 1,
    nodeIndex: typeof mark.nodeIndex === 'number' ? mark.nodeIndex : 0,
    startOffset: typeof mark.startOffset === 'number' ? mark.startOffset : 0,
  };
}

export function readCachedMarks(userId: string, bookId: string): WordMark[] {
  return readMap(cacheKey(userId))[bookId] ?? [];
}

export function dropBookMarks(userId: string, bookId: string): void {
  for (const key of [cacheKey(userId), outboxKey(userId)]) {
    const map = readMap(key);
    if (!(bookId in map)) continue;
    delete map[bookId];
    writeMap(key, map);
  }
}

export function createGateway(userId: string, remote: MarksRemote | null, online: () => boolean = () => navigator.onLine): MarksGateway {
  const persist = (bookId: string, marks: WordMark[]) => {
    const cached = readMap(cacheKey(userId));
    cached[bookId] = marks;
    writeMap(cacheKey(userId), cached);
  };
  const queue = (bookId: string, marks: WordMark[]) => {
    const pending = readMap(outboxKey(userId));
    pending[bookId] = marks;
    writeMap(outboxKey(userId), pending);
  };
  const dropQueue = (bookId: string) => {
    const pending = readMap(outboxKey(userId));
    if (!(bookId in pending)) return;
    delete pending[bookId];
    writeMap(outboxKey(userId), pending);
  };

  return {
    async load(bookId) {
      const pending = readMap(outboxKey(userId))[bookId];
      if (pending) return pending;
      const cached = readCachedMarks(userId, bookId);
      if (!remote || !online()) return cached;
      const pulled = await remote.pull(userId, bookId);
      if (!pulled) return cached;
      persist(bookId, pulled);
      return pulled;
    },
    async save(bookId, marks) {
      persist(bookId, marks);
      if (!remote) return;
      if (!online()) {
        queue(bookId, marks);
        return;
      }
      const ok = await remote.push(userId, bookId, marks);
      if (ok) dropQueue(bookId);
      else queue(bookId, marks);
    },
    async flush(bookId) {
      const pending = readMap(outboxKey(userId))[bookId];
      if (!pending || !remote || !online()) return;
      const ok = await remote.push(userId, bookId, pending);
      if (ok) dropQueue(bookId);
    },
  };
}
