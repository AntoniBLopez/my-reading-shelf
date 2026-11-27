import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Highlighter } from 'lucide-react';
import { copy, studyFill, studyProgress, studySummary } from '@/lib/marks/copy';
import { paletteColor } from '@/lib/marks/palette';
import type { WordMark } from '@/lib/marks/types';

export function StudyView({
  queue,
  onKnow,
  onBack,
}: {
  queue: WordMark[];
  onKnow: (id: string) => void;
  onBack: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [known, setKnown] = useState(0);
  const [contextOpen, setContextOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const done = index >= queue.length;
  const current = queue[index];

  useEffect(() => {
    rootRef.current?.focus();
  }, [index, done]);

  const skip = () => {
    setContextOpen(false);
    setIndex((value) => value + 1);
  };
  const know = () => {
    if (!current) return;
    onKnow(current.id);
    setKnown((value) => value + 1);
    skip();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (done || !current) return;
    if (event.key === ' ' || event.code === 'Space') {
      event.preventDefault();
      event.stopPropagation();
      setContextOpen((open) => !open);
    } else if (event.key === '1') {
      event.preventDefault();
      event.stopPropagation();
      skip();
    } else if (event.key === '2') {
      event.preventDefault();
      event.stopPropagation();
      know();
    }
  };

  if (done || !current) {
    return (
      <div ref={rootRef} tabIndex={-1} className="flex h-full flex-col items-center justify-center px-6 text-center outline-none">
        <Highlighter className="h-10 w-10 text-[var(--mark-action)]" aria-hidden />
        <h2 className="mt-3 text-xl font-bold">{copy.studyDone}</h2>
        <p className="mt-2 max-w-[36ch] text-[15px] font-medium text-[var(--mark-muted)]">{studySummary(queue.length, known)}</p>
        <button type="button" className="mt-6 h-12 w-full max-w-sm rounded-xl bg-[var(--mark-action)] font-semibold text-white hover:bg-[var(--mark-action-hover)]" onClick={onBack}>
          {copy.back}
        </button>
      </div>
    );
  }

  const color = paletteColor(current.colorIndex);
  return (
    <div ref={rootRef} tabIndex={-1} className="flex h-full min-h-0 flex-col px-4 pb-4 pt-5 outline-none" onKeyDown={onKeyDown}>
      <p className="mb-2 font-semibold text-[var(--mark-muted)]">{studyProgress(index + 1, queue.length)}</p>
      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-[var(--mark-line)]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={studyFill(index, queue.length)} aria-label={studyProgress(index + 1, queue.length)}>
        <span className="block h-full bg-[var(--mark-action)]" style={{ width: `${studyFill(index, queue.length)}%` }} />
      </div>
      <div className="flex min-h-0 flex-1 items-center">
        <article className="w-full rounded-[20px] border-l-4 bg-[var(--mark-card)] p-7" style={{ borderLeftColor: color }}>
          <h2 className="m-0 text-[32px] font-bold leading-tight">{current.display}</h2>
          <button type="button" className="mt-3 font-semibold text-[var(--mark-action)]" onClick={() => setContextOpen((open) => !open)}>
            {contextOpen ? copy.hideContext : copy.showContext}
          </button>
          {contextOpen && <p className="mt-3 text-sm font-medium leading-relaxed text-[var(--mark-muted)]">{current.context}</p>}
        </article>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <button type="button" className="h-12 rounded-xl border border-[var(--mark-line)] bg-[var(--mark-card)] font-semibold" onClick={skip}>
          {copy.still}
        </button>
        <button type="button" className="h-12 rounded-xl bg-success font-semibold text-success-foreground" onClick={know}>
          {copy.know}
        </button>
      </div>
      <p className="mt-2 text-center text-xs text-[var(--mark-muted)]">{copy.studyHint}</p>
    </div>
  );
}
