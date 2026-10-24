import { fireEvent, render, screen } from '@testing-library/react';
import { act, useCallback, useRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { useFullscreenKey } from '@/hooks/useFullscreenKey';
import { focusReaderFullscreenRoot, guardReaderFullscreenClick } from '@/lib/readerFullscreen';

function press(key: string, target: Element = document.body) {
  let event!: KeyboardEvent;
  act(() => {
    event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
  });
  return event;
}

function Reader({ onClose }: { onClose: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [turns, setTurns] = useState(0);
  const toggle = useCallback(async () => {
    const root = rootRef.current;
    if (!root) return;
    const native = document.fullscreenElement;
    if (native || fullscreen) {
      if (native && document.exitFullscreen) await document.exitFullscreen();
      setFullscreen(false);
      return;
    }
    focusReaderFullscreenRoot(root);
    if (typeof root.requestFullscreen === 'function') {
      try {
        await root.requestFullscreen();
      } catch {
        // jsdom has no fullscreen host; the flag below still mirrors the reader.
      }
    }
    setFullscreen(true);
  }, [fullscreen]);
  useFullscreenKey(open, () => void toggle());

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setOpen(false);
          onClose();
        }
      }}
    >
      <DialogContent
        hideCloseButton
        onPointerDownOutside={(event) => guardReaderFullscreenClick(rootRef.current, event)}
        onInteractOutside={(event) => guardReaderFullscreenClick(rootRef.current, event)}
      >
        <DialogTitle>Libro</DialogTitle>
        <DialogDescription>Lector</DialogDescription>
        {!fullscreen && (
          <button type="button" onClick={() => onClose()}>
            Cerrar libro
          </button>
        )}
        <div ref={rootRef} tabIndex={-1} data-testid="reader-page" className="outline-none">
          <button type="button" onClick={() => void toggle()}>
            {fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
          </button>
          <button type="button" onClick={() => setTurns((count) => count + 1)}>
            Página siguiente
          </button>
          <button type="button" onClick={() => setTurns((count) => count + 1)}>
            Barra del lector
          </button>
          <p>Pasos {turns}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

describe('reader fullscreen clicks', () => {
  afterEach(() => {
    delete (document as { fullscreenElement?: Element }).fullscreenElement;
  });

  it('GIVEN focus is outside the page WHEN F enters fullscreen THEN a click on the page or header stays in the book', async () => {
    const onClose = vi.fn();
    render(<Reader onClose={onClose} />);
    const page = screen.getByTestId('reader-page');
    page.requestFullscreen = () => {
      Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => page });
      return Promise.resolve();
    };
    screen.getByRole('button', { name: 'Cerrar libro' }).focus();

    press('f');
    await act(async () => {
      await Promise.resolve();
    });

    expect(page.contains(document.activeElement)).toBe(true);
    expect(screen.getByRole('button', { name: 'Salir de pantalla completa' })).toBeInTheDocument();
    expect(document.fullscreenElement).toBe(page);

    fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    fireEvent.click(screen.getByRole('button', { name: 'Barra del lector' }));
    fireEvent.pointerDown(document.body);
    fireEvent.click(document.body);

    expect(screen.getByText('Pasos 2')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('GIVEN fullscreen was entered with the button WHEN the page and header are clicked THEN the book stays open and the controls run', async () => {
    const onClose = vi.fn();
    render(<Reader onClose={onClose} />);
    const page = screen.getByTestId('reader-page');
    page.requestFullscreen = () => {
      Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => page });
      return Promise.resolve();
    };

    fireEvent.click(screen.getByRole('button', { name: 'Pantalla completa' }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(document.fullscreenElement).toBe(page);
    expect(page.contains(document.activeElement)).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    fireEvent.click(screen.getByRole('button', { name: 'Barra del lector' }));

    expect(screen.getByText('Pasos 2')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
