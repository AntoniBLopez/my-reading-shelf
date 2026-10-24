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

  it('GIVEN a book open WHEN the user taps the rayo, changes the speed, and waits THEN the word stays until play', async () => {
    render(<Reader text="corto medianas" />);
    fireEvent.click(screen.getByRole('button', { name: 'Lectura rápida' }));
    await flushLoad();
    expect(screen.getByRole('button', { name: 'Reproducir lectura' })).toHaveTextContent('corto');

    fireEvent.keyDown(screen.getByRole('slider', { name: 'Palabras por minuto' }), { key: 'ArrowRight' });
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    const stage = screen.getByRole('button', { name: 'Reproducir lectura' });
    expect(stage).toHaveTextContent('corto');
    expect(stage.querySelector('[data-rsvp-word]')).toHaveClass('text-center');

    fireEvent.click(stage);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByRole('button', { name: 'Pausar lectura' })).toHaveTextContent('medianas');
  });

  it('GIVEN a sentence mentioning Figura 1.1 WHEN that sentence ends THEN the figure is shown paused and Continuar resumes', async () => {
    const resolveFigure = vi.fn(async (cue: FigureCue) => ({ url: 'blob:fig', label: cue.label }));
    render(<Reader text="Mira Figura 1.1 ahora mismo. Sigue" resolveFigure={resolveFigure} />);
    fireEvent.click(screen.getByRole('button', { name: 'Lectura rápida' }));
    await flushLoad();
    act(() => {
      vi.advanceTimersByTime(500);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reproducir lectura' }));

    for (const word of ['Figura', '1.1', 'ahora', 'mismo.']) {
      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(screen.getByRole('button', { name: 'Pausar lectura' })).toHaveTextContent(word);
      expect(screen.queryByRole('img', { name: 'Figura 1.1' })).not.toBeInTheDocument();
    }
    act(() => {
      vi.advanceTimersByTime(400);
    });

    await act(async () => {
      await Promise.resolve();
    });
    const image = screen.getByRole('img', { name: 'Figura 1.1' });
    expect(image).toHaveAttribute('src', 'blob:fig');
    expect(image).not.toHaveStyle({ filter: 'invert(1)' });
    expect(screen.getByTestId('rsvp-figure')).toHaveClass('bg-white');
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByRole('img', { name: 'Figura 1.1' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(screen.getByRole('button', { name: 'Pausar lectura' })).toHaveTextContent('Sigue');
  });

  it('GIVEN dark mode WHEN the sentence that mentions a figure ends THEN the figure is inverted on a dark panel', async () => {
    document.documentElement.classList.add('dark');
    render(
      <Reader
        text="Figura 1.1 al final."
        resolveFigure={async (cue) => ({ url: 'blob:dark', label: cue.label })}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Lectura rápida' }));
    await flushLoad();
    act(() => {
      vi.advanceTimersByTime(500);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reproducir lectura' }));
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByRole('button', { name: 'Pausar lectura' })).toHaveTextContent('1.1');
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByRole('button', { name: 'Pausar lectura' })).toHaveTextContent('al');
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByRole('button', { name: 'Pausar lectura' })).toHaveTextContent('final.');
    act(() => {
      vi.advanceTimersByTime(400);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const image = screen.getByRole('img', { name: 'Figura 1.1' });
    expect(image).toHaveStyle({ filter: 'invert(1)' });
    expect(screen.getByTestId('rsvp-figure')).toHaveClass('bg-black');
    document.documentElement.classList.remove('dark');
  });

  it('GIVEN RSVP is open WHEN Space or Enter is pressed THEN playback toggles and the focused button is not activated twice', async () => {
    render(<Reader text="uno dos tres" />);
    fireEvent.click(screen.getByRole('button', { name: 'Lectura rápida' }));
    await flushLoad();
    act(() => {
      vi.advanceTimersByTime(500);
    });
    const play = screen.getByRole('button', { name: 'Reproducir' });
    play.focus();
    let enter!: KeyboardEvent;
    act(() => {
      enter = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true });
      play.dispatchEvent(enter);
    });
    expect(enter.defaultPrevented).toBe(true);
    expect(screen.getByRole('button', { name: 'Pausar lectura' })).toHaveTextContent('uno');

    let space!: KeyboardEvent;
    act(() => {
      space = new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true });
      window.dispatchEvent(space);
    });
    expect(space.defaultPrevented).toBe(true);
    expect(screen.getByRole('button', { name: 'Reproducir lectura' })).toHaveTextContent('uno');
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByRole('button', { name: 'Reproducir lectura' })).toHaveTextContent('uno');
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

    act(() => {
      vi.advanceTimersByTime(500);
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
