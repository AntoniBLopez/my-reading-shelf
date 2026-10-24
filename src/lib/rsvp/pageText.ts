export interface ReadablePdf {
  numPages: number;
  getPage: (pageNumber: number) => Promise<{
    getTextContent: () => Promise<{ items: readonly unknown[] }>;
  }>;
}

interface TextRun {
  text: string;
  hasEOL: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  hasGeometry: boolean;
}

const STARTS_WITH_LETTER = /^[\p{L}]/u;
/** Gap wider than this fraction of the font size is a real word space. */
const GAP_EM = 0.18;

/**
 * One linear pass over PDF text items.
 * Adjacent runs on the same line are concatenated unless a real gap or an
 * explicit space separates them. A hyphen glued to a word at a line break is
 * dropped when the next line starts with a letter.
 */
export function textItemsToPageText(items: readonly unknown[]): string {
  let out = '';
  let prev: TextRun | null = null;
  let afterEOL = false;
  let emptyEol = 0;

  for (const item of items) {
    const run = readRun(item);
    if (!run) continue;
    if (!run.text) {
      if (run.hasEOL) {
        afterEOL = true;
        emptyEol += 1;
      }
      continue;
    }

    if (!prev) {
      out = run.text;
    } else if (emptyEol >= 2 || isBlockGap(prev, run)) {
      out = appendBlock(out, run.text);
    } else if (afterEOL || isNewLine(prev, run)) {
      out = appendNewLine(out, run.text);
    } else {
      out = appendSameLine(out, prev, run);
    }

    prev = run;
    afterEOL = run.hasEOL;
    emptyEol = 0;
  }

  return stripInvisibles(out).replace(/[ \t\u00A0]+/g, ' ').trim();
}

function stripInvisibles(text: string): string {
  return text
    .replace(/\u00AD/g, '')
    .replace(/\u200B/g, '')
    .replace(/\u200C/g, '')
    .replace(/\u200D/g, '')
    .replace(/\uFEFF/g, '');
}

function textOf(value: unknown): string | null {
  if (typeof value === 'string') return value;
  // pdf.js builds a run as an array of glyphs before it joins them.
  if (Array.isArray(value) && value.every((part) => typeof part === 'string')) return value.join('');
  return null;
}

function readRun(item: unknown): TextRun | null {
  if (!item || typeof item !== 'object') return null;
  const record = item as {
    str?: unknown;
    hasEOL?: unknown;
    width?: unknown;
    height?: unknown;
    transform?: unknown;
    x?: unknown;
    y?: unknown;
    type?: unknown;
  };
  const str = textOf(record.str);
  if (str == null) return null;

  let x = numberOrNaN(record.x);
  let y = numberOrNaN(record.y);
  const width = numberOrNaN(record.width);
  let height = numberOrNaN(record.height);
  const transform = matrixOf(record.transform);
  if (transform) {
    if (!Number.isFinite(x)) x = numberOrNaN(transform[4]);
    if (!Number.isFinite(y)) y = numberOrNaN(transform[5]);
    if (!Number.isFinite(height)) {
      const scale = Math.hypot(numberOrNaN(transform[2]), numberOrNaN(transform[3]));
      if (scale > 0) height = scale;
    }
  }

  const hasGeometry =
    Number.isFinite(x) &&
    Number.isFinite(y) &&
    Number.isFinite(width) &&
    width >= 0 &&
    Number.isFinite(height) &&
    height > 0;

  return {
    text: str,
    hasEOL: Boolean(record.hasEOL),
    x,
    y,
    width,
    height,
    hasGeometry,
  };
}

function numberOrNaN(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : Number.NaN;
}

/** pdf.js 6 transfers the text matrix as a typed array, which is not an Array. */
function matrixOf(value: unknown): ArrayLike<unknown> | null {
  if (typeof value === 'string' || !value || typeof value !== 'object' || !('length' in value)) return null;
  const length = (value as { length: unknown }).length;
  if (typeof length !== 'number' || length < 6) return null;
  return value as ArrayLike<unknown>;
}

function isNewLine(prev: TextRun, next: TextRun): boolean {
  if (!prev.hasGeometry || !next.hasGeometry) return false;
  const font = Math.max(prev.height, next.height);
  return Math.abs(next.y - prev.y) > font * 0.5;
}

/** A gap taller than a wrapped line: paragraph, caption, or other block. */
function isBlockGap(prev: TextRun, next: TextRun): boolean {
  if (!prev.hasGeometry || !next.hasGeometry) return false;
  const font = Math.max(prev.height, next.height);
  return Math.abs(next.y - prev.y) > font * 1.75;
}

function appendBlock(out: string, nextText: string): string {
  const next = nextText.replace(/^[ \t\u00A0]+/u, '');
  const body = wordBeforeLineHyphen(out);
  if (body != null && STARTS_WITH_LETTER.test(next)) return body + next;
  const end = out.replace(/[ \t\u00A0]+$/u, '');
  if (!end) return next;
  if (!next) return end;
  return `${end}\n${next}`;
}

function appendNewLine(out: string, nextText: string): string {
  const next = nextText.replace(/^[ \t\u00A0]+/u, '');
  const body = wordBeforeLineHyphen(out);
  if (body != null && STARTS_WITH_LETTER.test(next)) return body + next;
  return withSpace(out, nextText);
}

/** Word sitting against a trailing hyphen, with no space before that hyphen. */
function wordBeforeLineHyphen(out: string): string | null {
  const trimmed = out.replace(/[ \t\u00A0]+$/g, '');
  if (trimmed.length < 2) return null;
  const mark = trimmed.charAt(trimmed.length - 1);
  if (mark !== '-' && mark !== '\u00AD' && mark !== '\u2010' && mark !== '\u2011') return null;
  const body = trimmed.slice(0, -1);
  if (/[ \t\u00A0]$/u.test(body)) return null;
  const glued = body.charAt(body.length - 1);
  if (!/^[\p{L}\p{N}]$/u.test(glued)) return null;
  return body;
}

function appendSameLine(out: string, prev: TextRun, next: TextRun): string {
  const explicitSpace = /\s$/u.test(out) || /^\s/u.test(next.text);
  if (prev.hasGeometry && next.hasGeometry) {
    if (hasRealGap(prev, next)) return withSpace(out, next.text);
    // Kerning or font splits sit on top of each other. Drop a fake boundary space.
    return out.replace(/[\s\u00A0]+$/u, '') + next.text.replace(/^[\s\u00A0]+/u, '');
  }
  if (explicitSpace) return withSpace(out, next.text);
  return out + next.text;
}

function hasRealGap(prev: TextRun, next: TextRun): boolean {
  const font = Math.max(prev.height, next.height);
  const gap = next.x - (prev.x + prev.width);
  return gap > font * GAP_EM;
}

function withSpace(left: string, right: string): string {
  const end = left.replace(/[\s\u00A0]+$/u, '');
  const start = right.replace(/^[\s\u00A0]+/u, '');
  if (!end) return start;
  if (!start) return end;
  return `${end} ${start}`;
}

/** Read the text layer the reader actually painted (PDF text layer, or any `.textLayer`). */
export function extractRenderedPageText(root: ParentNode | null): string {
  if (!root) return '';
  const layer =
    root.querySelector('.pdf-turn-leaf .textLayer') ||
    root.querySelector('.textLayer') ||
    root.querySelector('.react-pdf__Page__textContent');
  if (!layer) return '';
  return textItemsToPageText(runsFromLayer(layer));
}

function runsFromLayer(layer: Element): unknown[] {
  const items: unknown[] = [];
  const visit = (node: Node) => {
    if (!(node instanceof Element)) return;
    if (node.classList.contains('endOfContent')) return;
    if (node.tagName === 'BR') {
      items.push({ str: '', hasEOL: true });
      return;
    }
    // pdf.js 6 wraps runs in a marked-content span (display: contents).
    // The words live in the nested presentation spans, not on the wrapper.
    if (node.classList.contains('markedContent')) {
      node.childNodes.forEach(visit);
      return;
    }
    if (node.tagName === 'SPAN') {
      items.push({ str: node.textContent ?? '', hasEOL: false });
      return;
    }
    node.childNodes.forEach(visit);
  };
  layer.childNodes.forEach(visit);
  if (items.some((item) => textOf((item as { str?: unknown }).str)?.trim())) return items;
  const clone = layer.cloneNode(true);
  if (!(clone instanceof Element)) return items;
  clone.querySelectorAll('.endOfContent').forEach((node) => node.remove());
  const text = clone.textContent ?? '';
  return text.trim() ? [{ str: text, hasEOL: false }] : items;
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, 48);
    requestAnimationFrame(() => {
      clearTimeout(timer);
      resolve();
    });
  });
}

export async function readReaderPageText(
  pdf: ReadablePdf | null,
  pageNumber: number,
  renderedRoot: ParentNode | null,
): Promise<string> {
  if (pdf && pageNumber >= 1 && pageNumber <= pdf.numPages) {
    try {
      const page = await pdf.getPage(pageNumber);
      // pdf.js 6 resolves getTextContent from a worker stream. Ask for the
      // joined TextContent, then read `str` (typed-array matrices included).
      const content = await page.getTextContent();
      const text = textItemsToPageText(content?.items ?? []);
      if (text) return text;
    } catch {
      // Fall through to whatever the reader has on screen.
    }
  }
  const painted = extractRenderedPageText(renderedRoot);
  if (painted) return painted;
  // The text layer appends its spans after the canvas paints. One frame later
  // they are in the DOM even when the worker stream has not settled.
  await nextFrame();
  return extractRenderedPageText(renderedRoot);
}
