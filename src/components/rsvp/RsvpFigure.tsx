import { Button } from '@/components/ui/button';
import { useDarkClass } from '@/hooks/useDarkClass';
import type { FigureCue, FigureImage } from '@/lib/rsvp/figures/types';

interface RsvpFigureProps {
  cue: FigureCue;
  image: FigureImage | null;
  searching: boolean;
  onContinue: () => void;
}

export function RsvpFigure({ cue, image, searching, onContinue }: RsvpFigureProps) {
  const dark = useDarkClass();
  return (
    <div
      data-testid="rsvp-figure"
      className={
        dark
          ? 'flex flex-1 flex-col items-center justify-center gap-4 bg-black px-4 py-6 text-neutral-200'
          : 'flex flex-1 flex-col items-center justify-center gap-4 bg-white px-4 py-6 text-neutral-900'
      }
    >
      <p className="text-sm font-medium">{cue.label}</p>
      {image ? (
        <img
          src={image.url}
          alt={cue.label}
          className="max-h-[50vh] max-w-full object-contain"
          style={dark ? { filter: 'invert(1)' } : undefined}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          {searching ? 'Buscando la figura…' : 'No se pudo cargar la figura.'}
        </p>
      )}
      <Button onClick={onContinue}>Continuar</Button>
    </div>
  );
}
