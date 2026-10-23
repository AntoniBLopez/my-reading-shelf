import type { Box } from '@/lib/rsvp/figures/types';

const SAVE = 10;
const RESTORE = 11;
const TRANSFORM = 12;
const PAINT = new Set([83, 84, 85, 86, 87, 88, 89]);

type Matrix = [number, number, number, number, number, number];

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

function multiply(left: Matrix, right: Matrix): Matrix {
  const [a1, b1, c1, d1, e1, f1] = left;
  const [a2, b2, c2, d2, e2, f2] = right;
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1,
  ];
}

function apply(matrix: Matrix, x: number, y: number): { x: number; y: number } {
  return {
    x: matrix[0] * x + matrix[2] * y + matrix[4],
    y: matrix[1] * x + matrix[3] * y + matrix[5],
  };
}

function asMatrix(value: unknown): Matrix | null {
  if (!value || typeof value !== 'object' || !('length' in value)) return null;
  const list = value as ArrayLike<unknown>;
  if (list.length < 6) return null;
  const numbers = [0, 1, 2, 3, 4, 5].map((index) => list[index]);
  if (!numbers.every((entry) => typeof entry === 'number' && Number.isFinite(entry))) return null;
  return numbers as Matrix;
}

/**
 * Image bounding boxes from a pdf.js operator list.
 * An image is the unit square painted through the current transformation matrix.
 */
export function imageBoxesFromOps(fnArray: ArrayLike<number>, argsArray: ArrayLike<unknown>): Box[] {
  const stack: Matrix[] = [];
  let current: Matrix = IDENTITY;
  const boxes: Box[] = [];

  for (let index = 0; index < fnArray.length; index += 1) {
    const fn = fnArray[index];
    if (fn === SAVE) {
      stack.push(current);
      continue;
    }
    if (fn === RESTORE) {
      current = stack.pop() ?? IDENTITY;
      continue;
    }
    if (fn === TRANSFORM) {
      const next = asMatrix(argsArray[index]);
      if (next) current = multiply(current, next);
      continue;
    }
    if (!PAINT.has(fn)) continue;
    const corners = [apply(current, 0, 0), apply(current, 1, 0), apply(current, 0, 1), apply(current, 1, 1)];
    const xs = corners.map((point) => point.x);
    const ys = corners.map((point) => point.y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    const box = { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
    if (box.width > 1 && box.height > 1) boxes.push(box);
  }

  return boxes;
}
