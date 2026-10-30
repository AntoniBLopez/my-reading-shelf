import { describe, expect, it } from 'vitest';
import {
  COMMIT_PROGRESS,
  COMMIT_VELOCITY,
  clampPointerToBox,
  directionFromDx,
  DRAG_START_PX,
  gesturePhase,
  isEdgeBlocked,
  isTurnBlockedTarget,
  leafOffsetPx,
  nextVelocity,
  releaseOffsetPx,
  pageAfterTurns,
  shouldCommitTurn,
  targetPage,
  turnDirectionFromKey,
  turnProgress,
} from '@/lib/pageTurnGesture';

describe('page turn gesture', () => {
  it('should keep a drag pending until it is clearly horizontal or vertical', () => {
    expect(gesturePhase(0, 0)).toBe('pending');
    expect(gesturePhase(DRAG_START_PX - 1, 0)).toBe('pending');
    expect(gesturePhase(DRAG_START_PX, DRAG_START_PX)).toBe('pending');
    expect(gesturePhase(DRAG_START_PX, 0)).toBe('horizontal');
    expect(gesturePhase(30, 10)).toBe('horizontal');
    expect(gesturePhase(0, DRAG_START_PX + 1)).toBe('vertical');
    expect(gesturePhase(10, 30)).toBe('vertical');
  });

  it('should map finger direction to the page that should be revealed', () => {
    expect(directionFromDx(-1)).toBe('next');
    expect(directionFromDx(4)).toBe('prev');
    expect(targetPage(4, 'next')).toBe(5);
    expect(targetPage(4, 'prev')).toBe(3);
  });

  it('should block the edge page and every page when the book is empty', () => {
    expect(isEdgeBlocked('prev', 1, 8)).toBe(true);
    expect(isEdgeBlocked('next', 8, 8)).toBe(true);
    expect(isEdgeBlocked('next', 1, 1)).toBe(true);
    expect(isEdgeBlocked('next', 2, 8)).toBe(false);
    expect(isEdgeBlocked('prev', 2, 8)).toBe(false);
    expect(isEdgeBlocked('next', 1, 0)).toBe(true);
  });

  it('should follow the finger 1:1 and only resist an edge', () => {
    expect(leafOffsetPx(-120, 300, 'next', false)).toBe(-120);
    expect(leafOffsetPx(40, 300, 'next', false)).toBe(0);
    expect(leafOffsetPx(-900, 300, 'next', false)).toBe(-300);
    expect(leafOffsetPx(80, 300, 'prev', false)).toBe(80);
    expect(leafOffsetPx(-20, 300, 'prev', false)).toBe(0);
    const resisted = leafOffsetPx(-200, 300, 'next', true);
    expect(Math.abs(resisted)).toBeLessThan(50);
    expect(resisted).toBeLessThan(0);
  });

  it('should measure progress across the page and ignore the wrong direction', () => {
    expect(turnProgress(-150, 300, 'next')).toBeCloseTo(0.5);
    expect(turnProgress(150, 300, 'next')).toBe(0);
    expect(turnProgress(300, 200, 'prev')).toBe(1);
  });

  it('should keep the previous velocity when the sample is too short to trust', () => {
    expect(nextVelocity(1.2, 10, 11, 100, 107)).toBe(1.2);
    expect(nextVelocity(0, 10, 26, 100, 108)).toBeCloseTo(2);
    expect(nextVelocity(0, 40, 10, 100, 116)).toBeCloseTo(-1.875);
  });

  it('should commit on distance or a flick and never on a blocked edge', () => {
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

  it('should park a committed sheet off the page and return a cancelled one home', () => {
    expect(releaseOffsetPx(300, 'next', true)).toBe(-300);
    expect(releaseOffsetPx(300, 'prev', true)).toBe(300);
    expect(releaseOffsetPx(300, 'next', false)).toBe(0);
  });

  it('should map arrow keys to a page turn in normal and fullscreen readers', () => {
    expect(turnDirectionFromKey('ArrowRight')).toBe('next');
    expect(turnDirectionFromKey('ArrowUp')).toBe('next');
    expect(turnDirectionFromKey('ArrowLeft')).toBe('prev');
    expect(turnDirectionFromKey('ArrowDown')).toBe('prev');
    expect(turnDirectionFromKey('f')).toBeNull();
    expect(turnDirectionFromKey('Escape')).toBeNull();
  });

  it('should clamp a margin press onto the book so the curl meets the finger', () => {
    const book = { left: 40, top: 20, right: 340, bottom: 420 };
    expect(clampPointerToBox(12, 80, book)).toEqual({ x: 40, y: 80 });
    expect(clampPointerToBox(400, 10, book)).toEqual({ x: 340, y: 20 });
    expect(clampPointerToBox(120, 200, book)).toEqual({ x: 120, y: 200 });
  });

  it('should leave toolbar controls, menus, links and fields out of the page turn', () => {
    const host = document.createElement('div');
    const link = document.createElement('a');
    const field = document.createElement('input');
    const menu = document.createElement('div');
    menu.setAttribute('role', 'menu');
    const item = document.createElement('div');
    item.setAttribute('role', 'menuitem');
    menu.append(item);
    const chrome = document.createElement('div');
    chrome.setAttribute('data-reader-chrome', '');
    const label = document.createElement('span');
    chrome.append(label);
    const page = document.createElement('div');
    host.append(link, field, menu, chrome, page);
    expect(isTurnBlockedTarget(link)).toBe(true);
    expect(isTurnBlockedTarget(field)).toBe(true);
    expect(isTurnBlockedTarget(item)).toBe(true);
    expect(isTurnBlockedTarget(label)).toBe(true);
    expect(isTurnBlockedTarget(page)).toBe(false);
    expect(isTurnBlockedTarget(null)).toBe(false);
  });

  it('should apply every rapid turn instead of keeping the page that is still curling', () => {
    expect(pageAfterTurns(2, 12, ['next', 'next', 'next'])).toBe(5);
    expect(pageAfterTurns(4, 12, ['prev', 'prev'])).toBe(2);
    expect(pageAfterTurns(2, 4, ['next', 'next', 'next', 'next'])).toBe(4);
    expect(pageAfterTurns(1, 4, ['prev', 'next'])).toBe(2);
  });
});
