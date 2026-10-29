import { describe, expect, it } from 'vitest';
import { pageDelta, reduceTurn, shownNeighbor, slotsForPage } from '@/lib/pageTurnSlots';
import type { TurnDirection } from '@/lib/pageTurnGesture';

const BOOK = 8;

describe('page turn slots', () => {
  it('should keep the page index still when a drag starts and moves', () => {
    const start = slotsForPage(2);
    const dragging = reduceTurn(reduceTurn(start, { type: 'drag-start' }, BOOK), { type: 'move' }, BOOK);
    expect(pageDelta(start.leaf, dragging.leaf)).toBe(0);
    expect(shownNeighbor(dragging, 'next') - dragging.leaf).toBe(1);
    expect(shownNeighbor(dragging, 'prev') - dragging.leaf).toBe(-1);
  });

  it('should advance exactly one page on drop and keep that page in the hole', () => {
    const start = slotsForPage(2);
    const seen = shownNeighbor(start, 'next');
    const landed = reduceTurn(start, { type: 'drop', dir: 'next' }, BOOK);
    expect(pageDelta(start.leaf, landed.leaf)).toBe(1);
    expect(landed.leaf).toBe(seen);
    expect(shownNeighbor(landed, 'next')).toBe(landed.leaf);
    expect(shownNeighbor(landed, 'next')).not.toBe(landed.next);
  });

  it('should go back exactly one page and keep that page in the hole', () => {
    const start = slotsForPage(5);
    const seen = shownNeighbor(start, 'prev');
    const landed = reduceTurn(start, { type: 'drop', dir: 'prev' }, BOOK);
    expect(pageDelta(start.leaf, landed.leaf)).toBe(-1);
    expect(landed.leaf).toBe(seen);
    expect(shownNeighbor(landed, 'prev')).toBe(landed.leaf);
  });

  it('should return to the original page when the drag is cancelled', () => {
    const start = slotsForPage(2);
    const dragging = reduceTurn(start, { type: 'drag-start' }, BOOK);
    const cancelled = reduceTurn(dragging, { type: 'cancel' }, BOOK);
    expect(pageDelta(start.leaf, cancelled.leaf)).toBe(0);
    expect(cancelled.hole).toBeNull();
    expect(shownNeighbor(cancelled, 'next') - cancelled.leaf).toBe(1);
  });

  it('should apply each rapid turn as a single step', () => {
    const dirs: TurnDirection[] = ['next', 'next', 'prev', 'next'];
    let slots = slotsForPage(2);
    const steps: number[] = [];
    for (const dir of dirs) {
      const before = slots.leaf;
      const seen = shownNeighbor(slots.hole ? slotsForPage(slots.leaf) : slots, dir);
      slots = reduceTurn(slotsForPage(slots.leaf), { type: 'drop', dir }, BOOK);
      steps.push(pageDelta(before, slots.leaf));
      expect(shownNeighbor(slots, dir)).toBe(slots.leaf);
      expect(slots.leaf).toBe(seen);
    }
    expect(steps).toEqual([1, 1, -1, 1]);
    expect(slots.leaf).toBe(4);
  });

  it('should not move past either end of the book', () => {
    const atStart = reduceTurn(slotsForPage(1), { type: 'drop', dir: 'prev' }, BOOK);
    const atEnd = reduceTurn(slotsForPage(BOOK), { type: 'drop', dir: 'next' }, BOOK);
    expect(pageDelta(1, atStart.leaf)).toBe(0);
    expect(pageDelta(BOOK, atEnd.leaf)).toBe(0);
  });

  it('should clear the hole when the curl settles without another step', () => {
    const landed = reduceTurn(slotsForPage(2), { type: 'drop', dir: 'next' }, BOOK);
    const settled = reduceTurn(landed, { type: 'settle' }, BOOK);
    expect(pageDelta(landed.leaf, settled.leaf)).toBe(0);
    expect(settled.hole).toBeNull();
    expect(shownNeighbor(settled, 'next') - settled.leaf).toBe(1);
  });

  it('should reveal only the next page on a slow drag after rapid drops that never settled', () => {
    let slots = slotsForPage(2);
    for (let step = 0; step < 4; step += 1) {
      const origin = slots.leaf;
      slots = reduceTurn(slots, { type: 'drag-start' }, BOOK);
      const revealed = shownNeighbor(slots, 'next');
      expect(revealed).toBe(origin + 1);
      slots = reduceTurn(slots, { type: 'drop', dir: 'next' }, BOOK);
      expect(slots.leaf).toBe(origin + 1);
      expect(shownNeighbor(slots, 'next')).toBe(origin + 1);
    }

    const origin = slots.leaf;
    const staleGen = 1;
    slots = reduceTurn(slots, { type: 'drag-start' }, BOOK);
    expect(shownNeighbor(slots, 'next')).toBe(origin + 1);
    const interrupted = reduceTurn(slots, { type: 'settle', gen: staleGen }, BOOK);
    expect(interrupted.leaf).toBe(origin);
    expect(shownNeighbor(interrupted, 'next')).toBe(origin + 1);
    slots = reduceTurn(interrupted, { type: 'drop', dir: 'next' }, BOOK);
    expect(slots.leaf).toBe(origin + 1);
    expect(shownNeighbor(slots, 'next')).toBe(origin + 1);
  });
});
