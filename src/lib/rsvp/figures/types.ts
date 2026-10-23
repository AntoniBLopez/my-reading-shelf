export type FigureKind = 'figure' | 'table';

export interface FigureCue {
  key: string;
  label: string;
  kind: FigureKind;
  number: string;
}

export interface FigureImage {
  url: string;
  label: string;
}

/** PDF user space. Origin is the bottom-left of the page. */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type CropSource = 'image' | 'caption' | 'page';

export interface CropChoice {
  box: Box;
  source: CropSource;
}
