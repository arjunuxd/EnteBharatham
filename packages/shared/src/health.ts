export interface HealthResponse {
  status: 'ok';
  service: string;
  timestamp: string;
  uptimeSeconds: number;
}

export type DatabaseReadyState = 'disconnected' | 'connected' | 'connecting' | 'disconnecting';

export interface DetailedHealthResponse extends HealthResponse {
  environment: string;
  database: {
    connected: boolean;
    readyState: DatabaseReadyState;
  };
}

/** Response for GET /api/v1/health/ready. HTTP 200 when ready, 503 otherwise. */
export interface ReadinessResponse {
  status: 'ready' | 'unavailable';
  service: string;
  timestamp: string;
  database: {
    connected: boolean;
    readyState: DatabaseReadyState;
  };
}
