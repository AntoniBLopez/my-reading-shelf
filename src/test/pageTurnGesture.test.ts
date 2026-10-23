import { describe, expect, it } from 'vitest';
import {
  COMMIT_PROGRESS,
  COMMIT_VELOCITY,
  directionFromDx,
  DRAG_START_PX,
  gesturePhase,
  isEdgeBlocked,
  leafOffsetPx,
  nextVelocity,
  releaseOffsetPx,
  shouldCommitTurn,
  targetPage,
  turnProgress,
} from '@/lib/pageTurnGesture';

describe('page turn gesture', () => {
  it('keeps a drag pending until it is clearly horizontal or vertical', () => {
    expect(gesturePhase(0, 0)).toBe('pending');
    expect(gesturePhase(DRAG_START_PX - 1, 0)).toBe('pending');
    expect(gesturePhase(DRAG_START_PX, DRAG_START_PX)).toBe('pending');
    expect(gesturePhase(DRAG_START_PX, 0)).toBe('horizontal');
    expect(gesturePhase(30, 10)).toBe('horizontal');
    expect(gesturePhase(0, DRAG_START_PX + 1)).toBe('vertical');
    expect(gesturePhase(10, 30)).toBe('vertical');
  });

  it('maps finger direction to the page that should be revealed', () => {
    expect(directionFromDx(-1)).toBe('next');
    expect(directionFromDx(4)).toBe('prev');
    expect(targetPage(4, 'next')).toBe(5);
    expect(targetPage(4, 'prev')).toBe(3);
  });

  it('blocks the edge page and every page when the book is empty', () => {
    expect(isEdgeBlocked('prev', 1, 8)).toBe(true);
    expect(isEdgeBlocked('next', 8, 8)).toBe(true);
    expect(isEdgeBlocked('next', 1, 1)).toBe(true);
    expect(isEdgeBlocked('next', 2, 8)).toBe(false);
    expect(isEdgeBlocked('prev', 2, 8)).toBe(false);
    expect(isEdgeBlocked('next', 1, 0)).toBe(true);
  });

  it('follows the finger 1:1 and only resists an edge', () => {
    expect(leafOffsetPx(-120, 300, 'next', false)).toBe(-120);
    expect(leafOffsetPx(40, 300, 'next', false)).toBe(0);
    expect(leafOffsetPx(-900, 300, 'next', false)).toBe(-300);
    expect(leafOffsetPx(80, 300, 'prev', false)).toBe(80);
    expect(leafOffsetPx(-20, 300, 'prev', false)).toBe(0);
    const resisted = leafOffsetPx(-200, 300, 'next', true);
    expect(Math.abs(resisted)).toBeLessThan(50);
    expect(resisted).toBeLessThan(0);
  });

  it('measures progress across the page and ignores the wrong direction', () => {
    expect(turnProgress(-150, 300, 'next')).toBeCloseTo(0.5);
    expect(turnProgress(150, 300, 'next')).toBe(0);
    expect(turnProgress(300, 200, 'prev')).toBe(1);
  });

  it('keeps the previous velocity when the sample is too short to trust', () => {
    expect(nextVelocity(1.2, 10, 11, 100, 107)).toBe(1.2);
    expect(nextVelocity(0, 10, 26, 100, 108)).toBeCloseTo(2);
    expect(nextVelocity(0, 40, 10, 100, 116)).toBeCloseTo(-1.875);
  });

  it('commits on distance or a flick and never on a blocked edge', () => {
    expect(shouldCommitTurn({ progress: COMMIT_PROGRESS, vx: 0, dir: 'next', blocked: false })).toBe(true);
    expect(shouldCommitTurn({ progress: COMMIT_PROGRESS - 0.01, vx: 0, dir: 'next', blocked: false })).toBe(false);
    expect(
      shouldCommitTurn({ progress: 0.1, vx: -(COMMIT_VELOCITY + 0.01), dir: 'next', blocked: false })
    ).toBe(true);
    expect(shouldCommitTurn({ progress: 0.1, vx: -COMMIT_VELOCITY, dir: 'next', blocked: false })).toBe(false);
    expect(shouldCommitTurn({ progress: 0.08, vx: -2, dir: 'next', blocked: false })).toBe(false);
    expect(shouldCommitTurn({ progress: 0.2, vx: COMMIT_VELOCITY + 0.1, dir: 'prev', blocked: false })).toBe(true);
    expect(shouldCommitTurn({ progress: 1, vx: -4, dir: 'next', blocked: true })).toBe(false);
  });

  it('parks a committed sheet off the page and returns a cancelled one home', () => {
    expect(releaseOffsetPx(300, 'next', true)).toBe(-300);
    expect(releaseOffsetPx(300, 'prev', true)).toBe(300);
    expect(releaseOffsetPx(300, 'next', false)).toBe(0);
  });
});
