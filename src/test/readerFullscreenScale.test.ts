import { describe, expect, it } from 'vitest';
import {
  cssScreenLength,
  desktopFullscreenScale,
  LAPTOP_FULLSCREEN_SCALE,
  LARGE_DESKTOP_FULLSCREEN_SCALE,
  type FullscreenScreen,
} from '@/lib/readerFullscreenScale';

function screen(overrides: Partial<FullscreenScreen>): FullscreenScreen {
  return {
    viewportWidth: 1280,
    viewportHeight: 800,
    screenWidth: 1280,
    screenHeight: 800,
    devicePixelRatio: 1,
    ...overrides,
  };
}

describe('desktop fullscreen zoom', () => {
  it('should keep the current desktop zoom on a 3440x1440 monitor at 100%', () => {
    const scale = desktopFullscreenScale(screen({
      viewportWidth: 3440,
      viewportHeight: 1440,
      screenWidth: 3440,
      screenHeight: 1440,
      devicePixelRatio: 1,
    }));
    expect(scale).toBe(LARGE_DESKTOP_FULLSCREEN_SCALE);
    expect(scale).toBe(0.3);
  });

  it('should keep that zoom when a scaled ultrawide reports physical pixels', () => {
    expect(cssScreenLength(3440, 2293, 1.5)).toBeCloseTo(2293.333, 2);
    expect(desktopFullscreenScale(screen({
      viewportWidth: 2293,
      viewportHeight: 960,
      screenWidth: 3440,
      screenHeight: 1440,
      devicePixelRatio: 1.5,
    }))).toBe(0.3);
  });

  it('should use 50% on a 2560x1600 laptop whose Windows scaling shrinks the CSS viewport', () => {
    const scaled = desktopFullscreenScale(screen({
      viewportWidth: 1707,
      viewportHeight: 1067,
      screenWidth: 1707,
      screenHeight: 1067,
      devicePixelRatio: 1.5,
    }));
    const physicalReport = desktopFullscreenScale(screen({
      viewportWidth: 1707,
      viewportHeight: 1067,
      screenWidth: 2560,
      screenHeight: 1600,
      devicePixelRatio: 1.5,
    }));
    const heavierScale = desktopFullscreenScale(screen({
      viewportWidth: 1600,
      viewportHeight: 1000,
      screenWidth: 1600,
      screenHeight: 1000,
      devicePixelRatio: 1.6,
    }));
    expect(scaled).toBe(LAPTOP_FULLSCREEN_SCALE);
    expect(physicalReport).toBe(0.5);
    expect(heavierScale).toBe(0.5);
  });

  it('should treat the same laptop panel at 100% scaling as a large CSS viewport', () => {
    expect(desktopFullscreenScale(screen({
      viewportWidth: 2560,
      viewportHeight: 1600,
      screenWidth: 2560,
      screenHeight: 1600,
      devicePixelRatio: 1,
    }))).toBe(0.3);
  });

  it('should keep a large 2560x1440 monitor on the desktop zoom and a 1080p display on the laptop zoom', () => {
    expect(desktopFullscreenScale(screen({
      viewportWidth: 2560,
      viewportHeight: 1440,
      screenWidth: 2560,
      screenHeight: 1440,
      devicePixelRatio: 1,
    }))).toBe(0.3);
    expect(desktopFullscreenScale(screen({
      viewportWidth: 1920,
      viewportHeight: 1080,
      screenWidth: 1920,
      screenHeight: 1080,
      devicePixelRatio: 1,
    }))).toBe(0.5);
  });
});
