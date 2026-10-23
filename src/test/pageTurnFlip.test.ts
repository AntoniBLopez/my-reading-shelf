import { describe, expect, it } from 'vitest';
import { dragProgress, flipPose, flipTransform, grabRatio } from '@/lib/pageTurnFlip';

describe('page flip pose', () => {
  it('should follow the finger with a signed fold around the spine', () => {
    const next = flipPose(0.5, 'next', 0.5);
    const prev = flipPose(0.5, 'prev', 0.5);
    expect(next.angle).toBeCloseTo(-90);
    expect(prev.angle).toBeCloseTo(90);
    expect(next.origin.startsWith('left')).toBe(true);
    expect(prev.origin.startsWith('right')).toBe(true);
    expect(next.shade).toBeCloseTo(1);
    expect(flipPose(0, 'next').shade).toBe(0);
  });

  it('should twist the grabbed corner and snap a full turn to 180 degrees', () => {
    const high = flipPose(1, 'next', 0.9);
    const low = flipPose(1, 'next', 0.1);
    expect(high.angle).toBeCloseTo(-180);
    expect(high.twist).toBeLessThan(0);
    expect(low.twist).toBeGreaterThan(0);
    expect(flipPose(1, 'next', 0.5).twist).toBeCloseTo(0);
    expect(flipTransform(flipPose(0, 'prev')).includes('rotateY(0deg)')).toBe(true);
  });

  it('should keep a cancelled drag below a full flip and resist the edge of the book', () => {
    expect(dragProgress(-40, 300, 'next', false)).toBeCloseTo(40 / 300);
    expect(dragProgress(-40, 300, 'next', false)).toBeLessThan(0.28);
    const blocked = dragProgress(-200, 300, 'next', true);
    expect(blocked).toBeGreaterThan(0);
    expect(blocked).toBeLessThan(0.2);
    expect(Math.abs(flipPose(blocked, 'next').angle)).toBeLessThan(36);
  });

  it('should read the finger position from the page box captured at the start', () => {
    expect(grabRatio(0, 10, 400)).toBe(0);
    expect(grabRatio(210, 10, 400)).toBeCloseTo(0.5);
    expect(grabRatio(900, 10, 400)).toBe(1);
  });
});
