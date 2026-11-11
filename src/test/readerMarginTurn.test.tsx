import { useState } from 'react';
import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useReaderMarginTurn } from '@/hooks/useReaderMarginTurn';
import { marginTurnAction, marginTurnBlocked, readerPageBox, type ReaderBox } from '@/lib/readerMarginTurn';

const viewport: ReaderBox = { left: 0, top: 0, width: 1000, height: 800 };
const page: ReaderBox = { left: 400, top: 200, width: 200, height: 300 };

describe('margin turn geometry', () => {
  it('should turn from the empty gutter across the full reader height', () => {
    expect(marginTurnAction(30, 8, viewport, null, false)).toBe('prev');
    expect(marginTurnAction(30, 790, viewport, null, false)).toBe('prev');
    expect(marginTurnAction(970, 8, viewport, null, false)).toBe('next');
    expect(marginTurnAction(970, 790, viewport, null, false)).toBe('next');
  });

  it('should turn the gutter beside a small page even inside the old center band', () => {
    expect(marginTurnAction(450, 12, viewport, null, false)).toBe('prev');
    expect(marginTurnAction(560, 12, viewport, null, false)).toBe('next');
    expect(marginTurnAction(490, 12, viewport, null, false)).toBe('prev');
    expect(marginTurnAction(490, 350, viewport, page, false)).toBe('center');
  });

  it('should keep the page side bands and the center control', () => {
    expect(marginTurnAction(430, 350, viewport, page, false)).toBe('prev');
    expect(marginTurnAction(500, 350, viewport, page, false)).toBe('center');
    expect(marginTurnAction(570, 350, viewport, page, false)).toBe('next');
  });

  it('should follow the visible reader when the page is zoomed, not a fixed frame', () => {
    const screen = { left: 0, top: 0, width: 500, height: 400 };
    expect(marginTurnAction(10, 10, screen, null, false)).toBe('prev');
    expect(marginTurnAction(480, 390, screen, null, false)).toBe('next');
    const fullscreen = { left: 0, top: 0, width: 1920, height: 1080 };
    expect(marginTurnAction(12, 1070, fullscreen, null, false)).toBe('prev');
    expect(marginTurnAction(1900, 8, fullscreen, null, false)).toBe('next');
    const widePage = { left: 0, top: 0, width: 1600, height: 2000 };
    const rightEdge = { left: 800, top: 0, width: 400, height: 600 };
    expect(marginTurnAction(820, 40, rightEdge, widePage, false)).toBe('center');
    expect(marginTurnAction(1100, 40, rightEdge, widePage, false)).toBe('next');
    expect(marginTurnAction(820, 40, rightEdge, null, false)).toBe('prev');
  });

  it('should ignore clicks outside the reader, blocked controls, and a text selection', () => {
    expect(marginTurnAction(30, -4, viewport, null, false)).toBeNull();
    expect(marginTurnAction(30, 20, viewport, null, true)).toBeNull();
    const button = document.createElement('button');
    const chrome = document.createElement('div');
    chrome.setAttribute('data-reader-chrome', '');
    chrome.append(button);
    expect(marginTurnBlocked(button, false)).toBe(true);
    expect(marginTurnBlocked(document.createElement('div'), true)).toBe(true);
    expect(marginTurnBlocked(document.createElement('div'), false)).toBe(false);
  });

  it('should read the page element and ignore a frame wrapped around it', () => {
    const frame = document.createElement('div');
    frame.setAttribute('data-book-frame', '');
    const book = document.createElement('div');
    book.setAttribute('data-reader-page', '');
    book.setAttribute('data-show-border', 'true');
    frame.append(book);
    book.getBoundingClientRect = () =>
      ({ left: 400, top: 200, width: 200, height: 300, right: 600, bottom: 500, x: 400, y: 200, toJSON() { return {}; } }) as DOMRect;
    expect(readerPageBox(book)).toMatchObject(page);
    expect(readerPageBox(frame)).toBeNull();
    book.setAttribute('data-show-border', 'false');
    expect(readerPageBox(book)).toMatchObject(page);
  });
});

function Reader({
  showBorder,
  desktop = true,
  canTurn = () => true,
  textSelected = () => false,
  onTurn,
  onCenter,
}: {
  showBorder: boolean;
  desktop?: boolean;
  canTurn?: () => boolean;
  textSelected?: () => boolean;
  onTurn: (direction: 'next' | 'prev') => void;
  onCenter: () => void;
}) {
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null);
  useReaderMarginTurn({
    viewport,
    active: true,
    desktop,
    canTurn,
    textSelected,
    turn: onTurn,
    onCenter,
  });
  return (
    <div>
      <header data-reader-chrome="">
        <button type="button">Bordes</button>
      </header>
      <div ref={setViewport} data-testid="viewport">
        <div data-book-frame="">
          <button type="button">Dentro</button>
          <div data-reader-page="" data-show-border={showBorder ? 'true' : 'false'} data-testid="page">
            página
          </div>
        </div>
      </div>
    </div>
  );
}

function rect(box: ReaderBox): DOMRect {
  return {
    ...box,
    right: box.left + box.width,
    bottom: box.top + box.height,
    x: box.left,
    y: box.top,
    toJSON() {
      return {};
    },
  } as DOMRect;
}

function mount(showBorder: boolean, options?: {
  desktop?: boolean;
  canTurn?: () => boolean;
  textSelected?: () => boolean;
}) {
  const onTurn = vi.fn();
  const onCenter = vi.fn();
  const view = render(
    <Reader showBorder={showBorder} onTurn={onTurn} onCenter={onCenter} {...options} />,
  );
  const viewportNode = view.getByTestId('viewport');
  const pageNode = view.getByTestId('page');
  viewportNode.getBoundingClientRect = () => rect(viewport);
  pageNode.getBoundingClientRect = () => rect(page);
  return { ...view, onTurn, onCenter, viewportNode, pageNode };
}

function dblclick(node: Element, clientX: number, clientY: number) {
  const event = new MouseEvent('dblclick', { bubbles: true, cancelable: true, clientX, clientY, button: 0 });
  act(() => {
    node.dispatchEvent(event);
  });
}

function pointerDown(node: Element, clientX: number, clientY: number, pointerType: string) {
  const event = new MouseEvent('pointerdown', { bubbles: true, cancelable: true, clientX, clientY, button: 0 });
  Object.defineProperty(event, 'pointerType', { value: pointerType });
  act(() => {
    node.dispatchEvent(event);
  });
}

describe('reader margin double click', () => {
  it('GIVEN empty space around the book WHEN borders are shown or hidden THEN one double click turns that side', () => {
    for (const showBorder of [false, true]) {
      const { onTurn, onCenter, viewportNode, unmount } = mount(showBorder);
      expect(viewportNode.querySelector('[data-reader-page]')?.getAttribute('data-show-border')).toBe(
        showBorder ? 'true' : 'false',
      );
      dblclick(viewportNode, 30, 8);
      dblclick(viewportNode, 30, 790);
      dblclick(viewportNode, 970, 400);
      dblclick(viewportNode, 450, 12);
      expect(onTurn.mock.calls).toEqual([['prev'], ['prev'], ['next'], ['prev']]);
      expect(onCenter).not.toHaveBeenCalled();
      unmount();
    }
  });

  it('GIVEN a double click on the page WHEN it lands on a side or the center THEN the page bands stay', () => {
    const { onTurn, onCenter, pageNode } = mount(false);
    dblclick(pageNode, 430, 350);
    dblclick(pageNode, 500, 350);
    dblclick(pageNode, 570, 350);
    expect(onTurn.mock.calls).toEqual([['prev'], ['next']]);
    expect(onCenter).toHaveBeenCalledTimes(1);
  });

  it('GIVEN header and in-reader controls WHEN they are double clicked THEN the page stays', () => {
    const { onTurn, onCenter, getByRole } = mount(true);
    dblclick(getByRole('button', { name: 'Bordes' }), 40, 10);
    dblclick(getByRole('button', { name: 'Dentro' }), 20, 20);
    expect(onTurn).not.toHaveBeenCalled();
    expect(onCenter).not.toHaveBeenCalled();
  });

  it('GIVEN a mouse drag or a text selection WHEN it happens in the gutter THEN the page stays', () => {
    const selected = mount(false, { textSelected: () => true });
    dblclick(selected.viewportNode, 30, 400);
    pointerDown(selected.viewportNode, 800, 400, 'mouse');
    pointerDown(selected.viewportNode, 100, 400, 'mouse');
    expect(selected.onTurn).not.toHaveBeenCalled();
    selected.unmount();

    const dragging = mount(false);
    pointerDown(dragging.viewportNode, 800, 400, 'mouse');
    pointerDown(dragging.viewportNode, 40, 400, 'mouse');
    expect(dragging.onTurn).not.toHaveBeenCalled();
  });

  it('GIVEN one double click WHEN the page can turn THEN it asks for exactly one step', () => {
    const { onTurn, viewportNode } = mount(false);
    dblclick(viewportNode, 970, 100);
    expect(onTurn).toHaveBeenCalledTimes(1);
    expect(onTurn).toHaveBeenCalledWith('next');
  });

  it('GIVEN a touch double tap followed by the synthetic click WHEN it is the right gutter THEN the page turns once', () => {
    const { onTurn, viewportNode } = mount(false);
    pointerDown(viewportNode, 970, 100, 'touch');
    pointerDown(viewportNode, 972, 102, 'touch');
    dblclick(viewportNode, 972, 102);
    expect(onTurn).toHaveBeenCalledTimes(1);
    expect(onTurn).toHaveBeenCalledWith('next');
  });

  it('GIVEN a phone WHEN the reader gets a mouse double click THEN the touch gesture stays in charge', () => {
    const { onTurn, viewportNode } = mount(false, { desktop: false });
    dblclick(viewportNode, 30, 100);
    expect(onTurn).not.toHaveBeenCalled();
    pointerDown(viewportNode, 30, 100, 'touch');
    pointerDown(viewportNode, 32, 102, 'touch');
    expect(onTurn).toHaveBeenCalledTimes(1);
    expect(onTurn).toHaveBeenCalledWith('prev');
  });

  it('GIVEN the reader pane mounts after the dialog opens WHEN the gutter is double clicked THEN the page turns once', () => {
    const onTurn = vi.fn();
    const onCenter = vi.fn();
    function Delayed() {
      const [open, setOpen] = useState(false);
      const [viewport, setViewport] = useState<HTMLDivElement | null>(null);
      useReaderMarginTurn({
        viewport,
        active: open,
        desktop: true,
        canTurn: () => true,
        textSelected: () => false,
        turn: onTurn,
        onCenter,
      });
      return (
        <div>
          <button type="button" onClick={() => setOpen(true)}>Abrir</button>
          {open && <div ref={setViewport} data-testid="viewport" />}
        </div>
      );
    }
    const view = render(<Delayed />);
    dblclick(view.getByRole('button', { name: 'Abrir' }), 20, 20);
    expect(onTurn).not.toHaveBeenCalled();
    act(() => {
      view.getByRole('button', { name: 'Abrir' }).click();
    });
    const viewportNode = view.getByTestId('viewport');
    viewportNode.getBoundingClientRect = () => rect(viewport);
    dblclick(viewportNode, 900, 40);
    dblclick(viewportNode, 900, 40);
    expect(onTurn.mock.calls).toEqual([['next'], ['next']]);
  });

  it('GIVEN pinch zoom WHEN the gutter is double clicked THEN the page stays', () => {
    const { onTurn, viewportNode } = mount(false, { canTurn: () => false });
    dblclick(viewportNode, 30, 100);
    expect(onTurn).not.toHaveBeenCalled();
  });
});
