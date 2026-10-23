export interface ReadablePdf {
  numPages: number;
  getPage: (pageNumber: number) => Promise<{
    getTextContent: () => Promise<{ items: readonly unknown[] }>;
  }>;
}

/** Join PDF text items in content order, keeping line-break hyphens as one word. */
export function textItemsToPageText(items: readonly unknown[]): string {
  let out = '';
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const record = item as { str?: unknown; hasEOL?: unknown };
    if (typeof record.str === 'string' && record.str.length > 0) out += record.str;
    if (record.hasEOL) out = breakLine(out);
  }
  return out.replace(/\s+/g, ' ').trim();
}

function breakLine(out: string): string {
  if (out.endsWith('-')) return out.slice(0, -1);
  if (out && !/\s$/.test(out)) return `${out} `;
  return out;
}

/** Read the text layer the reader actually painted (PDF text layer, or any `.textLayer`). */
export function extractRenderedPageText(root: ParentNode | null): string {
  if (!root) return '';
  const layer =
    root.querySelector('.pdf-turn-leaf .textLayer') ||
    root.querySelector('.textLayer') ||
    root.querySelector('.react-pdf__Page__textContent');
  if (!layer) return '';
  return textFromLayer(layer);
}

function textFromLayer(layer: Element): string {
  let out = '';
  let skipGap = false;
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? '';
      if (skipGap && text.trim() === '') return;
      skipGap = false;
      out += text;
      return;
    }
    if (!(node instanceof Element)) {
      node.childNodes.forEach(walk);
      return;
    }
    if (node.classList.contains('endOfContent')) return;
    if (node.tagName === 'BR') {
      out = breakLine(out);
      skipGap = true;
      return;
    }
    node.childNodes.forEach(walk);
  };
  layer.childNodes.forEach(walk);
  return out.replace(/\s+/g, ' ').trim();
}

export async function readReaderPageText(
  pdf: ReadablePdf | null,
  pageNumber: number,
  renderedRoot: ParentNode | null,
): Promise<string> {
  if (pdf && pageNumber >= 1 && pageNumber <= pdf.numPages) {
    try {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = textItemsToPageText(content.items);
      if (text) return text;
    } catch {
      // Fall through to whatever the reader has on screen.
    }
  }
  return extractRenderedPageText(renderedRoot);
}
