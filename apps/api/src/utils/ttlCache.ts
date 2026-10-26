/**
 * Small in-process TTL cache for public read models.
 *
 * The cache is deliberately bounded and process-local: it removes repeated
 * aggregation work during traffic bursts without becoming a second source of
 * truth. Callers invalidate it after a change that affects public visibility,
 * and TTLs stay short so a missed invalidation cannot expose stale data for
 * long.
 */
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Every TTL cache registers here so process-wide state changes (notably a
 * database disconnect) can drop all cached data at once without creating an
 * import cycle between the database config and feature services.
 */
const cacheRegistry = new Set<{ clear(): void }>();

/** Clears every registered TTL cache (for example after a database loss). */
export function clearAllTtlCaches(): void {
  for (const cache of cacheRegistry) cache.clear();
}

export class TtlCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();
  private readonly inFlight = new Map<string, Promise<T>>();
  private generation = 0;

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 200,
  ) {
    cacheRegistry.add(this);
  }

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (entry === undefined) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T, ttlMs: number = this.ttlMs): void {
    if (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    this.entries.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  /**
   * Returns a cached value or runs (and deduplicates) the loader. Concurrent
   * misses for the same key share one database round trip.
   */
  async getOrLoad(key: string, loader: () => Promise<T>, ttlMs: number = this.ttlMs): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) return cached;

    const pending = this.inFlight.get(key);
    if (pending !== undefined) return pending;

    // A read that started before a mutation must never write its now-stale
    // result into the cleared cache. Capture the generation and only store if
    // no invalidation happened while the loader was running.
    const generation = this.generation;
    const request = loader().then((value) => {
      if (generation === this.generation) {
        this.set(key, value, ttlMs);
      }
      return value;
    });

    const clearInFlight = () => {
      if (this.inFlight.get(key) === request) this.inFlight.delete(key);
    };
    request.then(clearInFlight, clearInFlight);

    this.inFlight.set(key, request);
    return request;
  }

  clear(): void {
    this.generation += 1;
    this.entries.clear();
    this.inFlight.clear();
  }
}
