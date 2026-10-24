/** Workbox options that make a deploy replace the service worker the reader already has. */
export const workboxClientUpdate = {
  skipWaiting: true,
  clientsClaim: true,
  cleanupOutdatedCaches: true,
} as const;

/** Ask the registered worker for the newest build as soon as the page loads. */
export function onRegisteredServiceWorker(
  _url: string,
  registration?: { update: () => Promise<unknown> } | null,
): void {
  void registration?.update();
}
