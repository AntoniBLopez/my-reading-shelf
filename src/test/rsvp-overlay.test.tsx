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
  it('renders the pivot pieces with no gap between them', () => {
    const { container } = render(<RsvpWord word="dimension" orpIndex={2} />);
    const grid = container.firstElementChild;
    expect(grid).not.toBeNull();
    const stray = [...grid!.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE);
    expect(stray).toEqual([]);
    expect(grid!.textContent).toBe('dimension');
    expect([...grid!.children].map((node) => node.textContent)).toEqual(['di', 'm', 'ension']);
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

  it('locks the recognition letter in the center and pauses from the word area', async () => {
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
    expect(stage.querySelector('.text-primary')).toHaveTextContent('o');
    expect(screen.getByText('Pág. 3')).toBeInTheDocument();

    fireEvent.click(stage);
    const playing = screen.getByRole('button', { name: 'Pausar lectura' });
    fireEvent.click(playing);
    expect(screen.getByRole('button', { name: 'Reproducir lectura' })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByRole('button', { name: 'Reproducir lectura' }).querySelector('.text-primary')).toHaveTextContent('o');
  });

  it('stops at the end of the page and continues on the next one', async () => {
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

  it('closes with Escape without leaving the reader', async () => {
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
