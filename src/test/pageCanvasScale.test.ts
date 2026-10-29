import { describe, expect, it } from 'vitest';
import { pageDevicePixelRatio } from '@/lib/pageCanvasScale';

describe('page canvas scale', () => {
  it('should use the settled page ratio for the page revealed under a touch drag', () => {
    expect(pageDevicePixelRatio(3, true, 'leaf')).toBe(2);
    expect(pageDevicePixelRatio(4, true, 'leaf')).toBe(2);
    expect(pageDevicePixelRatio(3, true, 'neighbor')).toBe(2);
    expect(pageDevicePixelRatio(1.25, true, 'leaf')).toBe(1.25);
    expect(pageDevicePixelRatio(1.25, true, 'neighbor')).toBe(1.25);
  });

  it('should keep the desktop page and the revealed page at the native ratio', () => {
    expect(pageDevicePixelRatio(3, false, 'leaf')).toBe(3);
    expect(pageDevicePixelRatio(1, false, 'leaf')).toBe(1);
    expect(pageDevicePixelRatio(3, false, 'neighbor')).toBe(3);
    expect(pageDevicePixelRatio(1.5, false, 'neighbor')).toBe(1.5);
  });

  it('should treat a missing ratio as 1', () => {
    expect(pageDevicePixelRatio(Number.NaN, true, 'leaf')).toBe(1);
    expect(pageDevicePixelRatio(0, false, 'leaf')).toBe(1);
    expect(pageDevicePixelRatio(-2, true, 'neighbor')).toBe(1);
  });
});
