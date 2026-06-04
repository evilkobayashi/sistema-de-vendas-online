import crypto from 'node:crypto';
import { type NextFunction, type Request, type Response } from 'express';

export function requestIdMiddleware(_req: Request, res: Response, next: NextFunction) {
  const id = `req-${crypto.randomUUID().slice(0, 13).toUpperCase()}`;
  res.setHeader('X-Request-Id', id);
  next();
}
