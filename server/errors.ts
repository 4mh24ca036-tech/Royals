import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Error carrying an explicit HTTP status and a message safe to show to clients.
 */
export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

/**
 * Wraps an async route handler so rejected promises reach the express error handler
 * instead of being lost as unhandled rejections.
 */
export function asyncHandler(handler: (req: any, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export function apiNotFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: `Unknown API endpoint: ${req.method} ${req.originalUrl}` });
}

export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) {
    return next(err);
  }

  const status = err instanceof HttpError ? err.status : 500;
  const message =
    err instanceof HttpError
      ? err.message
      : 'An internal server error occurred. Please try again or contact support.';

  if (status >= 500) {
    console.error(`[ROYALS] ${req.method} ${req.originalUrl} failed:`, err);
  }

  res.status(status).json({ error: message });
}
