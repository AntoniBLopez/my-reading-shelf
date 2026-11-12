type TimeoutHandle = ReturnType<typeof setTimeout>;

type ListenerRecord = {
  type: string;
  listener: EventListenerOrEventListenerObject;
  options?: boolean | AddEventListenerOptions;
};

/**
 * page-flip 2.0.7 never cancels the frame loop started in Render.start.
 * destroy() also skips removeHandlers when useMouseEvents is false, so each
 * finished turn kept two window resize listeners and a drawFrame loop.
 * Those loops pause while the tab is hidden and all resume on the next paint.
 */
export function bindCurlRuntime(start: () => void): () => void {
  const listeners: ListenerRecord[] = [];
  const timeouts = new Set<TimeoutHandle>();
  const frames = new Set<number>();
  let stopped = false;

  const nativeAdd = window.addEventListener.bind(window);
  const nativeRemove = window.removeEventListener.bind(window);
  const nativeClear = window.clearTimeout.bind(window);
  const nativeRAF = window.requestAnimationFrame.bind(window);
  const nativeCancel = window.cancelAnimationFrame.bind(window);
  const previousWindowRAF = window.requestAnimationFrame;
  const previousGlobalRAF = globalThis.requestAnimationFrame;
  const previousWindowTimeout = window.setTimeout;
  const previousGlobalTimeout = globalThis.setTimeout;
  const previousAdd = window.addEventListener;

  const trackedRAF = (callback: FrameRequestCallback): number => {
    if (stopped) return 0;
    const id = nativeRAF((time) => {
      frames.delete(id);
      if (stopped) return;
      installRAF();
      try {
        callback(time);
      } finally {
        restoreRAF();
      }
    });
    frames.add(id);
    return id;
  };

  const installRAF = () => {
    window.requestAnimationFrame = trackedRAF;
    globalThis.requestAnimationFrame = trackedRAF;
  };
  const restoreRAF = () => {
    window.requestAnimationFrame = previousWindowRAF;
    globalThis.requestAnimationFrame = previousGlobalRAF;
  };

  const trackedTimeout = ((handler: TimerHandler, timeout?: number) => {
    const id = previousGlobalTimeout(handler, timeout);
    timeouts.add(id);
    return id;
  }) as typeof setTimeout;

  const trackedAdd = ((
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ) => {
    listeners.push({ type, listener, options });
    nativeAdd(type, listener, options);
  }) as typeof window.addEventListener;

  const release = () => {
    if (stopped) return;
    stopped = true;
    restoreRAF();
    window.setTimeout = previousWindowTimeout;
    globalThis.setTimeout = previousGlobalTimeout;
    window.addEventListener = previousAdd;
    for (const id of frames) nativeCancel(id);
    frames.clear();
    for (const id of timeouts) nativeClear(id);
    timeouts.clear();
    for (const item of listeners) nativeRemove(item.type, item.listener, item.options);
    listeners.length = 0;
  };

  window.addEventListener = trackedAdd;
  window.setTimeout = trackedTimeout;
  globalThis.setTimeout = trackedTimeout;
  installRAF();
  try {
    start();
  } catch (error) {
    release();
    throw error;
  } finally {
    if (!stopped) {
      restoreRAF();
      window.setTimeout = previousWindowTimeout;
      globalThis.setTimeout = previousGlobalTimeout;
      window.addEventListener = previousAdd;
    }
  }
  return release;
}
