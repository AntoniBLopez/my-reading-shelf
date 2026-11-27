import { Highlighter, NotebookPen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ReaderWordControls } from '@/hooks/useReaderWordMarks';
import { isApplePlatform, markTooltip, panelTooltip } from '@/lib/marks/keys';

export function MarkToolbar({ controls }: { controls: ReaderWordControls }) {
  const apple = isApplePlatform(typeof navigator === 'undefined' ? '' : navigator.userAgent);
  const mark = markTooltip(apple);
  const panel = panelTooltip(apple);
  return (
    <>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={controls.toggleSelection}
        aria-label={mark}
        title={mark}
      >
        <Highlighter className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={controls.togglePanel}
        aria-label={panel}
        aria-expanded={controls.panelOpen}
        title={panel}
      >
        <NotebookPen className="h-4 w-4" />
      </Button>
    </>
  );
}
