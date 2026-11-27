import { fireEvent, render, screen } from '@testing-library/react';
import { useRef, useState } from 'react';
import { describe, expect, it } from 'vitest';
import { AuthProvider } from '@/hooks/useAuth';
import { useFullscreenKey } from '@/hooks/useFullscreenKey';
import { useReaderArrowKeys } from '@/hooks/useReaderArrowKeys';
import { useReaderWordMarks } from '@/hooks/useReaderWordMarks';
import { MarkChrome } from '@/components/marks/MarkChrome';
import { MarkToolbar } from '@/components/marks/MarkToolbar';

function Reader({ bookId, text }: { bookId: string; text: string }) {
  const surface = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(2);
  const [full, setFull] = useState(false);
  useFullscreenKey(true, () => setFull((value) => !value));
  const controls = useReaderWordMarks({
    bookId,
    bookTitle: 'Cuaderno de bitácora',
    pageNumber: page,
    surfaceRef: surface,
    active: true,
    shortcuts: true,
    onGoToPage: setPage,
  });
  useReaderArrowKeys(true, () => false, () => setPage((value) => value + 1));
  return (
    <div>
      <p data-testid="page">Página {page}</p>
      <p data-testid="full">{full ? 'completa' : 'ventana'}</p>
      <MarkToolbar controls={controls} />
      <div ref={surface}>
        <div className="pdf-turn-leaf">
          <div className="textLayer">
            <span data-testid="line">{text}</span>
          </div>
        </div>
      </div>
      <MarkChrome controls={controls} />
    </div>
  );
}

function select(word: string) {
  const span = screen.getByTestId('line');
  const node = span.firstChild as Text;
  const start = node.textContent?.indexOf(word) ?? -1;
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, start + word.length);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function press(code: string, init: KeyboardEventInit = {}) {
  fireEvent.keyDown(window, { key: code.replace('Key', '').toLowerCase(), code, bubbles: true, cancelable: true, ...init });
}

describe('reader word marks', () => {
  it('GIVEN a selected word WHEN Ctrl+Alt+M is pressed THEN the word is marked for the book and undo removes it', async () => {
    localStorage.clear();
    render(
      <AuthProvider>
        <Reader bookId="book-bruma" text="La bruma cubre el muelle y la bruma vuelve." />
      </AuthProvider>,
    );
    select('bruma');
    press('KeyM', { ctrlKey: true, altKey: true });

    expect(await screen.findByRole('status')).toHaveTextContent('"bruma" marcada · 2 veces en esta página');
    expect(window.getSelection()?.toString() ?? '').toBe('');
    expect(screen.getByTestId('page')).toHaveTextContent('Página 2');
    expect(screen.getByTestId('full')).toHaveTextContent('ventana');

    fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Panel de repaso' }));
    expect(screen.getByText('Aún no hay palabras marcadas en este libro')).toBeInTheDocument();
  });

  it('GIVEN marked words WHEN the review panel is opened THEN the reader can study and jump to the page', async () => {
    localStorage.clear();
    render(
      <AuthProvider>
        <Reader bookId="book-study" text="El faro guía al barco entre la bruma del faro." />
      </AuthProvider>,
    );
    select('faro');
    press('KeyM', { ctrlKey: true, altKey: true });
    select('bruma');
    press('KeyM', { ctrlKey: true, altKey: true });
    press('KeyL', { ctrlKey: true, altKey: true });

    expect(await screen.findByRole('dialog', { name: 'Panel de repaso' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'faro' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'bruma' })).toBeInTheDocument();
    expect(screen.getByTestId('full')).toHaveTextContent('ventana');

    fireEvent.click(screen.getByRole('button', { name: 'Repasar estas palabras' }));
    fireEvent.click(screen.getByRole('button', { name: 'Me la sé' }));
    fireEvent.click(screen.getByRole('button', { name: 'Aún no' }));
    expect(screen.getByText('Eso es todo por ahora')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Volver a la lista' }));
    expect(screen.getByText('2 palabras · 1 aprendida')).toBeInTheDocument();

    fireEvent.keyDown(screen.getByTestId('line'), { key: 'ArrowRight', code: 'ArrowRight' });
    expect(screen.getByTestId('page')).toHaveTextContent('Página 3');
    fireEvent.keyDown(screen.getByTestId('line'), { key: 'f', code: 'KeyF' });
    expect(screen.getByTestId('full')).toHaveTextContent('completa');
  });

  it('GIVEN no selection WHEN the mark button is used THEN the reader asks for a word and does not turn the page', async () => {
    localStorage.clear();
    render(
      <AuthProvider>
        <Reader bookId="book-empty" text="Una página en calma." />
      </AuthProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Marcar o quitar la palabra seleccionada' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Selecciona una palabra primero');
    expect(screen.getByTestId('page')).toHaveTextContent('Página 2');
    press('KeyF');
    expect(screen.getByTestId('full')).toHaveTextContent('completa');
  });
});
