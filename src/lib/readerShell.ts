/** Windowed reader on a desktop, fullscreen on a phone and in F-mode. */
export function readerShellClass(fullscreen: boolean): string {
  if (fullscreen) {
    return 'fixed inset-0 left-0 top-0 z-[100] h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 rounded-none border-0';
  }
  return 'h-[92vh] w-[min(1400px,94vw)] max-w-[min(1400px,94vw)] max-md:fixed max-md:inset-0 max-md:left-0 max-md:top-0 max-md:h-[100dvh] max-md:w-screen max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-none';
}

export function pagesRemainingLabel(remaining: number): string {
  if (remaining === 1) return 'Te queda 1 página';
  return `Te quedan ${remaining} páginas`;
}
