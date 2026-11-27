import { describe, expect, it } from 'vitest';
import { alphaFor, buildHighlightCss, hexToRgba, invertHex, nextColorIndex, PALETTE } from '@/lib/marks/palette';

describe('word mark palette', () => {
  it('should keep ten distinct base colors', () => {
    expect(PALETTE).toHaveLength(10);
    expect(new Set(PALETTE.map((color) => color.base)).size).toBe(10);
    expect(PALETTE[0].base).toBe('#F2B53A');
  });

  it('should use a lighter alpha for the other occurrences', () => {
    expect(alphaFor(0, 'light', 'other')).toBeLessThan(alphaFor(0, 'light', 'sel'));
    expect(alphaFor(0, 'dark', 'sel')).toBe(0.42);
    expect(alphaFor(0, 'dark', 'learned')).toBe(0.1);
    expect(alphaFor(0, 'light', 'hover')).toBeCloseTo(0.3);
  });

  it('should underline only the selected occurrence', () => {
    const css = buildHighlightCss();
    expect(css).toContain('::highlight(ink-0-l-sel)');
    expect(css).toContain('text-decoration-thickness: 2px');
    expect(css).toContain(hexToRgba('#F2B53A', 0.5));
    expect(css).toContain(invertHex('#F2B53A'));
    const other = css.split('::highlight(ink-0-l-other)')[1]?.split('::highlight')[0] ?? '';
    expect(other).toContain('text-decoration: none');
  });

  it('should reuse a freed color before repeating the palette', () => {
    expect(nextColorIndex([0, 1, 2])).toBe(3);
    expect(nextColorIndex([1, 2, 3])).toBe(0);
    expect(nextColorIndex([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])).toBe(0);
  });
});
