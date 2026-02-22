import crypto from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { deliveries, medicines, orders, tickets, users, type DeliveryStatus, type Order, type Role, type User } from './data.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolvePublicDir() {
  const candidates = [
    path.resolve(process.cwd(), 'public'),
    path.resolve(__dirname, '../public'),
    path.resolve(__dirname, '../../public')
  ];

  const found = candidates.find((dir) => fs.existsSync(path.join(dir, 'index.html')));
  if (!found) {
    throw new Error('Diretório public não encontrado. Gere os assets ou valide o ambiente de execução.');
  }

  return found;
}

const saleSchema = z.object({
  patientName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(8),
  address: z.string().min(5),
  items: z.array(z.object({ medicineId: z.string(), quantity: z.number().int().positive() })).min(1),
  prescriptionCode: z.string().optional(),
  recurring: z.object({ discountPercent: z.number().min(0).max(100), nextBillingDate: z.string() }).optional()
});

const deliveryUpdateSchema = z.object({
  status: z.enum(['pendente', 'em_rota', 'entregue']).optional(),
  forecastDate: z.string().optional(),
  carrier: z.string().optional()
});

const loginSchema = z.object({ employeeCode: z.string(), password: z.string() });
const paginationSchema = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20) });
const medicineCreateSchema = z.object({
  name: z.string().min(3),
  price: z.coerce.number().positive(),
  lab: z.string().min(2),
  specialty: z.string().min(2),
  controlled: z.coerce.boolean().default(false),
  image: z.string().url().or(z.literal(''))
});

type Session = { user: Omit<User, 'password'>; expiresAt: number };
const sessions = new Map<string, Session>();
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

type AuthenticatedRequest = Request & { authUser: Omit<User, 'password'> };

function getAuthUser(req: Request) {
  return (req as unknown as AuthenticatedRequest).authUser;
}

function createToken() {
  return crypto.randomBytes(24).toString('hex');
}

function cleanExpiredSessions() {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    if (session.expiresAt <= now) sessions.delete(token);
  }
}

function authRequired(req: Request, res: Response, next: NextFunction) {
  cleanExpiredSessions();
  const authHeader = req.header('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  if (!token) return res.status(401).json({ error: 'Token ausente' });

  const session = sessions.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    if (session) sessions.delete(token);
    return res.status(401).json({ error: 'Sessão inválida ou expirada' });
  }

  (req as AuthenticatedRequest).authUser = session.user;
  return next();
}

function authorize(roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authUser = getAuthUser(req);
    if (!roles.includes(authUser.role)) return res.status(403).json({ error: 'Sem permissão para esta operação' });
    next();
  };
}

function getDaysUntil(dateIso: string) {
  return Math.ceil((new Date(dateIso).getTime() - Date.now()) / (24 * 3600 * 1000));
}

function buildRecurringReminders(items: Order[]) {
  return items
    .filter((o) => {
      if (!o.recurring?.needsConfirmation) return false;
      const diffDays = getDaysUntil(o.recurring.nextBillingDate);
      return diffDays >= 0 && diffDays <= 3;
    })
    .map((o) => ({
      orderId: o.id,
      patientName: o.patientName,
      nextBillingDate: o.recurring?.nextBillingDate,
      message: 'Confirmar junto ao cliente a recorrência da compra'
    }));
}

function paginate<T>(items: T[], page: number, pageSize: number) {
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  return {
    items: items.slice(start, end),
    page,
    pageSize,
    total: items.length,
    totalPages: Math.max(1, Math.ceil(items.length / pageSize))
  };
}

export function createApp() {
  const app = express();
  app.use(express.json());
  const publicDir = resolvePublicDir();

  app.get('/health/live', (_, res) => res.json({ status: 'ok' }));
  app.get('/health/ready', (_, res) => res.json({ status: 'ready', sessions: sessions.size }));

  app.post('/api/login', (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Payload inválido' });

    const user = users.find((u) => u.employeeCode === parsed.data.employeeCode && u.password === parsed.data.password);
    if (!user) return res.status(401).json({ error: 'Credenciais inválidas' });

    const token = createToken();
    const safeUser = { id: user.id, name: user.name, role: user.role, employeeCode: user.employeeCode };
    sessions.set(token, { user: safeUser, expiresAt: Date.now() + SESSION_TTL_MS });

    return res.json({ token, expiresInMs: SESSION_TTL_MS, user: safeUser });
  });

  app.post('/api/logout', authRequired, (req, res) => {
    const authHeader = req.header('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    if (token) sessions.delete(token);
    return res.json({ ok: true });
  });

  app.use('/api', authRequired);

  app.get('/api/medicines', (req, res) => {
    const specialty = req.query.specialty?.toString();
    const lab = req.query.lab?.toString();

    let filtered = medicines;
    if (specialty) filtered = filtered.filter((m) => m.specialty === specialty);
    if (lab) filtered = filtered.filter((m) => m.lab === lab);

    res.setHeader('Cache-Control', 'private, max-age=60');
    res.setHeader('ETag', `W/"meds-${filtered.length}"`);

    return res.json({ items: filtered, specialties: [...new Set(medicines.map((m) => m.specialty))], labs: [...new Set(medicines.map((m) => m.lab))] });
  });

  app.post('/api/medicines', authorize(['admin', 'gerente']), (req, res) => {
    const parsed = medicineCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const newMedicine = {
      id: `m${medicines.length + 1}`,
      name: parsed.data.name,
      price: parsed.data.price,
      lab: parsed.data.lab,
      specialty: parsed.data.specialty,
      controlled: parsed.data.controlled,
      image: parsed.data.image || 'https://picsum.photos/seed/med-default/320/220'
    };

    medicines.unshift(newMedicine);
    return res.status(201).json({ item: newMedicine });
  });

  app.post('/api/orders', (req, res) => {
    const parsed = saleSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const authUser = getAuthUser(req);
    const { items, prescriptionCode, recurring } = parsed.data;

    const meds = items.map((item) => {
      const med = medicines.find((m) => m.id === item.medicineId);
      if (!med) return null;
      return {
        medicineId: med.id,
        medicineName: med.name,
        quantity: item.quantity,
        unitPrice: med.price,
        subtotal: med.price * item.quantity,
        controlled: med.controlled
      };
    });

    if (meds.some((m) => !m)) return res.status(400).json({ error: 'Um ou mais medicamentos são inválidos' });
    const validMeds = meds.filter(Boolean) as NonNullable<(typeof meds)[number]>[];

    const hasControlled = validMeds.some((m) => m.controlled);
    if (hasControlled && !prescriptionCode) return res.status(400).json({ error: 'Receita obrigatória para medicamentos controlados.' });

    const totalBruto = validMeds.reduce((acc, item) => acc + item.subtotal, 0);
    const discount = recurring ? totalBruto * (recurring.discountPercent / 100) : 0;
    const total = Number((totalBruto - discount).toFixed(2));

    const orderId = `P-${new Date().getFullYear()}-${String(orders.length + 1).padStart(3, '0')}`;
    const order: Order = {
      id: orderId,
      patientName: parsed.data.patientName,
      email: parsed.data.email,
      phone: parsed.data.phone,
      address: parsed.data.address,
      items: validMeds.map(({ controlled, ...rest }) => rest),
      total,
      controlledValidated: hasControlled,
      createdBy: authUser.id,
      createdAt: new Date().toISOString(),
      recurring: recurring ? { ...recurring, needsConfirmation: true } : undefined
    };

    orders.unshift(order);
    deliveries.unshift({
      orderId: order.id,
      patientName: order.patientName,
      status: 'pendente',
      forecastDate: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString().slice(0, 10),
      carrier: 'Transportadora Interna'
    });

    return res.status(201).json({ order });
  });

  app.get('/api/orders', (req, res) => {
    const pagination = paginationSchema.safeParse(req.query);
    if (!pagination.success) return res.status(400).json({ error: pagination.error.flatten() });
    return res.json(paginate(orders, pagination.data.page, pagination.data.pageSize));
  });

  app.patch('/api/orders/:orderId/recurring/confirm', (req, res) => {
    const authUser = getAuthUser(req);
    const order = orders.find((o) => o.id === req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Pedido não encontrado' });
    if (!order.recurring) return res.status(400).json({ error: 'Pedido não possui recorrência ativa' });

    order.recurring.needsConfirmation = false;
    order.recurring.lastConfirmationAt = new Date().toISOString();
    order.recurring.confirmedBy = authUser.id;

    return res.json({ order });
  });

  app.get('/api/deliveries', (req, res) => {
    const pagination = paginationSchema.safeParse(req.query);
    if (!pagination.success) return res.status(400).json({ error: pagination.error.flatten() });

    const status = req.query.status?.toString() as DeliveryStatus | undefined;
    const q = req.query.q?.toString().toLowerCase();
    let filtered = deliveries;
    if (status) filtered = filtered.filter((d) => d.status === status);
    if (q) filtered = filtered.filter((d) => d.orderId.toLowerCase().includes(q) || d.patientName.toLowerCase().includes(q));

    return res.json(paginate(filtered, pagination.data.page, pagination.data.pageSize));
  });

  app.patch('/api/deliveries/:orderId', authorize(['admin', 'gerente']), (req, res) => {
    const parsed = deliveryUpdateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const target = deliveries.find((d) => d.orderId === req.params.orderId);
    if (!target) return res.status(404).json({ error: 'Entrega não encontrada' });

    Object.assign(target, parsed.data);
    return res.json({ item: target });
  });

  app.get('/api/tickets/:userId', (req, res) => {
    const authUser = getAuthUser(req);
    if (authUser.role === 'operador' && authUser.id !== req.params.userId) return res.status(403).json({ error: 'Sem permissão para visualizar tickets de outro usuário' });

    const items = tickets.filter((t) => t.assignedTo === req.params.userId);
    return res.json({ items });
  });

  app.get('/api/dashboard/:role?', (req, res) => {
    const authUser = getAuthUser(req);
    const totalSales = orders.reduce((acc, order) => acc + order.total, 0);
    const reminders = buildRecurringReminders(orders);

    return res.json({
      role: authUser.role,
      indicators: {
        pedidos: orders.length,
        entregasPendentes: deliveries.filter((d) => d.status !== 'entregue').length,
        ticketsAbertos: tickets.filter((t) => t.status !== 'fechado').length,
        totalSales
      },
      reminders
    });
  });

  app.use(express.static(publicDir));
  app.get('*', (_, res) => res.sendFile(path.join(publicDir, 'index.html')));

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = err instanceof Error ? err.message : 'Erro interno';
    return res.status(500).json({ error: message });
  });

  return app;
}
