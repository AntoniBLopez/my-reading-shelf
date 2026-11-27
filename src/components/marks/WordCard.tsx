import type { ReactNode } from 'react';
import { Check, MapPin, Trash2 } from 'lucide-react';
import { cardLabel, copy } from '@/lib/marks/copy';
import { paletteColor } from '@/lib/marks/palette';
import type { WordMark } from '@/lib/marks/types';

const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mark-action)]';

export function WordCard({
  mark,
  count,
  onGoTo,
  onLearn,
  onDelete,
}: {
  mark: WordMark;
  count: number;
  onGoTo: () => void;
  onLearn: () => void;
  onDelete: () => void;
}) {
  const color = paletteColor(mark.colorIndex);
  return (
    <article
      data-card=""
      data-id={mark.id}
      tabIndex={0}
      aria-label={cardLabel(mark.display, count, mark.learned)}
      className={`group mb-2.5 rounded-[14px] border-l-4 bg-[var(--mark-card)] px-4 py-3.5 outline-none ${focusRing} ${mark.learned ? 'opacity-60' : ''}`}
      style={{ borderLeftColor: color }}
      onClick={onGoTo}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          onGoTo();
        }
      }}
    >
      <div className="flex items-center gap-2">
        <h3 className="m-0 text-lg font-bold">{mark.display}</h3>
        <span className="ml-auto rounded-full bg-[var(--mark-raised)] px-2 py-0.5 text-[13px] font-semibold text-[var(--mark-muted)]">
          {count > 0 ? `×${count}` : `pág. ${mark.pageNumber}`}
        </span>
      </div>
      {mark.context && (
        <p className="mt-1.5 line-clamp-2 text-sm font-medium leading-snug text-[var(--mark-muted)]">
          <Emphasized sentence={mark.context} word={mark.display} />
        </p>
      )}
      <div className="mt-2 flex gap-1 opacity-100 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:group-focus-within:opacity-100">
        <IconButton label={copy.goTo} onClick={onGoTo}>
          <MapPin className="h-[18px] w-[18px]" />
        </IconButton>
        <IconButton label={copy.learnedAction} onClick={onLearn} pressed={mark.learned}>
          <Check className="h-[18px] w-[18px]" />
        </IconButton>
        <IconButton label={copy.deleteAction} onClick={onDelete} danger>
          <Trash2 className="h-[18px] w-[18px]" />
        </IconButton>
      </div>
    </article>
  );
}

function IconButton({
  label,
  onClick,
  children,
  danger,
  pressed,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  danger?: boolean;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className={`grid h-9 w-9 place-items-center rounded-[10px] ${focusRing} ${danger ? 'hover:text-destructive' : ''} ${pressed ? 'bg-success/10 text-success' : ''}`}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      {children}
    </button>
  );
}

function Emphasized({ sentence, word }: { sentence: string; word: string }) {
  const index = sentence.toLowerCase().indexOf(word.toLowerCase());
  if (index < 0) return <>{sentence}</>;
  return (
    <>
      {sentence.slice(0, index)}
      <strong className="font-semibold">{sentence.slice(index, index + word.length)}</strong>
      {sentence.slice(index + word.length)}
    </>
  );
}
