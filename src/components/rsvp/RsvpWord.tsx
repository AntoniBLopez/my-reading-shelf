interface RsvpWordProps {
  word: string;
  orpIndex: number;
}

/**
 * One word. The pivot letter is the middle grid column, so it stays put.
 * Side columns share the leftover width equally; text grows away from the pivot.
 * Spans are adjacent so JSX indentation cannot insert a space between letters.
 */
export function RsvpWord({ word, orpIndex }: RsvpWordProps) {
  const pivot = word ? Math.max(0, Math.min(orpIndex, word.length - 1)) : 0;
  const before = word.slice(0, pivot);
  const letter = word.slice(pivot, pivot + 1) || '\u00a0';
  const after = word.slice(pivot + 1);

  return (
    <div
      className="grid w-full items-baseline font-medium leading-none text-foreground"
      style={{
        gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
        fontSize: 'clamp(1.35rem, 8vw, 4.75rem)',
        letterSpacing: '0px',
        fontKerning: 'none',
        fontVariantLigatures: 'none',
      }}
    >
      <span className="block min-w-0 text-right">{before}</span><span className="block text-center text-primary" style={{ paddingInline: '0.045em' }}>{letter}</span><span className="block min-w-0 text-left">{after}</span>
    </div>
  );
}
