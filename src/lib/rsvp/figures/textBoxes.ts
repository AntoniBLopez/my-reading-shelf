import type { TextBox } from '@/lib/rsvp/figures/matchCaption';

function numberOrNaN(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : Number.NaN;
}

function matrixOf(value: unknown): ArrayLike<unknown> | null {
  if (typeof value === 'string' || !value || typeof value !== 'object' || !('length' in value)) return null;
  const length = (value as { length: unknown }).length;
  if (typeof length !== 'number' || length < 6) return null;
  return value as ArrayLike<unknown>;
}

function textOf(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.every((part) => typeof part === 'string')) return value.join('');
  return '';
}

/** Text positions from a pdf.js text-content item list, including typed-array matrices. */
export function textBoxesFromItems(items: readonly unknown[]): TextBox[] {
  const boxes: TextBox[] = [];
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const record = item as { str?: unknown; width?: unknown; height?: unknown; transform?: unknown };
    const text = textOf(record.str);
    if (!text.trim()) continue;
    const transform = matrixOf(record.transform);
    const x = numberOrNaN(transform?.[4]);
    const y = numberOrNaN(transform?.[5]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const width = numberOrNaN(record.width);
    let height = numberOrNaN(record.height);
    if (!Number.isFinite(height) && transform) {
      height = Math.hypot(numberOrNaN(transform[2]), numberOrNaN(transform[3]));
    }
    boxes.push({
      text,
      x,
      y,
      width: Number.isFinite(width) ? width : 0,
      height: Number.isFinite(height) && height > 0 ? height : 12,
    });
  }
  return boxes;
}
