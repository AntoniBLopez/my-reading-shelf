import { DARK_LUMINANCE } from './constants';

interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

export function parseCssColor(input: string | null | undefined): Rgba | null {
  if (!input || input === 'transparent' || input === 'rgba(0, 0, 0, 0)') return null;
  const match = input.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)/i);
  if (!match) return null;
  return {
    r: Number(match[1]),
    g: Number(match[2]),
    b: Number(match[3]),
    a: match[4] === undefined ? 1 : Number(match[4]),
  };
}

function channelLinear(channel: number): number {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * channelLinear(r) + 0.7152 * channelLinear(g) + 0.0722 * channelLinear(b);
}

export function elementIsDark(element: Element): boolean {
  const colors: Rgba[] = [];
  let current: Element | null = element;
  let depth = 0;
  while (current && depth < 12) {
    const parsed = parseCssColor(getComputedStyle(current).backgroundColor);
    if (parsed && parsed.a > 0.01) colors.push(parsed);
    if (parsed && parsed.a >= 0.99) break;
    current = current.parentElement;
    depth += 1;
  }
  const opaque = [...colors].reverse().find((color) => color.a >= 0.99);
  const sample = opaque ?? colors[colors.length - 1];
  if (!sample) return document.documentElement.classList.contains('dark');
  return relativeLuminance(sample.r, sample.g, sample.b) < DARK_LUMINANCE;
}

export function filterInverts(element: Element): boolean {
  let current: Element | null = element;
  let depth = 0;
  while (current && depth < 8) {
    const filter = getComputedStyle(current).filter;
    if (filter && filter !== 'none' && filter.includes('invert')) return true;
    current = current.parentElement;
    depth += 1;
  }
  return false;
}
