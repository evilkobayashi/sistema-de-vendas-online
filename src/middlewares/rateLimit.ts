import { type NextFunction, type Request, type Response } from 'express';

const loginAttempts = new Map<string, { count: number; resetAt: number }>();

// Limite de tentativas de login por IP
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 60000; // 1 minuto

export function loginRateLimiter(_req: Request, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) return next();

  // Obter IP real considerando proxies
  const ip = _req.ip ||
         _req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
         _req.socket.remoteAddress ||
         'unknown';

  const now = Date.now();
  const entry = loginAttempts.get(ip);

  if (entry) {
    if (now > entry.resetAt) {
      // Reiniciar contador após o período de tempo
      loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
      return next();
    }

    // Incrementar tentativas
    entry.count += 1;

    if (entry.count > MAX_LOGIN_ATTEMPTS) {
      // Adicionando cabeçalhos úteis para o cliente
      res.setHeader('Retry-After', Math.floor((entry.resetAt - now) / 1000).toString());
      return res.status(429).json({
        error: 'Muitas tentativas de login. Aguarde um minuto e tente novamente.',
        retryAfter: Math.floor((entry.resetAt - now) / 1000)
      });
    }

    return next();
  }

  // Primeira tentativa
  loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
  return next();
}

// Middleware genérico de rate limiting para outros endpoints
export function createRateLimiter(windowMs: number, maxRequests: number) {
  const attempts = new Map<string, { count: number; resetAt: number }>();

  return function rateLimiter(req: Request, res: Response, next: NextFunction) {
    if (process.env.NODE_ENV === 'test' || process.env.VITEST) return next();

    const ip = req.ip ||
           req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
           req.socket.remoteAddress ||
           'unknown';

    const now = Date.now();
    const entry = attempts.get(ip);

    if (entry) {
      if (now > entry.resetAt) {
        attempts.set(ip, { count: 1, resetAt: now + windowMs });
        return next();
      }

      entry.count += 1;

      if (entry.count > maxRequests) {
        res.setHeader('Retry-After', Math.floor((entry.resetAt - now) / 1000).toString());
        return res.status(429).json({
          error: 'Limite de requisições excedido. Tente novamente mais tarde.',
          retryAfter: Math.floor((entry.resetAt - now) / 1000)
        });
      }

      return next();
    }

    attempts.set(ip, { count: 1, resetAt: now + windowMs });
    return next();
  };
}

export function clearLoginAttempts() {
  loginAttempts.clear();
}

export function clearAllRateLimits() {
  loginAttempts.clear();
}
