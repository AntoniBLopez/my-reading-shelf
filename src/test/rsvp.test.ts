import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { useRsvp } from '@/hooks/useRsvp';
import { extractRenderedPageText, textItemsToPageText } from '@/lib/rsvp/pageText';
import { delayFactor, wordDelayMs } from '@/lib/rsvp/timing';
import { orpIndex, tokenize } from '@/lib/rsvp/tokenize';
import { RSVP_WPM_STORAGE_KEY, clampWpm, readStoredWpm, storeWpm } from '@/lib/rsvp/wpm';

describe('rsvp tokenizer and timing', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('places the recognition point about a third of the way in', () => {
    expect(orpIndex('a')).toBe(0);
    expect(orpIndex('hola')).toBe(1);
    expect(orpIndex('¿Hola')).toBe(2);
    expect(orpIndex('lectura')).toBe(2);
    expect(orpIndex('reconocer')).toBe(2);
    expect(orpIndex('rapidamente')).toBe(3);
    expect(orpIndex('reconocimiento')).toBe(4);
    expect(orpIndex('hello,')).toBe(1);
  });

  it('splits words and keeps punctuation for the pause', () => {
    const tokens = tokenize('Hola, mundo.\n¿Listo?');
    expect(tokens.map((token) => token.word)).toEqual(['Hola,', 'mundo.', '¿Listo?']);
    expect(tokens[0].delayFactor).toBe(1.5);
    expect(tokens[1].delayFactor).toBe(2);
    expect(tokens[2].delayFactor).toBe(2);
    expect(tokens[2].orpIndex).toBe(2);
  });

  it('holds punctuation and long words a little longer', () => {
    expect(delayFactor('casa')).toBe(1);
    expect(delayFactor('casa,')).toBe(1.5);
    expect(delayFactor('fin.')).toBe(2);
    expect(delayFactor('fin."')).toBe(2);
    expect(delayFactor('biblioteca')).toBe(1.25);
    expect(delayFactor('extraordinario')).toBe(1.4);
    expect(delayFactor('biblioteca.')).toBe(2);
    expect(wordDelayMs(300, 1)).toBe(200);
    expect(wordDelayMs(300, 2)).toBe(400);
    expect(wordDelayMs(50, 1)).toBe(600);
  });

  it('remembers words per minute between visits', () => {
    expect(readStoredWpm()).toBe(300);
    expect(storeWpm(450)).toBe(450);
    expect(localStorage.getItem(RSVP_WPM_STORAGE_KEY)).toBe('450');
    expect(readStoredWpm()).toBe(450);
    expect(clampWpm(5000)).toBe(1000);
    expect(storeWpm(20)).toBe(100);
  });

  it('joins PDF lines and drops a hyphen that only breaks a word', () => {
    const text = textItemsToPageText([
      { str: 'La lectu-', hasEOL: true },
      { str: 'ra rápida', hasEOL: true },
      { str: 'sigue.', hasEOL: false },
      { type: 'beginMarkedContent' },
    ]);
    expect(text).toBe('La lectura rápida sigue.');
  });

  it('joins a hyphen glued to a word at a line break and keeps a mid-line hyphen', () => {
    const line = (str: string, x: number, y: number, width: number, hasEOL = false) => ({
      str,
      hasEOL,
      width,
      height: 12,
      transform: [12, 0, 0, 12, x, y],
    });

    expect(textItemsToPageText([
      line('sys-', 40, 700, 36, true),
      line('tems', 40, 684, 40),
    ])).toBe('systems');

    expect(textItemsToPageText([
      line('sys-', 40, 700, 36),
      line('tems', 40, 680, 40),
    ])).toBe('systems');

    expect(textItemsToPageText([
      line('sys', 40, 700, 28),
      line('-', 68, 700, 8, true),
      line('tems', 40, 684, 40),
    ])).toBe('systems');

    expect(textItemsToPageText([
      line('a well-', 40, 700, 50),
      line('known', 92, 700, 48),
      line('pair', 160, 700, 30),
    ])).toBe('a well-known pair');

    expect(textItemsToPageText([
      { str: 'sys -', hasEOL: true },
      { str: 'tems', hasEOL: false },
    ])).toBe('sys - tems');
  });

  it('concatenates text runs that are only split by font or kerning', () => {
    const run = (str: string, x: number, width: number) => ({
      str,
      hasEOL: false,
      width,
      height: 10,
      transform: [10, 0, 0, 10, x, 500],
    });

    expect(textItemsToPageText([run('cri', 10, 18), run('teria', 28, 30)])).toBe('criteria');
    expect(textItemsToPageText([run('cri ', 10, 20), run('teria', 30, 30)])).toBe('criteria');
    expect(textItemsToPageText([run('not', 10, 20), run('ice', 30, 18)])).toBe('notice');
    expect(textItemsToPageText([run('al', 10, 12), run('l', 22, 6)])).toBe('all');
    expect(textItemsToPageText([run('it', 10, 10), run('of', 28, 12)])).toBe('it of');
  });

  it('trims tokens and drops soft hyphens, zero-width characters, and blanks', () => {
    const tokens = tokenize('  it\u00A0 of \u200B cri\u00ADteria \u00AD  ');
    expect(tokens.map((token) => token.word)).toEqual(['it', 'of', 'criteria']);
    expect(tokens[0].orpIndex).toBe(1);
    expect(tokens[1].orpIndex).toBe(1);
    expect(tokenize(' \u00AD \u200B ').map((token) => token.word)).toEqual([]);
  });

  it('should read pdf.js 6 items whose text matrix is a typed array', () => {
    const matrix = new Float32Array([12, 0, 0, 12, 40, 700]);
    expect(textItemsToPageText([
      { str: 'En esta ', width: 48, height: 12, transform: matrix, hasEOL: false },
      { str: ['pá', 'gina'], width: 40, height: 12, transform: new Float32Array([12, 0, 0, 12, 100, 700]), hasEOL: true },
    ])).toBe('En esta página');
  });

  it('should read words inside a pdf.js 6 marked-content text layer', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <div class="pdf-turn-leaf">
        <div class="react-pdf__Page__textContent textLayer">
          <span class="markedContent">
            <span role="presentation">En esta </span>
            <span role="presentation">página </span>
            <br role="presentation"></br>
            <span role="presentation">hay texto.</span>
          </span>
          <div class="endOfContent">ignore</div>
        </div>
      </div>
    `;
    expect(extractRenderedPageText(root)).toBe('En esta página hay texto.');
  });

  it('reads the text layer the page rendered', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <div class="pdf-turn-leaf">
        <div class="textLayer">
          <span>recono-</span><br />
          <span>cimiento </span>
          <span>visual</span><br />
          <span class="endOfContent">ignore</span>
        </div>
      </div>
    `;
    expect(extractRenderedPageText(root)).toBe('reconocimiento visual');
  });
});

describe('useRsvp', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('plays through a page, pauses on demand, and stops at the end', () => {
    const tokens = tokenize('uno dos tres.');
    const { result } = renderHook(() => useRsvp(tokens, { autoPlay: true }));

    expect(result.current.playing).toBe(true);
    expect(result.current.index).toBe(0);

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.index).toBe(1);

    act(() => {
      result.current.pause();
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.index).toBe(1);
    expect(result.current.playing).toBe(false);

    act(() => {
      result.current.play();
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.index).toBe(2);

    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(result.current.finished).toBe(true);
    expect(result.current.playing).toBe(false);
    expect(result.current.index).toBe(2);
    expect(result.current.progress).toBe(100);
  });

  it('steps one word and restarts from the first', () => {
    const tokens = tokenize('alpha beta gamma');
    const { result } = renderHook(() => useRsvp(tokens));

    act(() => {
      result.current.step(1);
      result.current.step(1);
    });
    expect(result.current.index).toBe(2);
    expect(result.current.finished).toBe(false);

    act(() => {
      result.current.step(1);
    });
    expect(result.current.finished).toBe(true);

    act(() => {
      result.current.step(-1);
    });
    expect(result.current.index).toBe(1);
    expect(result.current.finished).toBe(false);

    act(() => {
      result.current.restart();
    });
    expect(result.current.index).toBe(0);
    expect(result.current.playing).toBe(true);
  });

  it('stores the chosen speed', () => {
    const { result } = renderHook(() => useRsvp(tokenize('hola')));
    act(() => {
      result.current.setWpm(640);
    });
    expect(result.current.wpm).toBe(640);
    expect(readStoredWpm()).toBe(640);
  });
});
