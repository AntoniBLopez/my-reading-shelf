/** True when the event target is a field the reader must not steal keys from. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target instanceof HTMLElement && target.isContentEditable) return true;
  return target.closest('input, textarea, [contenteditable="true"]') != null;
}

/** Space and Enter are the play/pause and header keys. */
export function isToggleKey(event: { key: string; code?: string }): boolean {
  return event.key === 'Enter' || event.key === ' ' || event.code === 'Space';
}

/** Bare f/F toggles the reader's fullscreen. Ctrl, Alt, Meta, and Shift stay free. */
export function isFullscreenKey(event: {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
}): boolean {
  if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return false;
  return event.key === 'f' || event.key === 'F';
}
