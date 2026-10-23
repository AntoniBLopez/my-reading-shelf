interface IdleHost {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
}

/** Run after the RSVP frame, during idle time when the browser offers it. */
export function whenIdle(task: () => void): () => void {
  const host = globalThis as unknown as IdleHost;
  if (typeof host.requestIdleCallback === 'function') {
    const handle = host.requestIdleCallback(task, { timeout: 200 });
    return () => host.cancelIdleCallback?.(handle);
  }
  const handle = setTimeout(task, 16);
  return () => clearTimeout(handle);
}
