import { useCallback, useEffect, useRef, useState } from 'react';
import { toastLearned, toastMarked, toastUnmarked } from '@/lib/marks/copy';
import { removeMark, setLearned, toggleWord } from '@/lib/marks/model';
import { paletteColor } from '@/lib/marks/palette';
import type { MarksGateway } from '@/lib/marks/store';
import type { MarkToastModel, NewMarkInput, WordMark } from '@/lib/marks/types';

export interface ActiveToast extends MarkToastModel {
  id: number;
}

export function useBookMarks(bookId: string, gateway: MarksGateway) {
  const [marks, setMarks] = useState<WordMark[]>([]);
  const [toast, setToast] = useState<ActiveToast | null>(null);
  const marksRef = useRef(marks);
  const undoRef = useRef<WordMark[] | null>(null);
  const gen = useRef(0);
  marksRef.current = marks;

  useEffect(() => {
    const token = ++gen.current;
    void gateway.load(bookId).then((next) => {
      if (token === gen.current) setMarks(next);
    });
    return undefined;
  }, [bookId, gateway]);

  useEffect(() => {
    const onOnline = () => void gateway.flush(bookId);
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [bookId, gateway]);

  const commit = useCallback((next: WordMark[]) => {
    gen.current += 1;
    marksRef.current = next;
    setMarks(next);
    void gateway.save(bookId, next);
  }, [bookId, gateway]);

  const show = useCallback((model: MarkToastModel, snapshot: WordMark[]) => {
    undoRef.current = snapshot;
    setToast({ ...model, id: Date.now() });
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  const notify = useCallback((text: string) => {
    undoRef.current = null;
    setToast({ text, undo: false, id: Date.now() });
  }, []);

  const undo = useCallback(() => {
    const snapshot = undoRef.current;
    undoRef.current = null;
    setToast(null);
    if (snapshot) commit(snapshot);
  }, [commit]);

  const toggle = useCallback((input: NewMarkInput, count: number) => {
    const snapshot = marksRef.current;
    const result = toggleWord(snapshot, input);
    commit(result.marks);
    const color = paletteColor(result.mark.colorIndex);
    show(
      result.action === 'marked'
        ? { text: toastMarked(result.mark.display, count), color, undo: true }
        : { text: toastUnmarked(result.mark.display), color, undo: true },
      snapshot,
    );
    return result;
  }, [commit, show]);

  const remove = useCallback((id: string) => {
    const snapshot = marksRef.current;
    const result = removeMark(snapshot, id);
    if (!result.removed) return;
    commit(result.marks);
    show({ text: toastUnmarked(result.removed.display), color: paletteColor(result.removed.colorIndex), undo: true }, snapshot);
  }, [commit, show]);

  const learn = useCallback((id: string) => {
    const snapshot = marksRef.current;
    const current = snapshot.find((mark) => mark.id === id);
    if (!current || current.learned) return;
    commit(setLearned(snapshot, id, true));
    show({ text: toastLearned(current.display), color: paletteColor(current.colorIndex), undo: true }, snapshot);
  }, [commit, show]);

  return { marks, toast, dismissToast, notify, undo, toggle, remove, learn };
}
