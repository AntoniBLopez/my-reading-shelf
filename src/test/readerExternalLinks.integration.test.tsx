import { useState } from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PDFPageStage } from '@/components/PDFPageStage';
import { LinkTarget } from '@/lib/readerExternalLinks';
import type { ReaderLinkService } from '@/lib/readerExternalLinks';

const linkService: ReaderLinkService = {
  externalLinkTarget: LinkTarget.NONE,
  externalLinkRel: null,
  setExternalLinkTarget(target) {
    if (target === '_blank') this.externalLinkTarget = LinkTarget.BLANK;
  },
  setExternalLinkRel(rel) {
    this.externalLinkRel = rel ?? null;
  },
};

vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}));

vi.mock('react-pdf', async () => {
  const React = await import('react');
  return {
    pdfjs: { GlobalWorkerOptions: { workerSrc: '' } },
    useDocumentContext: () => ({ linkService }),
    Document: ({
      children,
      externalLinkTarget,
      externalLinkRel,
    }: {
      children: React.ReactNode;
      externalLinkTarget?: string;
      externalLinkRel?: string;
    }) => (
      <div data-external-target={externalLinkTarget} data-external-rel={externalLinkRel}>
        {children}
      </div>
    ),
    Page: ({
      pageNumber,
      onRenderSuccess,
    }: {
      pageNumber: number;
      onRenderSuccess?: (page: { pageNumber: number }) => void;
    }) => {
      React.useEffect(() => {
        onRenderSuccess?.({ pageNumber });
      }, [pageNumber, onRenderSuccess]);
      return <span>{pageNumber}</span>;
    },
  };
});

const rect = {
  width: 300,
  height: 400,
  top: 0,
  left: 0,
  right: 300,
  bottom: 400,
  x: 0,
  y: 0,
  toJSON() {
    return {};
  },
} as DOMRect;

function pointer(
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  node: EventTarget,
  values: { clientX: number; clientY: number },
) {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: values.clientX,
    clientY: values.clientY,
    button: 0,
  });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  Object.defineProperty(event, 'pointerType', { value: 'touch' });
  act(() => {
    node.dispatchEvent(event);
  });
}

function Reader({ initialPage = 2 }: { initialPage?: number }) {
  const [page, setPage] = useState(initialPage);
  return (
    <PDFPageStage
      pdfUrl="blob:test"
      pageNumber={page}
      numPages={5}
      pageWidth={300}
      scale={1}
      showBookBorder={false}
      getCanTurn={() => true}
      onCommit={setPage}
      onDocumentLoadSuccess={() => {}}
      onDocumentLoadError={() => {}}
      onItemClick={() => {}}
    />
  );
}

describe('book links in the reader', () => {
  let frames: FrameRequestCallback[] = [];

  function flushFrames() {
    const batch = frames.splice(0, frames.length);
    act(() => {
      for (const frame of batch) frame(performance.now());
    });
  }

  beforeEach(() => {
    linkService.externalLinkTarget = LinkTarget.NONE;
    linkService.externalLinkRel = null;
    frames = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(rect);
    vi.spyOn(window, 'open').mockImplementation(() => ({ opener: window }) as Window);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('GIVEN the pdf link service WHEN the page is shown THEN external links target a new tab', async () => {
    const { container } = render(<Reader />);
    await waitFor(() => {
      expect(linkService.externalLinkTarget).toBe(LinkTarget.BLANK);
    });
    expect(linkService.externalLinkRel).toBe('noopener noreferrer');
    const documentNode = container.querySelector('[data-external-target]');
    expect(documentNode?.getAttribute('data-external-target')).toBe('_blank');
    expect(documentNode?.getAttribute('data-external-rel')).toBe('noopener noreferrer');
  });

  it('GIVEN an external link in the book WHEN the reader clicks it THEN a new tab opens and the page stays', async () => {
    const here = window.location.href;
    render(<Reader />);
    const leaf = document.querySelector('.pdf-turn-leaf');
    if (!(leaf instanceof HTMLElement)) throw new Error('missing leaf');
    const link = document.createElement('a');
    link.href = 'https://publisher.example/paper';
    const label = document.createElement('span');
    label.textContent = 'Paper';
    link.append(label);
    leaf.append(link);

    pointer('pointerdown', label, { clientX: 220, clientY: 80 });
    pointer('pointermove', window, { clientX: 40, clientY: 90 });
    flushFrames();
    pointer('pointerup', window, { clientX: 40, clientY: 90 });
    expect(link.querySelector('span')?.textContent).toBe('Paper');
    expect(document.querySelector('.pdf-turn-leaf')?.textContent).toContain('2');
    expect(document.querySelector('.pdf-turn-scene')?.hasAttribute('data-turn')).toBe(false);

    const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    label.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(window.open).toHaveBeenCalledWith(
      'https://publisher.example/paper',
      '_blank',
      'noopener,noreferrer',
    );
    const opened = vi.mocked(window.open).mock.results.at(-1)?.value as { opener: unknown } | null;
    expect(opened?.opener).toBeNull();
    expect(window.location.href).toBe(here);
    expect(document.querySelector('.pdf-turn-leaf')?.textContent).toContain('2');
  });

  it('GIVEN an in-document link WHEN the reader clicks it THEN the book follows it and no tab opens', () => {
    const here = window.location.href;
    render(<Reader />);
    const leaf = document.querySelector('.pdf-turn-leaf');
    if (!(leaf instanceof HTMLElement)) throw new Error('missing leaf');
    const link = document.createElement('a');
    link.href = '#dest';
    link.textContent = 'Contents';
    link.setAttribute('data-element-id', 'dest');
    const section = document.createElement('section');
    section.setAttribute('data-internal-link', '');
    section.append(link);
    leaf.append(section);
    const goto = vi.fn();
    link.onclick = () => {
      goto(4);
      return false;
    };
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    expect(goto).toHaveBeenCalledWith(4);
    expect(window.open).not.toHaveBeenCalled();
    expect(window.location.href).toBe(here);
    expect(document.querySelector('.pdf-turn-leaf')?.textContent).toContain('2');
  });
});
