import { ReviewPanel } from '@/components/marks/ReviewPanel';
import { copy } from '@/lib/marks/copy';
import type { PanelLayout } from '@/lib/marks/panelLayout';
import type { ReaderWordControls } from '@/hooks/useReaderWordMarks';

export function MarkChrome({ controls, layout = 'overlay' }: { controls: ReaderWordControls; layout?: PanelLayout }) {
  if (!controls.panelOpen) return null;
  return (
    <>
      {layout !== 'dock' && (
        <button
          type="button"
          aria-label={copy.close}
          className="absolute inset-0 z-30 bg-black/40"
          onClick={controls.closePanel}
        />
      )}
      <ReviewPanel
        layout={layout}
        marks={controls.marks}
        pageNumber={controls.pageNumber}
        counts={controls.counts}
        onClose={controls.closePanel}
        onGoTo={controls.goTo}
        onDelete={controls.remove}
        onLearn={controls.learn}
      />
    </>
  );
}
