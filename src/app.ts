import express, { type NextFunction, type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import {
  addAuditLog,
  createDataStore,
  type DataStore,
  verifyAndMigrateUserPassword,
} from './data.js';

interface AuthPayload {
  userId: string;
  username: string;
  type: 'access' | 'refresh';
  jti?: string;
}

interface RefreshSession {
  userId: string;
  expiresAt: number;
  revoked: boolean;
}

export interface AppOptions {
  jwtSecret?: string;
  accessTokenTtlSeconds?: number;
  refreshTokenTtlSeconds?: number;
  dataStore?: DataStore;
}

interface AuthenticatedRequest extends Request {
  auth?: {
    userId: string;
    username: string;
  };
}

export async function createApp(options: AppOptions = {}) {
  const app = express();
  const store = options.dataStore ?? (await createDataStore());

  const jwtSecret = options.jwtSecret ?? 'dev-secret';
  const accessTokenTtlSeconds = options.accessTokenTtlSeconds ?? 60;
  const refreshTokenTtlSeconds = options.refreshTokenTtlSeconds ?? 7 * 24 * 60 * 60;
  const refreshSessions = new Map<string, RefreshSession>();

  app.use(express.json());

  function issueTokens(user: { id: string; username: string }) {
    const refreshJti = uuidv4();
    const accessToken = jwt.sign(
      { userId: user.id, username: user.username, type: 'access' } satisfies AuthPayload,
      jwtSecret,
      { expiresIn: accessTokenTtlSeconds },
    );
    const refreshToken = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        type: 'refresh',
        jti: refreshJti,
      } satisfies AuthPayload,
      jwtSecret,
      { expiresIn: refreshTokenTtlSeconds },
    );

    refreshSessions.set(refreshJti, {
      userId: user.id,
      expiresAt: Date.now() + refreshTokenTtlSeconds * 1000,
      revoked: false,
    });

    return { accessToken, refreshToken };
  }

  function invalidateRefreshToken(refreshToken: string): boolean {
    try {
      const decoded = jwt.verify(refreshToken, jwtSecret) as AuthPayload;
      if (decoded.type !== 'refresh' || !decoded.jti) {
        return false;
      }

      const session = refreshSessions.get(decoded.jti);
      if (!session) {
        return false;
      }

      session.revoked = true;
      return true;
    } catch {
      return false;
    }
  }

  function authenticateRequest(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const header = req.header('authorization');
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;

    if (!token) {
      return res.status(401).json({ error: 'Token de acesso ausente.' });
    }

    try {
      const decoded = jwt.verify(token, jwtSecret) as AuthPayload;
      if (decoded.type !== 'access') {
        return res.status(401).json({ error: 'Token inválido.' });
      }

      req.auth = { userId: decoded.userId, username: decoded.username };
      return next();
    } catch {
      return res.status(401).json({ error: 'Token expirado ou inválido.' });
    }
  }

  app.post('/api/login', async (req, res) => {
    const { username, password } = req.body as { username?: string; password?: string };

    if (!username || !password) {
      return res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });
    }

    const user = store.users.find((entry) => entry.username === username);
    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    const valid = await verifyAndMigrateUserPassword(user, password);
    if (!valid) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    addAuditLog(store, user.id, 'LOGIN');
    return res.json(issueTokens(user));
  });

  app.post('/api/refresh', (req, res) => {
    const { refreshToken } = req.body as { refreshToken?: string };
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token ausente.' });
    }

    try {
      const decoded = jwt.verify(refreshToken, jwtSecret) as AuthPayload;
      if (decoded.type !== 'refresh' || !decoded.jti) {
        return res.status(401).json({ error: 'Refresh token inválido.' });
      }

      const session = refreshSessions.get(decoded.jti);
      if (!session || session.revoked || session.expiresAt < Date.now()) {
        return res.status(401).json({ error: 'Refresh token expirado/inválido.' });
      }

      session.revoked = true;
      const user = store.users.find((entry) => entry.id === decoded.userId);
      if (!user) {
        return res.status(401).json({ error: 'Usuário não encontrado.' });
      }

      return res.json(issueTokens(user));
    } catch {
      return res.status(401).json({ error: 'Refresh token inválido.' });
    }
  });

  app.post('/api/logout', (req, res) => {
    const { refreshToken } = req.body as { refreshToken?: string };
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token ausente.' });
    }

    if (!invalidateRefreshToken(refreshToken)) {
      return res.status(401).json({ error: 'Refresh token inválido.' });
    }

    return res.status(204).send();
  });

  app.use('/api/orders', authenticateRequest);
  app.use('/api/deliveries', authenticateRequest);
  app.use('/api/tickets', authenticateRequest);
  app.use('/api/dashboard', authenticateRequest);

  app.get('/api/orders', (req: AuthenticatedRequest, res) => {
    const orders = store.orders.filter((order) => order.userId === req.auth?.userId);
    return res.json(orders);
  });

  app.post('/api/orders', (req: AuthenticatedRequest, res) => {
    const { description } = req.body as { description?: string };
    if (!description) {
      return res.status(400).json({ error: 'Descrição é obrigatória.' });
    }

    const order = {
      id: `o${store.orders.length + 1}`,
      userId: req.auth!.userId,
      description,
      recurringConfirmed: false,
    };

    store.orders.push(order);
    addAuditLog(store, req.auth!.userId, 'CREATE_ORDER');
    return res.status(201).json(order);
  });

  app.post('/api/orders/:id/confirm-recurrence', (req: AuthenticatedRequest, res) => {
    const order = store.orders.find(
      (entry) => entry.id === req.params.id && entry.userId === req.auth!.userId,
    );
    if (!order) {
      return res.status(404).json({ error: 'Pedido não encontrado.' });
    }

    order.recurringConfirmed = true;
    addAuditLog(store, req.auth!.userId, 'CONFIRM_RECURRENCE');
    return res.json(order);
  });

  app.get('/api/deliveries', (req: AuthenticatedRequest, res) => {
    const deliveries = store.deliveries.filter((delivery) => delivery.userId === req.auth?.userId);
    return res.json(deliveries);
  });

  app.patch('/api/deliveries/:id', (req: AuthenticatedRequest, res) => {
    const delivery = store.deliveries.find(
      (entry) => entry.id === req.params.id && entry.userId === req.auth!.userId,
    );
    if (!delivery) {
      return res.status(404).json({ error: 'Entrega não encontrada.' });
    }

    delivery.status = (req.body as { status?: string }).status ?? delivery.status;
    addAuditLog(store, req.auth!.userId, 'UPDATE_DELIVERY');
    return res.json(delivery);
  });

  app.get('/api/tickets', (req: AuthenticatedRequest, res) => {
    const tickets = store.tickets.filter((ticket) => ticket.userId === req.auth?.userId);
    return res.json(tickets);
  });

  app.get('/api/dashboard', (req: AuthenticatedRequest, res) => {
    const userId = req.auth!.userId;
    const metrics = {
      orders: store.orders.filter((order) => order.userId === userId).length,
      deliveries: store.deliveries.filter((delivery) => delivery.userId === userId).length,
      tickets: store.tickets.filter((ticket) => ticket.userId === userId).length,
    };

    return res.json(metrics);
  });

  app.get('/api/audit-logs', (_req, res) => {
    return res.json(store.auditLogs);
  });

  return { app, store };
}
