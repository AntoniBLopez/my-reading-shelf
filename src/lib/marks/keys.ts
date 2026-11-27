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
