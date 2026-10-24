import { fireEvent, render, screen } from '@testing-library/react';
import { act, useState } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { RsvpOverlay } from '@/components/rsvp/RsvpOverlay';
import { useFullscreenKey } from '@/hooks/useFullscreenKey';

function press(key: string, target: Element = document.body, init: KeyboardEventInit = {}) {
  let event!: KeyboardEvent;
  act(() => {
    event = new KeyboardEvent('keydown', {
      key,
      code: key === ' ' ? 'Space' : `Key${key.toUpperCase()}`,
      bubbles: true,
      cancelable: true,
      ...init,
    });
    target.dispatchEvent(event);
  });
  return event;
}

function Reader() {
  const [fullscreen, setFullscreen] = useState(false);
  const [open, setOpen] = useState(false);
  useFullscreenKey(true, () => setFullscreen((current) => !current));
  return (
    <div>
      <p>{fullscreen ? 'Pantalla completa' : 'Ventana'}</p>
      <input aria-label="Número de página" />
      <button type="button" onClick={() => setOpen(true)}>
        Abrir lectura
      </button>
      {open && (
        <RsvpOverlay
          pageNumber={1}
          hasNextPage={false}
          loadPageText={async () => 'uno dos'}
          onNextPage={() => {}}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

describe('reader fullscreen key', () => {
  beforeEach(() => {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  it('GIVEN the reader WHEN F is pressed THEN fullscreen toggles', () => {
    render(<Reader />);
    expect(screen.getByText('Ventana')).toBeInTheDocument();

    const lower = press('f');
    expect(lower.defaultPrevented).toBe(true);
    expect(screen.getByText('Pantalla completa')).toBeInTheDocument();

    const upper = press('F');
    expect(upper.defaultPrevented).toBe(true);
    expect(screen.getByText('Ventana')).toBeInTheDocument();

    press('F', document.body, { shiftKey: true });
    expect(screen.getByText('Ventana')).toBeInTheDocument();
  });

  it('GIVEN a field is focused WHEN F is pressed THEN fullscreen stays as it is', () => {
    render(<Reader />);
    const field = screen.getByRole('textbox', { name: 'Número de página' });
    const typed = press('f', field);
    expect(typed.defaultPrevented).toBe(false);
    expect(screen.getByText('Ventana')).toBeInTheDocument();

    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    document.body.append(editable);
    press('F', editable);
    expect(screen.getByText('Ventana')).toBeInTheDocument();
    editable.remove();
  });

  it('GIVEN RSVP is open WHEN F is pressed THEN fullscreen toggles and RSVP stays open until Escape', async () => {
    render(<Reader />);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir lectura' }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByRole('dialog', { name: 'Lectura rápida' })).toBeInTheDocument();

    press('f');
    expect(screen.getByText('Pantalla completa')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Lectura rápida' })).toBeInTheDocument();

    press('Escape');
    expect(screen.queryByRole('dialog', { name: 'Lectura rápida' })).not.toBeInTheDocument();
    expect(screen.getByText('Pantalla completa')).toBeInTheDocument();
  });
});
