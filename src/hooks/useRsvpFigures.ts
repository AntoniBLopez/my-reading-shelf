import { useCallback, useEffect, useRef, useState } from 'react';
import { mentionKeys } from '@/lib/rsvp/figures/references';
import type { FigureCue, FigureImage } from '@/lib/rsvp/figures/types';
import { whenIdle } from '@/lib/rsvp/figures/whenIdle';
import type { RsvpToken } from '@/lib/rsvp/tokenize';

export interface FigureResolver {
  resolveFigure?: (cue: FigureCue, pageNumber: number) => Promise<FigureImage | null>;
  listOrphans?: (pageNumber: number, mentioned: ReadonlySet<string>) => Promise<FigureCue[]>;
  prefetch?: (pageNumber: number) => void;
}

/**
 * Loads the image for the figure step currently on screen.
 * PDF work stays off the word timer: cues are prefetched while idle.
 */
export function useRsvpFigures(
  tokens: readonly RsvpToken[],
  pageNumber: number,
  { resolveFigure, listOrphans, prefetch }: FigureResolver,
) {
  const [figure, setFigure] = useState<FigureCue | null>(null);
  const [image, setImage] = useState<FigureImage | null>(null);
  const [searching, setSearching] = useState(false);
  const [orphans, setOrphans] = useState<FigureCue[]>([]);
  const figureRef = useRef<FigureCue | null>(null);
  const seenImages = useRef(new Map<string, FigureImage>());
  figureRef.current = figure;

  useEffect(() => {
    if (!figure || !resolveFigure) {
      setImage(null);
      setSearching(false);
      return;
    }
    const cached = seenImages.current.get(figure.key);
    if (cached) {
      setImage(cached);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    setImage(null);
    resolveFigure(figure, pageNumber).then((next) => {
      if (cancelled) return;
      if (next) seenImages.current.set(figure.key, next);
      setImage(next);
      setSearching(false);
    });
    return () => {
      cancelled = true;
    };
  }, [figure, pageNumber, resolveFigure]);

  useEffect(() => {
    const words = tokens.map((token) => token.word);
    const mentioned = mentionKeys(words);
    const cues = tokens.flatMap((token) => {
      const cue = token.figureStep ?? token.figureAfter;
      return cue ? [cue] : [];
    });
    let cancelled = false;
    const cancelIdle = whenIdle(() => {
      if (cancelled) return;
      prefetch?.(pageNumber);
      if (resolveFigure) {
        for (const cue of cues) void resolveFigure(cue, pageNumber);
      }
      listOrphans?.(pageNumber, mentioned).then((list) => {
        if (cancelled) return;
        setOrphans(list);
        if (resolveFigure) {
          for (const cue of list) void resolveFigure(cue, pageNumber);
        }
      });
    });
    return () => {
      cancelled = true;
      cancelIdle();
    };
  }, [tokens, pageNumber, resolveFigure, listOrphans, prefetch]);

  const focus = useCallback((next: FigureCue | null) => {
    if (figureRef.current?.key === next?.key) return;
    figureRef.current = next;
    setFigure(next);
    const cached = next ? seenImages.current.get(next.key) ?? null : null;
    setImage(cached);
    setSearching(Boolean(next) && !cached);
  }, []);

  return { figure, image, searching, orphans, focus };
}
