import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useSearchParams } from 'react-router-dom';
import { PwaAutoReload } from '@/components/PwaAutoReload';
import {
  bindServiceWorkerUpdateChecks,
  createPwaAutoReload,
  decidePwaReload,
  onPwaNeedReload,
  PWA_PENDING_RELOAD_KEY,
  PWA_RELOADED_BUILD_KEY,
  PWA_UPDATE_INTERVAL_MS,
  startPwaAutoReload,
  stopPwaAutoReload,
  type PwaAutoReloadOptions,
} from '@/lib/pwaAutoReload';
import { isReaderRoute } from '@/lib/readerRoute';

function memoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key) => (items.has(key) ? items.get(key)! : null),
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => {
      items.delete(key);
    },
    setItem: (key, value) => {
      items.set(key, value);
    },
  };
}

function setup(overrides: Partial<PwaAutoReloadOptions> = {}) {
  const oldController = { id: 'old' };
  const nextController = { id: 'next' };
  let current: unknown = oldController;
  let inReader = false;
  const reload = vi.fn();
  const storage = memoryStorage();
  const controller = createPwaAutoReload({
    buildId: 'build-a',
    hadController: true,
    initialController: oldController,
    getController: () => current,
    isReader: () => inReader,
    storage,
    reload,
    ...overrides,
  });
  return {
    controller,
    storage,
    reload,
    oldController,
    nextController,
    setController: (value: unknown) => {
      current = value;
    },
    setReader: (value: boolean) => {
      inReader = value;
    },
    claim: () => {
      current = nextController;
    },
  };
}

describe('reader route', () => {
  it('should treat an open book, including RSVP, as the reader', () => {
    expect(isReaderRoute('?book=abc')).toBe(true);
    expect(isReaderRoute('tab=library&book=abc')).toBe(true);
    expect(isReaderRoute('?tab=library&book=abc')).toBe(true);
    expect(isReaderRoute('?tab=library')).toBe(false);
    expect(isReaderRoute('?book=')).toBe(false);
    expect(isReaderRoute('')).toBe(false);
  });
});

describe('decidePwaReload', () => {
  const base = {
    hadController: true,
    controllerChanged: true,
    inReader: false,
    alreadyReloaded: false,
    pending: false,
    reason: 'update' as const,
  };

  it('should reload once a new worker takes control outside the reader', () => {
    expect(decidePwaReload(base)).toBe('reload');
  });

  it('should defer while a book or RSVP is open and reload after leaving', () => {
    expect(decidePwaReload({ ...base, inReader: true })).toBe('defer');
    expect(decidePwaReload({ ...base, reason: 'route', pending: true, inReader: true })).toBe('ignore');
    expect(decidePwaReload({ ...base, reason: 'route', pending: true, inReader: false })).toBe('reload');
  });

  it('should ignore the first install and a second reload of the same build', () => {
    expect(decidePwaReload({ ...base, hadController: false })).toBe('ignore');
    expect(decidePwaReload({ ...base, controllerChanged: false })).toBe('ignore');
    expect(decidePwaReload({ ...base, alreadyReloaded: true })).toBe('ignore');
    expect(decidePwaReload({ ...base, reason: 'route', pending: false })).toBe('ignore');
  });
});

describe('createPwaAutoReload', () => {
  it('should reload once when the new worker takes control outside a book', () => {
    const { controller, reload, claim, storage } = setup();
    controller.onUpdateAvailable();
    expect(reload).not.toHaveBeenCalled();

    claim();
    controller.onUpdateAvailable();
    controller.onControllerChange();
    expect(reload).toHaveBeenCalledOnce();
    expect(storage.getItem(PWA_RELOADED_BUILD_KEY)).toBe('build-a');
    expect(storage.getItem(PWA_PENDING_RELOAD_KEY)).toBeNull();
  });

  it('should not reload on the first install', () => {
    const { controller, reload, claim } = setup({
      hadController: false,
      initialController: null,
    });
    claim();
    controller.onControllerChange();
    controller.onUpdateAvailable();
    expect(reload).not.toHaveBeenCalled();
  });

  it('should defer inside the reader and reload once the book route is gone', () => {
    const { controller, reload, claim, setReader, storage } = setup();
    setReader(true);
    claim();
    controller.onControllerChange();
    controller.onRouteChange();
    expect(reload).not.toHaveBeenCalled();
    expect(storage.getItem(PWA_PENDING_RELOAD_KEY)).toBe('build-a');

    setReader(false);
    controller.onRouteChange();
    controller.onRouteChange();
    expect(reload).toHaveBeenCalledOnce();
  });

  it('should keep a deferred reload across a new controller and block a loop on the same build', () => {
    const storage = memoryStorage();
    const oldController = { id: 'old' };
    const nextController = { id: 'next' };
    let current: unknown = nextController;
    const firstReload = vi.fn();
    const waiting = createPwaAutoReload({
      buildId: 'build-a',
      hadController: true,
      initialController: oldController,
      getController: () => current,
      isReader: () => true,
      storage,
      reload: firstReload,
    });
    waiting.onControllerChange();
    expect(firstReload).not.toHaveBeenCalled();

    const resumedReload = vi.fn();
    let reader = true;
    const resumed = createPwaAutoReload({
      buildId: 'build-a',
      hadController: true,
      initialController: oldController,
      getController: () => current,
      isReader: () => reader,
      storage,
      reload: resumedReload,
    });
    resumed.onRouteChange();
    expect(resumedReload).not.toHaveBeenCalled();
    reader = false;
    resumed.onRouteChange();
    expect(resumedReload).toHaveBeenCalledOnce();

    const loopReload = vi.fn();
    current = { id: 'spurious' };
    const sameBuild = createPwaAutoReload({
      buildId: 'build-a',
      hadController: true,
      initialController: nextController,
      getController: () => current,
      isReader: () => false,
      storage,
      reload: loopReload,
    });
    sameBuild.onControllerChange();
    sameBuild.onUpdateAvailable();
    expect(loopReload).not.toHaveBeenCalled();

    const nextBuildReload = vi.fn();
    const nextBuild = createPwaAutoReload({
      buildId: 'build-b',
      hadController: true,
      initialController: nextController,
      getController: () => current,
      isReader: () => false,
      storage,
      reload: nextBuildReload,
    });
    nextBuild.onControllerChange();
    expect(nextBuildReload).toHaveBeenCalledOnce();
  });
});

describe('service worker update checks', () => {
  const originalVisibility = document.visibilityState;

  afterEach(() => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => originalVisibility,
    });
  });

  it('should check on an interval, on focus, and when the tab is shown again', async () => {
    vi.useFakeTimers();
    const update = vi.fn(() => Promise.resolve());
    const stop = bindServiceWorkerUpdateChecks({ update }, { intervalMs: PWA_UPDATE_INTERVAL_MS });
    const settled = () => vi.waitFor(() => expect(update.mock.calls.length).toBeGreaterThan(0));

    window.dispatchEvent(new Event('focus'));
    await settled();
    expect(update).toHaveBeenCalledOnce();

    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    await Promise.resolve();
    expect(update).toHaveBeenCalledOnce();

    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.waitFor(() => expect(update).toHaveBeenCalledTimes(2));

    await vi.advanceTimersByTimeAsync(PWA_UPDATE_INTERVAL_MS);
    expect(update).toHaveBeenCalledTimes(3);

    update.mockImplementationOnce(() => Promise.reject(new Error('offline')));
    window.dispatchEvent(new Event('focus'));
    await vi.waitFor(() => expect(update).toHaveBeenCalledTimes(4));

    stop();
    window.dispatchEvent(new Event('focus'));
    await Promise.resolve();
    expect(update).toHaveBeenCalledTimes(4);
    vi.useRealTimers();
  });
});

function LeaveBookButton() {
  const [, setSearchParams] = useSearchParams();
  return (
    <button type="button" onClick={() => setSearchParams({ tab: 'library' })}>
      Biblioteca
    </button>
  );
}

describe('usePwaAutoReload', () => {
  const oldController = { id: 'old' };
  const nextController = { id: 'next' };
  let current: unknown = oldController;
  let reloads = 0;

  beforeEach(() => {
    current = oldController;
    reloads = 0;
    stopPwaAutoReload();
    startPwaAutoReload({
      bindBrowser: false,
      buildId: 'build-a',
      storage: memoryStorage(),
      reload: () => {
        reloads += 1;
      },
      hadController: true,
      initialController: oldController,
      getController: () => current,
    });
  });

  afterEach(() => {
    stopPwaAutoReload();
  });

  it('GIVEN an open book WHEN a new worker takes control THEN the reload waits until the reader closes', () => {
    render(
      <MemoryRouter initialEntries={['/?book=42']}>
        <PwaAutoReload />
        <LeaveBookButton />
      </MemoryRouter>,
    );

    current = nextController;
    onPwaNeedReload();
    expect(reloads).toBe(0);

    fireEvent.click(screen.getByRole('button', { name: 'Biblioteca' }));
    expect(reloads).toBe(1);
    onPwaNeedReload();
    expect(reloads).toBe(1);
  });

  it('GIVEN the library WHEN a new worker takes control THEN the page reloads once', () => {
    render(
      <MemoryRouter initialEntries={['/?tab=library']}>
        <PwaAutoReload />
      </MemoryRouter>,
    );
    current = nextController;
    onPwaNeedReload();
    expect(reloads).toBe(1);
  });
});
