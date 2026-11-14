import * as pdfjs from 'pdfjs-dist';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useReaderMarginTurn } from '@/hooks/useReaderMarginTurn';
import { useReaderExternalLinks } from '@/hooks/useReaderExternalLinks';
import LinkService from 'react-pdf/dist/LinkService.js';
import {
  LinkTarget,
  applyReaderExternalLinkPolicy,
  externalBookUrl,
  type ReaderLinkService,
} from '@/lib/readerExternalLinks';
import type { ReaderBox } from '@/lib/readerMarginTurn';

const viewportBox: ReaderBox = { left: 0, top: 0, width: 1000, height: 800 };
const pageBox: ReaderBox = { left: 400, top: 200, width: 200, height: 300 };

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

function Book({
  html,
  bookRef,
}: {
  html?: string;
  bookRef?: RefObject<HTMLDivElement | null>;
}) {
  const localRef = useRef<HTMLDivElement>(null);
  const ref = bookRef ?? localRef;
  useReaderExternalLinks(ref);
  return <div ref={ref} data-reader-page="" data-testid="book" dangerouslySetInnerHTML={html ? { __html: html } : undefined} />;
}

describe('reader external links', () => {
  const opened: { opener: Window | null }[] = [];

  beforeEach(() => {
    opened.length = 0;
    vi.spyOn(window, 'open').mockImplementation((url?: string | URL) => {
      const popup = { opener: window, name: String(url ?? '') } as Window;
      opened.push(popup);
      return popup;
    });
  });

  it('should point pdf.js external links at LinkTarget.BLANK with noopener', () => {
    const linkService: ReaderLinkService = {
      externalLinkTarget: LinkTarget.NONE,
      externalLinkRel: null,
      setExternalLinkTarget: vi.fn(),
      setExternalLinkRel: vi.fn(),
    };
    applyReaderExternalLinkPolicy(linkService);
    expect(linkService.externalLinkTarget).toBe(LinkTarget.BLANK);
    expect(linkService.externalLinkTarget).toBe(2);
    expect(linkService.externalLinkRel).toBe('noopener noreferrer');
    expect(linkService.setExternalLinkTarget).toHaveBeenCalledWith('_blank');
    expect(linkService.setExternalLinkRel).toHaveBeenCalledWith('noopener noreferrer');

    // Importing pdf.js first installs the global the viewer link service expects.
    expect(typeof pdfjs.getDocument).toBe('function');
    const service = new LinkService();
    applyReaderExternalLinkPolicy(service);
    expect(service.externalLinkTarget).toBe(LinkTarget.BLANK);
    expect(service.externalLinkRel).toBe('noopener noreferrer');
    const anchor = document.createElement('a');
    service.addLinkAttributes(anchor, 'https://publisher.example/paper', false);
    expect(anchor.target).toBe('_blank');
    expect(anchor.rel).toBe('noopener noreferrer');
    expect(anchor.href).toBe('https://publisher.example/paper');
  });

  it('should open an external url in a new tab and leave the app location unchanged', () => {
    const here = window.location.href;
    const { getByText } = render(<Book html={'<a href="https://publisher.example/paper"><span>Paper</span></a>'} />);
    const text = getByText('Paper');
    fireEvent.click(text);
    expect(window.open).toHaveBeenCalledWith(
      'https://publisher.example/paper',
      '_blank',
      'noopener,noreferrer',
    );
    expect(opened[0]?.opener).toBeNull();
    expect(text.closest('a')).toHaveAttribute('target', '_blank');
    expect(text.closest('a')).toHaveAttribute('rel', 'noopener noreferrer');
    expect(window.location.href).toBe(here);
  });

  it('should keep in-document destinations in the book', () => {
    const here = window.location.href;
    const goto = vi.fn();
    const { getByRole } = render(
      <Book html={'<section data-internal-link=""><a href="#">Chapter</a></section><a href="#section-2">Section</a>'} />,
    );
    const chapter = getByRole('link', { name: 'Chapter' });
    const section = getByRole('link', { name: 'Section' });
    chapter.onclick = () => {
      goto(3);
      return false;
    };
    section.onclick = () => {
      goto(2);
      return false;
    };
    fireEvent.click(chapter);
    fireEvent.click(section);
    expect(goto.mock.calls).toEqual([[3], [2]]);
    expect(window.open).not.toHaveBeenCalled();
    expect(window.location.href).toBe(here);
    expect(chapter).not.toHaveAttribute('target', '_blank');
  });

  it('should keep an epub chapter inside its frame and open urls that would replace the app', async () => {
    const { getByTestId } = render(<Book />);
    const book = getByTestId('book');
    const frame = document.createElement('iframe');
    await act(async () => {
      book.append(frame);
    });
    const doc = frame.contentDocument;
    if (!doc) throw new Error('missing frame document');
    doc.head.innerHTML = '<base href="https://book.example/epub/">';
    doc.body.innerHTML = [
      '<a id="chapter" href="chapter2.xhtml">Chapter</a>',
      '<a id="note" href="https://notes.example/1">Note</a>',
      '<a id="escape" href="chapter3.xhtml" target="_top">Escape</a>',
    ].join('');
    const chapter = doc.getElementById('chapter') as HTMLAnchorElement | null;
    const note = doc.getElementById('note') as HTMLAnchorElement | null;
    const escape = doc.getElementById('escape') as HTMLAnchorElement | null;
    if (!chapter || chapter.tagName !== 'A') throw new Error('missing chapter');
    if (!note || note.tagName !== 'A') throw new Error('missing note');
    if (!escape || escape.tagName !== 'A') throw new Error('missing escape');
    expect(externalBookUrl(chapter)).toBeNull();
    expect(externalBookUrl(note)).toBe('https://notes.example/1');
    expect(externalBookUrl(escape)).toMatch(/chapter3\.xhtml$/);

    const here = window.location.href;
    note.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(window.open).toHaveBeenCalledWith('https://notes.example/1', '_blank', 'noopener,noreferrer');
    expect(window.location.href).toBe(here);
    chapter.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(window.open).toHaveBeenCalledTimes(1);
  });

  it('should not let a link press become a page turn, and should still allow selection', () => {
    const onTurn = vi.fn();
    function Shelf() {
      const bookRef = useRef<HTMLDivElement>(null);
      useReaderExternalLinks(bookRef);
      useEffect(() => {
        const parent = bookRef.current?.parentElement;
        if (!parent) return undefined;
        const turn = () => onTurn();
        parent.addEventListener('pointerdown', turn);
        parent.addEventListener('dblclick', turn);
        parent.addEventListener('click', turn);
        return () => {
          parent.removeEventListener('pointerdown', turn);
          parent.removeEventListener('dblclick', turn);
          parent.removeEventListener('click', turn);
        };
      }, []);
      return (
        <div>
          <div ref={bookRef} data-reader-page="">
            <a href="https://publisher.example/paper"><span>Paper</span></a>
            <a href="#section-2">Section</a>
            <p>body</p>
          </div>
        </div>
      );
    }
    const { getByText } = render(<Shelf />);
    const paper = getByText('Paper');
    const down = new MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 });
    paper.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(false);
    fireEvent.dblClick(paper);
    fireEvent.click(getByText('Section'));
    expect(onTurn).not.toHaveBeenCalled();
    fireEvent.pointerDown(getByText('body'));
    expect(onTurn).toHaveBeenCalledTimes(1);
  });
});

function MarginBook({ onTurn }: { onTurn: (direction: 'next' | 'prev') => void }) {
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null);
  const bookRef = useRef<HTMLDivElement>(null);
  useReaderExternalLinks(bookRef);
  useReaderMarginTurn({
    viewport,
    active: true,
    desktop: true,
    canTurn: () => true,
    textSelected: () => false,
    releaseSelection: () => {},
    turn: onTurn,
    onCenter: () => {},
  });
  return (
    <div ref={setViewport} data-testid="viewport">
      <div ref={bookRef} data-reader-page="" data-testid="page">
        <a href="https://publisher.example/side">Side</a>
        <span>page</span>
      </div>
    </div>
  );
}

describe('reader link clicks and margin turns', () => {
  beforeEach(() => {
    vi.spyOn(window, 'open').mockImplementation(() => ({ opener: null }) as Window);
  });

  it('GIVEN a link on the page WHEN the reader double-clicks it THEN the page does not turn', () => {
    const onTurn = vi.fn();
    const { getByRole, getByText, getByTestId } = render(<MarginBook onTurn={onTurn} />);
    getByTestId('viewport').getBoundingClientRect = () => rect(viewportBox);
    getByTestId('page').getBoundingClientRect = () => rect(pageBox);
    fireEvent.dblClick(getByRole('link', { name: 'Side' }), { clientX: 570, clientY: 350, button: 0 });
    expect(onTurn).not.toHaveBeenCalled();
    fireEvent.dblClick(getByText('page'), { clientX: 570, clientY: 350, button: 0 });
    expect(onTurn).toHaveBeenCalledTimes(1);
    expect(onTurn).toHaveBeenCalledWith('next');
  });
});
