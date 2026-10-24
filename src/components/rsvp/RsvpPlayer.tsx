import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { RsvpFigure } from '@/components/rsvp/RsvpFigure';
import { RsvpWord } from '@/components/rsvp/RsvpWord';
import { useRsvp } from '@/hooks/useRsvp';
import { useRsvpFigures, type FigureResolver } from '@/hooks/useRsvpFigures';
import type { RsvpToken } from '@/lib/rsvp/tokenize';
import { RSVP_MAX_WPM, RSVP_MIN_WPM } from '@/lib/rsvp/wpm';

interface RsvpPlayerProps extends FigureResolver {
  tokens: RsvpToken[];
  autoPlay?: boolean;
  pageNumber?: number;
  hasNextPage: boolean;
  onNextPage: () => void;
  prefetchFigures?: (pageNumber: number) => void;
}

export function RsvpPlayer({
  tokens,
  autoPlay,
  pageNumber = 1,
  hasNextPage,
  onNextPage,
  resolveFigure,
  listOrphans,
  prefetchFigures,
}: RsvpPlayerProps) {
  const figures = useRsvpFigures(tokens, pageNumber, {
    resolveFigure,
    listOrphans,
    prefetch: prefetchFigures,
  });
  const rsvp = useRsvp(tokens, { autoPlay, beforeAdvance: figures.beforeAdvance });
  const { toggle, step, index, total } = rsvp;
  const [stageArmed, setStageArmed] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setStageArmed(true), 450);
    return () => window.clearTimeout(timer);
  }, []);
  const { figure, continueReading, dismiss } = figures;

  const resume = useCallback(
    () => continueReading({ index, total, step, play: rsvp.play }),
    [continueReading, index, total, step, rsvp.play],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const onSlider = !!target?.closest('[role="slider"]');
      if (figure) {
        if (target?.closest('button')) return;
        if (event.key === ' ' || event.code === 'Space' || event.key === 'ArrowRight' || event.key === 'ArrowUp') {
          event.preventDefault();
          event.stopPropagation();
          resume();
        }
        return;
      }
      if (event.key === ' ' || event.code === 'Space') {
        if (target?.closest('button') && !target.closest('[data-rsvp-stage]')) return;
        event.preventDefault();
        event.stopPropagation();
        toggle();
        return;
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
        if (onSlider) return;
        event.preventDefault();
        event.stopPropagation();
        step(-1);
        return;
      }
      if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
        if (onSlider) return;
        event.preventDefault();
        event.stopPropagation();
        step(1);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [figure, resume, toggle, step]);

  const word = rsvp.token?.word ?? '';

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-4 pt-4 sm:px-6">
        <Progress value={rsvp.progress} className="h-1.5" aria-label="Progreso de la página" />
        <p className="mt-2 text-center text-xs tabular-nums text-muted-foreground">
          {Math.min(rsvp.index + 1, rsvp.total)} / {rsvp.total}
        </p>
      </div>

      {figure ? (
        <RsvpFigure cue={figure} image={figures.image} searching={figures.searching} onContinue={resume} />
      ) : (
        <div
          data-rsvp-stage
          role="button"
          tabIndex={0}
          className="flex flex-1 cursor-pointer select-none items-center justify-center px-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => {
            if (!stageArmed) return;
            toggle();
          }}
          aria-label={rsvp.playing ? 'Pausar lectura' : 'Reproducir lectura'}
        >
          <div className="w-full max-w-3xl">
            <div className="mx-auto mb-3 h-4 w-px bg-primary" aria-hidden />
            <RsvpWord word={word} orpIndex={rsvp.token?.orpIndex ?? 0} />
            <div className="mx-auto mt-3 h-4 w-px bg-primary/40" aria-hidden />
          </div>
        </div>
      )}

      {rsvp.finished && !figure && (
        <div className="px-4 pb-2 text-center">
          <p className="mb-3 text-sm font-medium">Fin de la página</p>
          {hasNextPage ? (
            <Button onClick={onNextPage}>Siguiente página</Button>
          ) : (
            <p className="text-sm text-muted-foreground">Has llegado al final del libro</p>
          )}
        </div>
      )}

      <div className="border-t bg-background px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
        <div className="mx-auto flex max-w-xl flex-col gap-3">
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-11 w-11"
              onClick={() => {
                dismiss();
                rsvp.restart();
              }}
              aria-label="Reiniciar"
              title="Reiniciar"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-11 w-11"
              onClick={() => {
                dismiss();
                rsvp.step(-1);
              }}
              aria-label="Palabra anterior"
              title="Palabra anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              className="h-11 w-11"
              onClick={() => (figure ? resume() : toggle())}
              aria-label={rsvp.playing ? 'Pausar' : 'Reproducir'}
              title={rsvp.playing ? 'Pausar' : 'Reproducir'}
            >
              {rsvp.playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-11 w-11"
              onClick={() => {
                dismiss();
                rsvp.step(1);
              }}
              aria-label="Palabra siguiente"
              title="Palabra siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-16 shrink-0 text-sm tabular-nums text-muted-foreground">{rsvp.wpm} PPM</span>
            <Slider
              min={RSVP_MIN_WPM}
              max={RSVP_MAX_WPM}
              step={10}
              value={[rsvp.wpm]}
              onValueChange={([value]) => rsvp.setWpm(value)}
              aria-label="Palabras por minuto"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
