import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useReaderArrowKeys } from '@/hooks/useReaderArrowKeys';

function Keys({
  blocked = false,
  onTurn,
}: {
  blocked?: boolean;
  onTurn: (direction: 'next' | 'prev') => void;
}) {
  useReaderArrowKeys(true, () => blocked, onTurn);
  return (
    <div>
      <input aria-label="Página" />
    </div>
  );
}

function key(keyName: string, target: EventTarget = window) {
  const event = new KeyboardEvent('keydown', { key: keyName, bubbles: true, cancelable: true });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

describe('reader arrow keys', () => {
  it('GIVEN the reader WHEN an arrow is pressed THEN the shared turn runs once', () => {
    const onTurn = vi.fn();
    render(<Keys onTurn={onTurn} />);
    key('ArrowRight');
    key('ArrowLeft');
    key('ArrowUp');
    key('ArrowDown');
    expect(onTurn.mock.calls).toEqual([['next'], ['prev'], ['next'], ['prev']]);
  });

  it('GIVEN a field or the speed reader WHEN an arrow is pressed THEN the page stays', () => {
    const onTurn = vi.fn();
    const view = render(<Keys onTurn={onTurn} />);
    key('ArrowRight', view.getByLabelText('Página'));
    view.unmount();
    render(<Keys blocked onTurn={onTurn} />);
    key('ArrowRight');
    expect(onTurn).not.toHaveBeenCalled();
  });

  it('GIVEN a zoom key WHEN it is pressed THEN the arrow turn does not run', () => {
    const onTurn = vi.fn();
    render(<Keys onTurn={onTurn} />);
    key('+');
    key('-');
    expect(onTurn).not.toHaveBeenCalled();
  });
});
