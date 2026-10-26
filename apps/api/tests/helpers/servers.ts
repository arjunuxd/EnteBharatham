import http from 'http';
import type { Express } from 'express';

/**
 * Binds an app to a real loopback port for the duration of a test.
 *
 * SuperTest starts and stops an ephemeral server for each request when it is
 * handed an Express app directly; under a fast sequence of requests that
 * start/stop race can surface as `Cannot read properties of null (reading
 * 'address')`. Passing an already-listening server avoids the race and also
 * exercises the same HTTP stack as production.
 */
export async function listen(app: Express): Promise<http.Server> {
  const server = http.createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject);
      resolve();
    });
  });
  return server;
}

export async function closeServer(server: http.Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
