import { type NextFunction, type Request, type Response } from 'express';

export function requestLogger(_req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on('finish', () => {
    const method = _req.method;
    const url = _req.originalUrl;
    const status = res.statusCode;
    const duration = Date.now() - start;
    const logLevel = status >= 500 ? 'ERROR' : status >= 400 ? 'WARN' : 'INFO';
    if (process.env.NODE_ENV !== 'test') {
      console.error(`[${logLevel}] ${method} ${url} ${status} ${duration}ms`);
    }
  });

  next();
}
