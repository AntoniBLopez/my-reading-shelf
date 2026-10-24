import { describe, expect, it } from 'vitest';
import { extractRenderedPageText, textItemsToPageText } from '@/lib/rsvp/pageText';

function glyph(str: string, x: number, width: number, extras: { height?: number; hasEOL?: boolean } = {}) {
  const height = extras.height ?? 12;
  return {
    str,
    hasEOL: extras.hasEOL ?? false,
    width,
    height,
    transform: [height, 0, 0, height, x, 700],
  };
}

describe('inline spaces in page text', () => {
  it('should keep a space item around an italic word and join a word split with no space', () => {
    // pdf.js emits the space as its own item. Those items have height 0, so
    // they have no geometry, and the gap they leave can be under 0.18em.
    const italicLine = textItemsToPageText([
      glyph('a', 40, 6.672),
      glyph(' ', 46.672, 1, { height: 0 }),
      glyph('guideline', 47.8, 48),
      glyph(' ', 96, 1, { height: 0 }),
      glyph('rather', 97.2, 36, { hasEOL: true }),
    ]);
    expect(italicLine).toBe('a guideline rather');

    const rule = textItemsToPageText([
      glyph('hard-and-fast', 40, 71),
      glyph(' ', 111, 1, { height: 0 }),
      glyph('rule', 112, 24),
    ]);
    expect(rule).toBe('hard-and-fast rule');

    const split = textItemsToPageText([
      glyph('and un', 40, 36),
      glyph('believ', 76, 34),
      glyph('able', 110, 24),
    ]);
    expect(split).toBe('and unbelievable');
  });

  it('should keep spaces around italic, bold, and link text and join a word split across tags', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <div class="textLayer">
        <span>a</span> <em>guideline</em> <span>rather</span>
        <span>hard-and-fast</span> <i>rule</i>
        <span>see</span> <strong>this</strong> <b>too</b>
        <a href="#n">link</a> <span>text</span>
        <span>and un</span><em>believ</em><strong>able</strong>
      </div>
    `;
    expect(extractRenderedPageText(root)).toBe(
      'a guideline rather hard-and-fast rule see this too link text and unbelievable',
    );
  });

  it('should keep a whitespace-only span between words', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <div class="textLayer">
        <span role="presentation">a</span><span role="presentation"> </span><em>guideline</em><span role="presentation"> </span><span role="presentation">rather</span>
        <span>un</span><em>believ</em><span>able</span>
      </div>
    `;
    expect(extractRenderedPageText(root)).toBe('a guideline rather unbelievable');
  });
});
