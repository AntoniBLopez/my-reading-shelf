import { useCallback, useRef } from 'react';
import { Page } from 'react-pdf';

type TurnSlotProps = {
  pageNumber: number;
  className: string;
  pageWidth: number;
  scale: number;
  devicePixelRatio: number;
  themeKey: string;
  text: boolean;
  onReady: (pageNumber: number) => void;
  onText?: (content: { items?: readonly unknown[] } | null, pageNumber: number) => void;
};

/** One PDF page. The canvas is stamped with the page it actually rendered. */
export function TurnSlot({
  pageNumber,
  className,
  pageWidth,
  scale,
  devicePixelRatio,
  themeKey,
  text,
  onReady,
  onText,
}: TurnSlotProps) {
  const ref = useRef<HTMLDivElement>(null);
  const onRender = useCallback(
    (page: { pageNumber: number }) => {
      const canvas = ref.current?.querySelector('canvas');
      if (canvas instanceof HTMLCanvasElement && !canvas.closest('.pdf-page-curl')) {
        canvas.dataset.page = String(page.pageNumber);
      }
      onReady(page.pageNumber);
    },
    [onReady],
  );

  return (
    <div ref={ref} className={className} aria-hidden={text ? undefined : true}>
      <Page
        width={pageWidth}
        scale={scale}
        devicePixelRatio={devicePixelRatio}
        loading={null}
        className="bg-white dark:bg-black"
        key={`${themeKey}-${pageNumber}`}
        pageNumber={pageNumber}
        renderTextLayer={text}
        renderAnnotationLayer={text}
        onRenderSuccess={onRender}
        onGetTextSuccess={text && onText ? (content) => onText(content, pageNumber) : undefined}
      />
    </div>
  );
}
