import { describe, expect, it } from 'vitest';
import { curlCorner, curlFold } from '@/lib/pageCurlGeometry';

describe('page curl geometry', () => {
  it('should bend from the grabbed corner instead of a fixed vertical hinge', () => {
    const fold = curlFold(300, 400, 150, 320, 'next');
    expect(fold.corner).toBe('bottom');
    expect(fold.progress).toBeCloseTo(0.5);
    expect(fold.foldX).toBeCloseTo(225);
    expect(fold.foldX).not.toBe(0);
    expect(fold.crease).toBeCloseTo(Math.atan2(80, 150));
    expect(Math.abs(fold.crease - Math.PI / 2)).toBeGreaterThan(0.2);
    expect(fold.shade).toBeCloseTo(1);
    expect(curlFold(300, 400, 300, 320, 'next').shade).toBeCloseTo(0);
  });

  it('should mirror a previous-page peel so the crease stays a diagonal', () => {
    const next = curlFold(300, 400, 60, 40, 'next');
    const prev = curlFold(300, 400, 240, 40, 'prev');
    expect(curlCorner(40, 400)).toBe('top');
    expect(prev.corner).toBe('top');
    expect(prev.progress).toBeCloseTo(next.progress);
    expect(prev.foldX).toBeCloseTo(300 - next.foldX);
    expect(prev.crease).toBeCloseTo(next.crease);
    expect(prev.crease).not.toBeCloseTo(0);
  });

  it('should keep progress inside the page when the finger leaves the sheet', () => {
    const past = curlFold(300, 400, -40, 500, 'next');
    expect(past.progress).toBe(1);
    expect(past.foldY).toBeLessThanOrEqual(400);
    const closed = curlFold(300, 400, 900, 10, 'next');
    expect(closed.progress).toBe(0);
    expect(closed.foldX).toBeCloseTo(300);
  });
});

describe('GIVEN a page peeled from the lower right', () => {
  it('should place the crease on a diagonal when the finger is halfway across', () => {
    const fold = curlFold(300, 400, 150, 300, 'next');
    expect(fold.corner).toBe('bottom');
    expect(fold.progress).toBeCloseTo(0.5);
    const hinge = Math.PI / 2;
    expect(Math.abs(fold.crease)).toBeGreaterThan(0.2);
    expect(Math.abs(fold.crease)).toBeLessThan(hinge);
    expect(fold.foldX).toBeGreaterThan(150);
    expect(fold.foldX).toBeLessThan(300);
  });
});
