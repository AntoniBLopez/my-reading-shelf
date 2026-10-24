import { describe, expect, it, vi } from 'vitest';
import { onRegisteredServiceWorker, workboxClientUpdate } from '@/lib/pwaUpdate';

describe('service worker update', () => {
  it('should activate the next worker immediately and drop outdated caches', () => {
    expect(workboxClientUpdate).toEqual({
      skipWaiting: true,
      clientsClaim: true,
      cleanupOutdatedCaches: true,
    });
  });

  it('should check for an update when the production worker registers', () => {
    const update = vi.fn(() => Promise.resolve());
    onRegisteredServiceWorker('/sw.js', { update });
    expect(update).toHaveBeenCalledOnce();
    expect(() => onRegisteredServiceWorker('/sw.js', null)).not.toThrow();
  });
});
