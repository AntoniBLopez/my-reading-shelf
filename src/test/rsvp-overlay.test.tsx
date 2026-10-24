import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RsvpOverlay } from '@/components/rsvp/RsvpOverlay';
import { RsvpWord } from '@/components/rsvp/RsvpWord';

async function flushLoad() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('RsvpWord', () => {
  it('should center the whole word regardless of pivot position', () => {
    const { container } = render(<RsvpWord word="dimension" orpIndex={2} />);
    const word = container.querySelector('[data-rsvp-word]');
    expect(word).not.toBeNull();
    expect(word).toHaveClass('text-center');
    expect((word as HTMLElement).style.transform).toBe('');
    expect(word?.textContent).toBe('dimension');
    expect(word?.querySelector('.text-primary')).toHaveTextContent('m');
    expect(word?.querySelector('[style*="translate"]')).toBeNull();
  });
});

describe('RsvpOverlay', () => {
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

  it('GIVEN consecutive words of different lengths WHEN each is shown THEN the whole word is centered', async () => {
    render(
      <RsvpOverlay
        pageNumber={3}
        hasNextPage
        loadPageText={async () => 'Hola mundo'}
        onNextPage={() => {}}
        onClose={() => {}}
      />,
    );
    await flushLoad();

    const stage = screen.getByRole('button', { name: 'Reproducir lectura' });
    const shown = stage.querySelector('[data-rsvp-word]');
    expect(shown).toHaveClass('text-center');
    expect(shown).toHaveTextContent('Hola');
    expect(shown?.querySelector('.text-primary')).toHaveTextContent('o');
    expect((shown as HTMLElement).style.transform).toBe('');
    expect(screen.getByText('Pág. 3')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(500);
    });
    fireEvent.click(stage);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    const longer = screen.getByRole('button', { name: 'Pausar lectura' }).querySelector('[data-rsvp-word]');
    expect(longer).toHaveTextContent('mundo');
    expect(longer).toHaveClass('text-center');
    expect((longer as HTMLElement).style.transform).toBe('');
    expect(longer?.querySelector('.text-primary')).toHaveTextContent('u');

    fireEvent.click(screen.getByRole('button', { name: 'Pausar lectura' }));
    expect(screen.getByRole('button', { name: 'Reproducir lectura' })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByRole('button', { name: 'Reproducir lectura' }).querySelector('.text-primary')).toHaveTextContent('u');
  });

  it('GIVEN the last word of a page WHEN the reader finishes THEN the next page can continue', async () => {
    const onNextPage = vi.fn();
    const loadPageText = vi.fn(async (page: number) => (page === 1 ? 'uno dos.' : 'sigue'));
    const view = render(
      <RsvpOverlay
        pageNumber={1}
        hasNextPage
        loadPageText={loadPageText}
        onNextPage={onNextPage}
        onClose={() => {}}
      />,
    );
    await flushLoad();
    act(() => {
      vi.advanceTimersByTime(500);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reproducir lectura' }));

    act(() => {
      vi.advanceTimersByTime(200);
    });
    act(() => {
      vi.advanceTimersByTime(400);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente página' }));
    expect(onNextPage).toHaveBeenCalledOnce();

    view.rerender(
      <RsvpOverlay
        pageNumber={2}
        hasNextPage={false}
        loadPageText={loadPageText}
        onNextPage={onNextPage}
        onClose={() => {}}
      />,
    );
    await flushLoad();
    expect(screen.getByText('Pág. 2')).toBeInTheDocument();
    const stage = screen.getByRole('button', { name: 'Reproducir lectura' });
    expect(stage).toHaveTextContent('sigue');
  });

  it('GIVEN RSVP is open WHEN Escape is pressed THEN the overlay closes and the reader stays', async () => {
    const onClose = vi.fn();
    render(
      <RsvpOverlay
        pageNumber={1}
        hasNextPage={false}
        loadPageText={async () => 'hola'}
        onNextPage={() => {}}
        onClose={onClose}
      />,
    );
    await flushLoad();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
