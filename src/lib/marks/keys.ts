/** Ctrl+Alt+M / Ctrl+Alt+L. `code` stays stable when Alt would rewrite `key`. */
export function isMarkWordKey(event: KeyChord): boolean {
  return chord(event) && event.code === 'KeyM';
}

export function isReviewPanelKey(event: KeyChord): boolean {
  return chord(event) && event.code === 'KeyL';
}

interface KeyChord {
  code?: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
}

function chord(event: KeyChord): boolean {
  return Boolean(event.ctrlKey && event.altKey && !event.metaKey && !event.shiftKey);
}

export const MARK_SHORTCUT = 'Ctrl+Alt+M';
export const PANEL_SHORTCUT = 'Ctrl+Alt+L';

export function isApplePlatform(userAgent: string): boolean {
  return /Mac|iPhone|iPad/.test(userAgent);
}

export function markTooltip(apple: boolean): string {
  return apple ? 'Marcar palabra (⌃⌥M)' : 'Marcar palabra (Ctrl+Alt+M)';
}

export function panelTooltip(apple: boolean): string {
  return apple ? 'Palabras marcadas (⌃⌥L)' : 'Palabras marcadas (Ctrl+Alt+L)';
}

export function shortcutGlyph(apple: boolean): string {
  return apple ? '⌃⌥M' : MARK_SHORTCUT;
}
