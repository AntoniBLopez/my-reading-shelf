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

interface PlaybackControls {
  index: number;
  total: number;
  step: (delta: number) => void;
  play: () => void;
}

/**
 * Pauses the word timer when a figure cue is due, without doing PDF work inside
 * that timer. Image lookup is prefetched on idle and again when the slide opens.
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
  const orphanCursor = useRef(0);
  figureRef.current = figure;
  const tokensRef = useRef(tokens);
  tokensRef.current = tokens;
  const orphansRef = useRef(orphans);
  orphansRef.current = orphans;

  useEffect(() => {
    orphanCursor.current = 0;
    setFigure((current) => (current === null ? current : null));
    setImage((current) => (current === null ? current : null));
    setSearching((current) => (current === false ? current : false));
    setOrphans((current) => (current.length === 0 ? current : []));
  }, [pageNumber, tokens]);

  useEffect(() => {
    if (!figure || !resolveFigure) {
      setImage(null);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    setImage(null);
    resolveFigure(figure, pageNumber).then((next) => {
      if (cancelled) return;
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
    const cues = tokens.flatMap((token) => (token.figureAfter ? [token.figureAfter] : []));
    let cancelled = false;
    const cancelIdle = whenIdle(() => {
      if (cancelled) return;
      prefetch?.(pageNumber);
      if (resolveFigure) {
        for (const cue of cues) void resolveFigure(cue, pageNumber);
      }
      listOrphans?.(pageNumber, mentioned).then((list) => {
        if (!cancelled) setOrphans(list);
      });
    });
    return () => {
      cancelled = true;
      cancelIdle();
    };
  }, [tokens, pageNumber, resolveFigure, listOrphans, prefetch]);

  const beforeAdvance = useCallback((index: number) => {
    const cue = tokensRef.current[index]?.figureAfter;
    if (cue) {
      setImage(null);
      setSearching(true);
      setFigure(cue);
      return true;
    }
    if (index < tokensRef.current.length - 1) return false;
    const next = orphansRef.current[orphanCursor.current];
    if (!next) return false;
    setImage(null);
    setSearching(true);
    setFigure(next);
    return true;
  }, []);

  const dismiss = useCallback(() => {
    setFigure(null);
    setImage(null);
    setSearching(false);
  }, []);

  const continueReading = useCallback((controls: PlaybackControls) => {
    const current = figureRef.current;
    const list = orphansRef.current;
    const orphanPos = current ? list.findIndex((cue) => cue.key === current.key) : -1;
    setFigure(null);
    setImage(null);
    setSearching(false);
    if (orphanPos >= 0) orphanCursor.current = orphanPos + 1;
    const upcoming = list[orphanCursor.current];
    const atEnd = controls.index >= Math.max(0, controls.total - 1);
    if (atEnd && upcoming) {
      setSearching(true);
      setFigure(upcoming);
      return;
    }
    if (atEnd) {
      controls.step(1);
      return;
    }
    controls.step(1);
    controls.play();
  }, []);

  return { figure, image, searching, beforeAdvance, continueReading, dismiss };
}
