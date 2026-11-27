import { useEffect, useRef, useState } from 'react';
import { ChevronRight, X } from 'lucide-react';
import { StudyView } from '@/components/marks/StudyView';
import { WordCard } from '@/components/marks/WordCard';
import { copy, emptyLead, summaryLine } from '@/lib/marks/copy';
import { MARK_SHORTCUT } from '@/lib/marks/keys';
import type { WordMark } from '@/lib/marks/types';

type Tab = 'page' | 'book';

export function ReviewPanel({
  title,
  marks,
  pageNumber,
  counts,
  onClose,
  onGoTo,
  onDelete,
  onLearn,
}: {
  title: string;
  marks: WordMark[];
  pageNumber: number;
  counts: Record<string, number>;
  onClose: () => void;
  onGoTo: (mark: WordMark) => void;
  onDelete: (id: string) => void;
  onLearn: (id: string) => void;
}) {
  const [tab, setTab] = useState<Tab>('page');
  const [query, setQuery] = useState('');
  const [learnedOpen, setLearnedOpen] = useState(false);
  const [studying, setStudying] = useState(false);
  const [studyQueue, setStudyQueue] = useState<WordMark[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    rootRef.current?.focus();
  }, []);
  const visible = tab === 'page' ? marks.filter((mark) => onThisPage(mark, pageNumber, counts)) : marks;
  const needle = query.trim().toLowerCase();
  const filtered = tab === 'book' && needle
    ? visible.filter((mark) => `${mark.display} ${mark.context}`.toLowerCase().includes(needle))
    : visible;
  const learning = filtered.filter((mark) => !mark.learned);
  const learned = filtered.filter((mark) => mark.learned);
  const learnedTotal = marks.filter((mark) => mark.learned).length;

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('input, textarea')) return;
    const cards = [...(rootRef.current?.querySelectorAll<HTMLElement>('[data-card]') ?? [])];
    const index = cards.findIndex((card) => card === document.activeElement || card.contains(document.activeElement));
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next = event.key === 'ArrowDown' ? Math.min(cards.length - 1, index + 1) : Math.max(0, index - 1);
      cards[next]?.focus();
    } else if ((event.key === 'Delete' || event.key === 'Backspace') && index >= 0) {
      event.preventDefault();
      event.stopPropagation();
      const id = cards[index]?.dataset.id;
      if (id) onDelete(id);
    } else if ((event.key === 'l' || event.key === 'L') && index >= 0) {
      event.preventDefault();
      const id = cards[index]?.dataset.id;
      if (id) onLearn(id);
    }
  };
  const startStudy = () => {
    if (!learning.length) return;
    setStudyQueue(learning);
    setStudying(true);
  };

  return (
    <div
      ref={rootRef}
      data-mark-ui=""
      tabIndex={-1}
      role="dialog"
      aria-label={copy.panel}
      onKeyDown={onKeyDown}
      className="absolute inset-y-0 right-0 z-40 flex w-full flex-col bg-[#FBF7F1] font-sans text-[#14213D] shadow-[-12px_0_40px_rgba(16,38,63,0.18)] outline-none sm:w-[min(520px,92vw)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#086CA8]"
    >
      {studying ? (
        <StudyView queue={studyQueue} onKnow={onLearn} onBack={() => setStudying(false)} />
      ) : (
        <>
          <header className="flex items-start gap-3 bg-[#F4EADB] px-5 py-5 pr-12">
            <div aria-hidden className="grid h-5 w-5 shrink-0 -rotate-6 place-items-center rounded-md bg-[#F2B53A] text-[13px] font-bold">i</div>
            <div className="min-w-0">
              <h2 className="line-clamp-2 text-base font-semibold leading-snug">{title}</h2>
              <p className="mt-1 text-sm font-medium text-[#4A5468]">{summaryLine(marks.length, learnedTotal)}</p>
            </div>
            <button type="button" aria-label={copy.close} className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-lg" onClick={onClose}>
              <X className="h-4 w-4" />
            </button>
          </header>
          <div role="tablist" className="mx-4 mt-3 grid grid-cols-2 gap-1 rounded-[14px] bg-[#F4EADB] p-1">
            <TabButton id="page" selected={tab === 'page'} onClick={() => setTab('page')}>{copy.thisPage}</TabButton>
            <TabButton id="book" selected={tab === 'book'} onClick={() => setTab('book')}>{copy.wholeBook}</TabButton>
          </div>
          <div className="min-h-0 flex-1 overflow-auto px-4 pb-4">
            {tab === 'book' && (
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={copy.search}
                aria-label={copy.search}
                className="mt-3 h-11 w-full rounded-xl border-0 bg-white px-3.5 text-[15px] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#086CA8]"
              />
            )}
            <ListBody
              tab={tab}
              marks={marks}
              learning={learning}
              learned={learned}
              query={query}
              learnedOpen={learnedOpen}
              counts={counts}
              onToggleLearned={() => setLearnedOpen((open) => !open)}
              onGoTo={onGoTo}
              onLearn={onLearn}
              onDelete={onDelete}
            />
          </div>
          {learning.length > 0 && (
            <footer className="border-t border-[#E8DFD2] bg-[#FBF7F1] p-4">
              <button type="button" className="h-12 w-full rounded-xl bg-[#086CA8] text-base font-semibold text-white" onClick={startStudy}>
                {copy.study}
              </button>
            </footer>
          )}
        </>
      )}
    </div>
  );
}

function onThisPage(mark: WordMark, pageNumber: number, counts: Record<string, number>): boolean {
  if (mark.id in counts) return counts[mark.id] > 0 || mark.pageNumber === pageNumber;
  return mark.pageNumber === pageNumber;
}

function TabButton({ id, selected, onClick, children }: { id: string; selected: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      role="tab"
      id={id}
      aria-selected={selected}
      className={`h-10 rounded-[10px] font-semibold ${selected ? 'bg-white text-[#14213D] shadow-sm' : 'text-[#4A5468]'}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function ListBody({
  tab,
  marks,
  learning,
  learned,
  query,
  learnedOpen,
  counts,
  onToggleLearned,
  onGoTo,
  onLearn,
  onDelete,
}: {
  tab: Tab;
  marks: WordMark[];
  learning: WordMark[];
  learned: WordMark[];
  query: string;
  learnedOpen: boolean;
  counts: Record<string, number>;
  onToggleLearned: () => void;
  onGoTo: (mark: WordMark) => void;
  onLearn: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  if (tab === 'book' && query.trim() && learning.length + learned.length === 0) {
    return <Empty title={copy.emptySearch(query.trim())} />;
  }
  if (marks.length === 0) return <Empty title={copy.emptyTitle} body={emptyLead()} kbd={MARK_SHORTCUT} />;
  if (learning.length === 0 && learned.length === 0) return <Empty title={copy.emptyPageTitle} />;
  if (learning.length === 0 && learned.length > 0) {
    return (
      <>
        <Empty title={copy.emptyLearned} />
        <LearnedBlock open={learnedOpen} count={learned.length} onToggle={onToggleLearned} marks={learned} counts={counts} onGoTo={onGoTo} onLearn={onLearn} onDelete={onDelete} />
      </>
    );
  }
  return (
    <>
      <h3 className="mb-2 mt-4 text-[13px] font-bold uppercase tracking-[0.06em] text-[#4A5468]">{copy.learning}</h3>
      {learning.map((mark) => (
        <Card key={mark.id} mark={mark} counts={counts} onGoTo={onGoTo} onLearn={onLearn} onDelete={onDelete} />
      ))}
      {learned.length > 0 && (
        <LearnedBlock open={learnedOpen} count={learned.length} onToggle={onToggleLearned} marks={learned} counts={counts} onGoTo={onGoTo} onLearn={onLearn} onDelete={onDelete} />
      )}
    </>
  );
}

function LearnedBlock(props: {
  open: boolean;
  count: number;
  onToggle: () => void;
  marks: WordMark[];
  counts: Record<string, number>;
  onGoTo: (mark: WordMark) => void;
  onLearn: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <>
      <button type="button" className="mt-2 flex h-10 w-full items-center justify-between text-[13px] font-bold uppercase tracking-[0.06em] text-[#4A5468]" aria-expanded={props.open} onClick={props.onToggle}>
        {copy.learned} ({props.count})
        <ChevronRight className={`h-4 w-4 transition-transform ${props.open ? 'rotate-90' : ''}`} />
      </button>
      {props.open && props.marks.map((mark) => (
        <Card key={mark.id} mark={mark} counts={props.counts} onGoTo={props.onGoTo} onLearn={props.onLearn} onDelete={props.onDelete} />
      ))}
    </>
  );
}

function Card(props: {
  mark: WordMark;
  counts: Record<string, number>;
  onGoTo: (mark: WordMark) => void;
  onLearn: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div data-id={props.mark.id}>
      <WordCard
        mark={props.mark}
        count={props.counts[props.mark.id] ?? 0}
        onGoTo={() => props.onGoTo(props.mark)}
        onLearn={() => props.onLearn(props.mark.id)}
        onDelete={() => props.onDelete(props.mark.id)}
      />
    </div>
  );
}

function Empty({ title, body, kbd, action, onAction }: { title: string; body?: string; kbd?: string; action?: string; onAction?: () => void }) {
  return (
    <div className="px-3 py-8 text-center">
      <div aria-hidden className="mx-auto mb-4 grid h-16 w-24 -rotate-6 place-items-center rounded-2xl bg-[#F2B53A] text-4xl font-bold">i</div>
      <h3 className="text-xl font-bold">{title}</h3>
      {body && (
        <p className="mx-auto mt-2 max-w-[36ch] text-[15px] font-medium leading-relaxed text-[#4A5468]">
          {kbd ? <ShortcutText text={body} shortcut={kbd} /> : body}
        </p>
      )}
      {action && (
        <button type="button" className="mt-4 h-12 rounded-xl bg-[#086CA8] px-4 font-semibold text-white" onClick={onAction}>
          {action}
        </button>
      )}
    </div>
  );
}

function ShortcutText({ text, shortcut }: { text: string; shortcut: string }) {
  const parts = text.split(shortcut);
  if (parts.length < 2) return <>{text}</>;
  return (
    <>
      {parts[0]}
      <kbd className="rounded-md bg-[#F4EADB] px-1 font-semibold">{shortcut}</kbd>
      {parts.slice(1).join(shortcut)}
    </>
  );
}
