import { Highlighter, NotebookPen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ReaderWordControls } from '@/hooks/useReaderWordMarks';
import { copy } from '@/lib/marks/copy';
import { MARK_SHORTCUT, PANEL_SHORTCUT } from '@/lib/marks/keys';

export function MarkToolbar({ controls }: { controls: ReaderWordControls }) {
  return (
    <>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={controls.toggleSelection}
        aria-label={copy.mark}
        title={`${copy.markShort} (${MARK_SHORTCUT})`}
      >
        <Highlighter className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={controls.togglePanel}
        aria-label={copy.panel}
        aria-expanded={controls.panelOpen}
        title={`${copy.panel} (${PANEL_SHORTCUT})`}
      >
        <NotebookPen className="h-4 w-4" />
      </Button>
    </>
  );
}
