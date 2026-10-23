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
  resolveFigure,
  listOrphans,
}: {
  text: string;
  resolveFigure?: (cue: FigureCue) => Promise<FigureImage | null>;
  listOrphans?: (pageNumber: number, mentioned: ReadonlySet<string>) => Promise<FigureCue[]>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <TooltipProvider>
      <RsvpLaunchButton onClick={() => setOpen(true)} />
      {open && (
        <RsvpOverlay
          pageNumber={1}
          hasNextPage={false}
          loadPageText={async () => text}
          onNextPage={() => {}}
          onClose={() => setOpen(false)}
          resolveFigure={resolveFigure}
          listOrphans={listOrphans}
        />
      )}
    </TooltipProvider>
  );
}

describe('RSVP figures', () => {
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
  });

  it('GIVEN RSVP opened WHEN tapping the rayo THEN it is paused until play', async () => {
    render(<Reader text="En esta pagina" />);
    fireEvent.click(screen.getByRole('button', { name: 'Lectura rápida' }));
    await flushLoad();

    const stage = screen.getByRole('button', { name: 'Reproducir lectura' });
    expect(stage).toHaveTextContent('En');
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(stage).toHaveTextContent('En');
    expect(stage).not.toHaveTextContent('esta');

    fireEvent.click(stage);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByRole('button', { name: 'Pausar lectura' })).toHaveTextContent('esta');
  });

  it("GIVEN text mentioning 'Figura 1.1' WHEN those words finish THEN the figure is shown paused and Continuar resumes", async () => {
    const resolveFigure = vi.fn(async (cue: FigureCue) => ({ url: 'blob:fig', label: cue.label }));
    render(<Reader text="Mira Figura 1.1 ahora" resolveFigure={resolveFigure} />);
    fireEvent.click(screen.getByRole('button', { name: 'Lectura rápida' }));
    await flushLoad();
    fireEvent.click(screen.getByRole('button', { name: 'Reproducir lectura' }));

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByRole('button', { name: 'Pausar lectura' })).toHaveTextContent('Figura');
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByRole('button', { name: 'Pausar lectura' })).toHaveTextContent('1.1');
    act(() => {
      vi.advanceTimersByTime(200);
    });

    await act(async () => {
      await Promise.resolve();
    });
    const image = screen.getByRole('img', { name: 'Figura 1.1' });
    expect(image).toHaveAttribute('src', 'blob:fig');
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByRole('img', { name: 'Figura 1.1' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pausar lectura' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(screen.getByRole('button', { name: 'Pausar lectura' })).toHaveTextContent('ahora');
  });

  it('GIVEN a caption the page never cites WHEN the words finish THEN that figure is shown paused', async () => {
    const orphan: FigureCue = { key: 'figure:9', label: 'Figura 9', kind: 'figure', number: '9' };
    render(
      <Reader
        text="uno dos"
        listOrphans={async () => [orphan]}
        resolveFigure={async (cue) => ({ url: 'blob:orphan', label: cue.label })}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Lectura rápida' }));
    await flushLoad();
    act(() => {
      vi.advanceTimersByTime(20);
    });
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Reproducir lectura' }));
    act(() => {
      vi.advanceTimersByTime(200);
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByRole('img', { name: 'Figura 9' })).toHaveAttribute('src', 'blob:orphan');
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(screen.getByText('Fin de la página')).toBeInTheDocument();
  });
});
