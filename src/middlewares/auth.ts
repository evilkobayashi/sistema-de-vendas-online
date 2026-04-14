import jwt from 'jsonwebtoken';
import { type NextFunction, type Request, type Response } from 'express';
import { users, sessions, type Role, type User, type Permission, hasPermission } from '../data.js';

const JWT_SECRET = process.env.JWT_SECRET;
export { JWT_SECRET };

export type AuthenticatedRequest = Request & { authUser: Omit<User, 'password'> };

export function getAuthUser(req: Request) {
  return (req as AuthenticatedRequest).authUser;
}

export function authRequired(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.header('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token ausente ou formato inválido' });
  }

  const token = authHeader.slice(7);

  if (!token || token.split('.').length !== 3) {
    return res.status(401).json({ error: 'Token inválido ou corrompido' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET!) as Omit<User, 'password'>;

    if (!payload.id || !payload.role) {
      return res.status(401).json({ error: 'Token inválido - informações ausentes' });
    }

    const user = users.find((u) => u.id === payload.id);
    if (!user || !user.active) {
      return res.status(401).json({ error: 'Usuário desativado ou não existe' });
    }

    const existingSession = sessions.find((s) => s.token === token);
    if (existingSession) {
      existingSession.lastActivity = new Date().toISOString();
    } else {
      sessions.push({
        token,
        userId: payload.id,
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        ipAddress: req.ip,
      });
    }

    (req as AuthenticatedRequest).authUser = payload;
    return next();
  } catch {
    console.warn('Tentativa de autenticação com token inválido:', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString(),
    });

    return res.status(401).json({ error: 'Sessão inválida ou expirada' });
  }
}

export function authorize(roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authUser = getAuthUser(req);

    if (!authUser) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    if (!roles.includes(authUser.role)) {
      console.warn('Tentativa de acesso não autorizado:', {
        userId: authUser.id,
        userName: authUser.name,
        attemptedRole: authUser.role,
        requiredRoles: roles,
        endpoint: req.path,
        ip: req.ip,
        timestamp: new Date().toISOString(),
      });

      return res.status(403).json({ error: 'Sem permissão para esta operação' });
    }

    return next();
  };
}

export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authUser = getAuthUser(req);

    if (!authUser) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    if (!hasPermission(authUser.role, permission)) {
      console.warn('Tentativa de acesso sem permissão:', {
        userId: authUser.id,
        userName: authUser.name,
        role: authUser.role,
        requiredPermission: permission,
        endpoint: req.path,
        ip: req.ip,
        timestamp: new Date().toISOString(),
      });

      return res.status(403).json({ error: 'Sem permissão para esta operação' });
    }

    return next();
  };
}

export async function loginHandler(req: Request, res: Response) {
  const { employeeCode, password } = req.body as { employeeCode: string; password: string };

  if (!employeeCode || !password) {
    return res.status(400).json({ error: 'Código de funcionário e senha são obrigatórios' });
  }

  const employeeCodeTrimmed = employeeCode.toString().trim();
  const passwordTrimmed = password.toString().trim();

  if (employeeCodeTrimmed.length > 50) {
    return res.status(400).json({ error: 'Código de funcionário muito longo' });
  }

  if (passwordTrimmed.length > 100) {
    return res.status(400).json({ error: 'Senha muito longa' });
  }

  const employeeCodeNormalized = employeeCodeTrimmed.toUpperCase();

  const user = users.find((u) => u.employeeCode.trim().toUpperCase() === employeeCodeNormalized);
  if (!user) {
    const bcrypt = await import('bcrypt');
    await bcrypt.default.compare(passwordTrimmed, '$2b$10$invalid');
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  if (!user.active) {
    return res.status(401).json({ error: 'Usuário desativado. Contacte o administrador.' });
  }

  const bcrypt = await import('bcrypt');
  const passwordMatch = await bcrypt.default.compare(passwordTrimmed, user.password);
  if (!passwordMatch) return res.status(401).json({ error: 'Credenciais inválidas' });

  const safeUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    employeeCode: user.employeeCode,
  };
  const token = jwt.sign(safeUser, JWT_SECRET!, { expiresIn: '24h' });

  sessions.push({
    token,
    userId: user.id,
    createdAt: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
    ipAddress: req.ip,
  });

  return res.json({ token, expiresInMs: 24 * 60 * 60 * 1000, user: safeUser });
}
