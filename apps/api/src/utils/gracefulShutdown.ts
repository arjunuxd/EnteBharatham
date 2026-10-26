export interface ShutdownDependencies {
  /** Closes the HTTP server (stops accepting connections). */
  closeServer: () => Promise<void>;
  /** Closes the database connection. */
  closeDatabase: () => Promise<void>;
  /** Closes other owned resources (session store, email pool, ...). */
  closeStores?: () => Promise<void>;
  /** Process exit with the given code. */
  exit: (code: number) => void;
  /** Maximum time to wait before forcing exit. Defaults to 10 seconds. */
  timeoutMs?: number;
}

/**
 * Builds a signal handler that closes the HTTP server and database exactly
 * once, then exits. A second signal (or a hang in either close) forces a
 * non-zero exit after the timeout so shutdown never leaves the process
 * hanging. Extracted from server.ts so the behavior is unit-testable.
 */
export function createShutdownHandler(deps: ShutdownDependencies): (signal: string) => void {
  const timeoutMs = deps.timeoutMs ?? 10_000;
  let started = false;

  return (signal: string): void => {
    if (started) return;
    started = true;
    console.log(`[server] received ${signal}, shutting down`);

    const forceExit = setTimeout(() => {
      console.error('[server] shutdown timed out, forcing exit');
      deps.exit(1);
    }, timeoutMs);
    forceExit.unref();

    void Promise.allSettled([
      deps.closeServer(),
      deps.closeDatabase(),
      ...(deps.closeStores !== undefined ? [deps.closeStores()] : []),
    ]).then(() => {
      clearTimeout(forceExit);
      deps.exit(0);
    });
  };
}
