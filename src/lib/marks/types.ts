export interface WordMark {
  id: string;
  normalized: string;
  display: string;
  colorIndex: number;
  context: string;
  learned: boolean;
  createdAt: number;
  anchorBefore: string;
  anchorAfter: string;
  pageNumber: number;
  nodeIndex: number;
  startOffset: number;
}

export interface NewMarkInput {
  normalized: string;
  display: string;
  context: string;
  anchorBefore: string;
  anchorAfter: string;
  pageNumber: number;
  nodeIndex: number;
  startOffset: number;
}

export type HighlightKind = 'sel' | 'other' | 'learned' | 'flash';

export type ThemeName = 'light' | 'dark';

export interface MarkToastModel {
  text: string;
  color?: string;
  undo: boolean;
}
