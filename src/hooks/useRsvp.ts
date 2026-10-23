import { useCallback, useEffect, useRef, useState } from 'react';
import type { RsvpToken } from '@/lib/rsvp/tokenize';
import { wordDelayMs } from '@/lib/rsvp/timing';
import { readStoredWpm, storeWpm } from '@/lib/rsvp/wpm';

interface UseRsvpOptions {
  autoPlay?: boolean;
}

export function useRsvp(tokens: RsvpToken[], options: UseRsvpOptions = {}) {
  const tokensRef = useRef(tokens);
  tokensRef.current = tokens;
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(() => Boolean(options.autoPlay) && tokens.length > 0);
  const [finished, setFinished] = useState(false);
  const [wpm, setWpmState] = useState(() => readStoredWpm());
  const playingRef = useRef(playing);
  const finishedRef = useRef(finished);
  const wpmRef = useRef(wpm);
  const indexRef = useRef(index);
  playingRef.current = playing;
  finishedRef.current = finished;
  wpmRef.current = wpm;
  indexRef.current = index;

  useEffect(() => {
    if (!playing) return;
    const list = tokensRef.current;
    const token = list[index];
    if (!token) {
      finishedRef.current = true;
      setFinished(true);
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => {
      if (index >= list.length - 1) {
        finishedRef.current = true;
        setFinished(true);
        setPlaying(false);
        return;
      }
      indexRef.current = index + 1;
      setIndex(index + 1);
    }, wordDelayMs(wpmRef.current, token.delayFactor));
    return () => window.clearTimeout(timer);
  }, [playing, index]);

  const play = useCallback(() => {
    if (tokensRef.current.length === 0) return;
    if (finishedRef.current) {
      finishedRef.current = false;
      setFinished(false);
      indexRef.current = 0;
      setIndex(0);
    }
    setPlaying(true);
  }, []);

  const pause = useCallback(() => setPlaying(false), []);

  const toggle = useCallback(() => {
    if (playingRef.current) pause();
    else play();
  }, [pause, play]);

  const step = useCallback((delta: number) => {
    const last = Math.max(0, tokensRef.current.length - 1);
    const current = indexRef.current;
    setPlaying(false);
    if (delta > 0 && current >= last) {
      finishedRef.current = true;
      setFinished(true);
      setIndex(last);
      return;
    }
    finishedRef.current = false;
    setFinished(false);
    const next = Math.min(last, Math.max(0, current + delta));
    indexRef.current = next;
    setIndex(next);
  }, []);

  const restart = useCallback(() => {
    finishedRef.current = false;
    setFinished(false);
    indexRef.current = 0;
    setIndex(0);
    setPlaying(tokensRef.current.length > 0);
  }, []);

  const setWpm = useCallback((value: number) => {
    setWpmState(storeWpm(value));
  }, []);

  const total = tokens.length;
  const token = tokens[index] ?? null;
  const progress = total === 0 ? 0 : ((index + 1) / total) * 100;

  return {
    index,
    token,
    total,
    progress,
    playing,
    finished,
    wpm,
    play,
    pause,
    toggle,
    step,
    restart,
    setWpm,
  };
}
