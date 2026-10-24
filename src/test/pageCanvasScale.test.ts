import { describe, expect, it } from 'vitest';
import { pageDevicePixelRatio } from '@/lib/pageCanvasScale';

describe('page canvas scale', () => {
  it('should cap a touch screen at 2 for the current page and 1 for the page underneath', () => {
    expect(pageDevicePixelRatio(3, true, 'leaf')).toBe(2);
    expect(pageDevicePixelRatio(4, true, 'leaf')).toBe(2);
    expect(pageDevicePixelRatio(3, true, 'neighbor')).toBe(1);
    expect(pageDevicePixelRatio(1.25, true, 'leaf')).toBe(1.25);
  });

  it('should keep the desktop page at its native ratio and cap the neighbor at 2', () => {
    expect(pageDevicePixelRatio(3, false, 'leaf')).toBe(3);
    expect(pageDevicePixelRatio(1, false, 'leaf')).toBe(1);
    expect(pageDevicePixelRatio(3, false, 'neighbor')).toBe(2);
    expect(pageDevicePixelRatio(1.5, false, 'neighbor')).toBe(1.5);
  });

  it('should treat a missing ratio as 1', () => {
    expect(pageDevicePixelRatio(Number.NaN, true, 'leaf')).toBe(1);
    expect(pageDevicePixelRatio(0, false, 'leaf')).toBe(1);
    expect(pageDevicePixelRatio(-2, true, 'neighbor')).toBe(1);
  });
});
