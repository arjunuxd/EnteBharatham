/**
 * Application error carrying an HTTP status code, a stable machine-readable
 * error code, and optional safe details (e.g. which fields are missing).
 * Throw (or pass to next()) from services/controllers; the centralized error
 * handler turns it into a safe JSON response.
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code: string = 'ERROR',
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
