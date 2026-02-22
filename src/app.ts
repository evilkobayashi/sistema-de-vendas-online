import express, { NextFunction, Request, Response } from 'express';
import pino from 'pino';
import client from 'prom-client';
import { randomUUID } from 'crypto';

export interface DependencyProbe {
  db: () => Promise<boolean>;
  queue: () => Promise<boolean>;
}

export interface ErrorPayload {
  code: string;
  message: string;
  details: unknown;
}

export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details: unknown = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry });

const routeLatencyMs = new client.Histogram({
  name: 'http_request_duration_ms',
  help: 'Latência de requests por rota',
  registers: [registry],
  labelNames: ['method', 'route', 'status_code']
});

const httpErrorsTotal = new client.Counter({
  name: 'http_errors_total',
  help: 'Erros HTTP por classe',
  registers: [registry],
  labelNames: ['class', 'route']
});

const orderEvents = new client.Counter({
  name: 'order_events_total',
  help: 'Volume de pedidos e confirmação de recorrência',
  registers: [registry],
  labelNames: ['event']
});

export function createApp(probes: DependencyProbe) {
  const app = express();
  app.use(express.json());

  app.use((req, res, next) => {
    const requestId = req.header('x-request-id') || randomUUID();
    res.setHeader('x-request-id', requestId);
    res.locals.requestId = requestId;
    res.locals.startAt = process.hrtime.bigint();

    logger.info({ requestId, method: req.method, path: req.path }, 'request_started');
    res.on('finish', () => {
      const elapsedNs = Number(process.hrtime.bigint() - res.locals.startAt);
      const elapsedMs = elapsedNs / 1_000_000;
      const route = req.route?.path || req.path;
      routeLatencyMs.observe({ method: req.method, route, status_code: res.statusCode }, elapsedMs);

      if (res.statusCode >= 400) {
        const errorClass = res.statusCode >= 500 ? '5xx' : '4xx';
        httpErrorsTotal.inc({ class: errorClass, route });
      }

      logger.info(
        { requestId, method: req.method, path: req.path, statusCode: res.statusCode, elapsedMs },
        'request_finished'
      );
    });

    next();
  });

  app.get('/health/live', (_req, res) => {
    res.status(200).json({ status: 'live' });
  });

  app.get('/health/ready', async (_req, res, next) => {
    try {
      const [db, queue] = await Promise.all([probes.db(), probes.queue()]);
      const ready = db && queue;
      res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'degraded', dependencies: { db, queue } });
    } catch (error) {
      next(new AppError(503, 'DEPENDENCY_CHECK_FAILED', 'Falha ao validar dependências', error));
    }
  });

  app.post('/orders', (_req, res) => {
    orderEvents.inc({ event: 'orders' });
    res.status(202).json({ status: 'accepted' });
  });

  app.post('/orders/recurrence/confirm', (_req, res) => {
    orderEvents.inc({ event: 'recurrence_confirmation' });
    res.status(200).json({ status: 'confirmed' });
  });

  app.get('/metrics', async (_req, res) => {
    res.set('Content-Type', registry.contentType);
    res.send(await registry.metrics());
  });

  app.get('/boom', () => {
    throw new AppError(400, 'INVALID_ORDER', 'Pedido inválido', { field: 'id' });
  });

  app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
    const requestId = res.locals.requestId;
    const appError =
      error instanceof AppError
        ? error
        : new AppError(500, 'INTERNAL_ERROR', 'Erro interno inesperado', process.env.NODE_ENV === 'production' ? null : error);

    const payload: ErrorPayload = {
      code: appError.code,
      message: appError.message,
      details: appError.details
    };

    logger.error({ requestId, err: error, payload }, 'request_error');
    res.status(appError.status).json(payload);
  });

  return app;
}
