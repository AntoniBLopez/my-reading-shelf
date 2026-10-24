export function figureCacheKey(docKey: string, cueKey: string): string {
  return `${docKey}::${cueKey}`;
}

/** One object URL per document and figure. A second store keeps the first URL. */
export class FigureImageCache {
  private readonly urls = new Map<string, string>();
  private readonly pending = new Map<string, Promise<string>>();

  get(key: string): string | undefined {
    return this.urls.get(key);
  }

  remember(key: string, url: string): string {
    const existing = this.urls.get(key);
    if (existing) return existing;
    this.urls.set(key, url);
    return url;
  }

  memoize(key: string, load: () => Promise<string>, revoke: (url: string) => void = URL.revokeObjectURL): Promise<string> {
    const cached = this.urls.get(key);
    if (cached) return Promise.resolve(cached);
    const inflight = this.pending.get(key);
    if (inflight) return inflight;
    const job = load().then(
      (url) => {
        this.pending.delete(key);
        const kept = this.remember(key, url);
        if (kept !== url) revoke(url);
        return kept;
      },
      (error: unknown) => {
        this.pending.delete(key);
        throw error;
      },
    );
    this.pending.set(key, job);
    return job;
  }

  revokeAll(revoke: (url: string) => void = URL.revokeObjectURL): void {
    for (const url of this.urls.values()) {
      try {
        if (url.startsWith('blob:')) revoke(url);
      } catch {
        // The URL may already have been revoked with the document.
      }
    }
    this.urls.clear();
    this.pending.clear();
  }
}
