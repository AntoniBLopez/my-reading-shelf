import { MarkToast } from '@/components/marks/MarkToast';
import { ReviewPanel } from '@/components/marks/ReviewPanel';
import type { ReaderWordControls } from '@/hooks/useReaderWordMarks';

export function MarkChrome({ controls }: { controls: ReaderWordControls }) {
  return (
    <>
      <MarkToast toast={controls.toast} panelOpen={controls.panelOpen} onUndo={controls.undo} onDismiss={controls.dismissToast} />
      {controls.panelOpen && (
        <ReviewPanel
          title={controls.bookTitle}
          marks={controls.marks}
          pageNumber={controls.pageNumber}
          counts={controls.counts}
          onClose={controls.closePanel}
          onGoTo={controls.goTo}
          onDelete={controls.remove}
          onLearn={controls.learn}
        />
      )}
    </>
  );
}
