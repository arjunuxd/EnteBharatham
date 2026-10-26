import type {
  DatabaseReadyState,
  DetailedHealthResponse,
  HealthResponse,
  ReadinessResponse,
} from '@entebharatham/shared';
import mongoose from 'mongoose';

const READY_STATES: Record<number, DatabaseReadyState> = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

function currentReadyState(): { connected: boolean; readyState: DatabaseReadyState } {
  const readyState = mongoose.connection.readyState;
  return {
    connected: readyState === 1,
    readyState: READY_STATES[readyState] ?? 'disconnected',
  };
}

/** Liveness: the process is running. Always 200 while the API responds. */
export function getHealth(
  verbose: boolean,
  environment: string,
): HealthResponse | DetailedHealthResponse {
  const base: HealthResponse = {
    status: 'ok',
    service: 'entebharatham-api',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
  };

  if (!verbose) {
    return base;
  }

  const detailed: DetailedHealthResponse = {
    ...base,
    environment,
    database: currentReadyState(),
  };
  return detailed;
}

/** Readiness: the database can currently serve requests. */
export function getReadiness(): ReadinessResponse {
  const database = currentReadyState();
  return {
    status: database.connected ? 'ready' : 'unavailable',
    service: 'entebharatham-api',
    timestamp: new Date().toISOString(),
    database,
  };
}
