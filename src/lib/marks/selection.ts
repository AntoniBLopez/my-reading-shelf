import { cleanSelection, normalizeWord, selectionIssue } from './text';
import { findHits, hitOverlapping, insideMarkUi, layerRoot, sentenceFor } from './scan';
import type { NewMarkInput } from './types';

export type SelectionRead =
  | { ok: true; input: NewMarkInput; count: number }
  | { ok: false; issue: 'empty' | 'too_long' | 'ignore' };

export function readPageSelection(surface: ParentNode | null, pageNumber: number, doc: Document): SelectionRead {
  const selection = doc.getSelection();
  const raw = selection?.toString() ?? '';
  const issue = selectionIssue(raw);
  if (!selection || selection.rangeCount === 0) return { ok: false, issue: issue ?? 'empty' };
  const range = selection.getRangeAt(0);
  if (insideMarkUi(range.startContainer)) return { ok: false, issue: 'ignore' };
  if (issue) return { ok: false, issue };
  if (!surface) return { ok: false, issue: 'empty' };
  const layer = layerRoot(surface);
  if (!(layer instanceof Node) || !layer.contains(range.startContainer)) return { ok: false, issue: 'empty' };
  const display = cleanSelection(raw);
  const normalized = normalizeWord(display);
  const { text, hits } = findHits(layer, normalized, doc);
  const chosen = hitOverlapping(hits, range);
  if (!chosen) return { ok: false, issue: 'empty' };
  const input: NewMarkInput = {
    normalized,
    display,
    context: sentenceFor(text, chosen),
    anchorBefore: chosen.before,
    anchorAfter: chosen.after,
    pageNumber,
    nodeIndex: chosen.nodeIndex,
    startOffset: chosen.start,
  };
  return { ok: true, input, count: hits.length };
}

export function clearNativeSelection(doc: Document): void {
  doc.getSelection()?.removeAllRanges();
}
