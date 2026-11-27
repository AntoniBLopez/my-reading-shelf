import { describe, expect, it } from 'vitest';
import { copy, emptyLead, studyFill, toastMarked } from '@/lib/marks/copy';
import { panelFrameClass, panelLayoutFor, sheetSwipeCloses } from '@/lib/marks/panelLayout';
import { isFrontReader } from '@/lib/marks/selection';
import { layoutPageWidth, pagesRemainingLabel, readerShellClass } from '@/lib/readerShell';

describe('reader shell and review layout', () => {
  it('should give the windowed reader a wide desktop frame and a phone the full screen', () => {
    const windowed = readerShellClass(false);
    const fullscreen = readerShellClass(true);
    expect(windowed).toContain('w-[min(1400px,94vw)]');
    expect(windowed).toContain('min-[2200px]:w-[min(1840px,94vw)]');
    expect(windowed).toContain('h-[92vh]');
    expect(windowed).toContain('max-md:h-[100dvh]');
    expect(fullscreen).toContain('h-[100dvh]');
    expect(fullscreen).not.toContain('92vh');
    expect(fullscreen).not.toContain('1840px');
  });

  it('should dock a wide panel, overlay a medium one, and use a sheet on a phone', () => {
    expect(panelLayoutFor(1440)).toBe('dock');
    expect(panelLayoutFor(1100)).toBe('dock');
    expect(panelLayoutFor(900)).toBe('overlay');
    expect(panelLayoutFor(390)).toBe('sheet');
    expect(panelFrameClass('dock')).toContain('w-[420px]');
    expect(panelFrameClass('dock')).toContain('min-[2200px]:w-[460px]');
    expect(panelFrameClass('dock')).not.toContain('absolute');
    expect(panelFrameClass('overlay')).toContain('absolute');
    expect(panelFrameClass('sheet')).toContain('bottom-0');
    expect(panelFrameClass('sheet')).toContain('h-[90dvh]');
    expect(panelFrameClass('sheet')).toContain('pb-[env(safe-area-inset-bottom)]');
    expect(sheetSwipeCloses(80)).toBe(true);
    expect(sheetSwipeCloses(20)).toBe(false);
    expect(layoutPageWidth(1200, 3440, 8, 0.8, false)).toBe(700);
    expect(layoutPageWidth(500, 3440, 8, 0.8, false)).toBe(500);
    expect(layoutPageWidth(1200, 1440, 8, 0.8, false)).toBe(1200);
    expect(layoutPageWidth(1200, 3440, 8, 0.8, true)).toBe(1200);
  });

  it('should phrase the toast, the empty panel, and the page footer', () => {
    expect(toastMarked('bruma', 2)).toBe('"bruma" marcada · 2 en esta página');
    expect(emptyLead()).toBe('Selecciona una palabra y pulsa Ctrl+Alt+M para marcarla.');
    expect(copy.emptyPageTitle).toBe('No hay palabras marcadas en esta página');
    expect(copy.emptyTitle).toBe('Aún no hay palabras marcadas en este libro');
    expect(pagesRemainingLabel(1)).toBe('Te queda 1 página');
    expect(pagesRemainingLabel(3)).toBe('Te quedan 3 páginas');
    expect(studyFill(0, 3)).toBe(33);
  });

  it('should let only the front reader handle the shortcut', () => {
    document.body.innerHTML = '<div data-reader-surface id="back"></div><div data-reader-surface id="front"></div>';
    const back = document.getElementById('back');
    const front = document.getElementById('front');
    expect(isFrontReader(front, document)).toBe(true);
    expect(isFrontReader(back, document)).toBe(false);
    expect(isFrontReader(front, document)).toBe(true);
  });
});
