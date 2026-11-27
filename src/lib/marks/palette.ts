import { HOVER_ALPHA_BUMP, LEARNED_ALPHA } from './constants';
import type { HighlightKind, ThemeName } from './types';

export interface AlphaPair {
  selected: number;
  other: number;
}

export interface PaletteColor {
  name: string;
  base: string;
  light: AlphaPair;
  dark: AlphaPair;
}

export const PALETTE: readonly PaletteColor[] = [
  { name: 'saffron', base: '#F2B53A', light: { selected: 0.5, other: 0.22 }, dark: { selected: 0.42, other: 0.2 } },
  { name: 'coral', base: '#F08A6C', light: { selected: 0.45, other: 0.2 }, dark: { selected: 0.42, other: 0.2 } },
  { name: 'rose', base: '#E87FA3', light: { selected: 0.42, other: 0.18 }, dark: { selected: 0.4, other: 0.18 } },
  { name: 'lilac', base: '#A98BE0', light: { selected: 0.42, other: 0.18 }, dark: { selected: 0.45, other: 0.2 } },
  { name: 'sky', base: '#5BB4E8', light: { selected: 0.42, other: 0.18 }, dark: { selected: 0.42, other: 0.2 } },
  { name: 'teal', base: '#3FBFB0', light: { selected: 0.42, other: 0.18 }, dark: { selected: 0.4, other: 0.18 } },
  { name: 'sage', base: '#8CC27A', light: { selected: 0.45, other: 0.2 }, dark: { selected: 0.4, other: 0.18 } },
  { name: 'peach', base: '#F5A55C', light: { selected: 0.45, other: 0.2 }, dark: { selected: 0.42, other: 0.2 } },
  { name: 'periwinkle', base: '#7F9CF0', light: { selected: 0.42, other: 0.18 }, dark: { selected: 0.45, other: 0.2 } },
  { name: 'olive', base: '#C4C95A', light: { selected: 0.48, other: 0.22 }, dark: { selected: 0.4, other: 0.18 } },
];

const round = (value: number) => Math.round(value * 100) / 100;

export function alphaFor(index: number, theme: ThemeName, kind: HighlightKind | 'hover'): number {
  const color = PALETTE[index] ?? PALETTE[0];
  const pair = theme === 'light' ? color.light : color.dark;
  if (kind === 'sel') return pair.selected;
  if (kind === 'flash') return pair.selected;
  if (kind === 'learned') return LEARNED_ALPHA;
  if (kind === 'hover') return round(pair.other + HOVER_ALPHA_BUMP);
  return pair.other;
}

export function underlineFor(kind: HighlightKind): boolean {
  return kind === 'sel';
}

export function hexToRgba(hex: string, alpha: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
}

/** The reader inverts the text layer in dark mode, so the painted color is pre-inverted. */
export function invertHex(hex: string): string {
  const value = Number.parseInt(hex.slice(1), 16);
  const channel = (shift: number) => (255 - ((value >> shift) & 255)).toString(16).padStart(2, '0');
  return `#${channel(16)}${channel(8)}${channel(0)}`;
}

export function highlightName(index: number, theme: ThemeName, kind: HighlightKind, inverted: boolean): string {
  return `ink-${index}-${theme === 'light' ? 'l' : 'd'}${inverted ? 'i' : ''}-${kind}`;
}

const KINDS: HighlightKind[] = ['sel', 'other', 'learned', 'flash'];

export function buildHighlightCss(): string {
  const rules: string[] = [];
  PALETTE.forEach((color, index) => {
    (['light', 'dark'] as const).forEach((theme) => {
      [false, true].forEach((inverted) => {
        const base = inverted ? invertHex(color.base) : color.base;
        KINDS.forEach((kind) => {
          const background = `background-color: ${hexToRgba(base, alphaFor(index, theme, kind))};`;
          const decoration = underlineFor(kind)
            ? `text-decoration-line: underline; text-decoration-thickness: 2px; text-decoration-color: ${base}; text-underline-offset: 3px;`
            : 'text-decoration: none;';
          rules.push(`::highlight(${highlightName(index, theme, kind, inverted)}) { ${background} ${decoration} }`);
        });
      });
    });
  });
  return rules.join('\n');
}

export function nextColorIndex(used: readonly number[]): number {
  const taken = new Set(used);
  for (let index = 0; index < PALETTE.length; index += 1) {
    if (!taken.has(index)) return index;
  }
  return used.length % PALETTE.length;
}

export function paletteColor(index: number): string {
  return (PALETTE[index] ?? PALETTE[0]).base;
}
