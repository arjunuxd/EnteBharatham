import { describe, expect, it } from 'vitest';
import { TtlCache } from '../src/utils/ttlCache.js';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('TtlCache', () => {
  it('deduplicates concurrent loads for the same key', async () => {
    const cache = new TtlCache<string>(60_000, 10);
    const gate = deferred<string>();
    let loads = 0;

    const loader = () => {
      loads += 1;
      return gate.promise;
    };

    const first = cache.getOrLoad('shared', loader);
    const second = cache.getOrLoad('shared', loader);
    gate.resolve('value');

    await expect(first).resolves.toBe('value');
    await expect(second).resolves.toBe('value');
    expect(loads).toBe(1);
  });

  it('returns a cached value without calling the loader again', async () => {
    const cache = new TtlCache<string>(60_000, 10);
    let loads = 0;
    const loader = async () => {
      loads += 1;
      return `value-${loads}`;
    };

    expect(await cache.getOrLoad('key', loader)).toBe('value-1');
    expect(await cache.getOrLoad('key', loader)).toBe('value-1');
    expect(loads).toBe(1);
  });

  it('does not repopulate the cache when a pre-clear read resolves late', async () => {
    const cache = new TtlCache<string>(60_000, 10);
    const gate = deferred<string>();

    const staleRead = cache.getOrLoad('key', () => gate.promise);
    cache.clear();
    gate.resolve('stale');
    await expect(staleRead).resolves.toBe('stale');

    const fresh = await cache.getOrLoad('key', async () => 'fresh');
    expect(fresh).toBe('fresh');
  });
});
