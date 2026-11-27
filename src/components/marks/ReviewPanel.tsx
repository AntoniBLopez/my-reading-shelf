import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ChevronRight, Highlighter, X } from 'lucide-react';
import { StudyView } from '@/components/marks/StudyView';
import { WordCard } from '@/components/marks/WordCard';
import { copy, emptyLead, summaryLine } from '@/lib/marks/copy';
import { isApplePlatform, shortcutGlyph } from '@/lib/marks/keys';
import { panelFrameClass, sheetSwipeCloses, type PanelLayout } from '@/lib/marks/panelLayout';
import type { WordMark } from '@/lib/marks/types';

type Tab = 'page' | 'book';
const actionButton = 'h-12 w-full rounded-xl bg-[var(--mark-action)] text-base font-semibold text-white hover:bg-[var(--mark-action-hover)]';

export function ReviewPanel({
  layout,
  marks,
  pageNumber,
  counts,
  onClose,
  onGoTo,
  onDelete,
  onLearn,
}: {
  layout: PanelLayout;
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
    if (!studying) rootRef.current?.focus();
  }, [studying]);
  const visible = tab === 'page' ? marks.filter((mark) => onThisPage(mark, pageNumber, counts)) : marks;
  const needle = query.trim().toLowerCase();
  const filtered = tab === 'book' && needle
    ? visible.filter((mark) => `${mark.display} ${mark.context}`.toLowerCase().includes(needle))
    : visible;
  const learning = filtered.filter((mark) => !mark.learned);
  const learned = filtered.filter((mark) => mark.learned);
  const learnedTotal = marks.filter((mark) => mark.learned).length;
  const shortcut = shortcutGlyph(isApplePlatform(typeof navigator === 'undefined' ? '' : navigator.userAgent));

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (studying) return;
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
      data-panel-layout={layout}
      tabIndex={-1}
      role={layout === 'dock' ? 'complementary' : 'dialog'}
      aria-label={copy.panel}
      onKeyDown={onKeyDown}
      className={panelFrameClass(layout)}
    >
      {studying ? (
        <StudyView queue={studyQueue} onKnow={onLearn} onBack={() => setStudying(false)} />
      ) : (
        <>
          <SheetTop layout={layout} onClose={onClose}>
            <header className="relative flex items-start gap-3 bg-[var(--mark-raised)] px-5 py-5 pr-12">
              <Highlighter className="mt-0.5 h-5 w-5 shrink-0 text-[var(--mark-ink)]" aria-hidden />
              <div className="min-w-0">
                <h2 className="text-base font-semibold leading-snug">{copy.panel}</h2>
                {marks.length > 0 && (
                  <p className="mt-1 text-sm font-medium text-[var(--mark-muted)]">{summaryLine(marks.length, learnedTotal)}</p>
                )}
              </div>
              <button type="button" aria-label={copy.close} className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-lg" onClick={onClose}>
                <X className="h-4 w-4" />
              </button>
            </header>
          </SheetTop>
          <div role="tablist" className="mx-4 mt-3 grid grid-cols-2 gap-1 rounded-[14px] bg-[var(--mark-raised)] p-1">
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
                className="mt-3 h-11 w-full rounded-xl border-0 bg-[var(--mark-card)] px-3.5 text-[15px] text-[var(--mark-text)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--mark-ink)]"
              />
            )}
            <ListBody
              tab={tab}
              marks={marks}
              learning={learning}
              learned={learned}
              query={query}
              shortcut={shortcut}
              learnedOpen={learnedOpen}
              counts={counts}
              onToggleLearned={() => setLearnedOpen((open) => !open)}
              onGoTo={onGoTo}
              onLearn={onLearn}
              onDelete={onDelete}
            />
          </div>
          {learning.length > 0 && (
            <footer className="border-t border-[var(--mark-line)] bg-[var(--mark-surface)] p-4">
              <button type="button" className={actionButton} onClick={startStudy}>{copy.study}</button>
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

function SheetTop({ layout, onClose, children }: { layout: PanelLayout; onClose: () => void; children: ReactNode }) {
  const origin = useRef<number | null>(null);
  if (layout !== 'sheet') return <>{children}</>;
  const finish = (clientY: number) => {
    if (origin.current == null) return;
    const delta = clientY - origin.current;
    origin.current = null;
    if (sheetSwipeCloses(delta)) onClose();
  };
  return (
    <div
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        origin.current = event.clientY;
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }}
      onPointerUp={(event) => finish(event.clientY)}
      onPointerCancel={() => { origin.current = null; }}
    >
      <div aria-hidden className="mx-auto mt-2 h-1 w-9 rounded-[2px] bg-[var(--mark-line)]" data-sheet-handle="" />
      {children}
    </div>
  );
}

function TabButton({ id, selected, onClick, children }: { id: string; selected: boolean; onClick: () => void; children: string }) {
  const tone = selected
    ? 'border border-[var(--mark-tab-border)] bg-[var(--mark-tab-bg)] font-semibold text-[var(--mark-tab-text)] shadow-sm dark:font-bold dark:shadow-none'
    : 'border border-transparent font-semibold text-[var(--mark-tab-idle)]';
  return (
    <button type="button" role="tab" id={id} aria-selected={selected} className={`h-10 rounded-[10px] ${tone}`} onClick={onClick}>
      {children}
    </button>
  );
}

function ListBody({
  tab, marks, learning, learned, query, shortcut, learnedOpen, counts, onToggleLearned, onGoTo, onLearn, onDelete,
}: {
  tab: Tab;
  marks: WordMark[];
  learning: WordMark[];
  learned: WordMark[];
  query: string;
  shortcut: string;
  learnedOpen: boolean;
  counts: Record<string, number>;
  onToggleLearned: () => void;
  onGoTo: (mark: WordMark) => void;
  onLearn: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const cards = (list: WordMark[]) => list.map((mark) => (
    <Card key={mark.id} mark={mark} counts={counts} onGoTo={onGoTo} onLearn={onLearn} onDelete={onDelete} />
  ));
  if (tab === 'book' && query.trim() && learning.length + learned.length === 0) return <Empty title={copy.emptySearch(query.trim())} />;
  if (learning.length === 0 && learned.length === 0) {
    const title = tab === 'page' ? copy.emptyPageTitle : copy.emptyTitle;
    return <Empty title={title} body={marks.length === 0 ? emptyLead(shortcut) : undefined} kbd={marks.length === 0 ? shortcut : undefined} />;
  }
  if (learning.length === 0 && learned.length > 0) {
    return (
      <>
        <Empty title={copy.emptyLearned} />
        <LearnedBlock open={learnedOpen} count={learned.length} onToggle={onToggleLearned}>{cards(learned)}</LearnedBlock>
      </>
    );
  }
  return (
    <>
      <h3 className="mb-2 mt-4 text-[13px] font-bold uppercase tracking-[0.06em] text-[var(--mark-muted)]">{copy.learning}</h3>
      {cards(learning)}
      {learned.length > 0 && (
        <LearnedBlock open={learnedOpen} count={learned.length} onToggle={onToggleLearned}>{cards(learned)}</LearnedBlock>
      )}
    </>
  );
}

function LearnedBlock({ open, count, onToggle, children }: { open: boolean; count: number; onToggle: () => void; children: ReactNode }) {
  return (
    <>
      <button type="button" className="mt-2 flex h-10 w-full items-center justify-between text-[13px] font-bold uppercase tracking-[0.06em] text-[var(--mark-muted)]" aria-expanded={open} onClick={onToggle}>
        {copy.learned} ({count})
        <ChevronRight className={`h-4 w-4 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && children}
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

function Empty({ title, body, kbd }: { title: string; body?: string; kbd?: string }) {
  return (
    <div className="px-3 py-8 text-center">
      <Highlighter className="mx-auto mb-4 h-10 w-10 text-[var(--mark-ink)]" aria-hidden />
      <h3 className="text-xl font-bold">{title}</h3>
      {body && (
        <p className="mx-auto mt-2 max-w-[36ch] text-[15px] font-medium leading-relaxed text-[var(--mark-muted)]">
          {kbd ? <ShortcutText text={body} shortcut={kbd} /> : body}
        </p>
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
      <kbd className="rounded-md bg-[var(--mark-raised)] px-1 font-semibold">{shortcut}</kbd>
      {parts.slice(1).join(shortcut)}
    </>
  );
}
