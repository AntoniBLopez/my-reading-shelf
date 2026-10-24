import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RsvpLaunchButton, RsvpOverlay } from '@/components/rsvp/RsvpOverlay';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { FigureCue, FigureImage } from '@/lib/rsvp/figures/types';

async function flushLoad() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function Reader({
  text,
  native,
  resolveFigure,
}: {
  text: string;
  native: boolean;
  resolveFigure?: (cue: FigureCue) => Promise<FigureImage | null>;
}) {
  const [open, setOpen] = useState(false);
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  return (
    <TooltipProvider>
      <div ref={setRoot} data-fullscreen-root>
        <RsvpLaunchButton onClick={() => setOpen(true)} />
        {open && root && (
          <RsvpOverlay
            portalRoot={native ? null : root}
            pageNumber={1}
            hasNextPage={false}
            loadPageText={async () => text}
            onNextPage={() => {}}
            onClose={() => setOpen(false)}
            resolveFigure={resolveFigure}
          />
        )}
      </div>
    </TooltipProvider>
  );
}

describe('RSVP in fullscreen', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (document as { fullscreenElement?: Element | null }).fullscreenElement;
  });

  it('GIVEN the reader in fullscreen WHEN tapping the rayo THEN the RSVP overlay is visible inside the fullscreen element and fullscreen stays active', async () => {
    const view = render(<Reader text="corto medianas" native />);
    const host = document.querySelector('[data-fullscreen-root]');
    if (!(host instanceof HTMLElement)) throw new Error('missing fullscreen root');
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => host });

    fireEvent.click(screen.getByRole('button', { name: 'Lectura rápida' }));
    await flushLoad();

    const stage = screen.getByRole('button', { name: 'Reproducir lectura' });
    expect(host.contains(stage)).toBe(true);
    expect(stage).toHaveTextContent('corto');
    expect(document.fullscreenElement).toBe(host);

    fireEvent.keyDown(screen.getByRole('slider', { name: 'Palabras por minuto' }), { key: 'ArrowRight' });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByRole('button', { name: 'Reproducir lectura' })).toHaveTextContent('corto');
    expect(document.fullscreenElement).toBe(host);

    fireEvent.click(screen.getByRole('button', { name: 'Reproducir lectura' }));
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByRole('button', { name: 'Pausar lectura' })).toHaveTextContent('medianas');
    fireEvent.click(screen.getByRole('button', { name: 'Pausar' }));
    expect(document.fullscreenElement).toBe(host);

    let space!: KeyboardEvent;
    act(() => {
      space = new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true });
      window.dispatchEvent(space);
    });
    expect(space.defaultPrevented).toBe(true);
    expect(screen.getByRole('button', { name: 'Pausar lectura' })).toHaveTextContent('medianas');
    expect(document.fullscreenElement).toBe(host);
    fireEvent.click(screen.getByRole('button', { name: 'Pausar' }));

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('button', { name: 'Reproducir lectura' })).not.toBeInTheDocument();
    expect(document.fullscreenElement).toBe(host);
    view.unmount();
  });

  it('GIVEN a CSS fullscreen reader WHEN a figure is due THEN Continuar is shown inside that root and fullscreen stays active', async () => {
    const resolveFigure = async (cue: FigureCue) => ({ url: 'blob:fig', label: cue.label });
    render(<Reader text="Mira Figura 1.1 ahora" native={false} resolveFigure={resolveFigure} />);
    const host = document.querySelector('[data-fullscreen-root]');
    if (!(host instanceof HTMLElement)) throw new Error('missing fullscreen root');

    fireEvent.click(screen.getByRole('button', { name: 'Lectura rápida' }));
    await flushLoad();
    act(() => {
      vi.advanceTimersByTime(500);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reproducir lectura' }));
    for (const word of ['Figura', '1.1', 'ahora']) {
      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(screen.getByRole('button', { name: 'Pausar lectura' })).toHaveTextContent(word);
    }
    act(() => {
      vi.advanceTimersByTime(200);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const image = screen.getByRole('img', { name: 'Figura 1.1' });
    expect(host.contains(image)).toBe(true);
    expect(host.contains(screen.getByRole('button', { name: 'Continuar' }))).toBe(true);
    expect(document.fullscreenElement ?? null).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('img', { name: 'Figura 1.1' })).not.toBeInTheDocument();
  });
});
