import { type NextFunction, type Request, type Response } from 'express';

const loginAttempts = new Map<string, { count: number; resetAt: number }>();

export function loginRateLimiter(_req: Request, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) return next();
  const ip = _req.ip || _req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (entry) {
    if (now > entry.resetAt) {
      loginAttempts.set(ip, { count: 1, resetAt: now + 60000 });
      return next();
    }
    entry.count += 1;
    if (entry.count > 5) {
      return res.status(429).json({ error: 'Muitas tentativas de login. Aguarde um minuto e tente novamente.' });
    }
    return next();
  }
  loginAttempts.set(ip, { count: 1, resetAt: now + 60000 });
  return next();
}

export function clearLoginAttempts() {
  loginAttempts.clear();
}
