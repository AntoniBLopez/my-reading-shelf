import { useState } from 'react';
import { copy, studyProgress, studySummary } from '@/lib/marks/copy';
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
  const done = index >= queue.length;
  const current = queue[index];

  if (done || !current) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center text-[#14213D]">
        <MarkLogo />
        <h2 className="mt-2 text-xl font-bold">{copy.studyDone}</h2>
        <p className="mt-2 max-w-[36ch] text-[15px] font-medium text-[#4A5468]">{studySummary(queue.length, known)}</p>
        <button type="button" className="mt-6 h-12 w-full max-w-sm rounded-xl bg-[#086CA8] font-semibold text-white" onClick={onBack}>
          {copy.back}
        </button>
      </div>
    );
  }

  const color = paletteColor(current.colorIndex);
  return (
    <div className="flex h-full min-h-0 flex-col px-4 pb-4 pt-5 text-[#14213D]">
      <p className="mb-2 font-semibold text-[#4A5468]">{studyProgress(index + 1, queue.length)}</p>
      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-[#F4EADB]" aria-hidden>
        <span className="block h-full bg-[#086CA8]" style={{ width: `${Math.round((index / queue.length) * 100)}%` }} />
      </div>
      <div className="flex min-h-0 flex-1 items-center">
        <article className="w-full rounded-[20px] border-l-4 bg-white p-7" style={{ borderLeftColor: color }}>
          <h2 className="m-0 text-[32px] font-bold leading-tight">{current.display}</h2>
          <button
            type="button"
            className="mt-3 font-semibold text-[#086CA8]"
            onClick={() => setContextOpen((open) => !open)}
          >
            {contextOpen ? copy.hideContext : copy.showContext}
          </button>
          {contextOpen && (
            <p className="mt-3 text-sm font-medium leading-relaxed text-[#4A5468]">{current.context}</p>
          )}
        </article>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          className="h-12 rounded-xl border border-[#E8DFD2] bg-white font-semibold"
          onClick={() => {
            setContextOpen(false);
            setIndex((value) => value + 1);
          }}
        >
          {copy.still}
        </button>
        <button
          type="button"
          className="h-12 rounded-xl bg-[#2F6B3A] font-semibold text-white"
          onClick={() => {
            onKnow(current.id);
            setKnown((value) => value + 1);
            setContextOpen(false);
            setIndex((value) => value + 1);
          }}
        >
          {copy.know}
        </button>
      </div>
    </div>
  );
}

function MarkLogo() {
  return (
    <div
      aria-hidden
      className="grid h-16 w-24 -rotate-6 place-items-center rounded-2xl bg-[#F2B53A] text-4xl font-bold text-[#14213D]"
    >
      i
    </div>
  );
}
