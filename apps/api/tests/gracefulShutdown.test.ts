import { describe, expect, it, vi } from 'vitest';
import { createShutdownHandler } from '../src/utils/gracefulShutdown.js';

describe('createShutdownHandler', () => {
  it('closes the server and database, then exits zero', async () => {
    const closeServer = vi.fn().mockResolvedValue(undefined);
    const closeDatabase = vi.fn().mockResolvedValue(undefined);
    const exit = vi.fn();

    const shutdown = createShutdownHandler({ closeServer, closeDatabase, exit });
    shutdown('SIGTERM');
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0));
    expect(closeServer).toHaveBeenCalledTimes(1);
    expect(closeDatabase).toHaveBeenCalledTimes(1);
  });

  it('runs only once even if multiple signals arrive', async () => {
    const closeServer = vi.fn().mockResolvedValue(undefined);
    const closeDatabase = vi.fn().mockResolvedValue(undefined);
    const exit = vi.fn();

    const shutdown = createShutdownHandler({ closeServer, closeDatabase, exit });
    shutdown('SIGINT');
    shutdown('SIGTERM');
    shutdown('SIGINT');

    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0));
    expect(closeServer).toHaveBeenCalledTimes(1);
    expect(closeDatabase).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledTimes(1);
  });

  it('still exits when a close operation rejects', async () => {
    const exit = vi.fn();

    const shutdown = createShutdownHandler({
      closeServer: vi.fn().mockRejectedValue(new Error('close failed')),
      closeDatabase: vi.fn().mockResolvedValue(undefined),
      exit,
    });
    shutdown('SIGTERM');

    await vi.waitFor(() => expect(exit).toHaveBeenCalled());
  });

  it('forces a non-zero exit when shutdown hangs past the timeout', async () => {
    const exit = vi.fn();

    const shutdown = createShutdownHandler({
      closeServer: () => new Promise<void>(() => {}),
      closeDatabase: () => new Promise<void>(() => {}),
      exit,
      timeoutMs: 20,
    });
    shutdown('SIGTERM');

    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(1), { timeout: 2000 });
  });
});
