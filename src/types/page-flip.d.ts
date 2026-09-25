declare module 'page-flip/dist/js/page-flip.module.js' {
  export class PageFlip {
    constructor(element: HTMLElement, settings: Record<string, unknown>);
    loadFromImages(images: string[]): void;
    on(event: string, callback: (event: { data: number | string }) => void): this;
    startUserTouch(point: { x: number; y: number }): void;
    userMove(point: { x: number; y: number }, isTouch: boolean): void;
    userStop(point: { x: number; y: number }, preventFlip: boolean): void;
    flipNext(corner?: 'top' | 'bottom'): void;
    flipPrev(corner?: 'top' | 'bottom'): void;
    getCurrentPageIndex(): number;
    destroy(): void;
  }
}
