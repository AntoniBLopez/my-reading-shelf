import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { RsvpOverlay } from '@/components/rsvp/RsvpOverlay';
import { readReaderPageText } from '@/lib/rsvp/pageText';

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

  it('WHEN RSVP mode starts THEN words are shown one by one', async () => {
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

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(stage).toHaveTextContent('esta');
    expect(stage).not.toHaveTextContent('En');

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(stage).toHaveTextContent('pagina');
  });
});
