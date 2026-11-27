import { anchorsFor, extractSentence, wordPattern } from './text';

export interface WordHit {
  range: Range;
  nodeIndex: number;
  start: number;
  end: number;
  textStart: number;
  textEnd: number;
  before: string;
  after: string;
}

interface Point {
  node: Text;
  offset: number;
  nodeIndex: number;
}

const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT', 'CANVAS', 'SVG', 'VIDEO', 'AUDIO']);

export function layerRoot(surface: ParentNode): ParentNode {
  if (surface instanceof Element || surface instanceof Document) {
    const leaf = surface.querySelector('.pdf-turn-leaf .textLayer, .pdf-turn-leaf .react-pdf__Page__textContent');
    if (leaf) return leaf;
    const any = surface.querySelector('.textLayer, .react-pdf__Page__textContent');
    if (any) return any;
  }
  return surface;
}

function textNodes(root: ParentNode): Text[] {
  const nodes: Text[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.nodeValue) nodes.push(node as Text);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node as Element;
    if (SKIP.has(element.tagName) || element.closest('[data-mark-ui]')) return;
    for (const child of element.childNodes) walk(child);
  };
  walk(root);
  return nodes;
}

/** Join text nodes, inserting a space where the PDF layer separated words without one. */
export function readLayer(root: ParentNode): { text: string; points: Array<Point | null> } {
  const nodes = textNodes(root);
  let text = '';
  const points: Array<Point | null> = [];
  nodes.forEach((node, nodeIndex) => {
    const value = node.nodeValue ?? '';
    if (nodeIndex > 0) {
      const previous = nodes[nodeIndex - 1].nodeValue ?? '';
      if (previous && value && !/\s$/u.test(previous) && !/^\s/u.test(value)) {
        text += ' ';
        points.push(null);
      }
    }
    for (let offset = 0; offset < value.length; offset += 1) {
      text += value[offset];
      points.push({ node, offset, nodeIndex });
    }
  });
  return { text, points };
}

function pointFrom(points: Array<Point | null>, index: number, edge: 'start' | 'end'): Point | null {
  if (edge === 'start') {
    for (let cursor = index; cursor < points.length; cursor += 1) {
      if (points[cursor]) return points[cursor];
    }
  } else {
    for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
      if (points[cursor]) return points[cursor];
    }
  }
  return null;
}

export function findHits(root: ParentNode, normalized: string, doc: Document): { text: string; hits: WordHit[] } {
  const { text, points } = readLayer(root);
  const hits: WordHit[] = [];
  if (!normalized) return { text, hits };
  for (const found of text.matchAll(wordPattern(normalized))) {
    const textStart = found.index ?? 0;
    const textEnd = textStart + found[0].length;
    const from = pointFrom(points, textStart, 'start');
    const to = pointFrom(points, textEnd, 'end');
    if (!from || !to) continue;
    const range = doc.createRange();
    try {
      range.setStart(from.node, from.offset);
      range.setEnd(to.node, to.offset + 1);
    } catch {
      continue;
    }
    const anchors = anchorsFor(text, textStart, textEnd);
    hits.push({
      range,
      nodeIndex: from.nodeIndex,
      start: from.offset,
      end: to.offset + 1,
      textStart,
      textEnd,
      before: anchors.before,
      after: anchors.after,
    });
  }
  return { text, hits };
}

export function rangesOverlap(a: Range, b: Range): boolean {
  return a.compareBoundaryPoints(Range.START_TO_END, b) < 0 && a.compareBoundaryPoints(Range.END_TO_START, b) > 0;
}

export function hitOverlapping(hits: readonly WordHit[], range: Range | null): WordHit | null {
  if (!hits.length) return null;
  if (!range) return hits[0];
  return hits.find((hit) => rangesOverlap(hit.range, range)) ?? hits[0];
}

export function sentenceFor(text: string, hit: WordHit): string {
  return extractSentence(text, hit.textStart, hit.textEnd);
}

export function insideMarkUi(node: Node | null): boolean {
  const element = node instanceof Element ? node : node?.parentElement;
  return Boolean(element?.closest('[data-mark-ui]'));
}
