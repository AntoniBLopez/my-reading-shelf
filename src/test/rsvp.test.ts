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
