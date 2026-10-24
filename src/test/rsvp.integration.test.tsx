import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { RsvpOverlay } from '@/components/rsvp/RsvpOverlay';
import { readReaderPageText, type ReadablePdf } from '@/lib/rsvp/pageText';
import { wordDelayMs, delayFactor } from '@/lib/rsvp/timing';

const SENTENCE = 'En esta pagina hay texto para leer.';

function pdfWithText(text: string): Uint8Array {
  const stream = `BT /F1 18 Tf 72 700 Td (${text}) Tj ET`;
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
    `4 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
  ];
  let body = '%PDF-1.4\n';
  const offsets = [0];
  for (const object of objects) {
    offsets.push(body.length);
    body += object;
  }
  const xrefAt = body.length;
  let xref = 'xref\n0 6\n0000000000 65535 f \n';
  for (let index = 1; index <= 5; index += 1) {
    xref += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  body += `${xref}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`;
  return new TextEncoder().encode(body);
}

async function flushLoad() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('GIVEN a PDF page with text', () => {
  beforeEach(() => {
    localStorage.clear();
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('GIVEN a PDF page with text WHEN RSVP mode starts THEN words are shown one by one', async () => {
    const doc = await getDocument({ data: pdfWithText(SENTENCE) }).promise;
    const text = await readReaderPageText(doc, 1, null);
    expect(text).toContain('pagina');
    expect(text).toContain('texto');
    vi.useFakeTimers();

    render(
      <RsvpOverlay
        pageNumber={1}
        hasNextPage={false}
        loadPageText={async () => text}
        onNextPage={() => {}}
        onClose={() => {}}
      />,
    );
    await flushLoad();

    act(() => {
      vi.advanceTimersByTime(500);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reproducir lectura' }));
    const stage = screen.getByRole('button', { name: 'Pausar lectura' });
    expect(stage).toHaveTextContent('En');
    expect(stage).not.toHaveTextContent('pagina');
    expect(stage.querySelector('.text-primary')).toHaveTextContent('n');

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(stage).toHaveTextContent('esta');
    expect(stage).not.toHaveTextContent('En');
    expect(stage.querySelector('.text-primary')).toHaveTextContent('s');

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(stage).toHaveTextContent('pagina');
    expect(stage.querySelector('.text-primary')).toHaveTextContent('g');
  });
});

function glyph(str: string, x: number, width: number, height = 12) {
  return { str, hasEOL: false, width, height, transform: [height, 0, 0, height, x, 700] };
}

function pdfWithItems(items: readonly unknown[]): ReadablePdf {
  return {
    numPages: 1,
    getPage: async () => ({ getTextContent: async () => ({ items }) }),
  };
}

function shownWord(): string {
  return document.querySelector('[data-rsvp-word]')?.textContent ?? '';
}

async function playWords(text: string): Promise<HTMLElement> {
  vi.useFakeTimers();
  render(
    <RsvpOverlay
      pageNumber={1}
      hasNextPage={false}
      loadPageText={async () => text}
      onNextPage={() => {}}
      onClose={() => {}}
    />,
  );
  await flushLoad();
  act(() => {
    vi.advanceTimersByTime(500);
  });
  fireEvent.click(screen.getByRole('button', { name: 'Reproducir lectura' }));
  return screen.getByRole('button', { name: 'Pausar lectura' });
}

describe('GIVEN a page with italic and bold words', () => {
  beforeEach(() => {
    localStorage.clear();
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('GIVEN italic and bold words separated by space items WHEN RSVP starts THEN each word is shown on its own', async () => {
    const text = await readReaderPageText(
      pdfWithItems([
        glyph('a', 40, 7),
        glyph(' ', 47, 1, 0),
        glyph('guideline', 48, 48),
        glyph(' ', 96, 1, 0),
        glyph('rather', 97, 36),
        glyph('hard-and-fast', 140, 71),
        glyph(' ', 211, 1, 0),
        glyph('rule', 212, 24),
        glyph('and un', 250, 36),
        glyph('believ', 286, 34),
        glyph('able', 320, 24),
      ]),
      1,
      null,
    );
    expect(text).toBe('a guideline rather hard-and-fast rule and unbelievable');

    await playWords(text);
    const words = ['a', 'guideline', 'rather', 'hard-and-fast', 'rule', 'and', 'unbelievable'];
    for (let index = 0; index < words.length; index += 1) {
      expect(shownWord()).toBe(words[index]);
      if (index === words.length - 1) break;
      act(() => {
        vi.advanceTimersByTime(wordDelayMs(300, delayFactor(words[index])));
      });
    }
  });

  it('GIVEN inline tags in the text layer WHEN the PDF stream is empty THEN RSVP keeps spaces and joins a split word', async () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <div class="pdf-turn-leaf">
        <div class="textLayer">
          <span>a</span> <em>guideline</em> <i>rather</i>
          <span>hard-and-fast</span> <strong>rule</strong>
          <b>and un</b><em>believ</em><a href="#w">able</a>
        </div>
      </div>
    `;
    const text = await readReaderPageText(null, 1, root);
    expect(text).toBe('a guideline rather hard-and-fast rule and unbelievable');

    await playWords(text);
    expect(shownWord()).toBe('a');
    act(() => {
      vi.advanceTimersByTime(wordDelayMs(300, delayFactor('a')));
    });
    expect(shownWord()).toBe('guideline');
    expect(shownWord()).not.toBe('aguidelinerather');
    act(() => {
      vi.advanceTimersByTime(wordDelayMs(300, delayFactor('guideline')));
    });
    expect(shownWord()).toBe('rather');
    act(() => {
      vi.advanceTimersByTime(wordDelayMs(300, delayFactor('rather')));
    });
    expect(shownWord()).toBe('hard-and-fast');
    act(() => {
      vi.advanceTimersByTime(wordDelayMs(300, delayFactor('hard-and-fast')));
    });
    expect(shownWord()).toBe('rule');
    expect(shownWord()).not.toBe('hard-and-fastrule');
    act(() => {
      vi.advanceTimersByTime(wordDelayMs(300, delayFactor('rule')));
    });
    expect(shownWord()).toBe('and');
    act(() => {
      vi.advanceTimersByTime(wordDelayMs(300, delayFactor('and')));
    });
    expect(shownWord()).toBe('unbelievable');
  });
});
