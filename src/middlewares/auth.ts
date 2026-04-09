import jwt from 'jsonwebtoken';
import { type NextFunction, type Request, type Response } from 'express';
import { users, type Role, type User } from '../data.js';

const JWT_SECRET = process.env.JWT_SECRET ?? crypto.randomUUID();
export { JWT_SECRET };

export type AuthenticatedRequest = Request & { authUser: Omit<User, 'password'> };

export function getAuthUser(req: Request) {
  return (req as AuthenticatedRequest).authUser;
}

export function authRequired(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.header('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  if (!token) return res.status(401).json({ error: 'Token ausente' });
  try {
    const payload = jwt.verify(token, JWT_SECRET) as Omit<User, 'password'>;
    (req as AuthenticatedRequest).authUser = payload;
    return next();
  } catch {
    return res.status(401).json({ error: 'Sessão inválida ou expirada' });
  }
}

export function authorize(roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authUser = getAuthUser(req);
    if (!roles.includes(authUser.role)) return res.status(403).json({ error: 'Sem permissão para esta operação' });
    return next();
  };
}

export async function loginHandler(req: Request, res: Response) {
  const { employeeCode, password } = req.body as { employeeCode: string; password: string };
  const employeeCodeNormalized = employeeCode.trim().toUpperCase();

  const user = users.find((u) => u.employeeCode.trim().toUpperCase() === employeeCodeNormalized);
  if (!user) return res.status(401).json({ error: 'Credenciais inválidas' });

  const bcrypt = await import('bcrypt');
  const passwordMatch = await bcrypt.default.compare(password.trim(), user.password);
  if (!passwordMatch) return res.status(401).json({ error: 'Credenciais inválidas' });

  const safeUser = { id: user.id, name: user.name, role: user.role, employeeCode: user.employeeCode };
  const token = jwt.sign(safeUser, JWT_SECRET, { expiresIn: '8h' });

  return res.json({ token, expiresInMs: 8 * 60 * 60 * 1000, user: safeUser });
}
