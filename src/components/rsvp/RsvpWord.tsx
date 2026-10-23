interface RsvpWordProps {
  word: string;
  orpIndex: number;
}

/** One word, with the recognition letter locked to the horizontal center. */
export function RsvpWord({ word, orpIndex }: RsvpWordProps) {
  const pivot = word ? Math.max(0, Math.min(orpIndex, word.length - 1)) : 0;
  const before = word.slice(0, pivot);
  const letter = word.slice(pivot, pivot + 1) || '\u00a0';
  const after = word.slice(pivot + 1);

  return (
    <div
      className="grid w-full grid-cols-[1fr_auto_1fr] items-baseline font-medium leading-none tracking-tight text-foreground"
      style={{ fontSize: 'clamp(1.35rem, 8vw, 4.75rem)' }}
    >
      <span className="overflow-hidden text-right whitespace-pre">{before}</span>
      <span className="text-primary">{letter}</span>
      <span className="overflow-hidden text-left whitespace-pre">{after}</span>
    </div>
  );
}
