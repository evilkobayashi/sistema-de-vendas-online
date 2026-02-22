import type { NextFunction, Request, Response } from 'express';
import { hasPermission, type Permission, type Role } from './permissions';

export interface AuthenticatedUser {
  id: string;
  role: Role;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthenticatedUser;
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const userId = req.header('x-user-id');
  const role = req.header('x-user-role') as Role | undefined;

  if (!userId || !role) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Usuário não autenticado.' });
    return;
  }

  req.user = { id: userId, role };
  next();
}

export function authorize(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user;

    if (!user || !hasPermission(user.role, permission)) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Permissão insuficiente.' });
      return;
    }

    next();
  };
}
