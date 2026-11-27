export type PanelLayout = 'dock' | 'overlay' | 'sheet';

/** Phone widths use a bottom sheet. Wide reader dialogs dock beside the page. */
export function panelLayoutFor(width: number): PanelLayout {
  if (width < 768) return 'sheet';
  if (width >= 1100) return 'dock';
  return 'overlay';
}

export function panelFrameClass(layout: PanelLayout): string {
  const base = 'flex min-h-0 flex-col bg-[var(--mark-surface)] font-sans text-[var(--mark-text)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--mark-action)]';
  if (layout === 'dock') return `${base} relative h-full w-[420px] shrink-0 border-l border-[var(--mark-line)]`;
  if (layout === 'sheet') return `${base} absolute inset-x-0 bottom-0 z-40 h-[90dvh] rounded-t-2xl shadow-[0_-12px_40px_rgba(16,38,63,0.22)]`;
  return `${base} absolute inset-y-0 right-0 z-40 w-[min(440px,92%)] shadow-[-12px_0_40px_rgba(16,38,63,0.18)]`;
}
