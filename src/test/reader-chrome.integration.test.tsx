import { fireEvent, render, screen } from '@testing-library/react';
import { act } from 'react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { useReaderChromeKeys } from '@/hooks/useReaderChromeKeys';

function ReaderChrome() {
  const [visible, setVisible] = useState(true);
  useReaderChromeKeys(true, () => setVisible((current) => !current));
  return (
    <div>
      {visible ? <header>Barra de lectura</header> : <p>Barra oculta</p>}
      <input aria-label="Número de página" />
    </div>
  );
}

function press(key: string, target: Element = document.body) {
  let event!: KeyboardEvent;
  act(() => {
    event = new KeyboardEvent('keydown', {
      key,
      code: key === ' ' ? 'Space' : key,
      bubbles: true,
      cancelable: true,
    });
    target.dispatchEvent(event);
  });
  return event;
}

describe('reader header keys', () => {
  it('GIVEN the reader WHEN Space or Enter is pressed THEN the header bar toggles', () => {
    render(<ReaderChrome />);
    expect(screen.getByText('Barra de lectura')).toBeInTheDocument();

    const space = press(' ');
    expect(space.defaultPrevented).toBe(true);
    expect(screen.getByText('Barra oculta')).toBeInTheDocument();

    const enter = press('Enter');
    expect(enter.defaultPrevented).toBe(true);
    expect(screen.getByText('Barra de lectura')).toBeInTheDocument();
  });

  it('GIVEN a page field is focused WHEN Space is pressed THEN the header stays', () => {
    render(<ReaderChrome />);
    const field = screen.getByRole('textbox', { name: 'Número de página' });
    const space = press(' ', field);
    expect(space.defaultPrevented).toBe(false);
    expect(screen.getByText('Barra de lectura')).toBeInTheDocument();
  });
});
