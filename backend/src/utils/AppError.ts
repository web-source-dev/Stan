/**
 * Operational error with an HTTP status and a stable, client-safe code.
 * Anything thrown that is NOT an AppError is treated as an unexpected 500.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly isOperational = true;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }

  static badRequest(message: string, details?: unknown) {
    return new AppError(400, 'bad_request', message, details);
  }
  static unauthorized(message = 'Authentication required') {
    return new AppError(401, 'unauthorized', message);
  }
  static forbidden(message = 'You do not have access to this resource') {
    return new AppError(403, 'forbidden', message);
  }
  static notFound(message = 'Resource not found') {
    return new AppError(404, 'not_found', message);
  }
  static conflict(message: string, details?: unknown) {
    return new AppError(409, 'conflict', message, details);
  }
  static tooMany(message = 'Too many requests') {
    return new AppError(429, 'rate_limited', message);
  }
  static internal(message = 'Something went wrong') {
    return new AppError(500, 'internal_error', message);
  }
}
