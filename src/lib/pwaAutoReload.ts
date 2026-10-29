import { isReaderRoute } from '@/lib/readerRoute';

/** Session flag: this tab already reloaded away from the running build. */
export const PWA_RELOADED_BUILD_KEY = 'pwa-auto-reloaded-build';

/** Session flag: a new worker is in control, waiting until the book closes. */
export const PWA_PENDING_RELOAD_KEY = 'pwa-auto-reload-pending';

/** Long-open tabs look for a deploy on this cadence (within 30–60 minutes). */
export const PWA_UPDATE_INTERVAL_MS = 45 * 60 * 1000;

export type PwaReloadDecision = 'reload' | 'defer' | 'ignore';

export interface PwaReloadInput {
  /** A service worker was already controlling the page before this update. */
  hadController: boolean;
  /** The controller is a different worker than the one that loaded this document. */
  controllerChanged: boolean;
  inReader: boolean;
  alreadyReloaded: boolean;
  pending: boolean;
  /** `update` is a newly controlling worker. `route` is leaving the reader. */
  reason: 'update' | 'route';
}

/**
 * Reload once the new worker is actually in control so the next document
 * comes from its precache. The first install has no previous controller.
 * An open book (including RSVP) waits until the reader route is gone.
 */
export function decidePwaReload(input: PwaReloadInput): PwaReloadDecision {
  if (input.alreadyReloaded) return 'ignore';
  if (input.reason === 'route') {
    if (!input.pending || input.inReader) return 'ignore';
    return 'reload';
  }
  if (!input.hadController || !input.controllerChanged) return 'ignore';
  if (input.inReader) return 'defer';
  return 'reload';
}

export interface PwaAutoReloadOptions {
  buildId: string;
  hadController: boolean;
  initialController: unknown;
  getController: () => unknown;
  isReader: () => boolean;
  storage: Storage;
  reload: () => void;
}

export interface PwaAutoReloadController {
  onUpdateAvailable: () => void;
  onControllerChange: () => void;
  onRouteChange: () => void;
}

export function createPwaAutoReload(options: PwaAutoReloadOptions): PwaAutoReloadController {
  const { buildId, hadController, initialController, getController, isReader, storage, reload } = options;

  const read = (key: string): string | null => {
    try {
      return storage.getItem(key);
    } catch {
      return null;
    }
  };
  const write = (key: string, value: string) => {
    try {
      storage.setItem(key, value);
    } catch {
      // Private mode can reject session writes; the in-memory flags still apply.
    }
  };
  const remove = (key: string) => {
    try {
      storage.removeItem(key);
    } catch {
      // Ignore blocked storage.
    }
  };

  const storedPending = read(PWA_PENDING_RELOAD_KEY);
  let pending = storedPending === buildId;
  if (storedPending !== null && storedPending !== buildId) remove(PWA_PENDING_RELOAD_KEY);

  let reloaded = read(PWA_RELOADED_BUILD_KEY) === buildId;

  const controllerChanged = () => {
    const current = getController();
    return current != null && current !== initialController;
  };

  const reloadOnce = () => {
    if (reloaded) return;
    reloaded = true;
    pending = false;
    write(PWA_RELOADED_BUILD_KEY, buildId);
    remove(PWA_PENDING_RELOAD_KEY);
    reload();
  };

  const apply = (reason: 'update' | 'route') => {
    const decision = decidePwaReload({
      hadController,
      controllerChanged: controllerChanged(),
      inReader: isReader(),
      alreadyReloaded: reloaded,
      pending,
      reason,
    });
    if (decision === 'defer') {
      pending = true;
      write(PWA_PENDING_RELOAD_KEY, buildId);
      return;
    }
    if (decision === 'reload') reloadOnce();
  };

  return {
    onUpdateAvailable: () => apply('update'),
    onControllerChange: () => apply('update'),
    onRouteChange: () => apply('route'),
  };
}

export function currentBuildId(): string {
  return import.meta.url;
}

export interface ServiceWorkerUpdateRegistration {
  update: () => Promise<unknown>;
}

/** Ask the active worker for a new build. Failures (offline) stay quiet. */
export function bindServiceWorkerUpdateChecks(
  registration: ServiceWorkerUpdateRegistration,
  options?: { intervalMs?: number },
): () => void {
  const intervalMs = options?.intervalMs ?? PWA_UPDATE_INTERVAL_MS;

  const check = () => {
    void Promise.resolve()
      .then(() => registration.update())
      .catch(() => {});
  };

  const onFocus = () => check();
  const onVisibility = () => {
    if (document.visibilityState === 'visible') check();
  };

  window.addEventListener('focus', onFocus);
  document.addEventListener('visibilitychange', onVisibility);
  const timer = window.setInterval(check, intervalMs);

  return () => {
    window.removeEventListener('focus', onFocus);
    document.removeEventListener('visibilitychange', onVisibility);
    window.clearInterval(timer);
  };
}

interface CapturedController {
  had: boolean;
  initial: unknown;
}

let captured = false;
let capturedHad = false;
let capturedInitial: unknown = null;
let active: PwaAutoReloadController | null = null;
let stopBrowser: (() => void) | null = null;
let routerSearch: string | null = null;
let queuedUpdate = false;

function readLiveController(): unknown {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  return navigator.serviceWorker.controller;
}

function browserStorage(): Storage {
  try {
    return window.sessionStorage;
  } catch {
    return memoryStorage();
  }
}

function memoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key) => (items.has(key) ? items.get(key)! : null),
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => items.delete(key),
    setItem: (key, value) => items.set(key, value),
  };
}

export function captureServiceWorkerController(): CapturedController {
  if (!captured) {
    capturedInitial = readLiveController();
    capturedHad = capturedInitial != null;
    captured = true;
  }
  return { had: capturedHad, initial: capturedInitial };
}

export function resetCapturedServiceWorkerController(): void {
  captured = false;
  capturedHad = false;
  capturedInitial = null;
}

function currentSearch(): string {
  if (routerSearch !== null) return routerSearch;
  if (typeof window === 'undefined') return '';
  return window.location.search;
}

/** React Router publishes the query the reader route is derived from. */
export function notifyReaderSearch(search: string): void {
  routerSearch = search.startsWith('?') || search.length === 0 ? search : `?${search}`;
  active?.onRouteChange();
}

/** vite-plugin-pwa calls this instead of reloading on `activated`. */
export function onPwaNeedReload(): void {
  if (!active) {
    queuedUpdate = true;
    return;
  }
  active.onUpdateAvailable();
}

export interface PwaAutoReloadStartOptions {
  buildId?: string;
  storage?: Storage;
  reload?: () => void;
  hadController?: boolean;
  initialController?: unknown;
  getController?: () => unknown;
  intervalMs?: number;
  /** Tests that drive the controller by hand skip the browser listeners. */
  bindBrowser?: boolean;
}

export function stopPwaAutoReload(): void {
  stopBrowser?.();
  stopBrowser = null;
  active = null;
  routerSearch = null;
  resetCapturedServiceWorkerController();
}

/**
 * Listen for a controlling worker and for later update checks.
 * Call this before `registerSW` so the first claim is not missed,
 * and after the previous controller (if any) is already known.
 */
export function startPwaAutoReload(options: PwaAutoReloadStartOptions = {}): void {
  stopPwaAutoReload();
  const capturedNow = captureServiceWorkerController();
  const getController = options.getController ?? readLiveController;

  active = createPwaAutoReload({
    buildId: options.buildId ?? currentBuildId(),
    hadController: options.hadController ?? capturedNow.had,
    initialController: options.initialController !== undefined ? options.initialController : capturedNow.initial,
    getController,
    isReader: () => isReaderRoute(currentSearch()),
    storage: options.storage ?? browserStorage(),
    reload: options.reload ?? (() => window.location.reload()),
  });

  if (queuedUpdate) {
    queuedUpdate = false;
    active.onUpdateAvailable();
  }

  if (options.bindBrowser === false) return;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  const onChange = () => active?.onControllerChange();
  navigator.serviceWorker.addEventListener('controllerchange', onChange);

  let stopChecks = () => {};
  let cancelled = false;
  const intervalMs = options.intervalMs;
  void navigator.serviceWorker.ready.then((registration) => {
    if (cancelled) return;
    stopChecks = bindServiceWorkerUpdateChecks(registration, { intervalMs });
  });

  stopBrowser = () => {
    cancelled = true;
    navigator.serviceWorker.removeEventListener('controllerchange', onChange);
    stopChecks();
  };
}
