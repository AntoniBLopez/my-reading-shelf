import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RsvpOverlay } from '@/components/rsvp/RsvpOverlay';

async function flushLoad() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

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

    const stage = screen.getByRole('button', { name: 'Pausar lectura' });
    const pivot = stage.querySelector('.text-primary');
    expect(pivot).toHaveTextContent('o');
    expect(screen.getByText('Pág. 3')).toBeInTheDocument();

    fireEvent.click(stage);
    expect(screen.getByRole('button', { name: 'Reproducir lectura' })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(stage.querySelector('.text-primary')).toHaveTextContent('o');
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
    const stage = screen.getByRole('button', { name: 'Pausar lectura' });
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
