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
